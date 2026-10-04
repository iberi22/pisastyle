import { describe, it, expect } from 'vitest';
import {
  CONTRIB_REPO_OWNER,
  CONTRIB_REPO_NAME,
  MAX_ISSUE_URL_LENGTH,
  PROTOCOL_FIELDS,
  countFilledProtocolFields,
  countMissingProtocolFields,
  downloadFilename,
  emptyDraft,
  firstInvalidField,
  issueBody,
  issueTitle,
  issueUrl,
  issueUrlFits,
  markdownDocument,
  validateDraft,
  type ContribDraft,
  type OptionLabels,
} from './contrib-issue';

const LABELS: OptionLabels = {
  types: { correction: 'Correccion', new: 'Item nuevo' },
  fields: {
    domain: 'Dominio',
    process: 'Proceso',
    content: 'Contenido',
    context: 'Contexto',
    format: 'Formato',
    demand: 'Demanda',
    level: 'Nivel',
    anchor: 'Ancla',
  },
  optionsHeader: 'Opciones',
  explanationHeader: 'Explicacion',
  noteHeader: 'Nota',
  unitHeader: 'Unidad',
  protocolHeader: 'Protocolo',
  stemHeader: 'Enunciado',
  generatedBy: 'Generado por PISAStyle',
  noDataNotice: 'sin datos personales',
};

const MSG = { required: 'required', optionsMin: 'min 2', optionsUnexpected: 'unexpected' };

function fullDraft(overrides: Partial<ContribDraft> = {}): ContribDraft {
  return {
    ...emptyDraft('es'),
    type: 'new',
    stem: 'Si 3 paneles cubren 12 m, quantos metros cubren 8 paneles?',
    options: ['28 m', '32 m', '24 m', '36 m'],
    explanation: 'Es una proporcion directa: 12/3 = 4 m por panel, 8 x 4 = 32 m.',
    domain: 'math',
    process: 'reasoning',
    content: 'quantity',
    context: 'personal',
    format: 'mc-single',
    demand: 'med',
    level: '3',
    anchor: 'OECD PISA 2022 Math',
    ...overrides,
  };
}

describe('emptyDraft', () => {
  it('deja los 8 campos de protocolo vacios', () => {
    const d = emptyDraft();
    for (const f of PROTOCOL_FIELDS) expect(d[f]).toBe('');
  });

  it('ofrece exactamente 4 opciones por defecto (formato MC de PISA)', () => {
    expect(emptyDraft().options).toHaveLength(4);
  });

  it('arranca en modo item nuevo y recuerda el locale', () => {
    expect(emptyDraft('pt').type).toBe('new');
    expect(emptyDraft('pt').locale).toBe('pt');
  });
});

describe('validateDraft', () => {
  it('acepta un draft completo y no reporta ningun error', () => {
    expect(validateDraft(fullDraft(), MSG)).toEqual({});
  });

  it('exige el enunciado', () => {
    expect(validateDraft(fullDraft({ stem: '   ' }), MSG).stem).toBe('required');
  });

  it('exige la unidad solo en modo correccion', () => {
    expect(validateDraft(fullDraft({ type: 'correction' }), MSG).unit).toBe('required');
    expect(validateDraft(fullDraft({ type: 'new' }), MSG).unit).toBeUndefined();
  });

  it('exige los 8 campos de protocolo, uno a uno', () => {
    for (const field of PROTOCOL_FIELDS) {
      const errors = validateDraft(fullDraft({ [field]: '' }), MSG);
      expect(errors[field], `campo ${field} debe ser obligatorio`).toBe('required');
    }
  });

  it('cuenta los campos de protocolo que faltan', () => {
    expect(countMissingProtocolFields(fullDraft())).toBe(0);
    expect(countMissingProtocolFields(fullDraft({ level: '', anchor: '  ' }))).toBe(2);
    expect(countMissingProtocolFields(emptyDraft())).toBe(8);
  });

  it('cuenta los campos de protocolo rellenos, y son los dos lados de la moneda', () => {
    // El contador de la interfaz pinto el numero de carencias como si fuera el
    // de avance: "8 / 8" con los ocho campos vacios. Este test fija que las dos
    // cuentas suman 8 y que un draft vacio NO esta completo.
    expect(countFilledProtocolFields(emptyDraft())).toBe(0);
    expect(countFilledProtocolFields(fullDraft())).toBe(8);
    expect(countFilledProtocolFields(fullDraft({ level: '', anchor: '  ' }))).toBe(6);
    for (const draft of [emptyDraft(), fullDraft({ domain: '' })]) {
      expect(countFilledProtocolFields(draft) + countMissingProtocolFields(draft)).toBe(8);
    }
  });

  it('exige al menos 2 opciones si el formato es opcion multiple', () => {
    const d = fullDraft({ format: 'mc-complex', options: ['solo una', '', '', ''] });
    expect(validateDraft(d, MSG).options).toBe('min 2');
  });

  it('NO exige opciones en un item construido (respuesta abierta)', () => {
    expect(validateDraft(fullDraft({ format: 'constructed-open', options: ['', '', '', ''] }), MSG)).toEqual({});
  });

  it('rechaza opcionesMetricas huerfanas en un item construido', () => {
    // Sin esto se generan issues donde el revisor no sabe cual es la respuesta.
    const d = fullDraft({ format: 'constructed-open', options: ['24', '', '', ''] });
    expect(validateDraft(d, MSG).options).toBe('unexpected');
  });

  it('exige la explicacion', () => {
    expect(validateDraft(fullDraft({ explanation: '' }), MSG).explanation).toBe('required');
  });

  it('un espacio no cuenta como contenido', () => {
    const errors = validateDraft(fullDraft({ stem: ' ', explanation: ' ', domain: '   ' }), MSG);
    expect(Object.keys(errors).sort()).toEqual(['domain', 'explanation', 'stem']);
  });
});

