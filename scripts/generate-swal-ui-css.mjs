/**
 * PISAStyle — genera `src/styles/swal-ui-components.css` desde @swal/ui.
 *
 * POR QUE EXISTE (bug de dev, no de diseno):
 * `@swal/ui` se renderiza en el servidor, sin `client:*`, asi que Astro produce
 * HTML estatico con las clases del core (`swal-btn primary md svelte-8nvg8p`).
 * El CSS scoped de Svelte solo viaja con el bundle JS hidratado, y en `astro dev`
 * Vite externaliza `@swal/ui` en SSR: lo carga con un `import` nativo desde
 * node_modules SIN pasarlo por el pipeline de Svelte, asi que su CSS nunca entra
 * en el grafo de Vite y no se inyecta. Las clases quedan correctas en el DOM pero
 * CERO reglas las aplican, y el navegador pinta <Button> como boton nativo
 * (133x21, Times, padding 1px 6px). En `astro build` el CSS si viaja: ahi el
 * boton mide 161x40.
 *
 * QUE HACE ESTO:
 * Compila con `svelte/compiler` los MISMOS .svelte del core que consume esta app,
 * pasando como `filename` la ruta REAL que resuelve Node. De ahi sale el hash
 * `svelte-xxxxxxxx` que lleva el HTML, y por eso las reglas casan exactamente.
 *
 * Es un script de build, no runtime: `svelte/compiler` no puede cargarse dentro
 * de workerd, y el fichero generado se importa como CSS normal.
 *
 * No se transcribe ni un valor — el CSS sale del core, asi que un retoque alli se
 * refleja aqui regenerando. Y no se toca el core.
 *
 *   node scripts/generate-swal-ui-css.mjs   (lo invocan `pnpm dev` y `pnpm build`)
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';

/** Componentes de @swal/ui que PISAStyle renderiza en el servidor. */
export const SWAL_UI_SSR_COMPONENTS = [
  'Button',
  'Card',
  'Badge',
  'Input',
  'Table',
  'Tabs',
  'Skeleton',
  'StatusBadge',
];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/styles/swal-ui-components.css');

const BANNER = `/* GENERADO AUTOMATICAMENTE — NO EDITAR A MANO.
   Fuente: componentes Svelte de @swal/ui, compilados con \`svelte/compiler\`
   y el mismo \`filename\` que usa Vite, para que el hash \`svelte-*\` coincida
   con el del HTML SSR.
   Regenerar: node scripts/generate-swal-ui-css.mjs  (lo invocan \`pnpm dev\` y \`pnpm build\`).
   Si el boton vuelve a verse nativo, es que falta este fichero: en \`astro dev\`
   Vite externaliza @swal/ui y su CSS scoped nunca se inyecta. */`;

/**
 * Ruta real de un componente dentro de @swal/ui.
 *
 * No se usa `require.resolve('@swal/ui/components/...')`: el `exports` del core
 * solo declara la condicion `svelte`, asi que sin esa condicion la resolucion
 * falla. Ademas hace falta el `realpath` (el symlink de pnpm apunta al store, y
 * es la ruta resuelta la que Vite usa como `filename` al compilar).
 */
function resolveComponent(name) {
  const link = resolve(ROOT, 'node_modules/@swal/ui/src/components/' + name + '.svelte');
  return existsSync(link) ? realpathSync(link) : null;
}

export function swalUiComponentCss(components = SWAL_UI_SSR_COMPONENTS) {
  const chunks = [];
  const missing = [];

  for (const name of components) {
    const filename = resolveComponent(name);
    if (!filename) {
      missing.push(name);
      continue;
    }
    const { css } = compile(readFileSync(filename, 'utf8'), { filename });
    if (css && css.code) chunks.push(css.code);
  }

  if (missing.length) chunks.push('/* no resueltos: ' + missing.join(', ') + ' */');
  return [BANNER, ...chunks].join('\n') + '\n';
}

export function writeSwalUiCss() {
  const css = swalUiComponentCss();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, css, 'utf8');
  return { path: OUT, bytes: Buffer.byteLength(css) };
}

// Ejecutado como script (`node scripts/generate-swal-ui-css.mjs`).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { path, bytes } = writeSwalUiCss();
  console.log('swal-ui-css: ' + path + ' (' + bytes + ' bytes)');
}
