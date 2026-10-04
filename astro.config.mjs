import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import cloudflare from '@astrojs/cloudflare';
import { VitePWA } from 'vite-plugin-pwa';

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
    // El runner de @astrojs/cloudflare carga los modulos SSR por ruta absoluta y el optimizador de
    // dependencias de Vite los re-optimiza y recarga a mitad de vuelo, de modo que `astro dev` puede
    // morir con: "The file does not exist at node_modules/.vite/deps_ssr/handler-*.js ... Try adding
    // it to optimizeDeps.exclude". Se excluye la integracion de Svelte del optimizador y el arranque
    // queda estable (necesario para `hermes verify` y para cualquier dev local).
    //
    // Lo que este config tenia antes y ya NO hace falta, porque se arreglo en el
    // core (2026-10-03, github.com/iberi22/swal-ui):
    //
    //   1. El alias `resolve.alias` hacia la ruta real de node_modules/@swal/ui.
    //      Existia solo porque `exports['.']` del core declaraba unicamente la
    //      condicion `svelte`, que el resolver de workerd no aplica — de ahi el
    //      "Unable to resolve [@swal/ui]" y el render cortado a mitad. Con la
    //      condicion `default` anadida en el core, el mapa de exports se resuelve
    //      solo y el alias sobra.
    //
    //   2. `@swal/ui` en este exclude. Mismo motivo: segunda barrera que ya no
    //      hace falta, y que ademas estorba (ver la nota de abajo).
    //
    // Y lo que NO hay que excluir, al reves de lo que sugiere el mensaje de
    // error: `@astrojs/cloudflare/entrypoints/server.js`. Exclusionarlo lo
    // EMPEORA: deja de crearse el archivo y workerd sigue pidiendolo, convirtiendo
    // un fallo intermitente en uno permanente (medido 2026-10-03: con el exclude
    // el 500 es SIEMPRE; sin el exclude es estable en 200).
    //
    // Si reaparece un fallo de deps_ssr tras limpiar: `rm -rf node_modules/.vite
    // .astro/dev.json` antes de arrancar. La cache corrupta no se recupera sola.
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