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
 * Es mas fragil que probar comportamiento, pero es lo que detecta la regresion
 * real: si alguien borra el redirect, el build sigue verde, los tests del resto
 * siguen verdes, y la raiz vuelve a servir la demo del scaffold sin que nada
 * falle. Eso ocurrio el 2026-10-03.
 *
 * Una version anterior de este archivo replicaba la logica de decision en
 * local: pasaba aunque el middleware no tuviera redirect, porque comprobaba una
 * copia de si mismo. El comportamiento (302, destino por Accept-Language) se
 * verifica aparte en runtime con curl.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'middleware.ts'), 'utf8');

describe('middleware.ts — redirect de la raiz y del indice', () => {
  it('redirige con context.redirect y 302, no reescribe la URL', () => {
    // Rewrite dejaria la URL canonica en '/', que rompe hreflang y los
    // enlaces compartidos.
    expect(src).toMatch(/context\.redirect\(/);
    expect(src).toMatch(/,\s*302\s*\)/);
  });

  it('el locale de la RUTA gana sobre el fallback de Accept-Language', () => {
    // Regresion real: pedir /es sin cabecera Accept-Language aterrizaba en
    // /en/explorar. `locale` resuelve a 'en' (el fallback de pisa-i18n) y el
    // destino se construia con el, asi que el usuario pedia espanol y recibia
    // ingles. Una eleccion explicita en la URL no puede perder contra un
    // default. La raiz `/` si decide por Accept-Language, porque ahi no hay
    // eleccion explicita.
    expect(src).toMatch(/const deRuta = PISASTYLE_LOCALES\.find\(/);
    expect(src).toMatch(/const destino = deRuta \?\? locale/);
    expect(src).toMatch(/`\/\$\{destino\}\/explorar/);
  });

  it('el destino es /{locale}/explorar, no el indice', () => {
    // El indice tiene 650 chars de texto (hero + 3 dominios + cifras): es una
    // portada, no producto. /explorar tiene 8.224. Medido sobre el servidor.
    // El destino usa `destino`, no `locale` a secas: el locale de la ruta
    // tiene prioridad sobre el fallback (ver el test de arriba).
    expect(src).toMatch(/`\/\$\{destino\}\/explorar\$\{q\}`/);
  });

  it('el indice se detecta contra TODOS los locales, no contra el resuelto', () => {
    // Regresion real del 2026-10-03: la condicion era
    //   url.pathname === `/${locale}`
    // Al pedir /es SIN cabecera Accept-Language, `locale` resuelve a 'en' (el
    // fallback de pisa-i18n), asi que comparaba '/es' contra '/en', no
    // entraba y /es se servia en vez de redirigir. Firma del bug: /en
    // redirigia y /es y /pt no, de forma DETERMINISTA (no intermitente).
    // La condicion no puede depender de `locale` porque `locale` describe el
    // idioma deseado, no el pathname que se pidio.
    expect(src).toMatch(/PISASTYLE_LOCALES\.some\(/);
    expect(src).not.toMatch(/url\.pathname === `\/\$\{locale\}`/);
  });

  it('importa PISASTYLE_LOCALES para esa comprobacion', () => {
    expect(src).toMatch(/import\s*\{[^}]*PISASTYLE_LOCALES[^}]*\}\s*from\s*'\.\/lib\/pisa-i18n'/);
  });

  it('no redirige durante el prerender', () => {
    // Astro corre el middleware tambien al prerenderizar, donde no hay request
    // con headers. Sin el guard, las paginas prerenderizadas salen como stubs.
    expect(src).toMatch(/isPrerendered/);
    expect(src).toMatch(/!\s*isPrerender\s*&&/);
  });

  it('solo aplica a la raiz y al indice, no a subrutas', () => {
    // /explorar, /metodo, /novedades, /api/* y assets deben quedar intactos.
    expect(src).not.toMatch(/pathname\.startsWith/);
    // La subruta /explorar NO debe colarse en la condicion.
    expect(src).toMatch(/url\.pathname === '\/'\s*\|\|\s*isIndex/);
  });

  it('conserva el ?lang= explicito al redirigir', () => {
    expect(src).toMatch(/searchParams\.get\(['"]lang['"]\)/);
    expect(src).toMatch(/encodeURIComponent/);
  });

  it('el locale se elige por Accept-Language o cookie, nunca por IP', () => {
    // CF-IPCountry solo puede acabar en locals.pisaCountry. Si participara en
    // la eleccion de locale, un visitante en Colombia veria es y uno en
    // Portugal pt solo por su IP, que es lo que el middleware prohibe.
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