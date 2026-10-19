import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guardia contra regresiones de capturas E2E (swal-1018.pisa-03).
 *
 * — POR QUE ESTE TEST EXISTE —
 * Chromium tiene un limite de tamano de textura de 16384 px. En mobile
 * (`deviceScaleFactor: 3`) `es/explorar` media 16641 px de alto y la captura
 * fallaba en CI con `Unable to capture screenshot`. Dos ajustes lo evitan:
 *
 *   1. `scale: 'css'` en la captura: reduce la imagen a pixeles CSS, asi que
 *      queda bajo el limite de textura.
 *   2. `reducedMotion: 'reduce'` en `playwright.config.ts`: la pagina se captura
 *      en su estado final, no a mitad de una animacion de entrada.
 *
 * Las capturas son documentacion, no aserciones: la politica sigue siendo
 * "fallo honesto" (`retries: 0`, sin `catch`), asi que la unica defensa contra
 * el fallo intermitente es que nadie pueda quitar estos ajustes sin que un test
 * se ponga rojo. Ese test es este.
 *
 * — POR QUE ES ESTATICO —
 * No lanza un navegador: lee los fuentes y comprueba la regla. Un guardia que
 * necesita Chromium no corre en `pnpm test` (vitest) y por tanto no protegeria
 * nada en el commit que rompe la captura.
 */

const E2E_DIR = join(process.cwd(), 'tests/e2e');
const HELPERS_FILE = join(E2E_DIR, 'helpers.ts');
const CONFIG_FILE = join(process.cwd(), 'playwright.config.ts');

/** La regla: `scale` explicito y en `'css'`. */
const CSS_SCALE = /scale\s*:\s*['"]css['"]/;

/**
 * Quita los comentarios antes de examinar un fuente.
 *
 * Sin esto el guardia se engana solo: `helpers.ts` explica en su JSDoc que usa
 * `scale: 'css'`, asi que bastaba con borrar el ajuste del codigo y dejar el
 * comentario para que la comprobacion siguiera pasando. Un ajuste que solo
 * vive en prosa no protege nada.
 */
function stripComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, '');
  // `//` dentro de una cadena (`http://`) no es comentario: solo se corta la
  // linea cuando el `//` no va precedido de `:` ni de una comilla.
  return withoutBlocks.replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/**
 * Devuelve cada llamada a `.screenshot(...)` del fuente con su numero de linea.
 *
 * El escaneo cuenta parentesis en vez de cortar en el primer `)`: una ruta con
 * `join(dir, name)` dentro de las opciones no debe partirse la llamada por la
 * mitad y dejar el ajuste fuera del texto examinado.
 */
function screenshotCalls(source: string): { args: string; line: number }[] {
  const calls: { args: string; line: number }[] = [];
  const pattern = /\.screenshot\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const open = match.index + match[0].length;
    let depth = 1;
    let end = open;
    for (; end < source.length && depth > 0; end++) {
      if (source[end] === '(') depth++;
      else if (source[end] === ')') depth--;
    }
    calls.push({
      args: source.slice(open, Math.max(open, end - 1)),
      line: source.slice(0, match.index).split('\n').length,
    });
  }
  return calls;
}

/** Llamadas a `screenshot` del fuente que NO fijan `scale: 'css'`. */
function callsMissingCssScale(source: string): string[] {
  return screenshotCalls(source)
    .filter(({ args }) => !CSS_SCALE.test(args))
    .map(({ line }) => `linea ${line}`);
}

/** Fuente sin comentarios, listo para comprobar la configuracion. */
function codeOf(file: string): string {
  return stripComments(readFileSync(file, 'utf-8'));
}

describe('Capturas de pantalla E2E', () => {
  it('helpers.ts captura con scale: "css"', () => {
    const source = codeOf(HELPERS_FILE);
    const calls = screenshotCalls(source);

    expect(calls.length, 'helpers.ts deberia capturar pantallas').toBeGreaterThan(0);
    expect(
      callsMissingCssScale(source),
      `helpers.ts captura sin scale: 'css' (${callsMissingCssScale(source).join(', ')}). ` +
        'Es el ajuste que mantiene la captura bajo el limite de textura de 16384 px de Chromium.',
    ).toEqual([]);
  });

  it('ningun archivo de tests/e2e captura sin scale: "css"', () => {
    const files = readdirSync(E2E_DIR).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const source = codeOf(join(E2E_DIR, file));
      offenders.push(...callsMissingCssScale(source).map((where) => `${file} (${where})`));
    }

    expect(
      offenders,
      `Capturas sin scale: 'css': ${offenders.join(', ')}. Si la captura es a proposito en pixeles de dispositivo, documenta aqui por que no rompe el limite de 16384 px.`,
    ).toEqual([]);
  });

  it('playwright.config.ts fija la politica de captura estable', () => {
    const config = codeOf(CONFIG_FILE);

    // Fallo honesto: la inestabilidad no se esconde con retries.
    expect(config, 'retries debe seguir en 0').toContain('retries: 0');

    // La causa raiz: mobile sigue midiendose con DPR 3.
    expect(config, 'el proyecto mobile debe mantener deviceScaleFactor: 3').toMatch(/deviceScaleFactor:\s*3/);
    expect(config, 'el proyecto mobile debe seguir declarado').toContain("name: 'mobile'");

    // Ajuste de animaciones: sin el, una captura puede caer a mitad de fade-in.
    expect(
      config,
      "playwright.config.ts debe fijar reducedMotion: 'reduce' para capturar la pagina en su estado final",
    ).toMatch(/reducedMotion:\s*['"]reduce['"]/);
  });

  it('la guardia detecta las mutaciones reales sobre helpers.ts (no es vacua)', () => {
    const real = codeOf(HELPERS_FILE);

    // La llamada real del CODIGO. Si se muta el comentario el guardia no se
    // entera y la prueba seria mentira, asi que se parte del fuente sin
    // comentarios y se exige que la llamada exista tal cual.
    const CALL = "page.screenshot({ fullPage, scale: 'css' })";
    expect(real, `helpers.ts deberia contener la llamada ${CALL}`).toContain(CALL);

    const mutations: [string, string][] = [
      ['quitar la opcion scale', real.replace(CALL, 'page.screenshot({ fullPage })')],
      ['escalar a device', real.replace(CALL, "page.screenshot({ fullPage, scale: 'device' })")],
      ['capturar sin opciones', real.replace(CALL, 'page.screenshot()')],
      ['anadir una segunda captura sin scale', `${real}\nconst otra = await page.screenshot({ fullPage: true });`],
    ];

    for (const [name, mutated] of mutations) {
      // Sanidad: la mutacion tiene que haber cambiado algo. Si no, su patron
      // esta roto y el test pasaria sin comprobar nada.
      expect(mutated, `la mutacion "${name}" no modifico el fuente; revisa su patron`).not.toBe(real);
      expect(
        callsMissingCssScale(mutated),
        `la mutacion "${name}" deberia ser detectada por el guardia`,
      ).not.toEqual([]);
    }
  });

  it('la guardia detecta si se quita reducedMotion de la config', () => {
    const real = codeOf(CONFIG_FILE);
    expect(real).toMatch(/reducedMotion:\s*['"]reduce['"]/);

    // Misma comprobacion que el test de la config, sobre la fuente mutado.
    const mutated = real.replace(/reducedMotion:\s*['"]reduce['"],?/, '');
    expect(mutated, 'la mutacion no modifico playwright.config.ts').not.toBe(real);
    expect(mutated).not.toMatch(/reducedMotion:\s*['"]reduce['"]/);
  });
});
