/**
 * global-setup.ts — preparations antes del primer test.
 *
 * NO es un spec (Playwright solo recoge `*.spec.ts`).
 *
 * Su unico trabajo es dejar `shots/e2e/` limpio para que las capturas de la
 * ejecucion actual sean las unicas del informe. Los `.png` de una corrida
 * anterior con una ruta que ya no existe se eliminan en vez de quedarse: si el
 * informe mezcla capturas viejas con las nuevas, uno creye que la ruta rota
 * sigue ahi.
 *
 * No borra `test-results/` ni `playwright-report/`: de eso se encarga Playwright.
 */
import fs from 'node:fs';

const SHOTS_DIR = 'shots/e2e';

export default function globalSetup(): void {
  if (!fs.existsSync(SHOTS_DIR)) return;
  for (const project of fs.readdirSync(SHOTS_DIR, { withFileTypes: true })) {
    if (!project.isDirectory()) continue;
    for (const file of fs.readdirSync(`${SHOTS_DIR}/${project.name}`)) {
      if (file.endsWith('.png')) fs.rmSync(`${SHOTS_DIR}/${project.name}/${file}`);
    }
  }
}