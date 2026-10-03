/**
 * hreflang / alternates para las rutas /es|en|pt/.
 *
 * Por que existe: sin hreflang, Google trata /es/ y /en/ de la MISMA pagina
 * como duplicados y se queda con una sola (normalmente la que no quiere). Con
 * hreflang declara que son la misma pagina en tres idiomas, y cadaLocale es
 * indexable por separado. Es requisito del plan (F4: "/es|en|pt/pisa/,
 * /rankings/, /infografias/ con hreflang").
 *
 * `Astro.site` es 'https://pisa.swal.network' (ver astro.config.mjs), asi que
 * las URLs absolutas se derivan de ahi y no hay que hardcodear el dominio en
 * cada pagina.
 */
import { PISASTYLE_LOCALES, PISASTYLE_DEFAULT_LOCALE, normalizePisaLocale } from './pisa-i18n';

export interface LocalizedPath {
  /** Path sin locale, con o sin slash inicial: 'explorar' | '/explorar' | '' */
  path: string;
  /**
   * Locale de la pagina actual. No hace falta para calcular los alternates
   * (que siempre cubren las 3 variantes), pero se acepta para que el llamador
   * pase la misma forma en todas las paginas y quede explicito que el locale
   * ya viaja aparte, en el atributo lang del Layout.
   */
  locale?: string;
  /** Origen absoluto. Por defecto usa Astro.site. */
  site?: URL | string;
}

function normalizePath(path: string): string {
  const p = path.replace(/^\/+/, '').replace(/\/+$/, '');
  return p;
}

function toAbsolute(site: URL | string, path: string): string {
  const base = typeof site === 'string' ? new URL(site) : site;
  const seg = normalizePath(path);
  return new URL(seg ? `${base.pathname.replace(/\/$/, '')}/${seg}` : base.pathname, base).href;
}

/**
 * Devuelve los alternates hreflang para una ruta, incluyendo `x-default` que
 * apunta al locale por defecto (en) para cuando el motor no puede decidir.
 */
export function buildAlternates({ path, site }: LocalizedPath): Record<string, string> {
  const origin = site ?? 'https://pisa.swal.network';
  const out: Record<string, string> = {};

  for (const loc of PISASTYLE_LOCALES) {
    out[loc] = toAbsolute(origin, `/${loc}${path ? `/${normalizePath(path)}` : ''}`);
  }
  out['x-default'] = toAbsolute(origin, `/${PISASTYLE_DEFAULT_LOCALE}${path ? `/${normalizePath(path)}` : ''}`);

  return out;
}

/** Locale ya normalizado a partir del param de ruta, para pasarlo al Layout. */
export function routeLocale(raw: string | undefined) {
  return normalizePisaLocale(raw);
}