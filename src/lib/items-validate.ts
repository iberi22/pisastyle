/**
 * Reglas de calidad para los bundles de items PISA (`items/<domain>/<lang>/*.md`).
 *
 * — POR QUE ES UNA LIB Y NO UN SCRIPT —
 * La lógica vive aquí, en funciones puras sobre strings, y
 * `scripts/validate-items.mjs` es solo el shell de CI (glob + exit code). Así las
 * 15 reglas se testean sin tocar el disco y el gate se puede invocar desde
 * cualquier sitio.
 *
 * — LAS 15 REGLAS NO SON INVENTADAS —
 * Cada una existe porque el defecto que atrapa ya ocurrió de verdad en el repo
 * hermano `worldexams` (4000 preguntas) o en este: duplicados que se colaron,
 * bundles enteros marcados en `A`, tokens pegados del estilo `energy-social`,
 * mojibake de una traducción, explicaciones de una línea que no explican nada.
 *
 * — NUNCA LANZA —
 * Un fichero roto produce hallazgos, no excepciones. Un validador que se cae en
 * el primer item mal deja el resto del banco sin mirar, que es exactamente el
 * "falso verde" que este módulo evita.
 */

/** Nombre estable de cada regla. Aparece tal cual en la salida del gate. */
export const RULE = {
  frontmatterMissing: 'frontmatter-missing',
  protocolFieldMissing: 'protocol-field-missing',
  protocolVersion: 'protocol-version',
  sourcesMissing: 'sources-missing',
  explanation: 'explanation',
  answerLetterBias: 'answer-letter-bias',
  duplicateQuestion: 'duplicate-question',
  duplicateIgnoringContext: 'duplicate-ignoring-context',
  allNoneOfAbove: 'all-none-of-above',
  optionLetters: 'option-letters',
  foreignScript: 'foreign-script',
  gluedToken: 'glued-token',
  controlCharsEncoding: 'control-chars-encoding',
  malformedOptionRow: 'malformed-option-row',
  placeholder: 'placeholder',
} as const;

/**
 * Reglas estructurales y de catalogo: NO son parte de las 15, pero el banco no
 * las perdona. `RULE` queda clavada en las 15 del encargo para que un test
 * pueda contar exactamente esas; lo que se anada va aqui.
 */
export const STRUCT = {
  missingItemHeaders: 'missing-item-headers',
  itemCountMismatch: 'item-count-mismatch',
  anchorUnknown: 'anchor-unknown',
  anchorDomainMismatch: 'anchor-domain-mismatch',
} as const;

export type Severity = 'ERROR' | 'WARNING';

export interface Finding {
  rule: string;
  severity: Severity;
  file: string;
  /** 1-based; 0 para hallazgos a nivel de fichero. */
  item: number;
  message: string;
}

export interface ValidationReport {
  files: number;
  items: number;
  errors: number;
  warnings: number;
  findings: Finding[];
}

export const EXPECTED_PROTOCOL_VERSION = 'v1.1';
export const MIN_EXPLANATION_CHARS = 80;
export const MAX_ANSWER_LETTER_SHARE = 0.5;
export const MIN_OPTIONS_PER_ITEM = 2;
/** Por debajo de este numero de items el reparto de letras no es interpretable. */
export const MIN_ITEMS_FOR_LETTER_BIAS = 2;

/** Los 8 campos obligatorios por item (PISAStyle protocol v1.1, seccion 2). */
export const REQUIRED_ITEM_FIELDS = [
  'domain',
  'process',
  'content',
  'context',
  'format',
  'demand',
  'level',
  'anchor',
] as const;

/* ------------------------------------------------------------------ */
/* Anclas PISAreleased — verificadas contra la propia pagina de la OCDE */
/* ------------------------------------------------------------------ */

