import { describe, it, expect } from 'vitest';
import { isPisaLocale, PISASTYLE_LOCALES } from './pisa-i18n';

/**
 * Un locale INVÁLIDO tiene que ser un 404, no un 500.
 *
 * — POR QUE ESTE TEST EXISTE —
 * `/no-existe` devolvía 500 con:
 *
 *   TypeError: Cannot read properties of undefined (reading 'hero')
 *
 * Las rutas `/[locale]/*` generan para CUALQUIER primer segmento: Astro hace
 * match de `[locale]` con 'no-existe', `dataMap['no-existe']` es `undefined`, y
 * `homeData.hero.title` revienta. Como `astro preview` no tiene middleware, el
 * 500 se colaba tal cual.
 *
 * El daño no era solo el 500: `/xx/evaluar` devolvía **200** con contenido en
 * español, o sea, una URL canónica loca servida como válida. Para un sitio
 *whose raison d'être es que los agentes lo indexen, eso es peor que un 500.
 *
 * La defensa es doble y las dos hacen falta:
 *   1. `isPisaLocale` para que las páginas puedan rechazar antes de leer datos.
 *   2. Un 404 de verdad, no una excepción sin manejar.
 */
describe('isPisaLocale', () => {
  it('acepta los tres locales reales', () => {
    for (const l of PISASTYLE_LOCALES) {
      expect(isPisaLocale(l), l).toBe(true);
    }
  });

  it('rechaza un primer segmento que no es locale', () => {
    for (const falso of ['no-existe', 'xx', 'klingon', 'ES ', '', 'e', 'espanol']) {
      expect(isPisaLocale(falso), JSON.stringify(falso)).toBe(false);
    }
  });

  it('rechaza undefined y null sin lanzar', () => {
    expect(isPisaLocale(undefined)).toBe(false);
    expect(isPisaLocale(null)).toBe(false);
  });

  it('es case-sensitive a proposito: /ES no es una ruta del sitio', () => {
    // Las rutas reales son /es /en /pt en minuscula. Aceptar /ES crearia rutas
    // duplicadas que compiten entre si en buscadores, que es justo lo que el
    // hreflang viene a evitar.
    expect(isPisaLocale('ES')).toBe(false);
    expect(isPisaLocale('EN')).toBe(false);
  });
});