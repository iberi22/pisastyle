# lib — Cores reusables para forks (pay-per-use 5% + mesh-only 0$)

Este folder es el **SSOT para reusar en cualquier fork** (gara-g, hosteler-ia, flota). No copies logica a apps, importa de aqui.

## Stack: `domain.config.ts` -> todo lo demas

Unico archivo obligatorio por app: `domain.config.ts` (appId + entities[] + billing). De ahi derivan:
- Xavier ns `app/{appId}/instance/{id}` (xavier.ts)
- Mesh room `swal/{appId}/{id}` (mesh.ts + yjsFleet.ts)
- D1/R2 vault path `packs/{appId}/{instanceId}/{entity}/{id}.json` (cloudflareVaultAdapter.ts + @swal/vault)
- Surreal/D1 DDL (domain.ts surrealDefineTable)

## Modulos reusables

- `domain.ts` — CRUD generico con instance_id isolation. StorageAdapter pluggable.
- `cloudflareVaultAdapter.ts` — **Nuevo core**: StorageAdapter 100% cifrado. Si hay env.SWAL_R2/D1 usa @swal/vault AES-GCM+Shamir 2/3 -> R2 ciphertext + D1 sealed_meta + KV shares. Si no hay bindings, fallback memoria (mesh-only gratis via replica P2P en otros nodos gara-g). 1 camion = 100 camiones mismo costo (solo bytes, no fee por vehiculo).
- `@swal/vault` (cores/swal-vault) — crypto primitiva: createSealedPack/unpack/verify + R2StorageClient. Reusable gara-g/hosteler-ia/flota.
- `billing.ts` — **pay-per-use 5%**: SWAL_HANDLING 0.05 (antes 0.20), TIERS mesh-only/payg/payg-managed (legacy socio->payg), calculatePrice, creditStatus, canAfford, isOverage, checkR2Quota, cfAiInfer. Mesh-only no cobra, payg cobra infra+AI con margen+handling con overage permitido (ver docs privados).
- `yjsFleet.ts` + `fleetStore.ts` + `mesh.ts` — Yjs y-webrtc + y-indexeddb offline-first, replica P2P (3+ peers) para persistencia sin pagar.
- `xavier.ts` + `xavierSync.ts` — memoria agentica por namespace.
- `surreal.ts` — stub legacy, ahora preferir cloudflareVaultAdapter.
- `billing.test.ts` + `cloudflareVaultAdapter.test.ts` + `domain.test.ts` — tests de reuso.

## Crear una app nueva (2 comandos, mismo stack, diferente modelo negocio)

```bash
node cores/swal-app-template/scripts/create-app.mjs mi-flota --target apps/mi-flota --entities "vehicle,fleet,driver,maintenance,fuelLog"
cd apps/mi-flota && pnpm install && pnpm run build
# edita src/lib/domain.config.ts: cambia appName, entities fields, billing.mode mesh-only|payg
```

El script reescribe package.json name, domain.config appId/entities, wrangler.toml name, manifest.json. Todo lo demas (vault/mesh/billing/UI) se reusa sin copiar.

## Activar vault cifrado en tu app (onMount)

```ts
import { setStorageAdapter } from '../lib/domain';
import { CloudflareVaultAdapter } from '../lib/cloudflareVaultAdapter';
import { billing } from '../lib/domain.config';

// mesh-only: 0$ (no env) -> replica P2P gratis
// payg: con env.SWAL_R2/D1/KV -> 5% handling sobre consumo real
const env: any = (import.meta as any).env ?? {};
if (env.PUBLIC_WANT_CLOUD === '1' && env.PUBLIC_EDGE_HIVE_URL) {
  const adapter = new CloudflareVaultAdapter({ SWAL_R2: env.SWAL_R2, SWAL_D1: env.SWAL_D1, SWAL_KV: env.SWAL_KV }, billing.appId);
  setStorageAdapter(adapter);
}
```

## Wrangler bindings (por app, mismo 5%)

```
[[r2_buckets]] binding="SWAL_R2" bucket_name="swal-{appId}-vault"
[[d1_databases]] binding="SWAL_D1" database_name="swal-billing" (compartido)
[[d1_databases]] binding="SWAL_DOMAIN_D1" database_name="swal-{appId}-domain"
[[kv_namespaces]] binding="SWAL_KV" id="..."
[ai] binding="AI"
```

D1 migrations: `migrations/001_billing.sql` (credits/invoices/sealed_meta/subscriptions) + `002_domain.sql` (plantilla por entity).

## UI reuso

Usa `@swal/ui` (tokens --swal-bg etc) + `AuiRenderer.svelte` + `CreditMeter.svelte` + `ProBadge.svelte`. No crear UI local.

## Notas pay-per-use

- 1 = 100 camiones mismo precio (no hay fee por vehiculo/entidad, solo bytes R2 + rows D1 + tokens AI).
- Si no usas backend, distribuye DB en otros nodos gara-g via edge-mesh Yjs (y-webrtc 20 peers + y-indexeddb) -> persistencia sin pagar.
- Overages se cobran, no bloquean (402 solo para mesh-only/free sin credito).
