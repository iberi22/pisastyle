/**
 * contrib-issue — logica pura de la pagina /contribuir.
 *
 * Sin DOM, sin red, sin framework: todo lo que la pagina necesita saber
 * ("como se titula la issue", "como se serializa el item", "que campos
 * obligatorios faltan", "la URL cabe en un enlace") vive aqui y se testea en
 * Node. El componente Svelte solo pinta y despacha.
 *
 * ── Por que NO se postea a la API de GitHub ──────────────────────────────────
 * El repositorio es un sitio ESTATICO (`output: 'server'` con el adaptador de
 * Cloudflare, pero las paginas publicas se sirven sin logica de negocio) y el
 * producto es anonymouso por requisito duro: sin login, sin cookies, sin
 * tracking, sin datos personales.
 *
 * Crear una issue por POST necesita un token de la app (un Fine-grained PAT
 * con permiso `issues: create`). En un sitio estatico ese token tiene una sola
 * ubicacion posible: el bundle que descarga el navegador. Eso es un token
 * publico para todo el mundo, con permiso de escritura en el repo, y la unica
 * forma de rotarlo es redesplegar. Rompe el requisito de "no recopila datos"
 * y el de "nadie puede escribir en el repo sin querer".
 *
 * Por eso el camino real es (b): generar el enlace de "nueva issue" de GitHub
 * YA PRE-RELLENADO (mismo mecanismo que `gh issue create --fill`, pero en el
 * navegador del visitante). El visitante revisa, edita y pulsa "Create". El
 * token del visitante es SUYO: no hay ningun secreto en nuestro lado, no hay
 * limite de tasa de la API, y si GitHub cierra sesion el flujo sigue siendo
 * valido porque la issue se puede escribir a mano desde el enlace.
 *
 * Y por si ese enlace se pierde (navegador sin ventanas emergentes, github.com
 * bloqueado por una red corporativa): `downloadMarkdown` + el mismo enlace.
 * Nunca hay punto muerto.
 */

/** Origen de la issue. Cambiar de repo es una linea y el test lo fija. */
export const CONTRIB_REPO_OWNER = 'iberi22';
export const CONTRIB_REPO_NAME = 'pisastyle';
export const CONTRIB_REPO_URL = `https://github.com/${CONTRIB_REPO_OWNER}/${CONTRIB_REPO_NAME}`;

/**
 * GitHub acepta URLs de issue mucho largas, pero ni todos los navegadores ni
 * proxies ni el propio formulario aguantan 40 KB, y por encima de ~6 KB el
 * campo se corta visualmente y el visitante ya no ve lo que va a publicar.
 * A partir de aqui la interfaz ofrece el .md como camino principal en vez de
 * fingir que el enlace funciono.
 */
export const MAX_ISSUE_URL_LENGTH = 6000;

export type ContribType = 'correction' | 'new';

/** Los 8 campos obligatorios del Protocolo PISAStyle v1.1 §2. */
export const PROTOCOL_FIELDS = [
  'domain',
  'process',
  'content',
  'context',
  'format',
  'demand',
  'level',
  'anchor',
] as const;

export type ProtocolField = (typeof PROTOCOL_FIELDS)[number];

export interface ContribDraft {
  /** Correccion sobre un item existente o item nuevo propuesto. */
  type: ContribType;
  /** Unidad / id del item afectado. Obligatorio solo en modo correccion. */
  unit: string;
  /** Enunciado del item. */
  stem: string;
  /** Opciones, en orden. Vacio = item construido (respuesta abierta). */
  options: string[];
  /** Explicacion / justificacion de la respuesta correcta. */
  explanation: string;
  domain: string;
  process: string;
  content: string;
  context: string;
  format: string;
  demand: string;
  level: string;
  anchor: string;
  /** Nota libre: fuente, justificacion extra, aviso de que no es un item oficial. */
  note: string;
  /** Locale del visitante. Va en la issue para poder responderle en su idioma. */
  locale: string;
}

