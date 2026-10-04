import { describe, it, expect } from 'vitest';
import { loadUnit } from './units';

/**
 * Cubre el parseo de nombres de fichero, que es donde se rompió /pt:
 * `sample-unit.pt.json` no encaja en `sample-<dominio>-<locale>.json` porque el
 * dominio ES 'unit'. Sin ese caso el fichero que `private-material.sh` lista
 * como material privado era invisible y /pt caía al fallback.
 *
 * El glob lo resuelve Vite en build, no en test, así que no se puede mockear.
 * Estos tests asertan sobre el vault REAL de la máquina: es lo que importa, y
 * si el vault está montado y estos tests pasan, la cadena glob→parse→render está
 * probada de verdad. El primer test falla si el glob no trae nada, en vez de
 * pasar en silencio — un `if (!data) return` hides justo el bug que buscamos.
 */

describe('loadUnit', () => {
  it('el glob del vault trae contenido (si el vault esta montado)', () => {
    const { data, origin } = loadUnit('en');
    // Si esto falla, el glob no resolvio y todo lo demas seria verde por inercia.
    expect(data).not.toBeNull();
    expect(data?.items.length).toBeGreaterThan(0);
    expect(origin).toBe('vault');
  });

  it('la unidad tiene la forma exacta que la pagina consume', () => {
    const { data } = loadUnit('en');
    expect(data).not.toBeNull();
    expect(typeof data!.stimulus.content).toBe('string');
    expect(data!.stimulus.content.length).toBeGreaterThan(0);
    expect(Array.isArray(data!.items)).toBe(true);
    for (const item of data!.items) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.process).toBe('string');
      expect(typeof item.level).toBe('string');
      expect(typeof item.question).toBe('string');
      // La página hace item.options.map(): sin array revienta en render.
      if (item.options) {
        expect(Array.isArray(item.options)).toBe(true);
        for (const o of item.options!) {
          expect(typeof o.id).toBe('string');
          expect(typeof o.text).toBe('string');
        }
      }
    }
  });

  it('sample-unit.<locale>.json se reconoce: /pt cae en la unidad generica', () => {
    // Regresión del bug: sin el caso `sample-unit.<locale>.json` el fichero que
    // lista private-material.sh era invisible y /pt devolvía 'none'.
    const { data, origin } = loadUnit('pt');
    expect(origin).toBe('vault');
    expect(data!.stimulus.title.toLowerCase()).toContain('estufa');
  });

  it('no inventa contenido: /es no tiene unidad y devuelve null', () => {
    // El vault solo tiene sample-science-en.json y sample-unit.pt.json.
    const { data, origin } = loadUnit('es');
    expect(data).toBeNull();
    expect(origin).toBe('none');
  });

  it('el origen es coherente: datos implican origen real', () => {
    for (const locale of ['es', 'en', 'pt'] as const) {
      const { data, origin } = loadUnit(locale);
      if (!data) expect(origin).toBe('none');
      else expect(['vault', 'local']).toContain(origin);
    }
  });

  it('es estable: dos llamadas seguidas dan lo mismo', () => {
    // Si el glob se cacheara mal, la página alternaría unidad/fallback entre renders.
    expect(loadUnit('en')).toEqual(loadUnit('en'));
    expect(loadUnit('pt')).toEqual(loadUnit('pt'));
  });
});
