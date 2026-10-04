import { defineMiddleware } from 'astro:middleware';
import { PISASTYLE_LOCALES, resolveLocaleFromRequest } from './lib/pisa-i18n';

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

  // Raiz -> /{locale}/explorar
  //
  // Sin esto, la raiz servia src/pages/index.astro, que sigue siendo la demo
  // del scaffold ("SWAL app-template — listo para clonar", botones "pnpm
  // create @swal/app"), mientras el producto vivia en /es /en /pt. Verificado
  // 2026-10-03 con captura del usuario.
  //
  // Y de /{locale} a /{locale}/explorar, porque el hero solo tiene 650 chars de
  // texto: es una portada, no producto. Medido el 2026-10-03 sobre el servidor:
  //
  //   /es              650 chars   <- indice: hero + 3 dominios + cifras PISA
  //   /es/metodo     5.156 chars   <- el metodo v1.1 completo
  //   /es/novedades  5.887 chars   <- 5 articulos con fecha y fuente
  //   /es/explorar   8.224 chars   <- la unidad PISA con su FAQ
  //
  // El indice queda igual accesible en /{locale}; lo que cambia es que la raiz
  // abre donde hay contenido. Se elige explorar y no metodo porque es la que
  // tiene el contenido PISA de verdad y enlaza al resto.
  //
  // Redirect y no rewrite a proposito: la URL debe quedar canonica (hreflang,
  // SEO y enlaces compartidos lo dependen). El locale se elige por
  // Accept-Language o cookie, nunca por IP.
  //
  // Solo en la raiz y en el indice; /explorar, /metodo, /novedades, /api/* y
  // los assets quedan intactos. Y nunca durante el prerender, donde no hay
  // request con headers que resolver (Astro corre el middleware tambien al
  // prerenderizar).
  const url = new URL(req.url);
  const isPrerender = (context as unknown as { isPrerendered?: boolean }).isPrerendered;
  // La condicion compara contra CUALQUIERA de los tres locales del indice, no
  // solo contra el locale resuelto. Con `pathname === '/' + locale` fallaba: al
  // pedir /es sin cabecera Accept-Language, `locale` resuelve a 'en' (el
  // fallback de pisa-i18n), asi que comparaba '/es' contra '/en', no entraba y
  // /es se servia en vez de redirigir. Medido 2026-10-03: /en redirigia y /es y
  // /pt no, de forma determinista — la firma de un error de logica, no de un
  // runtime intermitente.
  const isIndex = PISASTYLE_LOCALES.some((l) => url.pathname === `/${l}`);
  if (!isPrerender && (url.pathname === '/' || isIndex)) {
    const lang = url.searchParams.get('lang');
    const q = lang ? `?lang=${encodeURIComponent(lang)}` : '';

    // Si el locale viene de la RUTA (`/es`), esa es la eleccion explicita del
    // visitante y gana sobre el fallback. Sin esto, pedir /es sin cabecera
    // Accept-Language aterrizaba en /en/explorar — el usuario pedia espanol y
    // recibia ingles. Verificado 2026-10-03.
    //
    // La raiz (`/`) si decide por Accept-Language o cookie, porque ahi no hay
    // eleccion explicita. Y el locale NUNCA se impone por IP: CF-IPCountry solo
    // alimenta locals.pisaCountry.
    const deRuta = PISASTYLE_LOCALES.find((l) => url.pathname === `/${l}`);
    const destino = deRuta ?? locale;

    return context.redirect(`/${destino}/explorar${q}`, 302);
  }

  const res = await next();
  // Persiste preferencia cuando viene explicita en URL
  if (url.searchParams.get('lang')) {
    res.headers.append('Set-Cookie', `locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }
  res.headers.set('Content-Language', locale);
  return res;
});