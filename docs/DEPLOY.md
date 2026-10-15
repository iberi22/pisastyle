# Despliegue de PISAStyle en Cloudflare Workers

Producción: **https://pisa.swal.network** (Worker `pisastyle`).
Staging: Worker `pisastyle-staging`, por su subdominio `*.workers.dev`.

## 1. Configuración

| Fichero | Estado | Qué lleva |
|---|---|---|
| `wrangler.toml` | **commiteado** | Todo lo que necesita el deploy: `name`, `compatibility_date`/`compatibility_flags`, `workers_dev = true`, la ruta de `pisa.swal.network` como **custom domain** y dos vars de diagnóstico. **Ningún id**: sin `account_id` y sin bindings. |
| `dist/server/wrangler.json` | generado por el build | Lo que lee `wrangler deploy --config`: `astro build` copia a él el `wrangler.toml` de la raíz (nombre, compat, vars, `routes`, `workers_dev`) y le añade `main` y el binding `ASSETS`. |

La cuenta la resuelve `wrangler`: login local (`wrangler login`) o el secreto
`CLOUDFLARE_ACCOUNT_ID` en CI. No hay overlay privado, ni plantilla, ni
sustitución de placeholders: no hay nada que esconder porque no hay ids.

## 2. Bindings: ninguno (medido 2026-10-15)

`rg -n "env\.[A-Za-z_]+" src workers functions --glob '!**/*.test.*'` solo
devuelve `src/lib/cloudflareVaultAdapter.ts` (`SWAL_R2`/`SWAL_D1`/`SWAL_KV`), y
ninguna página ni endpoint lo importa: únicamente sus tests. Sin bindings, ese
adapter degrada a memoria.

| Binding que aparecía antes | Por qué no está |
|---|---|
| `SWAL_R2`, `SWAL_D1`, `SWAL_KV` | Solo los lee `cloudflareVaultAdapter.ts`, sin importadores reales |
| `AI` | Cero usos: `9d8b05c` borró `workers/ai.ts` y `src/pages/api/ai/infer.ts` |
| `SESSION` (KV) | `astro.config.mjs` lleva `session: false` (0 usos de `Astro.session`); activo, el adapter auto-provisionaba un namespace KV que nadie escribe |
| `IMAGES` | `imageService: 'passthrough'` (0 usos de `<Image>`); Cloudflare Images se factura por transformación |
| `ASSETS` | Lo aporta el adapter para los estáticos de `dist/client`; no se declara a mano |

KV (1.000 escrituras/día), D1 y R2 son cuota **de toda la cuenta SWAL**, así que
la regla es: no se declara un binding que ningún código lea.

`deploy.yml` lo protege: el paso **Verify deploy config** falla si `wrangler.toml`
lleva `REPLACE-ME` o un bloque `[[d1_databases]]`/`[[r2_buckets]]`/
`[[kv_namespaces]]`, y si al bundle le falta la ruta `pisa.swal.network` con
`custom_domain = true`. Si algún día se cablea el vault cifrado, ese id **no**
puede ir a `wrangler.toml` (es público): va por el mecanismo privado que se decida
en ese PR, y la puerta del CI se actualiza en el mismo cambio.

## 3. Comandos

```bash
pnpm install --frozen-lockfile
pnpm run build          # astro check && astro build
npx wrangler deploy --config dist/server/wrangler.json
```

El primer deploy crea el Worker, el registro DNS de `pisa.swal.network` y su
certificado: la ruta es un **custom domain** de la zona `swal.network`, que ya
está en la cuenta, así que no hay paso manual de DNS.

Staging añade `--name pisastyle-staging` (así nunca pisa el Worker de
producción). El workflow quita `routes` del bundle antes de desplegar staging, así
que staging queda solo en `pisastyle-staging.<cuenta>.workers.dev` y nunca reclama
`pisa.swal.network`. A mano, haz lo mismo antes del deploy de staging.

## 4. CI

`.github/workflows/deploy.yml`: preflight (`astro check`, `vitest`, build + E2E de
Playwright), build del SSR, la puerta de configuración y `wrangler deploy
--config dist/server/wrangler.json --name <worker>`. Luego smoke HTTP contra la
URL del target y tag de versión solo en producción.

## 5. Verificación antes de dar un deploy por bueno

```bash
pnpm install --frozen-lockfile
pnpm test                                                    # vitest (unit)
pnpm exec astro check                                        # 0 errores
pnpm run build
npx wrangler deploy --dry-run --config dist/server/wrangler.json
```

El `--dry-run` no toca Cloudflare: sube el bundle en memoria. Debe listar como
únicos bindings `env.ASSETS` y las dos vars de diagnóstico.
