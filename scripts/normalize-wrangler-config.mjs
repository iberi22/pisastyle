#!/usr/bin/env node
// scripts/normalize-wrangler-config.mjs — Fusiona la config real en el bundle que
// lee `wrangler deploy` (dist/server/wrangler.json).
//
// POR QUE EXISTE
//   `astro build` (@astrojs/cloudflare) emite dist/server/wrangler.json a partir
//   del wrangler.toml que encuentre. Si no hay ninguno (repo publico, fichero
//   gitignored) emite un config con `name` de package.json, la fecha de
//   compatibilidad del dia, SIN vars y SIN rutas. Desplegar eso publica un
//   Worker sin dominio propio: exactamente el fallo de los 20 runs de deploy.
//   Este script parte del JSON de Astro y SOLO corrige/anade lo que falta; nunca
//   borra un binding declarado.
//
// COMO SE DECIDE QUE ES "REAL"
//   scripts/infra-config.mjs resuelve: wrangler.toml (real, overlay) ->
//   private/infra/wrangler.toml -> wrangler.example.toml (plantilla publica).
//   Con la plantilla el script AVISA y omite los bindings con placeholder: el
//   bundle sirve para el dry-run y para CI (la app no usa bindings), pero no
//   provisiona nada. Con la config real, un id `REPLACE-ME` es un ERROR duro:
//   asi el deploy no puede salir "en verde" sin base de datos.
//
// USO
//   node scripts/normalize-wrangler-config.mjs [--target production|staging]
//                                              [--name <worker>] [--strict]
//   `--strict` (deploy real): un id `REPLACE-ME-*` es error. Sin el, la
//   plantilla o un `WRANGLER_TOML_IN` solo avisan y omiten esos bindings.
//   Variables: NORMALIZE_OUT (destino alternativo, lo usan los tests),
//              WRANGLER_TOML_IN (config alternativa), CF_<BINDING>_ID /
//              CF_<BINDING>_BUCKET (ids por env en CI), CF_ACCOUNT_ID.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isPlaceholder, parseWranglerToml, readWranglerConfig, repoRoot } from './infra-config.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? null);
};
// `--strict` exige ids reales aunque la config sea la plantilla o un override.
// Es el modo del deploy de verdad; sin el, plantilla/override solo avisan (el
// deploy de CI del repo publico no tiene overlay y la app no usa bindings).
const strict = args.includes('--strict');

const target = (flag('--target') ?? 'production').toLowerCase();
if (!['production', 'staging', 'preview'].includes(target)) {
  console.error(`[normalize-wrangler] target no soportado: "${target}" (production|staging)`);
  process.exit(2);
}
const isProduction = target === 'production';

const outPath = process.env.NORMALIZE_OUT
  ? resolve(process.env.NORMALIZE_OUT)
  : join(repoRoot, 'dist', 'server', 'wrangler.json');

const config = readWranglerConfig();
if (!config.text) {
  console.error(
    `[normalize-wrangler] FATAL: no se encontro config de wrangler (${config.path}).\n` +
      '  El repo publico lleva wrangler.example.toml; si falta, corre desde la raiz del repo.',
  );
  process.exit(2);
}
const toml = parseWranglerToml(config.text);
const usingTemplate = !strict && (config.kind === 'example' || config.kind === 'override');
if (!existsSync(outPath)) {
  console.error(
    `[normalize-wrangler] FATAL: no existe ${outPath}. Corre \`pnpm run build\` antes.`,
  );
  process.exit(2);
}
const cfg = JSON.parse(readFileSync(outPath, 'utf-8'));

const envKey = (binding, suffix) => `CF_${String(binding).replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}_${suffix}`;

/** Id real para un binding: del toml; si es placeholder, de la env (CI). */
function resolveId(binding, value, suffix) {
  if (!isPlaceholder(value)) return { value, source: config.kind };
  const fromEnv = process.env[envKey(binding, suffix)];
  if (fromEnv) return { value: fromEnv, source: 'env' };
  return { value: null, source: null };
}

const problems = [];

