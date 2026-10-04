/**
 * Validador de items PISA — suite de las 15 reglas de calidad.
 *
 * — POR QUE HACE FALTA —
 * Los items se escriben a mano (o por agentes) en `items/<domain>/<lang>/*.md`.
 * En el repo hermano `worldexams` 4000 preguntas quedaron con 100% de
 * consistencia SOLO porque el validador es un gate duro. Aquí se replica ese
 * gate: 15 reglas que cada una atrapa un defecto que ya ocurrio de verdad.
 *
 * — POR QUE HAY UN CASO "FALSO VERDE" —
 * El fallo más caro de un gate es no mirar nada y salir en verde: un glob mal
 * escrito devolvía "0 archivos / 0 errores" y el CI pasaba. Por eso hay tests
 * que ejecutan el CLI real contra un directorio vacío y exigen exit 1. Si algún
 * día alguien relaja el "0 ficheros -> exit 1", esos tests se ponen rojos.
 *
 * — POR QUE LAS DOS MITADES (lib + CLI) —
 * `items-validate.ts` es lógica pura sobre strings (testeable sin fs) y
 * `scripts/validate-items.mjs` es el shell de CI sobre ella. Los tests cubren
 * ambas: las 15 reglas contra la lib, el contrato de salida y exit code contra
 * el CLI de verdad (child_process), porque un gate que nadie ejecuta no existe.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateItemSet,
  validateItemFile,
  formatReport,
  RULE,
  MIN_EXPLANATION_CHARS,
  EXPECTED_PROTOCOL_VERSION,
  MAX_ANSWER_LETTER_SHARE,
  type Finding,
} from './items-validate';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, '../../scripts/validate-items.mjs');

/* ------------------------------------------------------------------ */
/* Helpers de fixture                                                  */
/* ------------------------------------------------------------------ */

const GOOD_EXPLANATION =
  'Se divide el area del terreno entre el numero de parcelas para obtener el promedio ' +
  'y se compara con el valor minimo exigido por el protocolo.';

interface ItemParts {
  index: number;
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  fields: Record<string, string>;
  sources: string[];
  extra: string;
  contextSection: string;
}

function baseFields(): Record<string, string> {
  return {
    domain: 'math',
    process: 'interpretar',
    content: 'quantity',
    context: 'ocupacional',
    format: 'MC simple',
    demand: 'low',
    level: '2',
    anchor: 'MA123-SolarSystem',
  };
}

function renderItem(p: ItemParts): string {
  const fieldLines = Object.entries(p.fields)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  const sourceLines = p.sources.map((s) => `  - ${s}`).join('\n');
  const options = p.options
    .map((text, i) => {
      const letter = String.fromCharCode(65 + i);
      return `- [${letter === p.correct ? 'x' : ' '}] ${letter}) ${text}`;
    })
    .join('\n');
  return [
    `## Item ${p.index}`,
    '',
    p.contextSection,
    p.question,
    '',
    options,
    '',
    '### Explicacion Pedagogica',
    '',
    p.explanation,
    '',
    '### Calibration',
    '',
    fieldLines,
    '- sources:',
    sourceLines,
    p.extra,
  ].join('\n');
}

/** Un item valido, con sobre-escritura por campo. */
function item(overrides: Partial<ItemParts> = {}): string {
  const p: ItemParts = {
    index: 1,
    question: 'Una parcela tiene 240 m2 y se divide en 6 filas iguales. ¿Cuanto mide cada fila en m2?',
    options: ['40', '144', '1.440', '60'],
    correct: 'A',
    explanation: GOOD_EXPLANATION,
    fields: baseFields(),
    sources: ['https://pisa2022-questions.oecd.org/'],
    extra: '',
    contextSection: '',
  };
  return renderItem({ ...p, ...overrides });
}

