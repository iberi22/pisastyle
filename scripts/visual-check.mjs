/**
 * Verificacion visual de PISAStyle (criterios de aceptacion del design review).
 *
 * Uso:  node scripts/visual-check.mjs [prefijo-de-salida]
 *   node scripts/visual-check.mjs before
 *   node scripts/visual-check.mjs after
 *
 * Para cada ruta captura desktop 1280 y movil 390, recoge errores de consola,
 * el overflow horizontal (documentElement.scrollWidth vs innerWidth) y el
 * tamano de los targets interactivos (WCAG 2.5.8 = 24x24 CSS px minimo).
 * Escribe un JSON de informe en .astro/visual/<prefijo>.json y las PNG en el
 * mismo directorio, para que el commit pueda citarlas.
 *
 * NO edita nada: es un script de solo lectura sobre el dev server.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.PISASTYLE_BASE_URL ?? 'http://127.0.0.1:4321';
const PREFIX = process.argv[2] ?? 'after';
const OUT = resolve(ROOT, '.astro/visual');

const ROUTES = [
  ['es', ''],
  ['es', 'explorar'],
  ['es', 'metodo'],
  ['es', 'novedades'],
];

const VIEWPORTS = [
  ['desktop', { width: 1280, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
];

const MIN_TARGET = 24; // WCAG 2.5.8 (AA, 24x24)

await mkdir(OUT, { recursive: true });

/* En NixOS el binario de ms-playwright no resuelve las libs del sistema
   (libnspr4.so): se usa el chromium del sistema como executablePath. */
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/run/current-system/sw/bin/chromium',
});
/* Calentamiento: la PRIMERA peticion de un dev server de Vite dispara la
   optimizacion de dependencias y un "server restarted", y esa respuesta se emite
   con el grafo de modulos a medias. Medir en ese estado da falsos negativos (el
   CSS inline de @swal/ui todavia no esta y los botones salen sin estilo), que es
   exactamente lo que hace esta medicion intermitente. Se descartan esas
   respuestas: lo que se compara es el estado estable del servidor. */
{
  const warm = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const warmPage = await warm.newPage();
  for (const [locale, path] of ROUTES) {
    await warmPage.goto(`${BASE}/${locale}${path ? `/${path}` : ''}`, { waitUntil: 'load' });
  }
  await warmPage.waitForTimeout(1200);
  await warm.close();
}
const report = { prefix: PREFIX, base: BASE, routes: [], consoleErrors: 0 };

for (const [locale, path] of ROUTES) {
  const entry = { route: `/${locale}${path ? `/${path}` : ''}`, viewports: {} };
  for (const [vpName, viewport] of VIEWPORTS) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

    await page.goto(`${BASE}/${locale}${path ? `/${path}` : ''}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(350);

    const metrics = await page.evaluate((minTarget) => {
      const doc = document.documentElement;
      const overflow = doc.scrollWidth > window.innerWidth + 1;
      const offenders = [];
      if (overflow) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > window.innerWidth + 1) {
            offenders.push(
              `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]} right=${Math.round(r.right)}`,
            );
          }
          if (offenders.length > 6) break;
        }
      }
      const small = [];
      for (const el of document.querySelectorAll('a, button, [role="button"], input, select, summary')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < minTarget || r.height < minTarget) {
          small.push(
            `${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 28)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
          );
        }
      }
      return {
        scrollWidth: doc.scrollWidth,
        innerWidth: window.innerWidth,
        overflow,
        overflowOffenders: offenders,
        smallTargets: small,
        // Los colores de texto/botones deben salir de los tokens --swal-*.
        buttons: [...document.querySelectorAll('button, a.cta, .cta')]
          .slice(0, 8)
          .map((el) => {
            const cs = getComputedStyle(el);
            return { text: (el.textContent || '').trim().slice(0, 24), color: cs.color, bg: cs.backgroundColor };
          }),
      };
    }, MIN_TARGET);

    const shot = resolve(OUT, `${PREFIX}-${vpName}-${locale}${path ? `-${path}` : ''}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    report.consoleErrors += errors.length;
    entry.viewports[vpName] = { shot, consoleErrors: errors.length, consoleMessages: errors, ...metrics };
    await context.close();
  }
  report.routes.push(entry);
}

await browser.close();
await writeFile(resolve(OUT, `${PREFIX}.json`), JSON.stringify(report, null, 2));

for (const r of report.routes) {
  for (const [vp, m] of Object.entries(r.viewports)) {
    const bad = m.overflow || m.consoleErrors > 0 || m.smallTargets.length > 0;
    console.log(
      `${bad ? 'FAIL' : ' ok '} ${vp.padEnd(7)} ${r.route.padEnd(16)} ` +
        `overflow=${m.overflow ? `YES(${m.overflowOffenders.join(', ')})` : 'no'} ` +
        `console=${m.consoleErrors} smallTargets=${m.smallTargets.length}` +
        (m.smallTargets.length ? ` -> ${m.smallTargets.slice(0, 4).join(' | ')}` : ''),
    );
  }
}
console.log(`\ntotal console errors: ${report.consoleErrors}`);
console.log(`informe: .astro/visual/${PREFIX}.json`);