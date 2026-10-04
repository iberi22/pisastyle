/**
 * rutas.spec.ts — las 3 locales x 5 rutas, en desktop y movil.
 *
 * Cada test navega de verdad al build servido por `astro preview`, comprueba el
 * estado, el `<title>` en el idioma de la ruta, el `<h1>`, la nav global, los
 * `hreflang` y guarda la captura. Se ejecuta en los dos proyectos de
 * Playwright (1440x900 y 390x844), asi que cada ruta queda documentada en
 * escritorio y en movil.
 *
 * Sin `catch`, sin retries, sin `skip`: si el selector no existe o la ruta
 * responde otra cosa, el test falla con el diff de Playwright.
 */
import { test, expect } from '@playwright/test';
import { BROWSER_LOCALE, LOCALES, NAV_ARIA, ROUTES, assertNoServerError, expectTitle, pathFor, shot } from './helpers';

for (const locale of LOCALES) {
  test.describe(`PISAStyle — locale ${locale}`, () => {
    test.use({ locale: BROWSER_LOCALE[locale] });

    for (const route of ROUTES[locale]) {
      const url = pathFor(locale, route.slug);

      test(`${locale}/${route.slug} renderiza y responde 200`, async ({ page }, info) => {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

        expect(response, `La ruta ${url} no devolvio ninguna respuesta (servidor caido?)`).not.toBeNull();
        expect(response!.status(), `GET ${url} devolvio un estado no-200`).toBe(200);
        expect(response!.headers()['content-language'], `GET ${url} no fijo Content-Language`).toBe(locale);

        await assertNoServerError(page, url);

        // `<html lang>` debe ser el de la ruta: es lo que lee elCorrector y lo
        // que usan los lectores de pantalla.
        await expect(page.locator('html')).toHaveAttribute('lang', locale);

        await expectTitle(page, route, locale);

        if (route.h1) {
          const h1 = page.locator('h1').first();
          await expect(h1, `GET ${url} no tiene <h1>`).toBeVisible();
          await expect(h1).toHaveText(route.h1);
        }
        if (route.h2) {
          await expect(
            page.getByRole('heading', { level: 2, name: route.h2 }).first(),
            `GET ${url} no tiene el <h2> "${route.h2}"`,
          ).toBeVisible();
        }

        // Nav global en todas las rutas (404/500 la ocultan a proposito).
        const nav = page.getByRole('navigation', { name: NAV_ARIA[locale] });
        await expect(nav, `GET ${url} no tiene la nav global`).toBeVisible();
        for (const lang of ['es', 'en', 'pt']) {
          await expect(nav.locator(`a[hreflang="${lang}"]`), `${url}: falta el enlace a ${lang}`).toHaveCount(1);
        }

        await shot(page, info, `${locale}-${route.slug}-viewport`, true);
      });

      test(`${locale}/${route.slug} declara hreflang de las 3 locales`, async ({ page }) => {
        await page.goto(url);
        await assertNoServerError(page, url);

        // hreflang es lo que hace que Google indexe esto como 3 idiomas de la
        // misma pagina y no como 3 paginas duplicadas (ver Layout.astro).
        for (const lang of ['es', 'en', 'pt']) {
          await expect(
            page.locator(`link[rel="alternate"][hreflang="${lang}"]`),
            `GET ${url} no declara hreflang=${lang}`,
          ).toHaveAttribute('href', new RegExp(`/${lang}/${route.slug}$`));
        }
        // x-default apunta a en, el fallback internacional de pisa-i18n.
        await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
          'href',
          new RegExp(`/en/${route.slug}$`),
        );
      });
    }
  });
}