/** Fichero valido por defecto; se puede romper con `fm` / `body` / `omitItems`. */
function bundleFile(
  opts: {
    path?: string;
    fm?: Record<string, string> | null;
    body?: string;
    omitItemsCount?: boolean;
  } = {},
): { path: string; content: string } {
  const filePath = opts.path ?? 'items/math/en/ok.md';
  const fm: Record<string, string> = {
    id: 'math-en-2026-10-04-unidad-01',
    domain: 'math',
    lang: 'en',
    protocol_version: EXPECTED_PROTOCOL_VERSION,
    ...(opts.omitItemsCount ? {} : { items: '2' }),
  };
  const body = opts.body ?? [item({ index: 1, correct: 'A' }), item({ index: 2, correct: 'B' })].join('\n\n');
  const extra = opts.fm;
  const content =
    extra === null
      ? body
      : [
          '---',
          ...Object.entries(fm).map(([k, v]) => `${k}: ${v}`),
          ...(extra ? Object.entries(extra).map(([k, v]) => `${k}: ${v}`) : []),
          '---',
          '',
          body,
        ].join('\n');
  return { path: filePath, content };
}

/** Ejecuta la lib sobre ficheros en memoria y devuelve solo los nombres de regla. */
function rulesFor(files: { path: string; content: string }[]): string[] {
  return validateItemSet(files)
    .findings.filter((f) => f.severity === 'ERROR')
    .map((f) => f.rule);
}

function errorsFor(files: { path: string; content: string }[]): Finding[] {
  return validateItemSet(files).findings.filter((f) => f.severity === 'ERROR');
}

/** El fichero de referencia debe pasar todas las reglas. */
const CLEAN = bundleFile();

/* ------------------------------------------------------------------ */

describe('items-validate :: baseline', () => {
  it('un bundle limpio no produce ningun error', () => {
    const report = validateItemSet([CLEAN]);
    expect(report.errors).toBe(0);
    expect(report.files).toBe(1);
    expect(report.items).toBe(2);
    expect(report.findings.filter((f) => f.severity === 'ERROR')).toEqual([]);
  });

  it('declara las 15 reglas con nombre estable y cuenta lo que analiza', () => {
    const report = validateItemSet([CLEAN]);
    expect(Object.values(RULE)).toHaveLength(15);
    // Ejercicio de autocomprobacion: si items fuera 0, el gate no miraria nada.
    expect(report.files).toBe(1);
    expect(report.items).toBe(2);
  });

  it('los items se numeran como item1, item2 en el informe', () => {
    const broken = validateItemFile('items/math/en/ok.md', bundleFile({ body: item({ explanation: 'corta' }) }).content);
    expect(broken.findings.map((f) => `${f.file}:item${f.item}`)).toContain('items/math/en/ok.md:item1');
  });
});

/* ------------------------------------------------------------------ */
/* Reglas 1-15: una por una                                            */
/* ------------------------------------------------------------------ */

describe('regla 1 · frontmatter-missing', () => {
  it('detecta un fichero sin frontmatter', () => {
    expect(rulesFor([bundleFile({ fm: null })])).toContain(RULE.frontmatterMissing);
  });

  it('un frontmatter que no cierra tambien es frontmatter ausente', () => {
    const content = '---\nid: x\n\n## Item 1\ntexto';
    expect(rulesFor([{ path: 'a.md', content }])).toContain(RULE.frontmatterMissing);
  });
});

describe('regla 2 · protocol-field-missing', () => {
  it('detecta campos del protocolo ausentes y los NOMBRA', () => {
    const body = item({ fields: { ...baseFields(), domain: '', format: '', anchor: '' } });
    const f = errorsFor([bundleFile({ body })]).find((x) => x.rule === RULE.protocolFieldMissing);
    expect(f).toBeDefined();
    expect(f!.message).toContain('format');
    expect(f!.message).toContain('anchor');
    expect(f!.message).toContain('domain');
    // Solo nombra los que faltan, no los 8.
    expect(f!.message).not.toContain('process');
  });

  it('los 8 campos obligatorios del protocolo v1.1 se comprueban de verdad', () => {
    for (const field of ['domain', 'process', 'content', 'context', 'format', 'demand', 'level', 'anchor']) {
      const body = item({ fields: { ...baseFields(), [field]: '' } });
      const f = errorsFor([bundleFile({ body })]).find((x) => x.rule === RULE.protocolFieldMissing);
      expect(f, `campo ${field} deberia fallar`).toBeDefined();
      expect(f!.message).toContain(field);
    }
  });
});

