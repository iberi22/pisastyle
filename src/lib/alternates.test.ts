import { describe, it, expect } from 'vitest';
import { buildAlternates, routeLocale } from './alternates';

/**
 * El helper existe por un motivo concreto: sin hreflang, /es/ y /en/ de la
 * misma pagina se declaran duplicados y Google indexa una sola. El plan (F4)
 * pide hreflang explicito en /pisa/, /rankings/ y /infografias/.
 */
describe('buildAlternates', () => {
  const site = 'https://pisa.swal.network';

  it('cubre las tres locales de Fase 1 mas x-default', () => {
    const alt = buildAlternates({ path: '', site });
    expect(Object.keys(alt).sort()).toEqual(['en', 'es', 'pt', 'x-default']);
  });

  it('apunta x-default al locale por defecto (en), no a es', () => {
    // El fallback de pisa-i18n es 'en' (area internacional), no 'es'.
    const alt = buildAlternates({ path: '', site });
    expect(alt['x-default']).toBe('https://pisa.swal.network/en');
  });

  it('genera la raiz sin barra duplicada', () => {
    const alt = buildAlternates({ path: '', site });
    expect(alt.es).toBe('https://pisa.swal.network/es');
    expect(alt.pt).not.toContain('//en');
  });

  it('normaliza el path con o sin slash inicial y final', () => {
    const a = buildAlternates({ path: 'explorar', site });
    const b = buildAlternates({ path: '/explorar', site });
    const c = buildAlternates({ path: '/explorar/', site });
    expect(a.es).toBe('https://pisa.swal.network/es/explorar');
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('preserva el sub-path en las tres locales', () => {
    const alt = buildAlternates({ path: 'infografias/ranking-bars', site });
    expect(alt.es).toBe('https://pisa.swal.network/es/infografias/ranking-bars');
    expect(alt.en).toBe('https://pisa.swal.network/en/infografias/ranking-bars');
    expect(alt.pt).toBe('https://pisa.swal.network/pt/infografias/ranking-bars');
  });

  it('no duplica slash cuando el sitio tiene path base', () => {
    const alt = buildAlternates({ path: 'explorar', site: 'https://swal.network/pisa/' });
    expect(alt.es).toBe('https://swal.network/pisa/es/explorar');
  });

  it('acepta URL como site, no solo string', () => {
    const alt = buildAlternates({ path: '', site: new URL('https://pisa.swal.network') });
    expect(alt.es).toBe('https://pisa.swal.network/es');
  });

  it('todas las URLs son absolutas (hreflang lo exige)', () => {
    const alt = buildAlternates({ path: 'explorar', site });
    for (const [lang, href] of Object.entries(alt)) {
      expect(() => new URL(href), `${lang} debe ser URL valida`).not.toThrow();
    }
  });
});

describe('routeLocale', () => {
  it('normaliza los tres locales de ruta', () => {
    expect(routeLocale('es')).toBe('es');
    expect(routeLocale('en')).toBe('en');
    expect(routeLocale('pt')).toBe('pt');
  });

  it('tolera mayusculas y variants regionales', () => {
    expect(routeLocale('ES')).toBe('es');
    expect(routeLocale('pt-BR')).toBe('pt');
  });

  it('cae al default en vez de propagar un locale invalido al lang', () => {
    // Si `lang` del HTML fuera 'xx', el atributo lang del documento seria
    // invalido y las lectores de pantalla leerian mal el texto.
    expect(routeLocale('fr')).toBe('en');
    expect(routeLocale(undefined)).toBe('en');
  });
});