describe('firstInvalidField', () => {
  it('devuelve el primero en orden de documento para mover el foco', () => {
    expect(firstInvalidField({ stem: 'x', level: 'x' })).toBe('stem');
    expect(firstInvalidField({ unit: 'x', stem: 'x' })).toBe('unit');
    expect(firstInvalidField({ anchor: 'x', explanation: 'x' })).toBe('explanation');
  });

  it('devuelve null si no hay errores', () => {
    expect(firstInvalidField({})).toBeNull();
  });
});

describe('issueTitle', () => {
  const types = { correction: 'correccion', new: 'item nuevo' };

  it('lleva el prefijo feat- y el dominio', () => {
    expect(issueTitle(fullDraft(), types)).toBe('feat-math: item nuevo — Si 3 paneles cubren 12 m, quantos metros cubren 8 paneles?');
  });

  it('en correccion el sujeto es la unidad, no el enunciado', () => {
    // El enunciado se trunca y no dice QUE se corrige; la unidad si.
    const t = issueTitle(fullDraft({ type: 'correction', unit: 'u-math-04' }), types);
    expect(t).toBe('feat-math: correccion — u-math-04');
  });

  it('cae al enunciado en correccion si no hay unidad', () => {
    const t = issueTitle(fullDraft({ type: 'correction', unit: '' }), types);
    expect(t).toContain('correccion');
    expect(t).toContain('Si 3 paneles');
  });

  it('cae a "pisa" si el dominio esta vacio, sin romper el prefijo', () => {
    const t = issueTitle(fullDraft({ domain: '' }), types);
    expect(t.startsWith('feat-pisa:')).toBe(true);
  });

  it('acorta un enunciado largo en vez de desbordar la cabecera', () => {
    const t = issueTitle(fullDraft({ stem: 'palabra '.repeat(60) }), types);
    expect(t.length).toBeLessThanOrEqual(100);
    expect(t.endsWith('...')).toBe(true);
  });

  it('recorta por palabra completa, no a media palabra', () => {
    const t = issueTitle(fullDraft({ stem: 'uno dos tres cuatro cinco seis siete ocho nueve diez' }), types);
    expect(t).not.toMatch(/\bdezn\b|\bnuev\d/);
  });

  it('colapsa saltos de linea y espacios multiples', () => {
    const t = issueTitle(fullDraft({ stem: 'uno\n\n  dos   tres' }), types);
    expect(t).not.toMatch(/\s{2,}|\n/);
  });

  it('no rompe con un enunciado vacio (el validador lo habra senalado)', () => {
    const t = issueTitle(fullDraft({ stem: '', unit: '' }), types);
    expect(t).toBe('feat-math: item nuevo — (sin enunciado)');
  });
});