describe('regla 3 · protocol-version', () => {
  it('rechaza una protocol_version distinta de v1.1', () => {
    // fm se antepone al bloque por defecto: hay que quitar la buena primero.
    const content = CLEAN.content.replace('protocol_version: v1.1', 'protocol_version: v1.0');
    expect(rulesFor([{ path: CLEAN.path, content }])).toContain(RULE.protocolVersion);
  });

  it('rechaza protocol_version ausente', () => {
    const content = CLEAN.content.replace(/^protocol_version:.*$/m, '');
    expect(rulesFor([{ path: CLEAN.path, content }])).toContain(RULE.protocolVersion);
  });

  it('acepta exactamente v1.1', () => {
    expect(rulesFor([CLEAN])).not.toContain(RULE.protocolVersion);
    expect(EXPECTED_PROTOCOL_VERSION).toBe('v1.1');
  });
});

describe('regla 4 · sources-missing', () => {
  it('detecta sources ausente en el frontmatter', () => {
    const content = bundleFile({ fm: { sources: '[]' } }).content;
    const f = errorsFor([{ path: CLEAN.path, content }]).find((x) => x.rule === RULE.sourcesMissing);
    expect(f).toBeDefined();
    expect(f!.message).toMatch(/sources/i);
  });

  it('detecta sources presente pero vacio', () => {
    const content = CLEAN.content.replace(/^sources:\n(?:  - .*\n?)+/m, 'sources: []\n');
    expect(rulesFor([{ path: CLEAN.path, content }])).toContain(RULE.sourcesMissing);
  });

  it('detecta un item sin sources propios', () => {
    const body = item({ sources: [] });
    const findings = errorsFor([bundleFile({ body })]);
    expect(findings.find((x) => x.rule === RULE.sourcesMissing)?.item).toBe(1);
  });
});

describe('regla 5 · explanation', () => {
  it('rechaza una explicacion mas corta de 80 caracteres', () => {
    const f = errorsFor([bundleFile({ body: item({ explanation: 'Muy corta.' }) })]).find(
      (x) => x.rule === RULE.explanation,
    );
    expect(f).toBeDefined();
    expect(f!.message).toMatch(/80/);
  });

  it('rechaza la explicacion ausente', () => {
    const content = CLEAN.content.replace(
      /### Explicacion Pedagogica\n\n[^\n]+\n/,
      '### Explicacion Pedagogica\n\n',
    );
    expect(rulesFor([{ path: CLEAN.path, content }])).toContain(RULE.explanation);
  });

  it('el limite es >= 80 caracteres, medido en el texto real', () => {
    expect(MIN_EXPLANATION_CHARS).toBe(80);
    const justUnder = 'a'.repeat(MIN_EXPLANATION_CHARS - 1);
    const exact = 'a'.repeat(MIN_EXPLANATION_CHARS);
    expect(rulesFor([bundleFile({ body: item({ explanation: justUnder }) })])).toContain(RULE.explanation);
    expect(rulesFor([bundleFile({ body: item({ explanation: exact }) })])).not.toContain(RULE.explanation);
  });
});