/**
 * Las unidades que la OCDE publica en `pisa2022-questions.oecd.org` y en
 * `pisa2018-questions.oecd.org`. NO es una lista inventada: cada codigo sale de
 * las URLs de la plataforma, que son `platform/index.html?domain=<D>&unit=<U>`.
 *
 * El prefijo NO indica el dominio, asi que el dominio va en el propio catalogo:
 *
 *  - MA*  → MAT (matematicas)
 *  - R*   → lectura PISA 2018 (`pisa2018-questions.oecd.org`)
 *  - CR*  → unidades del PDF "PISA2018 Released REA Items" (los codigos de la
 *           la plataforma online son R*, sin la C)
 *  - T*   → CRT (PENSAMIENTO CREATIVO). OJO: estas NO son de lectura. Un item
 *           de comprension lectora anclado a T400 esta MAL etiquetado.
 *  - F*   → LDW (resolucion de problemas digitales)
 */
export const RELEASED_UNITS: Record<string, readonly string[]> = {
  math: [
    'MA104-CarPurchase',
    'MA106-DVDSales',
    'MA118-MovingTruck',
    'MA123-SolarSystem',
    'MA150-TriangularPattern',
    'MA156-Points',
    'MA159-Spinners',
    'MA161-ForestedAreas',
  ],
  reading: [
    'CR548-ChickenForum',
    'CR551-RapaNui',
    'CR557-CowsMilk',
    'CR571-GalapagosIslands',
    'R548-ChickenForum',
    'R551-RapaNui',
    'R557-CowsMilk',
  ],
  /** PENSAMIENTO CREATIVO: tareas abiertas de generar una idea. */
  creativeThinking: [
    'T400-SaveTheBees',
    'T500-WheelchairAccessibleLibrary',
    'T570-RobotStory',
    'T630-Carpooling',
    'T690-SaveTheRiver',
  ],
  digital: ['F082-NewBike', 'F403-SellingOnline'],
} as const;

/** Todas las unidades conocidas, indexadas por su dominio real. */
const ANCHOR_DOMAIN_BY_CODE = new Map<string, string>();
for (const [domain, codes] of Object.entries(RELEASED_UNITS)) {
  for (const code of codes) ANCHOR_DOMAIN_BY_CODE.set(code, domain);
}

/** Nombre legible de cada familia de dominios, para los mensajes de error. */
const DOMAIN_LABEL: Record<string, string> = {
  math: 'matematicas',
  reading: 'lectura',
  creativeThinking: 'PENSAMIENTO CREATIVO (tareas abiertas, no multiple choice)',
  digital: 'lectura digital de problemas',
};

/**
 * Sugiere la unidad real mas parecida a un ancla inventada. Solo ayuda a que
 * el mensaje sea accionable ("quiza querias decir MA123-SolarSystem"); no
 * decide nada.
 */
function closestReleased(anchor: string): string | undefined {
  const codigo = anchor.split('-')[0]?.toLowerCase() ?? '';
  const cola = anchor.slice(anchor.indexOf('-') + 1).toLowerCase();
  if (!cola) return undefined;
  const candidatos = [...ANCHOR_DOMAIN_BY_CODE.keys()];
  const puntuados = candidatos
    .map((c) => {
      const partes = c.toLowerCase().split('-');
      const cCola = partes.slice(1).join('');
      let puntos = 0;
      if (partes[0] === codigo) puntos += 3;
      if (cCola === cola) puntos += 5;
      else if (cCola.includes(cola) || cola.includes(cCola)) puntos += 2;
      return { c, puntos };
    })
    .filter((x) => x.puntos >= 5)
    .sort((a, b) => b.puntos - a.puntos);
  return puntuados[0]?.c;
}

/** Dominios que el banco admite, y a que unidades pueden anclarse. */
const DOMAIN_ANCHOR_FAMILY: Record<string, readonly string[]> = {
  math: ['math'],
  reading: ['reading'],
  science: [], // ningun dominio liberado es de ciencias: la ciencia PISA no
  //             publica unidades released, asi que un ancla de ciencia debe
  //             ser un contexto cros-curricular (matematicas o lectura).
  digital: ['digital'],
};

export interface ItemFileInput {
  path: string;
  content: string;
}

/* ------------------------------------------------------------------ */
/* Patrones                                                           */
/* ------------------------------------------------------------------ */

