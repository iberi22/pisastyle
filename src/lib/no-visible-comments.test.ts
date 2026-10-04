import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Ningun comentario de codigo puede acabar visible en la pagina.
 *
 * — POR QUE ESTE TEST EXISTE —
 * `src/components/ContribForm.svelte` tenia un comentario de 15 líneas
 * (**POR QUE Svelte y no un form nativo...**) en la linea 1, es decir ANTES de
 * `<script lang="ts">`. En Svelte, lo que esta fuera de `<script>` y fuera de un
 * bloque `{#if}` es TEMPLATE: se renderiza como texto. La captura de
 * /contribuir mostraba el codigo fuente al visitante, en un recuadro, debajo de
 * la explicacion del flujo.
 *
 * No lo detecting ni el typecheck, ni los tests, ni el build: el comentario es
 * codigo valido y sale por un agujero de Svelte que nadie mire. Solo lo delata
 * una revision visual de la captura.
 *
 * Este test recorre los componentes y avisa si aparece un comentario de bloque
 * FUERA de `<script>`, que es exactamente el fallo que se coló.
 */
const SRC = join(process.cwd(), 'src');

function* svelteFiles(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* svelteFiles(p);
    else if (e.name.endsWith('.svelte')) yield p;
  }
}

describe('comentarios que se renderizan al usuario', () => {
  it('ningun .svelte tiene comentarios de bloque fuera de <script>', () => {
    const culpables: string[] = [];
    for (const ruta of svelteFiles(SRC)) {
      const fuente = readFileSync(ruta, 'utf-8');
      // Lo que hay antes del primer <script> es template puro.
      const antesDeScript = fuente.split(/<script/)[0];
      // Un comentario de bloque `/** ... */` ahi se renderiza como texto.
      const enPlantilla = antesDeScript.match(/\/\*[\s\S]*?\*\//g);
      if (enPlantilla) {
        culpables.push(`${ruta.replace(SRC + '/', '')}: ${enPlantilla.length} comentario(s) en la plantilla`);
      }
    }
    expect(culpables, `comentarios fuera de <script> (se ven en la pagina):\n  ${culpables.join('\n  ')}`).toEqual([]);
  });

  it('ContribForm tiene el bloque script (no es solo comentario)', () => {
    // Sonda: si este test falla, el fichero se vacio de contenido real.
    const fuente = readFileSync(join(SRC, 'components/ContribForm.svelte'), 'utf-8');
    expect(fuente).toContain('<script lang="ts">');
  });
});