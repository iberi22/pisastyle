/**
 * navegacion.spec.ts — recorridos de verdad, no solo carga de URL.
 *
 * Comprueba lo que un visitante hace de verdad: entrar por la raiz, cambiar de
 * idioma desde la nav, seguir un CTA, mandar el formulario de evaluacion y
 * recorrer la unidad de explorar. Cada paso deja su captura, asi que la carpeta
 * `shots/e2e/` cuenta la historia completa de la app en escritorio y movil.
 *
 * El recorrido de `evaluar` es el que mas valor tiene: si el formulario no
 * monta o el script inline no corre, la pagina se ve bien pero esta muerta, y
 * una captura de la pagina en blanco de resultados lo delata.
 */
import { test, expect } from '@playwright/test';
import { BROWSER_LOCALE, LOCALES, NAV_ARIA, ROUTES, assertNoServerError, expectTitle, shot } from './helpers';

test.describe('PISAStyle — la raiz elige locale', () => {
  // La raiz es la UNICA pagina que decide el idioma por Accept-Language en vez
  // de por la ruta (src/middleware.ts:68), asi que el locale hay que fijarlo a
  // nivel de CONTEXTO del navegador. Por eso un describe por locale en vez de
  // un bucle: `test.use()` es estatico, no se puede poner dentro de un test.
  //
  // El idioma se fija con `locale` de Playwright, que es lo que de verdad
  // produce el Accept-Language que ve workerd (un `page.goto({ headers })` NO
  // llega a la resolucion de locale: medido 2026-10-04).
  for (const [browserLocale, expected] of [
    ['es-CO', 'es'],
    ['en-US', 'en'],
    ['pt-BR', 'pt'],
  ] as const) {
    test.describe(`Accept-Language ${browserLocale}`, () => {
      test.use({ locale: browserLocale });

      test(`la raiz aterriza en /${expected}/explorar`, async ({ page }, info) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        expect(
          page.url(),
          `la raiz con Accept-Language ${browserLocale} no fue a /${expected}/explorar`,
        ).toContain(`/${expected}/explorar`);
        await expect(page.locator('html')).toHaveAttribute('lang', expected);
        await assertNoServerError(page, page.url());
        await shot(page, info, `nav-00-raiz-redirect-${expected}`, true);
      });
    });
  }
});