describe('regla 6 · answer-letter-bias', () => {
  it('detecta que la misma letra gana mas del 50% de los items', () => {
    const body = [
      item({ index: 1, correct: 'A' }),
      item({ index: 2, correct: 'A' }),
      item({ index: 3, correct: 'A', question: 'Segunda pregunta distinta para no duplicar el item.' }),
    ].join('\n\n');
    const f = errorsFor([bundleFile({ body })]).find((x) => x.rule === RULE.answerLetterBias);
    expect(f).toBeDefined();
    expect(f!.message).toContain('A');
  });

  it('detecta el sesgo combinando varios ficheros', () => {
    const files = [
      bundleFile({
        path: 'a.md',
        body: [item({ index: 1, correct: 'C' }), item({ index: 2, correct: 'B' })].join('\n\n'),
      }),
      bundleFile({
        path: 'b.md',
        body: [item({ index: 1, correct: 'C' }), item({ index: 2, correct: 'D' })].join('\n\n'),
      }),
    ];
    const f = errorsFor(files).find((x) => x.rule === RULE.answerLetterBias);
    expect(f).toBeDefined();
    expect(f!.message).toContain('C');
    expect(MAX_ANSWER_LETTER_SHARE).toBe(0.5);
  });

  it('NO se dispara con la distribucion plana A,B,C,D', () => {
    const body = [
      item({ index: 1, correct: 'A' }),
      item({ index: 2, correct: 'B' }),
      item({ index: 3, correct: 'C' }),
      item({ index: 4, correct: 'D' }),
    ].join('\n\n');
    expect(rulesFor([bundleFile({ body })])).not.toContain(RULE.answerLetterBias);
  });

  it('no dispara con el limite exacto (50%) y dispara en 3 de 5', () => {
    const half = [
      item({ index: 1, correct: 'A' }),
      item({ index: 2, correct: 'A' }),
      item({ index: 3, correct: 'B' }),
      item({ index: 4, correct: 'C' }),
    ].join('\n\n');
    expect(rulesFor([bundleFile({ body: half })])).not.toContain(RULE.answerLetterBias);

    const biased = [
      item({ index: 1, correct: 'A' }),
      item({ index: 2, correct: 'A' }),
      item({ index: 3, correct: 'A' }),
      item({ index: 4, correct: 'B' }),
      item({ index: 5, correct: 'C' }),
    ].join('\n\n');
    expect(rulesFor([bundleFile({ body: biased })])).toContain(RULE.answerLetterBias);
  });
});

describe('regla 7 · duplicate-question', () => {
  it('detecta dos items con el mismo enunciado y las mismas opciones', () => {
    const findings = errorsFor([bundleFile({ body: [item({ index: 1 }), item({ index: 2 })].join('\n\n') })]);
    const f = findings.find((x) => x.rule === RULE.duplicateQuestion);
    expect(f).toBeDefined();
    expect(f!.item).toBe(2);
  });

  it('detecta el duplicado aunque cambie solo la letra correcta', () => {
    const body = [item({ index: 1, correct: 'A' }), item({ index: 2, correct: 'B' })].join('\n\n');
    expect(rulesFor([bundleFile({ body })])).toContain(RULE.duplicateQuestion);
  });

  it('detecta el duplicado a traves de dos ficheros del banco', () => {
    const files = [
      bundleFile({ path: 'a.md', body: item({ index: 1 }) }),
      bundleFile({ path: 'b.md', body: item({ index: 1 }) }),
    ];
    const f = errorsFor(files).find((x) => x.rule === RULE.duplicateQuestion);
    expect(f).toBeDefined();
    expect(f!.file).toBe('b.md');
  });
});

describe('regla 8 · duplicate-ignoring-context', () => {
  it('detecta el mismo item cambiando solo el Contexto', () => {
    const body = [
      item({ index: 1, contextSection: '### Contexto\n\nElena cultiva en una finca de los Andes de 240 m2.' }),
      item({
        index: 2,
        options: ['50', '180', '1.200', '80'],
        contextSection: '### Contexto\n\nLa finca esta en una planicie del valle.',
      }),
    ].join('\n\n');
    const f = errorsFor([bundleFile({ body })]).find((x) => x.rule === RULE.duplicateIgnoringContext);
    expect(f).toBeDefined();
    expect(f!.item).toBe(2);
  });
});

