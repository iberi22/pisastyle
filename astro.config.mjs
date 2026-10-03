import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import cloudflare from '@astrojs/cloudflare';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// workerd (el runtime de `astro dev` con el adaptador de Cloudflare) no resuelve
// `@swal/ui`: el `exports` del core solo declara la condicion `svelte`, que el
// resolver de workerd no aplica, y el import a mano falla con
// "Unable to resolve [@swal/ui]", dejando la pagina a medio renderizar (HTML
// truncado justo antes de <Toaster>, y /es/metodo en 500). Un alias a la ruta
// real del paquete sortea el mapa de `exports`. Es ajuste de la APP: el core no
// se toca. La ruta se resuelve con fileURLToPath para no hardcodear el symlink
// de pnpm ni una ruta absoluta.
const swalUiPkg = fileURLToPath(new URL('./node_modules/@swal/ui/', import.meta.url));

export default defineConfig({
  site: 'https://pisa.swal.network',
  output: 'server',
  adapter: cloudflare(),
  // Escucha explicita en IPv4: por defecto `astro dev` se ata solo a [::1] y cualquier sonda que
  // use http://127.0.0.1 (monitores, `hermes verify`, contenedores, curl desde un host) recibe
  // "connection refused" aunque el servidor este perfectamente vivo.
  server: { host: '127.0.0.1' },
  integrations: [svelte()],
  vite: {
    // Ver el comentario de `swalUiPkg` mas arriba: sin este alias workerd no
    // resuelve `@swal/ui` y el render de la pagina se corta a mitad.
    resolve: {
      alias: [{ find: /^@swal\/ui$/, replacement: swalUiPkg + 'src/components/index.js' }],
    },
    // El runner de @astrojs/cloudflare carga los modulos SSR por ruta absoluta y el optimizador de
    // dependencias de Vite los re-optimiza y recarga a mitad de vuelo, de modo que `astro dev` moria
    // con: "The file does not exist at node_modules/.vite/deps_ssr/handler-*.js ... Try adding it to
    // optimizeDeps.exclude". Se excluye la integracion de Svelte del optimizador y el arranque queda
    // estable (necesario para `hermes verify` y para cualquier dev local de este template).
    optimizeDeps: {
      exclude: ['@astrojs/svelte/server.js', '@astrojs/svelte'],
    },
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon-192.png', 'icon-512.png'],
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.swal\.dev\/.*/i,
              handler: 'NetworkFirst',
              options: { cacheName: 'api', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 } },
            },
          ],
        },
      }),
    ],
  },
});
