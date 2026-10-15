# Despliegue de PISAStyle en Cloudflare Workers

Producción: **https://pisa.swal.network** (Worker `pisastyle`).
Staging: Worker `pisastyle-staging`, por su subdominio `*.workers.dev`.

El repo `iberi22/pisastyle` es **público**, así que no lleva ni un id de
Cloudflare. Este documento dice dónde viven los ids reales, cómo llegan al
bundle y qué comandos ejecuta quien despliega.

## 1. Qué es público y qué es privado

| Fichero | Estado | Qué lleva |
|---|---|---|
| `wrangler.example.toml` | **commiteado** | Plantilla: nombre, `compatibility_date`, `routes`, `[vars]` y los bindings opcionales **comentados** con placeholders `REPLACE-ME-*`. |
| `wrangler.toml` | **gitignored** | Config real: es la que lee `astro build` y el deploy. Se copia desde el overlay privado o se rellena a mano. |
| `private/infra/wrangler.toml` | gitignored (`/private/`) | Overlay del propietario (repo privado `iberi22/swal-infra`). Lo lee `scripts/infra-config.mjs` sin copiar nada. |
| `scripts/infra-config.mjs` | commiteado | Resuelve cuál usar: `wrangler.toml` → `private/infra/wrangler.toml` → `wrangler.example.toml`. |
| `scripts/normalize-wrangler-config.mjs` | commiteado | Fusiona la config resuelta en `dist/server/wrangler.json`, que es lo que lee `wrangler deploy`. |
| `scripts/check-public-tree.mjs` | commiteado | Puerta: falla si el árbol público lleva un id real, un fichero que no debería estar trackeado o un secreto. |

Mismo patrón que GARA-G y Fize. `pnpm run check:public` corre la puerta en local.

## 2. Cómo llegan los ids reales al bundle

Por orden de preferencia (lo decide `scripts/infra-config.mjs`):

1. **Overlay privado en el checkout**: `private/infra/wrangler.toml`. Basta con
   tenerlo; `normalize` lo lee directamente (no hay que copiar nada).
2. **`wrangler.toml` real** en la raíz, copiado del overlay. Es lo que hace el
   deploy del propietario:
   ```bash
   cp ~/proyectosSWAL/periferia/swal-infra/pisastyle/private/infra/wrangler.toml wrangler.toml
   ```
3. **Variables de entorno** (útil en CI, donde no hay overlay): un id
   `REPLACE-ME-*` se sustituye por `CF_<BINDING>_ID` (D1/KV) o
   `CF_<BINDING>_BUCKET` (R2). Ejemplo: `SWAL_KV` → `CF_SWAL_KV_ID`.
   `CF_ACCOUNT_ID` añade `account_id` al bundle.

Si no hay ninguna de las tres y la config declara un binding, `normalize`
**falla con exit 1** y dice qué recurso falta: un deploy “en verde” sin D1/KV es
peor que un deploy que no sale.

## 3. Bindings: cuáles usa el código hoy (medido 2026-10-15)

`rg -n "env\.[A-Z_]+" src workers functions --glob '!**/*.test.*'` da:

| Binding | ¿Uso real? |
|---|---|
| `SWAL_R2`, `SWAL_D1`, `SWAL_KV` | Solo aparecen en `src/lib/cloudflareVaultAdapter.ts`, y **ninguna página ni endpoint lo importa** (solo sus tests). Si no hay bindings, el adapter degrada a memoria. |
| `AI` | Cero usos: `9d8b05c` borró `workers/ai.ts` y `src/pages/api/ai/infer.ts`. |
| `SESSION` (KV) | Lo inyectaba el adapter de Astro por las sesiones. `astro.config.mjs` lleva `session: false` porque no hay un solo `Astro.session`; así no se auto-provisiona un KV que nadie escribe (la cuota free de KV, 1.000 escrituras/día, es de **toda** la cuenta SWAL). |
| `IMAGES` | Lo inyectaba el adapter para `astro:assets`. `imageService: 'passthrough'` porque no hay un solo `<Image>`; Cloudflare Images se factura por transformación. |
| `ASSETS` | Lo gestiona el adapter (estáticos de `dist/client`). No se declara a mano. |

Conclusión: **el deploy no necesita provisionar ningún recurso**. Los bloques
opcionales siguen comentados en `wrangler.example.toml` para cuando se cablee el
vault cifrado.

## 4. Comandos exactos

### 4.1 Deploy de producción (propietario, con overlay)

```bash
cd ~/wt/pisa-deploy            # o el worktree/checkout que toque
pnpm install --frozen-lockfile
cp ~/proyectosSWAL/periferia/swal-infra/pisastyle/private/infra/wrangler.toml wrangler.toml  # si no lo tienes ya
pnpm run check:public          # puerta: sin ids reales trackeados
pnpm run build                 # astro check && astro build
node scripts/normalize-wrangler-config.mjs --target production
npx wrangler deploy --config dist/server/wrangler.json --name pisastyle
```

El primer deploy crea el Worker `pisastyle`, el registro DNS de
`pisa.swal.network` y su certificado: la ruta es un **custom domain** de la zona
`swal.network`, que ya está en la cuenta, así que no hay paso manual de DNS.

### 4.2 Staging

```bash
node scripts/normalize-wrangler-config.mjs --target staging
npx wrangler deploy --config dist/server/wrangler.json --name pisastyle-staging
```
Staging no usa dominio propio (`workers_dev = true`) y se prueba en
`https://pisastyle-staging.iberi22.workers.dev`.

### 4.3 CI

`.github/workflows/deploy.yml` hace exactamente lo mismo salvo el `wrangler.toml`
real, que en el runner público no existe: `normalize` lee
`wrangler.example.toml`. Sin bindings declarados el resultado es desplegable
igual. El job **Verify deploy bundle** corta si el bundle conserva algún
`REPLACE-ME` o si a producción le falta la ruta `pisa.swal.network`.

### 4.4 Solo si algún día se cablea el vault cifrado

Estos comandos **no** hacen falta hoy (nada los lee). Si se activan los bindings
en el overlay/config real:

```bash
npx wrangler r2 bucket create swal-pisastyle-vault     # -> CF_SWAL_R2_BUCKET / bucket_name
npx wrangler d1 create swal-pisastyle                   # -> CF_SWAL_D1_ID / database_id
npx wrangler kv namespace create SWAL_KV                # -> CF_SWAL_KV_ID / id
npx wrangler d1 execute swal-pisastyle --file=./migrations/001_billing.sql
npx wrangler d1 execute swal-pisastyle --file=./migrations/002_domain.sql
```
Los ids que devuelve cada comando van **solo** a `wrangler.toml` (gitignored) o
al overlay privado, nunca a `wrangler.example.toml`.

## 5. Verificación antes de dar un deploy por bueno

```bash
pnpm install --frozen-lockfile
pnpm test                                   # vitest (unit)
pnpm run check                              # astro check: 0 errores
pnpm run build
node scripts/normalize-wrangler-config.mjs --target production
npx wrangler deploy --config dist/server/wrangler.json --name pisastyle --dry-run
curl -sSf -o /dev/null -w '%{http_code}\n' https://pisa.swal.network/es/explorar
```

El `--dry-run` no toca Cloudflare: sube el bundle en memoria y lista los
bindings que verá el Worker. Debe mostrar solo `env.ASSETS` y las vars.
