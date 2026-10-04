/**
 * helpers.ts — datos compartidos por los specs de E2E.
 *
 * NO es un spec: Playwright solo recoge `*.spec.ts`, asi que este archivo no se
 * ejecuta como test. Exporta la tabla de rutas, el titulo esperado de cada una,
 * el proveedor de capturas y la guardia contra paginas de error del servidor.
 *
 * DE DONDE SALE EL TITULO ESPERADO — Y POR QUE
 * De `SEO_ROUTES` en `src/lib/seo.ts`, NO de una tabla copiada a mano aqui.
 *
 * `src/layouts/Layout.astro` resuelve el `<title>` desde ese catalogo
 * (`finalTitle = catalogCopy?.title ?? title`), o sea que el catalogo ES la
 * fuente de la verdad de los titulos. Una tabla escrita a mano en el test es una
 * foto del pasado: cuando seo.ts anadio los titulos por ruta, la tabla se
 * quedo obsoleta y 6 tests de 39 fellaron sin que ninguna pagina estuviera rota
 * (medido 2026-10-04). Leyendo el mismo catalogo que usa el Layout, el E2E
 * comprueba lo que de verdad importa — que cada ruta se sirva con SU titulo en
 * SU idioma — y no se rompe cada vez que el copy mejora.
 *
 * `seo.ts` es TypeScript puro (cero `astro:`), asi que se importa sin mas.
 *
 * El `<h1>` y el `<h2>` si se miden contra el HTML renderizado, porque son copy
 * de pagina, no del catalogo SEO.
 */
import fs from 'node:fs';
import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';
import { routeMeta } from '../../src/lib/seo';

export const LOCALES = ['es', 'en', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];

export type Route = {
  /** Slug sin locale (p.ej. 'explorar'). */
  slug: string;
  /** `<title>` que el Layout debe renderizar, desde SEO_ROUTES. */
  title: string;
  /** Primer `<h1>` visible, o `null` si la pagina no tiene h1. */
  h1: string | null;
  /** Seccion `<h2>` que debe existir. */
  h2: string | null;
};

/** Los `<h1>`/`<h2>` se midieron contra el HTML renderizado (ver nota de arriba). */
const COPY: Record<Locale, Record<string, { h1: string | null; h2: string | null }>> = {
  es: {
    explorar: { h1: 'Explorar Unidad PISA', h2: 'Estímulo' },
    metodo: { h1: null, h2: 'Ciclo PISA' },
    novedades: { h1: 'Novedades', h2: 'Desempeño de Colombia en PISA' },
    evaluar: { h1: 'Evalúa tu nivel de PISA', h2: null },
    contribuir: { h1: 'Contribuir', h2: 'Cómo funciona' },
  },
  en: {
    explorar: { h1: 'Explore PISA Unit', h2: 'Stimulus' },
    metodo: { h1: null, h2: 'PISA Cycle' },
    novedades: { h1: 'Novedades', h2: "Colombia's PISA Performance" },
    evaluar: { h1: 'Check your PISA level', h2: null },
    contribuir: { h1: 'Contribute', h2: 'How it works' },
  },
  pt: {
    explorar: { h1: 'Explorar Unidade PISA', h2: 'Estímulo' },
    metodo: { h1: null, h2: 'Ciclo PISA' },
    novedades: { h1: 'Novedades', h2: 'Desempenho da Colômbia no PISA' },
    evaluar: { h1: 'Avalie seu nível PISA', h2: null },
    contribuir: { h1: 'Contribuir', h2: 'Como funciona' },
  },
};

const SLUGS = ['explorar', 'metodo', 'novedades', 'evaluar', 'contribuir'] as const;

export const ROUTES: Record<Locale, Route[]> = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    SLUGS.map((slug) => {
      const meta = routeMeta(slug);
      if (!meta) {
        // Falla aqui y no con un timeout 45s dentro del primer test: si alguien
        // renombra una ruta en seo.ts, el E2E tiene que enterarse al arrancar.
        throw new Error(`routeMeta('${slug}') no existe en src/lib/seo.ts. La ruta cambio y el E2E no la conoce.`);
      }
      return {
        slug,
        title: meta.copy[locale].title,
        h1: COPY[locale][slug].h1,
        h2: COPY[locale][slug].h2,
      };
    }),
  ]),
) as Record<Locale, Route[]>;

/** Etiqueta accesible de la nav global en cada idioma. */
export const NAV_ARIA: Record<Locale, string> = { es: 'Inicio', en: 'Home', pt: 'Início' };

/** Accept-Language por locale: `es-ES` -> "es-ES", que normalizePisaLocale mapea a 'es'. */
export const BROWSER_LOCALE: Record<Locale, string> = {
  es: 'es-ES',
  en: 'en-US',
  pt: 'pt-BR',
};

export function pathFor(locale: Locale, slug: string): string {
  return `/${locale}/${slug}`;
}

/**
 * El `<title>` tiene que ser exactamente el del catalogo SEO de esa ruta.
 *
 * Igualdad exacta y no `startsWith`: como la expectativa se lee del MISMO
 * catalogo que usa el Layout, ya no hay sufijos que se escapen, y asi una
 * pagina que se sirve con el titulo de otra ruta (o en otro idioma) falla aqui
 * con el mensaje de abajo en vez de pasar desapercibida.
 */
export async function expectTitle(page: Page, route: Route, locale: Locale): Promise<void> {
  const title = (await page.title()).trim();
  expect(
    title,
    `El <title> de /${locale}/${route.slug} deberia ser "${route.title}" y es "${title}". Si el catalogo SEO cambio de verdad, actualiza src/lib/seo.ts y no el test.`,
  ).toBe(route.title);
}

/**
 * Captura en `shots/e2e/{proyecto}/{nombre}.png`.
 *
 * El proyecto (desktop/mobile) va en el directorio para que las dos capturas del
 * mismo paso no se pisen, y `nombre` lleva locale + ruta + paso para poder
 * seguir un recorrido completo dentro de una pagina.
 *
 * `fullPage: true` por defecto: en `contribuir` y `evaluar` el formulario esta
 * bajo el fold y una captura de viewport no deja ver nada. El buffer se lee una
 * sola vez y se usa para el fichero y para el adjunto del reporte de CI.
 */
export async function shot(page: Page, info: TestInfo, name: string, fullPage = true): Promise<void> {
  const buffer = await page.screenshot({ fullPage });
  const dir = `shots/e2e/${info.project.name}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/${name}.png`, buffer);
  await info.attach(`${name}.png`, { body: buffer, contentType: 'image/png' });
}

/**
 * Falla si lo que se abrio es la pagina de error de Astro/workerd.
 *
 * Se llama DESPUES de cada navegacion y es la unica red de seguridad contra el
 * fallo que arrastraba esta suite: con `output: 'server'` + adaptador de
 * Cloudflare, un fallo de optimizeDeps devuelve una pagina que *parece* la de
 * error y el texto que el test busca no aparece. Sin esta comprobacion, un
 * fallo de arranque se manifestaria como un timeout sin diagnostico.
 */
export async function assertNoServerError(page: Page, url: string): Promise<void> {
  const body = await page.content();
  const broken = /Internal Server Error|ErrorOverlay|The file does not exist|workers\/runner-worker/.test(body);
  expect(
    broken,
    `Se renderizo una pagina de error del servidor en ${url}. Primeros 400 chars del HTML recibido:\n${body.slice(0, 400)}`,
  ).toBe(false);
}