/** Fila de opcion bien formada: `- [x] A) texto`. */
const OPTION_ROW = /^\s*[-*]\s*\[([ xX])\]\s*([A-Za-z])\)\s*(.*\S)\s*$/;
/** Fila que QUIERE ser opcion pero no encaja (le falta marca, letra o texto). */
const OPTION_ROW_LOOSE = /^\s*[-*]\s*(?:\[[^\]]*\]|[A-Za-z][).:])/;

const ALL_NONE_OF_ABOVE =
  /\b(?:todas\s+las\s+(?:anteriores|opciones)|ninguna\s+de\s+las\s+(?:anteriores|opciones)|todas\s+est(?:a|as)\s+anteriores|all\s+of\s+the\s+above|none\s+of\s+the\s+above|any\s+of\s+the\s+above)\b/i;

// Los marcadores de relleno son SIGLAS en mayusculas: TODO, FIXME, TBD, XXX,
// PLACEHOLDER. Sin flag `i` global a proposito: con el flag, "todo el pais"
// (es) y "todos os alunos" (pt) saltaban como relleno, y los items de lectura los
// usan como palabras normales. El coste es que la sigla se escribe en
// mayusculas, que es como se escribe un marcador de relleno de verdad.
//
// Las cadenas colapsadas (`lorem ipsum`, `???`) si son insensibles a mayusculas,
// asi que llevan su propio grupo `(?i:...)` en vez del flag global.
const PLACEHOLDER =
  /\bTODO\b|\bFIXME\b|\bTBD\b|\bXXX+\b|\bPLACEHOLDER\b|(?i:lorem\s+ipsum|\?{3,})/;

const GLUED_TOKEN = /[A-Za-z]{3,}-[A-Za-z]{3,}/;