// --- 1. Identidad -----------------------------------------------------------
cfg.name = flag('--name') ?? process.env.WRANGLER_APP_NAME ?? toml.name ?? cfg.name ?? 'pisastyle';
cfg.main = cfg.main || 'entry.mjs';
cfg.compatibility_date = toml.compatibilityDate ?? cfg.compatibility_date;
cfg.compatibility_flags = [
  ...new Set([...(cfg.compatibility_flags ?? []), ...toml.compatibilityFlags]),
];

// --- 2. Dominio -------------------------------------------------------------
// `custom_domain = true` deja que Cloudflare cree el registro DNS y el
// certificado de la zona swal.network. Es un hostname sin path, por eso NO se
// anade `/*` (a diferencia de las rutas con zone_name del resto del ecosistema).
const declaredRoutes = toml.routes.filter((r) => typeof r.pattern === 'string' && r.pattern.length > 0);
delete cfg.route;
if (isProduction) {
  if (declaredRoutes.length > 0) cfg.routes = declaredRoutes;
  else delete cfg.routes;
  cfg.workers_dev = false;
} else {
  // Staging: sin dominio propio, se prueba por el subdominio workers.dev.
  delete cfg.routes;
  cfg.workers_dev = true;
}

// --- 3. Vars y observabilidad ----------------------------------------------
cfg.vars = { ...(cfg.vars ?? {}), ...toml.vars };
if (toml.observabilityEnabled !== null) cfg.observability = { enabled: toml.observabilityEnabled };
else cfg.observability = { ...(cfg.observability ?? {}), enabled: true };

// La fecha del dia que estampa el adapter cuando no hay config mueve el runtime
// solo con el calendario. Se declara siempre la de la plantilla/overlay.
if (!cfg.compatibility_date) problems.push('sin compatibility_date');

// --- 4. Bindings ------------------------------------------------------------
// Solo los que la config declara. Los que inyecta el adapter y no estan
// declarados (SESSION/IMAGES) se retiran: la app no usa sesiones de Astro ni
// `astro:assets` (ver astro.config.mjs), y provisionarlos gasta cuota compartida.
const missingIds = [];
const applyId = (entry, binding, suffix) => {
  const { value, source } = resolveId(binding, entry.database_id ?? entry.bucket_name ?? entry.id, suffix);
  if (!value) {
    missingIds.push(binding);
    return null;
  }
  if (source === 'env') console.log(`[normalize-wrangler] ${binding}: id desde ${envKey(binding, suffix)}`);
  return value;
};

if (toml.d1Databases.length > 0) {
  cfg.d1_databases = toml.d1Databases
    .map((d) => {
      const id = applyId(d, d.binding, 'ID');
      return id ? { binding: d.binding, database_name: d.database_name, database_id: id } : null;
    })
    .filter(Boolean);
} else {
  delete cfg.d1_databases;
}

if (toml.r2Buckets.length > 0) {
  cfg.r2_buckets = toml.r2Buckets
    .map((b) => {
      const bucket = applyId(b, b.binding, 'BUCKET');
      return bucket ? { binding: b.binding, bucket_name: bucket } : null;
    })
    .filter(Boolean);
} else {
  delete cfg.r2_buckets;
}

if (toml.kvNamespaces.length > 0) {
  cfg.kv_namespaces = toml.kvNamespaces
    .map((k) => {
      const id = applyId(k, k.binding, 'ID');
      return id ? { binding: k.binding, id } : null;
    })
    .filter(Boolean);
} else {
  delete cfg.kv_namespaces;
}

if (toml.ai) cfg.ai = { binding: toml.ai.binding };
else delete cfg.ai;

// El adapter de Astro anade `images: { binding: "IMAGES" }` para `astro:assets`
// (Cloudflare Images se factura por transformacion) y un bloque `previews` con
// los bindings de preview (SESSION/IMAGES). Sin consumidor, fuera. Si el codigo
// llega a usar imagenes, se declara `[images]` en la config y se anade al
// parser, como `[ai]`.
if (cfg.images) {
  console.warn(
    '[normalize-wrangler] AVISO: se retira el binding IMAGES que inyecta el adapter\n' +
      '  (no hay `astro:assets` en el codigo y Cloudflare Images se factura por transformacion).',
  );
  delete cfg.images;
}
delete cfg.previews;