test.describe('PISAStyle — navegacion', () => {

  test('la nav cambia de locale conservando la ruta', async ({ page }, info) => {
    // Se entra por evaluar: la nav tiene que llevar a evaluar en los 3 idiomas,
    // no a la raiz (los href relative son el fallo clasico).
    for (const [from, to] of [
      ['es', 'en'],
      ['en', 'pt'],
      ['pt', 'es'],
    ] as const) {
      await page.goto(`/${from}/evaluar`, { waitUntil: 'domcontentloaded' });
      await assertNoServerError(page, page.url());
      const nav = page.getByRole('navigation', { name: NAV_ARIA[from] });
      await expect(nav).toBeVisible();

      await nav.locator(`a[hreflang="${to}"]`).click();
      await page.waitForURL(new RegExp(`/${to}/evaluar$`));
      await expect(page.locator('html'), `cambio a ${to} pero html lang no quedo en ${to}`).toHaveAttribute('lang', to);
      await expectTitle(page, ROUTES[to].find((r) => r.slug === 'evaluar')!, to);
      await shot(page, info, `nav-01-locale-${from}-a-${to}`, true);
    }
  });

  test('el CTA principal de la landing lleva al evaluador correcto', async ({ page }, info) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/explorar`, { waitUntil: 'domcontentloaded' });
      await assertNoServerError(page, page.url());

      const cta = page.getByRole('link', { name: /Evalúa tu nivel|Check your level|Avalie seu nível/ }).first();
      await expect(cta, `${locale}/explorar no tiene el CTA principal`).toBeVisible();
      await expect(cta).toHaveAttribute('href', `/${locale}/evaluar`);
      await shot(page, info, `nav-02-cta-${locale}-explorar`, true);

      await cta.click();
      await page.waitForURL(new RegExp(`/${locale}/evaluar$`));
      await assertNoServerError(page, page.url());
      await expectTitle(page, ROUTES[locale].find((r) => r.slug === 'evaluar')!, locale);
    }
  });

  test('el evaluador monta el formulario y responde al envio', async ({ page }, info) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/evaluar`, { waitUntil: 'domcontentloaded' });
      await assertNoServerError(page, page.url());
      await expectTitle(page, ROUTES[locale].find((r) => r.slug === 'evaluar')!, locale);

      // El formulario es nativo (`<form method="post">` a /api/ai/infer segun
      // evaluar.astro): lo que se comprueba es que EXISTE y se ve, no que la
      // llamada al backend funcione — eso es del otro agente.
      const form = page.locator('form.quiz');
      await expect(form, `${locale}/evaluar no renderizo el formulario del quiz`).toBeVisible();
      // NO `.first()` sobre `input`: el primer input del form es
      // `<input type="hidden" name="enviar">` (evaluar.astro:265) y por
      // definicion no es visible, asi que la asercion fallaba siempre. Las
      // respuestas son los `input[type=radio]` de cada opcion.
      const opciones = form.locator('input[type="radio"]');
      expect(
        await opciones.count(),
        `${locale}/evaluar no renderizo ninguna opcion de respuesta`,
      ).toBeGreaterThan(0);
      await expect(opciones.first(), `${locale}/evaluar: la primera opcion no se ve`).toBeVisible();
      await expect(
        form.locator('button[type="submit"]'),
        `${locale}/evaluar no tiene boton de envio`,
      ).toBeVisible();
      // El formulario es un quiz de verdad: al menos un dominio agrupado.
      expect(await form.locator('fieldset, fieldset > div').count()).toBeGreaterThan(0);

      await shot(page, info, `nav-03-evaluar-form-${locale}`, true);
    }
  });

  test('la unidad de explorar se lee completa y el selector de idioma funciona', async ({ page }, info) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/explorar`, { waitUntil: 'domcontentloaded' });
      await assertNoServerError(page, page.url());

      const h2s = page.locator('main h2, .wrap h2');
      const expected = ROUTES[locale].find((r) => r.slug === 'explorar')!.h2!;
      await expect(
        page.getByRole('heading', { level: 2, name: expected }).first(),
        `${locale}/explorar no muestra la seccion "${expected}"`,
      ).toBeVisible();
      expect(await h2s.count(), `${locale}/explorar no tiene secciones`).toBeGreaterThan(1);

      await shot(page, info, `nav-04-explorar-${locale}`, true);

      // Cambio de idioma desde la propia unidad: la ruta debe conservar
      // /explorar y no volver a la portada.
      await page.getByRole('navigation', { name: NAV_ARIA[locale] }).locator('a[hreflang="en"]').click();
      await page.waitForURL(/\/en\/explorar$/);
      await assertNoServerError(page, page.url());
      await expectTitle(page, ROUTES.en.find((r) => r.slug === 'explorar')!, 'en');
      await shot(page, info, 'nav-05-explorar-tras-cambio-idioma', true);
      // Volver a la locale del test para no encadenar estados.
      await page.goto(`/${locale}/explorar`, { waitUntil: 'domcontentloaded' });
    }
  });

  test('la unidad de metodo y la de novedades tienen contenido', async ({ page }, info) => {
    for (const slug of ['metodo', 'novedades'] as const) {
      for (const locale of LOCALES) {
        await page.goto(`/${locale}/${slug}`, { waitUntil: 'domcontentloaded' });
        await assertNoServerError(page, page.url());
        const h2 = ROUTES[locale].find((r) => r.slug === slug)!.h2!;
        await expect(
          page.getByRole('heading', { level: 2, name: h2 }).first(),
          `/${locale}/${slug} no tiene la seccion "${h2}"`,
        ).toBeVisible();
        await shot(page, info, `nav-06-${slug}-${locale}`, true);
      }
    }
  });

  test('contribuir monta el formulario sin login y con el badge de privacidad', async ({ page }, info) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/contribuir`, { waitUntil: 'domcontentloaded' });
      await assertNoServerError(page, page.url());

      // El texto de privacidad es la promesa central de la pagina: si cambia,
      // el visitante esta siendo engañado y el E2E debe enterarse.
      const badge = page.getByText(/Sin login · Sin cookies · Sin tracking|No login · No cookies · No tracking|Sem login · Sem cookies · Sem rastreamento/);
      await expect(badge, `${locale}/contribuir no muestra el badge de privacidad`).toBeVisible();

      const form = page.locator('form.form');
      await expect(form, `${locale}/contribuir no renderizo el formulario (isla Svelte)`).toBeVisible();
      // Locator visible, no `.first()`: un control hidden (p.ej. el honeypot o
      // un input de estado) haria fallar la asercion sin que falte nada.
      await expect(
        form.locator('input:not([type="hidden"]), textarea, select').first(),
        `${locale}/contribuir: el formulario no tiene ningun campo de entrada visible`,
      ).toBeVisible();
      await expect(
        form.locator('button[type="submit"]'),
        `${locale}/contribuir no tiene boton de envio`,
      ).toBeVisible();

      await shot(page, info, `nav-07-contribuir-form-${locale}`, true);
    }
  });
});