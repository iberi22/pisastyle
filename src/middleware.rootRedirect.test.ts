import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * El middleware NO se puede importar en vitest: `astro:middleware` es un
 * virtual module del plugin de Astro y Vite lo rechaza antes de ejecutar
 * ("Failed to resolve import astro:middleware"). Por eso este test lee el
 * SOURCE del middleware y afirma sobre su contenido.
 *
 * Es mas fragil que probar comportamiento, pero es lo que detecta la
 * regresion real: si alguien borra el redirect de la raiz, el build sigue
 * verde, los tests del resto siguen verdes, y la pagina de inicio vuelve a
 * servir la demo del scaffold ("SWAL app-template", "pnpm create @swal/app")
 * sin que nada falle. Eso fue exactamente lo que ocurrio el 2026-10-03.
 *
 * Se sustituyo una version anterior de este archivo que replicaba la logica de
 * decision en local: era un test que pasaba aunque el middleware no tuviera
 * redirect, porque comprobaba una copia de si mismo y no el codigo real.
 *
 * El comportamiento (302 effective, destino por Accept-Language) se verifica
 * aparte en runtime con curl y en el navegador.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'middleware.ts'), 'utf8');

describe('middleware.ts — el source contiene el redirect de la raiz', () => {
  it('redirige cuando el pathname es exactamente /', () => {
    expect(src).toMatch(/url\.pathname\s*===\s*['"]\/['"]/);
  });

  it('el redirect usa context.redirect con 302, no reescribe la URL', () => {
    // Rewrite dejaria la URL canonica en '/', que rompe hreflang y los
    // enlaces compartidos. Tiene que ser un 302.
    expect(src).toMatch(/context\.redirect\(/);
    expect(src).toMatch(/,\s*302\s*\)/);
  });

  it('el destino es /{locale}', () => {
    expect(src).toMatch(/`\/\$\{locale\}/);
  });

  it('no redirige durante el prerender', () => {
    // Astro corre el middleware tambien al prerenderizar, donde no hay request
    // con headers que resolver. Sin este guard, /es/metodo (que SI se
    // prerenderiza) saldria como stub de redirect.
    expect(src).toMatch(/isPrerendered/);
    expect(src).toMatch(/!\s*isPrerender\s*&&\s*url\.pathname/);
  });

  it('solo aplica a la raiz exacta, no a subrutas', () => {
    // Un startsWith('/') arrastraria /es/explorar, /es/metodo y /api/*.
    expect(src).toMatch(/url\.pathname\s*===\s*['"]\/['"]/);
    expect(src).not.toMatch(/pathname\.startsWith/);
  });

  it('conserva el ?lang= explicito al redirigir', () => {
    expect(src).toMatch(/searchParams\.get\(['"]lang['"]\)/);
    expect(src).toMatch(/encodeURIComponent/);
  });

  it('sigue resolviendo el locale por Accept-Language, no por IP', () => {
    // El pais (CF-IPCountry) solo puede acabar en locals.pisaCountry. Si
    // participara en la eleccion de locale, un visitante en Colombia veria
    // 'es' solo por su IP, que es lo que el propio middleware prohibe.
    expect(src).toMatch(/resolveLocaleFromRequest/);
    expect(src).toMatch(/cf-ipcountry/);
    expect(src).not.toMatch(/locale\s*=\s*country/i);
  });

  it('mantiene Content-Language y la cookie de preferencia', () => {
    expect(src).toMatch(/Content-Language/);
    expect(src).toMatch(/Set-Cookie/);
  });
});

describe('middleware.ts — el fallback de locale no es el idioma del dueno', () => {
  // Se lee de pisa-i18n.ts (no replicado) para comprobar la constante de
  // fallback: PISA es un programa internacional y la copia de referencia esta
  // en ingles. Caer a 'es' seria imponer el idioma por el servidor.
  const i18n = readFileSync(join(here, 'lib', 'pisa-i18n.ts'), 'utf8');

  it('el locale por defecto es en', () => {
    const m = i18n.match(/PISASTYLE_DEFAULT_LOCALE[^=]*=\s*['"]([^'"]+)['"]/);
    expect(m?.[1]).toBe('en');
  });

  it('los locales de Fase 1 son es, en, pt', () => {
    const m = i18n.match(/PISASTYLE_LOCALES[^=]*=\s*\[([^\]]+)\]/);
    expect(m?.[1].replace(/['"\s]/g, '').split(',').filter(Boolean).sort()).toEqual(['en', 'es', 'pt']);
  });
});