describe('regla 9 · all-none-of-above', () => {
  it('rechaza "todas las anteriores"', () => {
    const body = item({ options: ['40', '144', 'Todas las anteriores'], correct: 'C' });
    expect(rulesFor([bundleFile({ body })])).toContain(RULE.allNoneOfAbove);
  });

  it('rechaza "ninguna de las anteriores" y las variantes inglesas', () => {
    for (const text of ['Ninguna de las anteriores', 'All of the above', 'None of the above']) {
      expect(
        rulesFor([bundleFile({ body: item({ options: [text, '40', '60'], correct: 'A' }) })]),
        text,
      ).toContain(RULE.allNoneOfAbove);
    }
  });
});

describe('regla 10 · option-letters', () => {
  it('detecta una letra repetida dentro del mismo item', () => {
    const body = item({}).replace('- [ ] B) 144', '- [ ] A) 144');
    expect(rulesFor([bundleFile({ body })])).toContain(RULE.optionLetters);
  });

  it('detecta dos opciones marcadas como correctas', () => {
    const body = item({}).replace('- [ ] B) 144', '- [x] B) 144');
    const f = errorsFor([bundleFile({ body })]).find((x) => x.rule === RULE.optionLetters);
    expect(f?.message).toMatch(/correct/i);
  });
});

describe('regla 11 · foreign-script', () => {
  it('detecta cirilico', () => {
    const body = item({ question: 'Una parcela mide 240 m2. Сколько será el resultado final del cálculo.' });
    expect(rulesFor([bundleFile({ body })])).toContain(RULE.foreignScript);
  });

  it('detecta CJK', () => {
    const body = item({ explanation: 'La parcela mide 240 m2 中文 explica el calculo completo del problema.' });
    expect(rulesFor([bundleFile({ body })])).toContain(RULE.foreignScript);
  });

  it('detecta latin extendido', () => {
    const body = item({ question: 'El area es ā 240 m2 con simbolos AGE en el enunciado del problema.' });
    expect(rulesFor([bundleFile({ body })])).toContain(RULE.foreignScript);
  });

  it('acepta español con tildes, ñ, degree sign y simbolos matematicos', () => {
    const body = item({
      question: 'El área mide 240 m² y la razón es × 2; ¿cuánto vale la suma de ángulos? ñandú',
    });
    expect(rulesFor([bundleFile({ body })])).not.toContain(RULE.foreignScript);
  });
});

describe('regla 12 · glued-token', () => {
  it('detecta un token pegado del tipo energy-social', () => {
    const body = item({ question: 'Compara el energy-social de la instalacion y sus costes anuales.' });
    expect(rulesFor([bundleFile({ body })])).toContain(RULE.gluedToken);
  });

  it('detecta tokens pegados en la explicacion', () => {
    const body = item({ explanation: `${GOOD_EXPLANATION} El calculo final-arrastra un error tipico de las aulas.` });
    expect(rulesFor([bundleFile({ body })])).toContain(RULE.gluedToken);
  });

  it('no dispara con los guiones legitimos (ancla, banda de dificultad)', () => {
    expect(rulesFor([CLEAN])).not.toContain(RULE.gluedToken);
  });

  it('acepta palabras compuestas reales', () => {
    const body = item({ question: 'Es un problema non-breaking y de high-school sobre mitades exactas.' });
    expect(rulesFor([bundleFile({ body })])).not.toContain(RULE.gluedToken);
  });
});

describe('regla 13 · control-chars-encoding', () => {
  it('detecta caracteres de control en el fichero', () => {
    const content = CLEAN.content.replace('240 m2', '240\u0007 m2');
    expect(rulesFor([{ path: CLEAN.path, content }])).toContain(RULE.controlCharsEncoding);
  });

  it('detecta mojibake', () => {
    const content = CLEAN.content.replace('Explicacion Pedagogica', 'ExplicaciÃ³n PedagÃ³gica');
    expect(rulesFor([{ path: CLEAN.path, content }])).toContain(RULE.controlCharsEncoding);
  });

  it('el bundle limpio no dispara esta regla', () => {
    expect(rulesFor([CLEAN])).not.toContain(RULE.controlCharsEncoding);
  });
});