export function emptyDraft(locale = 'en'): ContribDraft {
  return {
    type: 'new',
    unit: '',
    stem: '',
    options: ['', '', '', ''],
    explanation: '',
    domain: '',
    process: '',
    content: '',
    context: '',
    format: '',
    demand: '',
    level: '',
    anchor: '',
    note: '',
    locale,
  };
}

/** Cuantos campos de protocolo quedan sin rellenar (0 = completo). */
export function countMissingProtocolFields(draft: ContribDraft): number {
  return PROTOCOL_FIELDS.filter((f) => !draft[f].trim()).length;
}

export type ContribField = ProtocolField | 'unit' | 'stem' | 'options' | 'explanation';

export type ContribErrors = Partial<Record<ContribField, string>>;

/**
 * Validacion de cliente. Devuelve un mapa campo -> mensaje, ya localizado por
 * el componente. Campos vacios con `trim()`: un espacio no es contenido.
 *
 * `options` solo es obligatorio si el formato elegido es de opcion multiple;
 * un item construido (respuesta abierta) no tiene opciones por definicion, y
 * exigirlas ahi seria un error de contenido.
 */
export function validateDraft(draft: ContribDraft, messages: ContribErrorMessages): ContribErrors {
  const errors: ContribErrors = {};

  if (!draft.stem.trim()) errors.stem = messages.required;
  if (draft.type === 'correction' && !draft.unit.trim()) errors.unit = messages.required;

  const isChoice = draft.format.startsWith('mc');
  if (isChoice) {
    const filled = draft.options.filter((o) => o.trim());
    if (filled.length < 2) errors.options = messages.optionsMin;
  } else if (draft.options.some((o) => o.trim())) {
    // Ignorar opciones en un item construido genera issues confusas.
    errors.options = messages.optionsUnexpected;
  }

  if (!draft.explanation.trim()) errors.explanation = messages.required;

  for (const field of PROTOCOL_FIELDS) {
    if (!draft[field].trim()) errors[field] = messages.required;
  }

  return errors;
}

export interface ContribErrorMessages {
  required: string;
  optionsMin: string;
  optionsUnexpected: string;
}

/** Primera clave con error, en orden de documento: para mover el foco ahi. */
export function firstInvalidField(errors: ContribErrors): ContribField | null {
  const order: ContribField[] = ['unit', 'stem', 'options', 'explanation', ...PROTOCOL_FIELDS];
  for (const field of order) {
    if (errors[field]) return field;
  }
  return null;
}

/**
 * Titulo de la issue. El prefijo `feat-` es lo que pide el flujo del proyecto:
 * lo que entra por esta pagina es contenido nuevo (un item) o una correccion
 * de contenido, y ambos acaban en el mismo pipeline.
 *
 * En modo correccion el sujeto es la UNIDAD y no el enunciado: es lo que
 * identifica de forma univoca el item a arreglar, y ademas el enunciado suele
 * ser largo y truncado, asi que el titulo acababa diciendo "correccion — Si 3
 * paneles cubren 12 m…" sin decir QUE se corrige. En modo item nuevo no hay
 * unidad que citar, asi que manda el enunciado.
 *
 * Se limita a 100 caracteres porque la cabecera de GitHub corta antes y un
 * titulo largo es ilegible en la lista de issues.
 */
export function issueTitle(draft: ContribDraft, typeLabels: { correction: string; new: string }): string {
  const kind = draft.type === 'correction' ? typeLabels.correction : typeLabels.new;
  const scope = draft.domain.trim() || 'pisa';
  const source = draft.type === 'correction' ? draft.unit.trim() || draft.stem.trim() : draft.stem.trim() || draft.unit.trim();
  const title = `feat-${scope}: ${kind} — ${truncateWords(source, 60) || '(sin enunciado)'}`.replace(/\s+/g, ' ');
  return title.length > 100 ? `${title.slice(0, 97).trimEnd()}...` : title;
}

