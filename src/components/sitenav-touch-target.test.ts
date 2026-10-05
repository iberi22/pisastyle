import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El nav global tiene nueve objetivos tactiles (6 enlaces + 3 selectores de
 * idioma + el brand) y todos eran mas bajos que 44px en movil: los enlaces y
 * los selectores de idioma median 36px, y el brand 19px (solo la altura de su
 * texto, sin padding). El minimo oficial es 24px (WCAG 2.5.8, AA), asi que
 * no era un incumplimiento: era la unica deuda de accesibilidad que quedaba
 * en el producto, en la barra que ve y toca todo el mundo.
 *
 * El area pulsable se consigue con `padding` + `min-height`, nunca subiendo la
 * fuente. Este test congela esa regla: si alguien sube el tamano del texto
 * para "arreglar" el alto, el texto crece y el test falla.
 *
 * Verificado con navegador real el 2026-10-05 (Chromium, 390x844, isMobile):
 * los 9 elementos miden 44px de alto y las fuentes siguen en 1 / 0.9 / 0.75rem.
 */
const SITE_NAV = join(process.cwd(), 'src/components/SiteNav.astro');

describe('objetivos tactiles del nav (44px)', () => {
  const fuente = readFileSync(SITE_NAV, 'utf-8');
  const bloqueCss = fuente.slice(fuente.indexOf('<style>'));

  /** Regla CSS de primer nivel para un selector dado, con su cuerpo. */
  function regla(selector: string): string {
    const esc = selector.replace('.', '\\.');
    const m = bloqueCss.match(new RegExp(`${esc}\\s*\\{([^}]*)\\}`));
    expect(m, `no se encontro la regla ${selector}`).toBeTruthy();
    return m![1];
  }

  it('declara el objetivo tactil una sola vez como --nav-tap', () => {
    expect(fuente).toContain('--nav-tap: 2.75rem;');
    const usos = [...bloqueCss.matchAll(/var\(--nav-tap\)/g)];
    // brand(1 min-height) + link(1) + lang(2) = 4 usos
    expect(usos.length).toBe(4);
  });

  it('los tres tipos de objetivo usan min-height de 44px', () => {
    expect(regla('.nav-brand')).toMatch(/min-height:\s*var\(--nav-tap\)/);
    expect(regla('.nav-link')).toMatch(/min-height:\s*var\(--nav-tap\)/);
    expect(regla('.nav-lang')).toMatch(/min-height:\s*var\(--nav-tap\)/);
  });

  it('el selector de idioma es 44x44, no solo alto', () => {
    const lang = regla('.nav-lang');
    expect(lang).toMatch(/min-width:\s*var\(--nav-tap\)/);
  });

  it('el brand y el enlace alinean el texto con flex, no con padding asimetrico', () => {
    for (const selector of ['.nav-brand', '.nav-link', '.nav-lang']) {
      const r = regla(selector);
      expect(r, `${selector} necesita display:inline-flex`).toMatch(/display:\s*inline-flex/);
      expect(r, `${selector} necesita align-items: center`).toMatch(/align-items:\s*center/);
    }
  });

  it('NO sube el tamano de fuente para ganar los 44px', () => {
    // Las tres fuentes son las de escritorio. Si suben, el alto se esta
    // comprando con texto mas grande en vez de con area pulsable.
    expect(regla('.nav-brand')).toMatch(/font-size:\s*1rem;/);
    expect(regla('.nav-link')).toMatch(/font-size:\s*0\.9rem;/);
    expect(regla('.nav-lang')).toMatch(/font-size:\s*0\.75rem;/);
  });

  it('NO se lleva por delante el anillo de foco', () => {
    // El foco de teclado es la otra mitad del mismo problema: si alguien
    // quita el outline para "dejar el nav limpio", el fallo es peor.
    expect(fuente).not.toMatch(/outline:\s*(none|0)\s*;/);
    expect(bloqueCss).toMatch(/focus-visible[\s\S]*outline:\s*2px solid var\(--swal-accent\)/);
  });

  it('en movil los seis enlaces caben con scroll horizontal, no reducidos', () => {
    // Con 44px de alto los enlaces miden 97px de ancho en total ~570px, mas que
    // los 361px utiles. La salida es overflow-x en la ul (regla de movil),
    // nunca font-size mas pequeno ni quitar enlaces.
    const movil = bloqueCss.slice(bloqueCss.indexOf('@media (max-width: 640px)'));
    expect(movil).toMatch(/\.nav-links[\s\S]*overflow-x:\s*auto/);
    expect(movil).toMatch(/\.nav-links[\s\S]*flex-wrap:\s*nowrap/);
  });
});