describe('regla 14 · malformed-option-row', () => {
  it('detecta una fila de opcion sin letra', () => {
    const body = item({}).replace('- [ ] B) 144', '- [ ] 144');
    expect(rulesFor([bundleFile({ body })])).toContain(RULE.malformedOptionRow);
  });

  it('detecta una fila de opcion sin texto', () => {
    const body = item({}).replace('- [ ] B) 144', '- [ ] B) ');
    expect(rulesFor([bundleFile({ body })])).toContain(RULE.malformedOptionRow);
  });

  it('detecta una fila de opcion sin la marca [x]/[ ]', () => {
    const body = item({}).replace('- [ ] B) 144', '- B) 144');
    expect(rulesFor([bundleFile({ body })])).toContain(RULE.malformedOptionRow);
  });
});

describe('regla 15 · placeholder', () => {
  it('detecta TODO/FIXME/XXX/lorem/TBD en el enunciado', () => {
    for (const token of ['TODO', 'FIXME', 'XXX', 'lorem ipsum', 'TBD']) {
      const body = item({ question: `Calcule el area: ${token} del problema de las parcelas.` });
      expect(rulesFor([bundleFile({ body })]), token).toContain(RULE.placeholder);
    }
  });

  it('detecta ??? como relleno de opcion', () => {
    const body = item({ options: ['40', '???', '1.440'], correct: 'A' });
    expect(rulesFor([bundleFile({ body })])).toContain(RULE.placeholder);
  });
});

/* ------------------------------------------------------------------ */
/* Estructura: lo que hace posible todo lo anterior                     */
/* ------------------------------------------------------------------ */

