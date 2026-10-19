import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guardia contra regresiones de capturas E2E (swal-1018.pisa-03).
 *
 * — POR QUE ESTE TEST EXISTE —
 * Chromium tiene un limite de tamano de textura de 16384px. En mobile
 * (deviceScaleFactor: 3), `es/explorar` media 16641px de alto y la captura
 * fallaba en CI con "Unable to capture screenshot". Usar `scale: 'css'`
 * reduce el tamano de la captura y la mantiene dentro de los limites
 * permitidos para documentacion (en vez de hacer que la asercion sea
 * inestable o forzar un retry).
 */

const E2E_DIR = join(process.cwd(), 'tests/e2e');
const HELPERS_FILE = join(E2E_DIR, 'helpers.ts');
const CONFIG_FILE = join(process.cwd(), 'playwright.config.ts');

describe('Capturas de pantalla E2E', () => {
  it('helpers.ts llama a screenshot con scale: "css"', () => {
    const fuente = readFileSync(HELPERS_FILE, 'utf-8');
    // Regex that catches any .screenshot( call, taking the string inside up to the closing paren
    const matches = [...fuente.matchAll(/\.screenshot\(([^)]*)\)/g)];
    expect(matches.length, 'Debe existir al menos una llamada a screenshot en helpers.ts').toBeGreaterThan(0);

    for (const match of matches) {
        const args = match[1];
        expect(args, 'La llamada a screenshot debe incluir scale: \'css\'').toContain("scale: 'css'");
    }
  });

  it('todos los archivos en tests/e2e/ usan scale: "css" al capturar pantallas', () => {
    const files = readdirSync(E2E_DIR).filter(f => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(join(E2E_DIR, file), 'utf-8');
      const matches = [...content.matchAll(/\.screenshot\(([^)]*)\)/g)];
      for (const match of matches) {
          const args = match[1];
          expect(args, `${file} llama a screenshot sin scale: 'css'`).toContain("scale: 'css'");
      }
    }
  });

  it('mutaciones especificas fallan si no tienen scale: "css"', () => {
    // Simulamos contenidos de archivo que el test anterior deberia capturar
    const casosMalo = [
      'await page.screenshot()',
      'const b = await p.screenshot({ fullPage: true })',
      'await page.locator("body").screenshot({ fullPage: true })'
    ];

    for (const caso of casosMalo) {
      const matches = [...caso.matchAll(/\.screenshot\(([^)]*)\)/g)];
      expect(matches.length).toBe(1);
      const args = matches[0][1];
      expect(args).not.toContain("scale: 'css'");
    }
  });

  it('playwright.config.ts respeta la politica de zero-retry y documenta el dpr mobile', () => {
    const config = readFileSync(CONFIG_FILE, 'utf-8');

    // Fallo honesto: no esconder la inestabilidad.
    expect(config).toContain('retries: 0');

    // Documenta la causa del error.
    expect(config).toMatch(/deviceScaleFactor:\s*3/);

    // mobile project declaration.
    expect(config).toContain("name: 'mobile'");
  });
});