/** Bloques de codigo y URLs: se limpian antes de buscar texto pegado. */
const FENCE = /```[\s\S]*?```/g;
const INLINE_CODE = /`[^`\n]*`/g;
const URLISH = /\b(?:https?:\/\/|mailto:)\S+|\[[^\]]*\]\([^)]*\)/g;

/** Mojibake: doble codificacion UTF-8 leida como latin-1. */
const MOJIBAKE = /[\u00C2\u00C3\u00E2\u00EF][\u0080-\u00BF\u2018\u2019\u201C\u201D]|\uFFFD/;

/** Rangos de caracteres que no pertenecen a un item en es/en/pt. */
const FOREIGN_RANGES: [number, number, string][] = [
  [0x0370, 0x04ff, 'griego/cirilico'],
  [0x0500, 0x052f, 'cirilico'],
  [0x0590, 0x06ff, 'hebreo/arabe/siriaco'],
  [0x0900, 0x0dff, 'indic'],
  [0x1100, 0x11ff, 'hangul jamo'],
  [0x2e80, 0x2fff, 'CJK radicales'],
  [0x3000, 0x9fff, 'CJK'],
  [0xac00, 0xd7af, 'hangul'],
  [0xf900, 0xfaff, 'CJK compatibilidad'],
  [0xff00, 0xffef, 'CJK formas'],
  [0x0100, 0x024f, 'latin extendido'],
  [0x1e00, 0x1eff, 'latin extendido adicional'],
  [0x2c60, 0x2c7f, 'latin extended-C'],
  [0xa720, 0xa7ff, 'latin extendido-D'],
];

/* ------------------------------------------------------------------ */
/* Parsing                                                            */
/* ------------------------------------------------------------------ */

interface ParsedOption {
  letter: string;
  text: string;
  correct: boolean;
}

interface ParsedItem {
  index: number;
  question: string;
  context: string;
  options: ParsedOption[];
  malformed: string[];
  correctLetters: string[];
  explanation: string;
  fields: Record<string, string>;
  sources: string[];
}

interface ParsedFile {
  frontmatter: Record<string, string[]> | null;
  items: ParsedItem[];
}

const ITEM_HEADER = /^##\s+(?:Item|item|Ítem)\s*(\d+)\s*:?\s*$/;

/** Divide el cuerpo en bloques `## Item N`. */
function splitItems(body: string): { index: number; block: string }[] {
  const out: { index: number; block: string }[] = [];
  let current: { index: number; lines: string[] } | null = null;
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(ITEM_HEADER);
    if (m) {
      if (current) out.push({ index: current.index, block: current.lines.join('\n') });
      current = { index: Number(m[1]), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) out.push({ index: current.index, block: current.lines.join('\n') });
  return out;
}

/**
 * Seccion `### Contexto` (o variantes) del bloque de un item.
 *
 * El contexto es un parrafo, y hay que quitarlo DEL ENUNCIADO: si se queda, dos
 * items que solo difieren en el Contexto no coinciden nunca y la regla 8 no
 * puede disparar. Y no se extiende hasta el proximo `###` a secas, porque en el
 * formato real `### Contexto` va seguido del enunciado y de las opciones ANTES
 * de `### Explicacion Pedagogica`.
 */
function extractContext(block: string): { context: string; without: string } {
  const re = /^###\s+(?:Contexto|Context)\b[^\n]*\n(?:\n*((?:(?!^###\s|^\s*$)[^\n]*\n)*))?/im;
  const m = block.match(re);
  if (!m) return { context: '', without: block };
  return { context: (m[1] ?? '').trim(), without: block.replace(re, '') };
}

/** Texto de una seccion `### <heading>` (tolerando lo que venga hasta el final). */
function extractSection(block: string, heading: RegExp): string {
  // El bloque termina en la siguiente cabecera `###`, o al final del item.
  // Ojo: en JS el fin de cadena no es `\Z` (eso es Python); es `(?![\\s\\S])`.
  const re = new RegExp(
    `^###\\s+(?:${heading.source})[^\\n]*\\n([\\s\\S]*?)(?=^#{1,3}\\s|(?![\\s\\S]))`,
    'im',
  );
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

/** Lee los `- campo: valor` y la lista `sources:` del bloque de calibracion. */
function parseCalibration(block: string): { fields: Record<string, string>; sources: string[] } {
  // El bloque de etiquetas es `### Calibration`; algunos items lo meten dentro
  // de la seccion de explicacion, asi que se acepta esa como respaldo.
  const zone =
    extractSection(block, /Calibration|Calibraci[oó]n/) ||
    extractSection(block, /Explicaci[oó]n\s+Pedag[oó]gica/);
  const fields: Record<string, string> = {};
  const sources: string[] = [];
  let inSources = false;

  for (const raw of (zone === '' ? block : zone).split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;
    const listItem = line.match(/^\s*[-*]\s+(.*)$/);
    if (inSources) {
      if (listItem) {
        sources.push(listItem[1].trim());
        continue;
      }
      inSources = false;
    }
    const kv = (listItem ? listItem[1] : line).match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    const value = kv[2].trim();
    if (key === 'sources') {
      if (value && value !== '[]') {
        // Inline: `sources: [a, b]` o `sources: url`
        sources.push(
          ...value
            .replace(/^\[|\]$/g, '')
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean),
        );
      }
      inSources = true;
      continue;
    }
    fields[key] = value;
  }
  return { fields, sources };
}

function parseItem(index: number, block: string): ParsedItem {
  const { context, without } = extractContext(block);

  const options: ParsedOption[] = [];
  const malformed: string[] = [];
  let firstOptionLine = -1;
  const lines = without.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!OPTION_ROW_LOOSE.test(line)) continue;
    const m = line.match(OPTION_ROW);
    if (m) {
      if (firstOptionLine < 0) firstOptionLine = i;
      options.push({ letter: m[2].toUpperCase(), text: m[3].trim(), correct: m[1].toLowerCase() === 'x' });
    } else {
      malformed.push(line.trim());
    }
  }

  const head = firstOptionLine < 0 ? lines : lines.slice(0, firstOptionLine);
  const question = head
    .filter((l) => !/^#{1,3}\s/.test(l))
    .join('\n')
    .trim();

  const { fields, sources } = parseCalibration(block);

  return {
    index,
    question,
    context,
    options,
    malformed,
    correctLetters: options.filter((o) => o.correct).map((o) => o.letter),
    explanation: extractSection(block, /Explicaci[oó]n\s+Pedag[oó]gica|Explanation|Explica[cç][aã]o\s+Pedag[oó]gica/),
    fields,
    sources,
  };
}