/**
 * Recorta a `max` caracteres por un limite de PALABRA. Cortar a lo bruto
 * ("...quantos metro") deja un titulo que parece un error de escritura; cortar
 * en el ultimo espacio produce algo que se lee entero.
 */
export function truncateWords(value: string, max: number): string {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

/** Traduce las claves de opcion al rotulo legible que aparece en la issue. */
export interface OptionLabels {
  types: Record<ContribType, string>;
  fields: Record<ProtocolField, string>;
  optionsHeader: string;
  explanationHeader: string;
  noteHeader: string;
  unitHeader: string;
  protocolHeader: string;
  stemHeader: string;
  generatedBy: string;
  noDataNotice: string;
}

export function issueBody(draft: ContribDraft, labels: OptionLabels): string {
  const lines: string[] = [];

  lines.push(`<!-- ${labels.generatedBy} -->`);
  lines.push(`<!-- ${labels.noDataNotice} -->`);
  lines.push('');

  lines.push(`## ${labels.types[draft.type]}`);
  lines.push('');

  if (draft.type === 'correction' && draft.unit.trim()) {
    lines.push(`**${labels.unitHeader}:** ${draft.unit.trim()}`);
    lines.push('');
  }

  lines.push(`### ${labels.stemHeader}`);
  lines.push('');
  lines.push(draft.stem.trim() || '_(vacio)_');
  lines.push('');

  const filledOptions = draft.options.map((o) => o.trim()).filter(Boolean);
  if (filledOptions.length) {
    lines.push(`### ${labels.optionsHeader}`);
    lines.push('');
    filledOptions.forEach((option, i) => {
      lines.push(`${String.fromCharCode(65 + i)}) ${option}`);
    });
    lines.push('');
  }

  if (draft.explanation.trim()) {
    lines.push(`### ${labels.explanationHeader}`);
    lines.push('');
    lines.push(draft.explanation.trim());
    lines.push('');
  }

  lines.push(`### ${labels.protocolHeader} (PISAStyle v1.1)`);
  lines.push('');
  for (const field of PROTOCOL_FIELDS) {
    const value = draft[field].trim();
    lines.push(`- **${labels.fields[field]}:** ${value || '_(vacio)_'}`);
  }
  lines.push('');

  if (draft.note.trim()) {
    lines.push(`### ${labels.noteHeader}`);
    lines.push('');
    lines.push(draft.note.trim());
    lines.push('');
  }

  lines.push('---');
  lines.push(`_${labels.generatedBy}_`);

  return lines.join('\n').trimEnd();
}

/**
 * URL de "nueva issue" pre-rellenada. Es el mecanismo real de entrega: la
 * pagina no pide ningun secreto y GitHub es quien autentica al visitante.
 */
export function issueUrl(title: string, body: string, labels?: string): string {
  const params = new URLSearchParams();
  params.set('title', title);
  params.set('body', body);
  if (labels) params.set('labels', labels);
  return `${CONTRIB_REPO_URL}/issues/new?${params.toString()}`;
}

/** `true` cuando la URL es corta y se puede abrir como enlace de verdad. */
export function issueUrlFits(url: string, max = MAX_ISSUE_URL_LENGTH): boolean {
  return url.length <= max;
}

/** `contribucion-item-domain.md` — nombre estable, sin datos personales. */
export function downloadFilename(draft: ContribDraft): string {
  const scope = (draft.domain.trim() || 'pisa').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const kind = draft.type === 'correction' ? 'correccion' : 'nuevo-item';
  return `pisastyle-${kind}-${scope || 'pisa'}.md`;
}

/** El .md que se descarga y que el visitante pega en la issue a mano. */
export function markdownDocument(draft: ContribDraft, labels: OptionLabels, title: string): string {
  return [
    `# ${title}`,
    '',
    `> ${labels.generatedBy}`,
    '',
    issueBody(draft, labels),
    '',
  ].join('\n');
}