describe('estructura de fichero e item', () => {
  it('un frontmatter con items declarados y ninguno escrito es error, no verde', () => {
    expect(rulesFor([bundleFile({ body: 'texto sin ningun item' })])).toContain('missing-item-headers');
  });

  it('avisa (warning) si el numero de items del frontmatter no cuadra', () => {
    const report = validateItemSet([bundleFile({ omitItemsCount: true })]);
    expect(report.findings.filter((f) => f.severity === 'WARNING').length).toBeGreaterThan(0);
  });

  it('avisa (warning) si un item tiene menos de 2 opciones', () => {
    expect(validateItemSet([bundleFile({ body: item({ options: ['40'], correct: 'A' }) })]).warnings).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* Falso verde (regla A del encargo)                                   */
/* ------------------------------------------------------------------ */

describe('falso verde · el gate debe fallar cuando no mira nada', () => {
  const tmpRoot = path.resolve(HERE, '..', '..', '.validate-items-test');

  function run(args: string[]): { code: number; stdout: string } {
    try {
      return { code: 0, stdout: execFileSync('node', [CLI, ...args], { encoding: 'utf-8' }) };
    } catch (e) {
      const err = e as { status: number; stdout: string };
      return { code: err.status, stdout: err.stdout };
    }
  }

  beforeAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    fs.mkdirSync(path.join(tmpRoot, 'empty'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'ok', 'math', 'en'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'ok', 'math', 'en', 'a.md'), CLEAN.content);
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('un directorio vacio sale con exit 1 y "0 files analysed"', () => {
    const r = run([path.join(tmpRoot, 'empty')]);
    expect(r.stdout).toMatch(/0 files analysed/);
    expect(r.code).toBe(1);
  });

  it('un glob que no matchea nada sale con exit 1 (el fallo real de worldexams)', () => {
    const r = run([path.join(tmpRoot, 'ok', 'math', 'en', '*.txt')]);
    expect(r.stdout).toMatch(/0 files analysed/);
    expect(r.code).toBe(1);
  });

  it('una ruta que no existe sale con exit 1', () => {
    expect(run([path.join(tmpRoot, 'nope', '*.md')]).code).toBe(1);
  });

  it('un glob valido encuentra ficheros y sale con 0', () => {
    const r = run([path.join(tmpRoot, 'ok', '**', '*.md')]);
    expect(r.stdout).toMatch(/1 files analysed/);
    expect(r.stdout).toMatch(/2 items analysed/);
    expect(r.code).toBe(0);
  });

  it('sin argumentos sale con exit 2 (invocacion incorrecta)', () => {
    expect(run([]).code).toBe(2);
  });

  it('un bundle con errores sale con exit 1 y lista ERROR [regla]', () => {
    const badPath = path.join(tmpRoot, 'ok', 'math', 'en', 'bad.md');
    fs.writeFileSync(badPath, bundleFile({ body: item({ explanation: 'corta' }) }).content);
    const r = run([path.join(tmpRoot, 'ok', '**', '*.md')]);
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/ERROR \[explanation\]/);
    fs.rmSync(badPath);
  });

  it('un fichero sin items sale con exit 1 (0 items no es verde)', () => {
    const onlyHeaders = path.join(tmpRoot, 'ok', 'math', 'en', 'c.md');
    fs.writeFileSync(onlyHeaders, '---\nid: x\ndomain: math\nlang: en\nprotocol_version: v1.1\n---\n\nsin items aqui\n');
    const r = run([onlyHeaders]);
    expect(r.code).toBe(1);
    fs.rmSync(onlyHeaders);
  });
});

/* ------------------------------------------------------------------ */
/* Control negativo: un bundle que viola todo                           */
/* ------------------------------------------------------------------ */

describe('control negativo · bundle con todas las reglas violadas', () => {
  const horrible = [
    '---\nid: math-en-broken\ndomain: math\nlang: en\nprotocol_version: v0.9\nsources: []\n---\n',
    item({
      index: 1,
      question: 'TODO: Сколько mide? energy-social ???',
      options: ['Todas las anteriores', '???', '144', '1.440'],
      correct: 'A',
      explanation: 'corta',
      contextSection: '### Contexto\n\nParcela de 240\u0007 m2',
    })
      // Letra A repetida: dos filas [x]/A) y la fila D pierde letra y texto.
      .replace('- [ ] B) ???', '- [x] A) ???')
      .replace('- [ ] D) 1.440', '- [ ] D'),
    item({
      index: 2,
      question: 'TODO: Сколько mide? energy-social ???',
      options: ['60', '64', '1040', '2304'],
      correct: 'A',
      explanation: 'cort',
    }),
    item({ index: 3, correct: 'A', question: 'Tercera pregunta sobre el precio final-arrastre de la parcela.' }),
    item({ index: 4, correct: 'A', question: 'Tercera pregunta sobre el precio final-arrastre de la parcela.' }),
    item({ index: 5, correct: 'A', question: 'Quinta pregunta distinta con el token pegado otro-caso en el texto.' }),
  ].join('\n\n');

  const findings = errorsFor([{ path: 'items/math/en/broken.md', content: horrible }]);
  const found = new Set(findings.map((f) => f.rule));

  it('detecta las 15 reglas a la vez', () => {
    expect(found.size).toBe(15);
    for (const rule of Object.values(RULE)) {
      expect(found, `deberia detectar ${rule}`).toContain(rule);
    }
  });

  it('nunca lanza excepcion: recoge y reporta', () => {
    expect(() => validateItemSet([{ path: 'items/math/en/broken.md', content: horrible }])).not.toThrow();
    expect(findings.length).toBeGreaterThan(5);
  });

  it('formatea un informe legible con el detalle de cada hallazgo', () => {
    const report = validateItemSet([{ path: 'items/math/en/broken.md', content: horrible }]);
    const text = formatReport(report);
    expect(text).toMatch(/files analysed/);
    expect(text).toMatch(/items analysed/);
    expect(text.split('\n').some((l) => /^ERROR \[.+\] items\/math\/en\/broken\.md:item\d/.test(l))).toBe(true);
  });
});
