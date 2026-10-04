import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Cada enlace del nav necesita su texto en las TRES locales.
 *
 * — POR QUE ESTE TEST EXISTE —
 * `SiteNav.astro` declara los rotulos asi:
 *
 *   pt: { home: 'Início', explorar: 'Unidades', metodo: 'Método',
 *         novidades: 'Novedades', avaliar: 'Avalie seu nível', ... }
 *
 * pero `LINKS` busca siempre la clave `evaluar`. Como en portugues el rotulo
 * estaba escrito `avaliar`, la clave no existia y el enlace se renderizaba SIN
 * TEXTO: una pildora gris vacia. En PT no habia forma visible de llegar a la
 * autoevaluacion desde el menu.
 *
 * Incumple WCAG 2.4.4 (Link Purpose) y 4.1.2 (Name, Role, Value), nivel A.
 *
 * No lo detecto el typecheck (el objeto es `Record<string, string>`, asi que
 * cualquier clave compila), ni los tests, ni el build. Las capturas si lo
 * mostraban: un hueco entre "Novedades" y "Contribuir", y una pildora gris sin
 * texto en movil. Solo hay que mirar el render.
 */
const SITE_NAV = join(process.cwd(), 'src/components/SiteNav.astro');

describe('rotulos del nav', () => {
  const fuente = readFileSync(SITE_NAV, 'utf-8');

  const bloqueLabels = fuente.slice(
    fuente.indexOf('const LABELS'),
    fuente.indexOf('const LINKS'),
  );

  const locales = ['es', 'en', 'pt'];
  const claves = [...fuente.matchAll(/key: '([a-z]+)'/g)].map((m) => m[1]);

  it('el nav declara al menos estos destinos', () => {
    expect(claves).toEqual(expect.arrayContaining(['home', 'explorar', 'metodo', 'novedades', 'evaluar', 'contribuir']));
  });

  for (const locale of locales) {
    it(`${locale}: tiene un rotulo para CADA clave del nav`, () => {
      const linea = bloqueLabels.match(new RegExp('(?:^|[\\s{])' + locale + ':\\s*\\{([^}]*)\\}'));
      expect(linea, `no se encontro el bloque de ${locale}`).toBeTruthy();
      const cuerpo = linea![1];
      for (const clave of claves) {
        expect(cuerpo, `falta el rotulo "${clave}" en ${locale}`).toContain(`${clave}:`);
      }
    });
  }

  it('los tres locales declaran EXACTAMENTE las mismas claves', () => {
    const conjuntos = locales.map((locale) => {
      const linea = bloqueLabels.match(new RegExp(`(?:^|[\\s{])${locale}:\\s*\\{([^}]*)\\}`))!;
      return [...linea[1].matchAll(/(\w+):\s*'/g)].map((m) => m[1]).sort();
    });
    expect(conjuntos[1]).toEqual(conjuntos[0]);
    expect(conjuntos[2]).toEqual(conjuntos[0]);
  });
});