/**
 * playwright.config.ts — E2E de PISAStyle.
 *
 * Decisiones (y por que):
 *
 * - `webServer` arranca el build + `astro preview` SOLO, en puerto fijo 4399 y
 *   ligado a 127.0.0.1. Se prueba el BUILD, no `astro dev`: el dev server con
 *   el adaptador de Cloudflare es el que devuelve 500 de forma intermitente
 *   (optimizeDeps) y el que se deja occupation en un puerto al abandonar la
 *   sesion. En CI el paso es exactamente el mismo que en local.
 *
 * - `--ignore-lock` es obligatorio. Astro 7 escribe `.astro/preview.json` y se
 *   niega a arrancar si el lock existe, aunque el PID ya haya muerto: hacia
 *   falta `astro preview stop` a mano y el pipeline se caia sin llegar a.test.
 *   Medido 2026-10-04 en este repo.
 *
 * - CI llama `pnpm run test:e2e`. El build va DENTRO del webServer porque el
 *   paso de preflight de deploy.yml no construye antes de `playwright test` y
 *   `astro preview` sin `dist/` no sirve nada.
 *
 * - Dos proyectos: `desktop` (1440x900) y `mobile` (390x844, con touch y DPR 3,
 *   que es lo que ve el visitante real en un movil). Mismos tests en ambos.
 *
 * - Fallo HONESTO: sin retries, sin `catch` que se trague errores y con
 *   `trace: 'retain-on-failure'` para poder ver que miraba el selector. Si un
 *   selector no existe, el test falla con el diff de Playwright.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4399);
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const isCI = !!process.env.CI;

// Chromium que arranca en este NixOS.
//
// En esta maquina el Chromium de Playwright (~/.cache/ms-playwright) NO arranca:
// es un binario generico de Linux al que NixOS no expone ~21 bibliotecas
// (libnspr4, libnss3, libglib-2.0, libatk, libX11, libgbm, libasound, ...).
// Anadir directorios del store a LD_LIBRARY_PATH lo va tapando pero no lo
// cierra y se rompe solo en cada actualizacion de NixOS, porque hay que acertar
// el hash de cada derivacion.
//
// La via que funciona es el Chromium DEL NIX, que trae sus propias
// dependencias, y decírselo a Playwright con `executablePath`.
// `scripts/with-nix-browser.sh` resuelve cual usar (perfil -> store ->
// Playwright) y exporta PISASYLE_BROWSER_PATH /
// PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH; por eso `test:e2e` lo invoca a traves de
// el script. Si la variable no esta (p.ej. en CI, donde el Chromium de
// Playwright si funciona), se usa el de Playwright sin tocar nada.
const exe = process.env.PISASYLE_BROWSER_PATH;
const launchOptions = exe ? { executablePath: exe, args: ['--no-sandbox'] } : {};

export default defineConfig({
  testDir: './tests/e2e',
  // Playwright recoge solo `*.spec.ts` / `*.test.ts`, asi que los helpers y el
  // global-setup de este mismo directorio no se ejecutan como tests.
  globalSetup: './tests/e2e/global-setup.ts',

  // El servidor es una unica instancia de workerd: en paralelo se pelean por
  // el puerto y los timeouts son ruido, no senal de un fallo real.
  workers: 1,
  fullyParallel: false,

  timeout: 45_000,
  expect: { timeout: 10_000 },
  forbidOnly: isCI,
  retries: 0,

  reporter: isCI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : [['list']],
  outputDir: 'test-results',

  use: {
    baseURL: BASE_URL,
    // NO se fija `locale` a proposito.
    //
    // `use.locale` cambia el Accept-Language del navegador y PISA lo usa para
    // resolver el idioma (src/middleware.ts). Al fijarlo a 'es-ES', el
    // `Accept-Language` que cada test pasa a `page.goto()` quedaba pisado por el
    // de Playwright: `/en/metodo` respondia `Content-Language: es` y el E2E
    // fallaba por algo que no era un fallo de la pagina sino del arnes.
    // Medido 2026-10-04: 15 de 37 tests en rojo por esto.
    // El idioma de cada test viaja en la cabecera que se pasa a `goto()`.
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(exe ? { launchOptions } : {}),
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // 390x844 (iPhone 14) con `isMobile`/`hasTouch`: sin eso Chromium se
      // comporta como escritorio y el layout movil nunca se ejecuta.
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },
  ],

  webServer: {
    // SOLO el preview. El build va en el script `test:e2e` (package.json), no
    // aqui dentro.
    //
    // Por que: `astro preview` no puede arrancar sin `dist/`, asi que el build
    // tiene que ocurrir antes — pero encadenarlo con `&&` dentro de webServer
    // hacia que Playwright viera el proceso padre salir con codigo 1 cuando el
    // build tardaba o el puerto 4399 seguia ocupado por el preview de la corrida
    // anterior (que Playwright aun no habia terminado de recoger). Medido
    // 2026-10-04: dos corridas seguidas, la segunda moria con
    // "Process from config.webServer was not able to start. Exit code: 1".
    //
    // Con el build fuera, este comando solo levanta el servidor: si falla, el
    // fallo es de verdad del servidor y el mensaje lo dice.
    command: `pnpm exec astro preview --ignore-lock --port ${PORT} --host ${HOST}`,
    url: `${BASE_URL}/es/explorar`,
    // Reutilizar solo si responde de verdad: si hay un preview zombie escuchando
    // en el puerto que no sirve el build actual, arrancar otro encima falla con
    // EADDRINUSE. En local (`!isCI`) se reutiliza el preview ya en pie, para no
    // tener que reconstruir en cada iteracion.
    reuseExistingServer: !isCI,
    // El preview tarda ~4s en levantar (workerd + bindings de Cloudflare).
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});