/** Parser de frontmatter minimo: `key: value` y listas `key:\n  - v`. */
function parseFrontmatter(content: string): { fm: Record<string, string[]> | null; body: string } {
  const normalized = content.replace(/^\uFEFF/, '');
  const m = normalized.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { fm: null, body: normalized };
  const fm: Record<string, string[]> = {};
  let current: string | null = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const listItem = raw.match(/^\s*-\s+(.*)$/);
    if (listItem && current) {
      fm[current].push(listItem[1].trim());
      continue;
    }
    const kv = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    current = kv[1].toLowerCase();
    fm[current] = kv[2].trim() ? [kv[2].trim()] : [];
  }
  return { fm, body: normalized.slice(m[0].length) };
}

function parseFile(content: string): ParsedFile {
  const { fm, body } = parseFrontmatter(content);
  const items = splitItems(body).map(({ index, block }) => parseItem(index, block));
  return { frontmatter: fm, items };
}

/* ------------------------------------------------------------------ */
/* Utilidades de analisis                                             */
/* ------------------------------------------------------------------ */

/** Texto visible: sin codigo, sin URLs. Para buscar basura tipografica. */
function visibleText(text: string): string {
  return text.replace(FENCE, ' ').replace(INLINE_CODE, ' ').replace(URLISH, ' ');
}

