import { describe, it, expect } from 'vitest';
import { buildAlternates, routeLocale } from './alternates';
import {
  CONTRIB_REPO_OWNER,
  CONTRIB_REPO_NAME,
  MAX_ISSUE_URL_LENGTH,
  downloadFilename,
  emptyDraft,
  firstInvalidField,
  issueBody,
  issueTitle,
  issueUrl,
  issueUrlFits,
  markdownDocument,
  truncateWords,
  validateDraft,
  type ContribDraft,
  type OptionLabels,
} from './contrib-issue';

/**
 * Por que este archivo y no solo contrib-issue.test.ts: el contrato de la
 * RUTA. Un hreflang mal puesto hace que /es/contribuir y /en/contribuir se
 * declaren duplicados y Google indexe una sola; y un enlace mal formado hace
 * que el visitante entre al repo equivocado. Son fallos que no se ven en
 * `astro build` y que aqui quedan fijados.
 */
const SITE = 'https://pisa.swal.network';

describe('contribuir route alternates', () => {
  const alt = buildAlternates({ path: 'contribuir', locale: 'es', site: SITE });

  it('cubre las tres locales mas x-default', () => {
    expect(Object.keys(alt).sort()).toEqual(['en', 'es', 'pt', 'x-default']);
  });

  it('apunta cada locale a su propia ruta /contribuir', () => {
    expect(alt.es).toBe(`${SITE}/es/contribuir`);
    expect(alt.en).toBe(`${SITE}/en/contribuir`);
    expect(alt.pt).toBe(`${SITE}/pt/contribuir`);
    expect(alt['x-default']).toBe(`${SITE}/en/contribuir`);
  });

  it('el locale de la URL no se cuela en el hreflang de otra locale', () => {
    // El fallo tipico: pasar 'es' como locale y que alt.en salga en /es.
    for (const lang of ['es', 'en', 'pt']) {
      expect(alt[lang]).toContain(`/${lang}/contribuir`);
    }
  });

  it('las tres locales de ruta son validas', () => {
    for (const l of ['es', 'en', 'pt'] as const) {
      expect(routeLocale(l)).toBe(l);
    }
  });
});

const LABELS: OptionLabels = {
  types: { correction: 'Corrección', new: 'Ítem nuevo' },
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
  explanationHeader: 'Explicación de la respuesta correcta',
  noteHeader: 'Nota',
  unitHeader: 'Unidad o ítem afectado',
  protocolHeader: 'Etiquetado del protocolo',
  stemHeader: 'Enunciado',
  generatedBy: 'Generado por la página /contribuir de PISAStyle. Sin login, sin cookies y sin datos personales.',
  noDataNotice: 'Este cuerpo no contiene ningún dato personal.',
};

const MSG = { required: 'obligatorio', optionsMin: 'min 2', optionsUnexpected: 'no aplica' };

function complete(): ContribDraft {
  return {
    ...emptyDraft('es'),
    stem: 'Si 3 paneles cubren 12 m, ¿cuántos metros cubren 8 paneles?',
    options: ['28 m', '32 m', '24 m', '36 m'],
    explanation: 'Proporción directa: 12/3 = 4 m por panel, 8 × 4 = 32 m.',
    domain: 'Matemáticas',
    process: 'interpretar',
    content: 'quantity',
    context: 'personal',
    format: 'mc-single',
    demand: 'med',
    level: '3',
    anchor: 'Triangular Pattern',
  };
}

/**
 * Recorrido de extremo a extremo SIN navegador: lo que el visitante teclea ->
 * lo que se valida -> el titulo y el cuerpo -> la URL que se abre. Es la
 * cadena completa del flujo de entrega, y falla aqui en vez de fallar en
 * production con el formulario ya abierto.
 */
describe('contribuir end-to-end (logica pura)', () => {
  it('un item nuevo completo llega a una issue de GitHub utilizable', () => {
    const draft = complete();
    expect(validateDraft(draft, MSG)).toEqual({});

    const title = issueTitle(draft, LABELS.types);
    const url = new URL(issueUrl(title, issueBody(draft, LABELS)));

    expect(title.startsWith('feat-')).toBe(true);
    expect(url.pathname).toBe(`/${CONTRIB_REPO_OWNER}/${CONTRIB_REPO_NAME}/issues/new`);
    expect(url.searchParams.get('body')).toContain('Triangular Pattern');
    expect(issueUrlFits(url.toString())).toBe(true);
  });

  it('una correccion llega con la unidad identificada en titulo y cuerpo', () => {
    const draft: ContribDraft = { ...complete(), type: 'correction', unit: 'u-math-04' };
    expect(validateDraft(draft, MSG)).toEqual({});
    const title = issueTitle(draft, LABELS.types);
    expect(title).toContain('u-math-04');
    expect(issueBody(draft, LABELS)).toContain('**Unidad o ítem afectado:** u-math-04');
  });

  it('un draft incompleto NO llega a GitHub y dice que falta', () => {
    const draft: ContribDraft = { ...complete(), domain: '', level: '' };
    const errors = validateDraft(draft, MSG);
    expect(Object.keys(errors).sort()).toEqual(['domain', 'level']);
    expect(firstInvalidField(errors)).toBe('domain');
  });

  it('el .md de salida contiene todo lo que la issue llevaria', () => {
    const draft = complete();
    const doc = markdownDocument(draft, LABELS, issueTitle(draft, LABELS.types));
    for (const needle of ['feat-', 'Enunciado', 'Opciones', 'Explicación', 'Dominio', 'Ancla']) {
      expect(doc, `falta ${needle}`).toContain(needle);
    }
  });

  it('una propuesta gigante cae al camino del .md en vez de un enlace roto', () => {
    const draft = complete();
    draft.explanation = 'palabra '.repeat(1200);
    const url = issueUrl(issueTitle(draft, LABELS.types), issueBody(draft, LABELS));
    expect(issueUrlFits(url)).toBe(false);

    // El .md sigue siendo una salida valida, y es MAS PEQUEÑA que la URL: el
    // enlace percent-codifica cada espacio a %20 y multiplica el tamano. Por
    // eso es el camino principal cuando el enlace se desborda.
    const doc = markdownDocument(draft, LABELS, 'feat-x');
    expect(doc).toContain('palabra '.repeat(10));
    expect(doc.length).toBeLessThan(url.length);
    expect(MAX_ISSUE_URL_LENGTH).toBeGreaterThan(0);
  });
});

describe('truncateWords', () => {
  it('no toca lo que ya cabe', () => {
    expect(truncateWords('corto', 60)).toBe('corto');
  });

  it('corta en el ultimo espacio utilizable', () => {
    expect(truncateWords('uno dos tres cuatro cinco seis', 14)).toBe('uno dos tres...');
  });

  it('colapsa espacios multiples antes de medir', () => {
    expect(truncateWords('uno   \n  dos', 60)).toBe('uno dos');
  });

  it('no deja un titulo vacio si el valor son puros espacios', () => {
    expect(truncateWords('     ', 60)).toBe('');
  });
});

describe('downloadFilename', () => {
  it('no incluye el texto del visitante (no es dato personal, pero tampoco ruido)', () => {
    const name = downloadFilename(complete());
    expect(name).not.toMatch(/paneles|m[ié]tros/);
    expect(name.endsWith('.md')).toBe(true);
  });
});
