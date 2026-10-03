import { defineMiddleware } from 'astro:middleware';
import { resolveLocaleFromRequest } from './lib/pisa-i18n';

/**
 * Middleware PISAStyle: resuelve locale (es/en/pt) SIN imponer idioma por IP.
 * Orden: ?lang= > cookie locale > Accept-Language > en.
 * El pais (CF-IPCountry) solo viaja como hint x-pisa-country para moneda/ejemplos.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const req = context.request;
  const locale = resolveLocaleFromRequest(req, req.headers.get('cookie') ?? '');
  context.locals.pisaLocale = locale;
  const country = req.headers.get('cf-ipcountry') ?? new URL(req.url).searchParams.get('country') ?? '';
  context.locals.pisaCountry = country.toUpperCase().slice(0, 2);

  // Raiz -> /{locale}.
  //
  // Sin esto, 127.0.0.1:4321/ servia src/pages/index.astro, que sigue siendo la
  // demo del scaffold ("SWAL app-template — listo para clonar", botones
  // "pnpm create @swal/app"), mientras la landing real solo existia en
  // /es /en /pt. Quien abria el dominio sin ruta via el template, no el
  // producto. Verificado 2026-10-03 con captura del usuario.
  //
  // Redirect y no rewrite a proposito: la URL del locale debe quedar canonica
  // (hreflang, SEO y enlaces compartidos lo dependen). El locale se elige por
  // Accept-Language o cookie, nunca por IP.
  //
  // Solo en la raiz exacta: /explorar, /metodo, /novedades, /api/* y los
  // assets quedan intactos. Y nunca durante el prerender, donde no hay request
  // con headers que resolver (Astro corre el middleware tambien al prerenderizar).
  const url = new URL(req.url);
  const isPrerender = (context as unknown as { isPrerendered?: boolean }).isPrerendered;
  if (!isPrerender && url.pathname === '/') {
    const lang = url.searchParams.get('lang');
    return context.redirect(lang ? `/${locale}?lang=${encodeURIComponent(lang)}` : `/${locale}`, 302);
  }

  const res = await next();
  // Persiste preferencia cuando viene explicita en URL
  if (url.searchParams.get('lang')) {
    res.headers.append('Set-Cookie', `locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }
  res.headers.set('Content-Language', locale);
  return res;
});