function normalizeForHash(text: string): string {
  return visibleText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function foreignScriptHits(text: string): { range: string; char: string }[] {
  const hits: { range: string; char: string }[] = [];
  for (const ch of visibleText(text)) {
    const cp = ch.codePointAt(0) ?? 0;
    for (const [lo, hi, name] of FOREIGN_RANGES) {
      if (cp >= lo && cp <= hi) {
        hits.push({ range: name, char: ch });
        break;
      }
    }
  }
  return hits;
}

function controlChars(text: string): string[] {
  const found: string[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x20 && ch !== '\n' && ch !== '\r' && ch !== '\t') {
      found.push(`U+${cp.toString(16).padStart(4, '0')}`);
    }
    if (cp === 0x7f) found.push('U+007f');
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* Validacion                                                         */
/* ------------------------------------------------------------------ */

function finding(rule: string, severity: Severity, file: string, item: number, message: string): Finding {
  return { rule, severity, file, item, message };
}

function validateOne(file: ItemFileInput): Finding[] {
  const out: Finding[] = [];
  const add = (rule: string, severity: Severity, item: number, message: string) =>
    out.push(finding(rule, severity, file.path, item, message));

  let parsed: ParsedFile;
  try {
    parsed = parseFile(file.content);
  } catch (e) {
    add(STRUCT.missingItemHeaders, 'ERROR', 0, `no se pudo interpretar el fichero: ${String(e)}`);
    return out;
  }

  const { frontmatter, items } = parsed;
  // El dominio es del BUNDLE (frontmatter), no de cada item: el fichero vive en
  // items/<domain>/<lang>/ y lo declara una vez. Por eso la regla del ancla
  // compara contra el dominio del fichero, no contra item.domain (que no existe).
  const bundleDomain = (frontmatter?.domain?.[0] ?? '').trim();

  // Regla 1 · frontmatter ausente. Regla 3 · protocol_version (seccion 9 del
  // protocolo: "cada unidad declara su protocol_version").
  // Regla 4 NO se comprueba aqui a proposito: en el formato del banco las
  // `sources` son por item (dentro de `### Calibration`), no del frontmatter,
  // asi que exigirlas en el frontmatter marcaria como invalido un bundle
  // perfectamente conforme.
  if (frontmatter === null) {
    add(RULE.frontmatterMissing, 'ERROR', 0, 'el fichero no empieza con un bloque YAML ---');
  } else {
    const version = (frontmatter['protocol_version'] ?? [])[0] ?? '';
    if (version !== EXPECTED_PROTOCOL_VERSION) {
      add(
        RULE.protocolVersion,
        'ERROR',
        0,
        `protocol_version debe ser ${EXPECTED_PROTOCOL_VERSION} y es "${version || '(ausente)'}"`,
      );
    }
  }

  if (items.length === 0) {
    add(STRUCT.missingItemHeaders, 'ERROR', 0, 'el fichero no contiene ninguna cabecera "## Item N"');
    return out;
  }

  if (frontmatter) {
    const declared = Number((frontmatter['items'] ?? [])[0] ?? NaN);
    if (!Number.isFinite(declared)) {
      add(STRUCT.itemCountMismatch, 'WARNING', 0, 'el frontmatter no declara items: <n>');
    } else if (declared !== items.length) {
      add(STRUCT.itemCountMismatch, 'WARNING', 0, `items: ${declared} en el frontmatter pero ${items.length} escritos`);
    }
  }

  // Un solo calculo de mojibake/caracteres de control por fichero: son del
  // fichero, no del item, asi que no se repiten por item.
  const fileLevelProblems: string[] = [];
  const controls = [...new Set(controlChars(file.content))];
  if (controls.length > 0) fileLevelProblems.push(`caracteres de control: ${controls.join(', ')}`);
  const mojibake = file.content.match(MOJIBAKE);
  if (mojibake) fileLevelProblems.push(`mojibake / doble codificacion: "${mojibake[0]}"`);

  for (const item of items) {
    const idx = item.index;

    // Regla 2 · los 8 campos del protocolo.
    const missing = REQUIRED_ITEM_FIELDS.filter((f) => !item.fields[f] || item.fields[f].length === 0);
    if (missing.length > 0) {
      add(RULE.protocolFieldMissing, 'ERROR', idx, `faltan campos obligatorios del protocolo v1.1: ${missing.join(', ')}`);
    }

    // Regla 16 · el ancla tiene que existir de verdad y ser del dominio correcto.
    //
    // Sin esto el validador aceptaba `MA104-SolarSystem` (que no existe: las
    // unidades reales son MA104-CarPurchase y MA123-SolarSystem) y aceptaba
    // `T400-SaveTheBees` como ancla de lectura, siendo las T* de PENSAMIENTO
    // CREATIVO. Un ancla inventada hace que la calibracion que el protocolo
    // promete en su seccion 5 sea una fiction.
    const anchor = item.fields.anchor?.trim();
    if (anchor && !/^PISA\b/i.test(anchor)) {
      const realDomain = ANCHOR_DOMAIN_BY_CODE.get(anchor);
      if (!realDomain) {
        const hint = closestReleased(anchor);
        add(
          STRUCT.anchorUnknown,
          'ERROR',
          idx,
          `ancla "${anchor}" no existe en el catalogo de unidades liberadas por la OCDE` +
            (hint ? `; quizá querías decir ${hint}` : ''),
        );
      } else {
        const allowed = DOMAIN_ANCHOR_FAMILY[bundleDomain] ?? [];
        if (allowed.length > 0 && !allowed.includes(realDomain)) {
          const label = DOMAIN_LABEL[realDomain] ?? realDomain;
          add(
            STRUCT.anchorDomainMismatch,
            'ERROR',
            idx,
            `ancla "${anchor}" es de ${label} y el bundle "${bundleDomain}" no admite esa familia`,
          );
        }
      }
    }

    // Regla 4 a nivel de item · sources.
    if (item.sources.length === 0) {
      add(RULE.sourcesMissing, 'ERROR', idx, 'el item no declara sources');
    }

    // Regla 5 · explicacion pedagogica.
    if (item.explanation.length === 0) {
      add(RULE.explanation, 'ERROR', idx, 'falta la seccion "### Explicacion Pedagogica"');
    } else if (item.explanation.length < MIN_EXPLANATION_CHARS) {
      add(
        RULE.explanation,
        'ERROR',
        idx,
        `explicacion de ${item.explanation.length} caracteres, minimo ${MIN_EXPLANATION_CHARS}`,
      );
    }

    // Regla 9 · todas/ninguna de las anteriores.
    const closing = item.options.find((o) => ALL_NONE_OF_ABOVE.test(o.text));
    if (closing) {
      add(RULE.allNoneOfAbove, 'ERROR', idx, `opcion ${closing.letter}) "${closing.text}" es una opcion de cierre`);
    }

    // Regla 10 · letras repetidas / varias correctas.
    const letters = item.options.map((o) => o.letter);
    const dupLetters = [...new Set(letters.filter((l, i) => letters.indexOf(l) !== i))];
    if (dupLetters.length > 0) {
      add(RULE.optionLetters, 'ERROR', idx, `letra de opcion repetida: ${dupLetters.join(', ')}`);
    }
    if (item.correctLetters.length > 1) {
      add(
        RULE.optionLetters,
        'ERROR',
        idx,
        `varias opciones marcadas como correctas: ${item.correctLetters.join(', ')} (solo una puede ser correcta)`,
      );
    }

    // Regla 11 · script foraneo.
    const hits = foreignScriptHits(`${item.question}\n${item.context}\n${item.explanation}`);
    if (hits.length > 0) {
      add(RULE.foreignScript, 'ERROR', idx, `caracter fuera del alfabeto permitido (${hits[0].range}: "${hits[0].char}")`);
    }

    // Regla 12 · tokens pegados.
    const glued = [...new Set(visibleText(`${item.question}\n${item.explanation}`).match(GLUED_TOKEN) ?? [])];
    if (glued.length > 0) {
      add(RULE.gluedToken, 'ERROR', idx, `token pegado tipo "${glued[0]}": dos palabras pegadas con guion`);
    }

    // Regla 13 · control chars / encoding (calculado por fichero).
    for (const problem of fileLevelProblems) {
      add(RULE.controlCharsEncoding, 'ERROR', idx, problem);
    }

    // Regla 14 · filas de opcion mal formadas.
    if (item.malformed.length > 0) {
      add(
        RULE.malformedOptionRow,
        'ERROR',
        idx,
        `fila de opcion mal formada (esperado "- [x] A) texto"): "${item.malformed[0]}"`,
      );
    }

    // Regla 15 · relleno. Se mira todo el item: un `???` en una opcion es tan
    // relleno como un TODO en el enunciado.
    const ph = `${item.question}\n${item.context}\n${item.explanation}\n${item.options
      .map((o) => o.text)
      .join('\n')}`.match(PLACEHOLDER);
    if (ph) {
      add(RULE.placeholder, 'ERROR', idx, `contenido de relleno "${ph[0]}" en el item`);
    }

    if (item.options.length < MIN_OPTIONS_PER_ITEM) {
      add(
        STRUCT.itemCountMismatch,
        'WARNING',
        idx,
        `el item tiene ${item.options.length} opcion(es); un item de eleccion multiple necesita varias`,
      );
    }
  }

  return out;
}

/** Reglas que necesitan ver el conjunto entero de ficheros del banco. */
function validateAcrossFiles(files: ItemFileInput[]): Finding[] {
  const out: Finding[] = [];

  const parsedFiles: { path: string; items: ParsedItem[] }[] = [];
  for (const file of files) {
    try {
      const parsed = parseFile(file.content);
      parsedFiles.push({ path: file.path, items: parsed.items });
    } catch {
      /* ya reportado en validateOne */
    }
  }

  // Regla 6 · sesgo de la letra correcta.
  //
  // El denominador es el numero de ITEMS, no el numero de marcas [x]. Un item
  // con dos opciones marcadas como correctas (que la regla `option-letters`
  // ya reporta por separado) inflaba el total y hacia que un banco sano
  // pareciera sesgado. Aqui se cuenta cada item una vez por letra.
  const totals = new Map<string, number>();
  let grandTotal = 0;
  for (const f of parsedFiles) {
    for (const item of f.items) {
      grandTotal += 1;
      for (const letter of new Set(item.correctLetters)) {
        totals.set(letter, (totals.get(letter) ?? 0) + 1);
      }
    }
  }
  // El sesgo solo es medible con al menos 2 items: con 1 solo item la letra
  // correcta es SIEMPRE la unica que hay (share 100%), asi que la regla no
  // tendria nada que senalar y solo marcaria en falso el bundle mas pequeno
  // que puede existir. Con 2 items, en cambio, 1 de 2 ya es exactamente el 50%.
  if (grandTotal > MIN_ITEMS_FOR_LETTER_BIAS) {
    for (const [letter, count] of [...totals].sort((a, b) => b[1] - a[1])) {
      const share = count / grandTotal;
      if (share > MAX_ANSWER_LETTER_SHARE) {
        const pct = Math.round(share * 1000) / 10;
        out.push(
          finding(
            RULE.answerLetterBias,
            'ERROR',
            '<set>',
            0,
            `la letra ${letter} es correcta en ${count} de ${grandTotal} items (${pct}%), maximo ${
              MAX_ANSWER_LETTER_SHARE * 100
            }%`,
          ),
        );
      }
    }
  }

  // Reglas 7 y 8 · duplicados en el banco entero (tambien dentro de un mismo
  // fichero). Se hace aqui y no por fichero para no reportar el mismo
  // duplicado dos veces: se reporta solo en el item repetido, con el origen.
  const seenFull = new Map<string, string>();
  const seenQuestion = new Map<string, string>();
  for (const f of parsedFiles) {
    for (const item of f.items) {
      const full = normalizeForHash(`${item.question} ${item.options.map((o) => o.text).join(' | ')}`);
      const qOnly = normalizeForHash(item.question);
      const where = `${f.path}:item${item.index}`;

      if (full) {
        const prev = seenFull.get(full);
        if (prev !== undefined) {
          out.push(finding(RULE.duplicateQuestion, 'ERROR', f.path, item.index, `duplicado exacto de ${prev} (enunciado + opciones)`));
        } else seenFull.set(full, where);
      }
      if (qOnly) {
        const prevQ = seenQuestion.get(qOnly);
        if (prevQ !== undefined) {
          out.push(
            finding(RULE.duplicateIgnoringContext, 'ERROR', f.path, item.index, `mismo enunciado que ${prevQ} ignorando el Contexto`),
          );
        } else seenQuestion.set(qOnly, where);
      }
    }
  }

  return out;
}

/** Valida un conjunto de ficheros en memoria. Nunca lanza. */
export function validateItemSet(files: ItemFileInput[]): ValidationReport {
  const findings: Finding[] = [];
  let items = 0;

  for (const file of files) {
    try {
      findings.push(...validateOne(file));
    } catch (e) {
      findings.push(finding(STRUCT.missingItemHeaders, 'ERROR', file.path, 0, `validacion abortada: ${String(e)}`));
    }
  }
  for (const file of files) {
    try {
      items += parseFile(file.content).items.length;
    } catch {
      /* ya reportado */
    }
  }

  findings.push(...validateAcrossFiles(files));

  return {
    files: files.length,
    items,
    errors: findings.filter((f) => f.severity === 'ERROR').length,
    warnings: findings.filter((f) => f.severity === 'WARNING').length,
    findings,
  };
}

/** Valida un solo fichero (util para tests y para depurar un bundle concreto). */
export function validateItemFile(path: string, content: string): ValidationReport {
  return validateItemSet([{ path, content }]);
}

/** Informe legible: una linea de resumen y luego cada hallazgo. */
export function formatReport(report: ValidationReport): string {
  const lines = [
    `validate-items: ${report.files} files analysed, ${report.items} items analysed, ` +
      `${report.errors} errors, ${report.warnings} warnings`,
  ];
  for (const f of report.findings) {
    lines.push(`${f.severity} [${f.rule}] ${f.file}:item${f.item} - ${f.message}`);
  }
  return lines.join('\n');
}
