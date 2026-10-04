#!/usr/bin/env node
/**
 * Capturas de todas las rutas publicas, en escritorio y movil.
 *
 * Uso:  bash scripts/with-nix-browser.sh node scripts/capture-all.mjs
 *
 * Por que un script y no el suite de Playwright: esto no comprueba nada, solo
 * hace capturas para revision visual con humanos o con vision. Las aserciones
 * viven en tests/e2e/**.
 *
 * El HTML puede devolver 200 con 0 bytes de CSS, y eso se ve en la captura como
 * una pagina sin estilos. Por eso despues de cada captura se comprueban los
 * bytes de las hojas de estilo referenciadas: si estan vacias, la captura esta
 * mal aunque el HTML sea correcto.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.PISASYLE_BASE ?? 'http://127.0.0.1:4321';
const OUT = process.env.PISASYLE_SHOTS ?? 'shots/revision';
const exe = process.env.PISASYLE_BROWSER_PATH;

const LOCALES = ['es', 'en', 'pt'];
const PAGINAS = ['explorar', 'metodo', 'novedades', 'evaluar', 'contribuir'];

const VIEWPORTS = [
  { nombre: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false },
  { nombre: 'movil', width: 390, height: 844, dpr: 3, mobile: true },
];

mkdirSync(OUT, { recursive: true });

const fallos = [];
const lineas = [];

const browser = await chromium.launch({
  headless: true,
  ...(exe ? { executablePath: exe } : {}),
  args: ['--no-sandbox'],
});

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });

  for (const locale of LOCALES) {
    for (const pagina of PAGINAS) {
      const ruta = `/${locale}/${pagina}`;
      const etiqueta = `${locale}-${pagina}-${vp.nombre}`;
      const page = await context.newPage();
      try {
        const respuesta = await page.goto(`${BASE}${ruta}`, {
          waitUntil: 'load',
          timeout: 30000,
        });
        const status = respuesta?.status() ?? 0;
        if (status !== 200) {
          fallos.push(`${ruta} [${vp.nombre}] -> HTTP ${status}`);
        }

        // Las hojas de estilo tienen que traer bytes. Una captura sin estilos es
        // inutil para revisar, y el HTML puede ser 200 con los assets rotos.
        const hojas = await page.evaluate(() =>
          [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => ({
            href: l.getAttribute('href'),
            bytes: 0,
          })),
        );
        for (const hoja of hojas) {
          const r = await page.request.get(`${BASE}${hoja.href}`);
          const cuerpo = await r.body();
          hoja.bytes = cuerpo.length;
          if (cuerpo.length < 256) {
            fallos.push(`${ruta} [${vp.nombre}] hoja ${hoja.href} con ${cuerpo.length}B`);
          }
        }

        // Error de consola: una pagina que logue errores no esta lista.
        const archivo = join(OUT, `${etiqueta}.png`);
        await page.screenshot({ path: archivo, fullPage: false });
        lineas.push(
          `${etiqueta}: HTTP ${status}, ${hojas.length} hojas ` +
            `(${hojas.map((h) => `${h.bytes}B`).join(' ')}), captura ${archivo}`,
        );
      } catch (e) {
        fallos.push(`${ruta} [${vp.nombre}] -> ${String(e.message ?? e).split('\n')[0]}`);
      } finally {
        await page.close();
      }
    }
  }
  await context.close();
}

await browser.close();

writeFileSync(join(OUT, 'resumen.txt'), lineas.join('\n') + '\n');
console.log(lineas.join('\n'));

if (fallos.length > 0) {
  console.error(`\ncapture-all: ${fallos.length} problema(s):`);
  for (const f of fallos) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\ncapture-all: ${lineas.length} capturas sin fallos.`);
process.exit(0);