if (process.env.CF_ACCOUNT_ID) cfg.account_id = process.env.CF_ACCOUNT_ID;

// --- 5. Puertas --------------------------------------------------------------
if (missingIds.length > 0) {
  if (usingTemplate) {
    console.warn(
      `[normalize-wrangler] AVISO: ${missingIds.join(', ')} declarados sin id real; se omiten del bundle.\n` +
        '  El bundle NO trae esos bindings (la app no los usa hoy). Para provisionarlos, crea el\n' +
        '  recurso, pon el id en wrangler.toml/overlay o exporta CF_<BINDING>_ID.',
    );
    for (const key of ['d1_databases', 'r2_buckets', 'kv_namespaces']) {
      if (Array.isArray(cfg[key]) && cfg[key].length === 0) delete cfg[key];
    }
  } else {
    problems.push(
      `bindings con id placeholder: ${missingIds.join(', ')} — crea el recurso y rellena los REPLACE-ME`,
    );
  }
}

if (toml.unknownSections.length > 0) {
  console.warn(
    `[normalize-wrangler] AVISO: secciones no reconocidas en ${config.path}: ${toml.unknownSections.join(', ')}.\n` +
      '  No se copian al bundle: si declaran un binding que el codigo usa, anadelas a parseWranglerToml().',
  );
}
if (usingTemplate) {
  console.warn(
    `[normalize-wrangler] AVISO: config sin ids reales (kind=${config.kind}: ${config.path}).\n` +
      '  Compatibilidad, vars y rutas son correctas; los bindings cloud vienen del overlay privado.',
  );
}

if (isProduction) {
  if (!Array.isArray(cfg.routes) || cfg.routes.length === 0) {
    problems.push('sin rutas: el Worker quedaria solo en *.workers.dev (pisa.swal.network no resolveria)');
  } else if (!cfg.routes.some((r) => r.custom_domain === true)) {
    problems.push('la ruta no lleva custom_domain = true: el DNS/certificado no se crearia solo');
  }
  if (cfg.vars.DOMAIN !== 'pisa.swal.network') {
    problems.push(`vars.DOMAIN debe ser pisa.swal.network (es ${cfg.vars.DOMAIN ?? 'ausente'})`);
  }
  if (cfg.vars.ENVIRONMENT !== 'production') {
    problems.push(`vars.ENVIRONMENT != production: ${cfg.vars.ENVIRONMENT ?? 'ausente'}`);
  }
}

if (problems.length > 0) {
  console.error(`[normalize-wrangler] DEPLOY NO SEGURO:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}

writeFileSync(outPath, `${JSON.stringify(cfg, null, 2)}\n`);

const routes = Array.isArray(cfg.routes) ? cfg.routes.map((r) => r.pattern).join(', ') : 'ninguna (workers.dev)';
const bindings = [
  ['D1', cfg.d1_databases?.map((d) => `${d.binding}=${d.database_id}`)],
  ['R2', cfg.r2_buckets?.map((b) => `${b.binding}=${b.bucket_name}`)],
  ['KV', cfg.kv_namespaces?.map((k) => `${k.binding}=${k.id}`)],
  ['AI', cfg.ai ? [cfg.ai.binding] : []],
]
  .filter(([, list]) => list?.length)
  .map(([kind, list]) => `${kind}[${list.join(' ')}]`)
  .join(' ');
console.log(
  `[normalize-wrangler] ${outPath}\n` +
    `  name=${cfg.name} target=${target} workers_dev=${cfg.workers_dev} routes=${routes}\n` +
    `  compatibility_date=${cfg.compatibility_date} flags=${cfg.compatibility_flags.join(',')}\n` +
    `  vars=${Object.keys(cfg.vars).join(',') || 'ninguna'}\n` +
    `  bindings=${bindings || 'ninguno (la app no usa bindings cloud)'}`,
);
if (isProduction) {
  console.log(
    '[normalize-wrangler] El registro DNS y el certificado de pisa.swal.network los crea el\n' +
      '  propio deploy por ser un custom domain de una zona de la cuenta. No hay paso manual de DNS.',
  );
}