describe('issueBody', () => {
  it('incluye enunciado, explicacion, opciones y los 8 campos', () => {
    const body = issueBody(fullDraft(), LABELS);
    expect(body).toContain('Si 3 paneles cubren 12 m');
    expect(body).toContain('Es una proporcion directa');
    expect(body).toContain('A) 28 m');
    expect(body).toContain('D) 36 m');
    for (const f of PROTOCOL_FIELDS) expect(body).toContain(LABELS.fields[f]);
  });

  it('marca la unidad solo en modo correccion', () => {
    expect(issueBody(fullDraft({ type: 'correction', unit: 'u-math-04' }), LABELS)).toContain('u-math-04');
    expect(issueBody(fullDraft({ type: 'new', unit: 'u-math-04' }), LABELS)).not.toContain('Unidad:');
  });

  it('deja constancia de que no se recoge ningun dato', () => {
    const body = issueBody(fullDraft(), LABELS);
    expect(body).toContain('sin datos personales');
    expect(body).toContain('Generado por PISAStyle');
  });

  it('omite el bloque de opciones cuando no hay ninguna', () => {
    const body = issueBody(fullDraft({ options: ['', '', '', ''] }), LABELS);
    expect(body).not.toContain('Opciones');
  });

  it('omite la nota si esta vacia', () => {
    expect(issueBody(fullDraft({ note: '' }), LABELS)).not.toContain('Nota');
    expect(issueBody(fullDraft({ note: 'Fuente: OECD 2022' }), LABELS)).toContain('Fuente: OECD 2022');
  });

  it('no deja campos de protocolo en blanco sin avisar', () => {
    // El validador lo impide, pero el body tiene que ser legible si se fuerza.
    expect(issueBody(fullDraft({ level: '' }), LABELS)).toContain('**Nivel:** _(vacio)_');
  });
});

describe('issueUrl', () => {
  it('apunta al repo correcto con title y body pre-rellenados', () => {
    const url = new URL(issueUrl('feat-math: x', 'cuerpo del item'));
    expect(url.origin + url.pathname).toBe(`https://github.com/${CONTRIB_REPO_OWNER}/${CONTRIB_REPO_NAME}/issues/new`);
    expect(url.searchParams.get('title')).toBe('feat-math: x');
    expect(url.searchParams.get('body')).toBe('cuerpo del item');
  });

  it('codifica acentos y saltos de linea sin romper la URL', () => {
    const url = new URL(issueUrl('feat-lectura: corrección', 'linea 1\nlinea 2 — 45%'));
    expect(url.searchParams.get('body')).toBe('linea 1\nlinea 2 — 45%');
    expect(url.searchParams.get('title')).toBe('feat-lectura: corrección');
  });

  it('añade labels solo si se piden', () => {
    expect(new URL(issueUrl('t', 'b')).searchParams.has('labels')).toBe(false);
    expect(new URL(issueUrl('t', 'b', 'enhancement')).searchParams.get('labels')).toBe('enhancement');
  });
});

describe('issueUrlFits', () => {
  it('acepta una URL razonable', () => {
    expect(issueUrlFits(issueUrl('feat-math: x', 'corto'))).toBe(true);
  });

  it('rechaza una URL desbordada para forzar el camino del .md', () => {
    expect(issueUrlFits('x'.repeat(MAX_ISSUE_URL_LENGTH + 1))).toBe(false);
  });
});

describe('downloadFilename / markdownDocument', () => {
  it('nombre estable y sin datos personales', () => {
    expect(downloadFilename(fullDraft())).toBe('pisastyle-nuevo-item-math.md');
    expect(downloadFilename(fullDraft({ type: 'correction', domain: 'Ciencias' }))).toBe(
      'pisastyle-correccion-ciencias.md',
    );
  });

  it('un dominio con simbolos raros no rompe el nombre', () => {
    const name = downloadFilename(fullDraft({ domain: 'LDW / digital!!' }));
    expect(name).toMatch(/^pisastyle-nuevo-item-[a-z0-9-]*\.md$/);
  });

  it('los acentos no se parten: "Matemáticas" es matematicas, no matem-ticas', () => {
    // Medido en navegador: el fichero se descargaba como "matem-ticas.md", que
    // parece corrupto y no lo encuentra nadie.
    expect(downloadFilename(fullDraft({ domain: 'Matemáticas' }))).toBe(
      'pisastyle-nuevo-item-matematicas.md',
    );
    expect(downloadFilename(fullDraft({ domain: 'Ciências' }))).toBe(
      'pisastyle-nuevo-item-ciencias.md',
    );
  });

  it('un dominio solo con simbolos cae a pisa en vez de dejar el nombre vacio', () => {
    expect(downloadFilename(fullDraft({ domain: '///' }))).toBe('pisastyle-nuevo-item-pisa.md');
  });

  it('el .md lleva el titulo como encabezado y el body completo', () => {
    const doc = markdownDocument(fullDraft(), LABELS, 'feat-math: item nuevo');
    expect(doc.startsWith('# feat-math: item nuevo')).toBe(true);
    expect(doc).toContain('### Enunciado');
    expect(doc).toContain('**Dominio:** math');
  });
});
