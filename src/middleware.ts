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

  const res = await next();
  // Persiste preferencia cuando viene explicita en URL
  const url = new URL(req.url);
  if (url.searchParams.get('lang')) {
    res.headers.append('Set-Cookie', `locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }
  res.headers.set('Content-Language', locale);
  return res;
});
