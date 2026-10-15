// scripts/infra-config.mjs — Un solo sitio que dice donde vive la config de Cloudflare.
//
// Este repositorio es PUBLICO. Solo se commitea la PLANTILLA
// (`wrangler.example.toml`): nombres, fecha de compatibilidad, rutas y
// placeholders `REPLACE-ME`. El fichero real (`wrangler.toml`) lleva el id de
// cuenta y los ids de D1/KV/R2, esta en .gitignore y vive en el overlay privado
// (repo iberi22/swal-infra). Mismo patron que GARA-G y Fize.
//
// Orden de busqueda (lo resuelve `wranglerConfig()`):
//   1. `wrangler.toml` real — lo copia el deploy desde el overlay antes de construir;
//   2. `private/infra/wrangler.toml` — checkout del propietario con el overlay;
//   3. `wrangler.example.toml` — plantilla commiteada. Con ella el build y los
//      tests pasan, pero el bundle NO es desplegable con bindings: todo son
//      placeholders y `normalize-wrangler-config.mjs` los avisa y los omite.
//
// Lo consumen:
//   - scripts/normalize-wrangler-config.mjs (rellena dist/server/wrangler.json)
//   - scripts/check-public-tree.mjs (comprueba que la plantilla no lleva ids reales)
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Un valor con pinta de placeholder no es desplegable. */
const PLACEHOLDER = /^(REPLACE-ME|<.*>|your-|example-|0000|xxxxxxxx)/i;

/** `true` si el valor es vacio o un placeholder (`REPLACE-ME-*`, `<...>`, `your-*`). */
export function isPlaceholder(value) {
  const v = String(value ?? '').trim();
  return v.length === 0 || PLACEHOLDER.test(v);
}

/**
 * Config de wrangler a usar: `{ path, kind: 'real' | 'private' | 'example' | 'override' }`.
 * `WRANGLER_TOML_IN` fuerza un fichero concreto (lo usan los tests y el ensayo del deploy).
 */
export function wranglerConfig() {
  if (process.env.WRANGLER_TOML_IN) {
    return { path: resolve(process.env.WRANGLER_TOML_IN), kind: 'override' };
  }
  const candidates = [
    { path: join(repoRoot, 'wrangler.toml'), kind: 'real' },
    { path: join(repoRoot, 'private', 'infra', 'wrangler.toml'), kind: 'private' },
    { path: join(repoRoot, 'wrangler.example.toml'), kind: 'example' },
  ];
  return candidates.find((c) => existsSync(c.path)) ?? candidates[candidates.length - 1];
}

/** Lee la config resuelta. `{ path, kind, text }`. */
export function readWranglerConfig() {
  const found = wranglerConfig();
  return { ...found, text: existsSync(found.path) ? readFileSync(found.path, 'utf-8') : '' };
}

// --- Parser TOML minimo -----------------------------------------------------
// Deliberadamente NO es un parser TOML completo: cubre el subconjunto que usa
// este repo (escalares, `[vars]`, `[observability]`, `routes = [ {...} ]` y los
// `[[d1_databases]]` / `[[r2_buckets]]` / `[[kv_namespaces]]`). Anadir una
// dependencia TOML solo para esto cambiaria el lockfile y la superficie de
// mantenimiento; a cambio, `parseWranglerToml` DEVUELVE la lista de secciones que
// no reconoce para que un binding nuevo no se ignore en silencio.

const KNOWN_SECTIONS = new Set([
  'vars',
  'observability',
  'd1_databases',
  'r2_buckets',
  'kv_namespaces',
  'ai',
  'assets',
  'env',
]);

/** Quita lineas de comentario y comentarios al final de linea. */
function stripComments(toml) {
  return toml
    .split('\n')
    .map((line) => {
      if (line.trim().startsWith('#')) return '';
      const i = line.search(/\s#/);
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
}

/** Cuerpos de todas las apariciones de `[[name]]`. */
function arraySections(text, name) {
  const re = new RegExp(`\\[\\[${name}\\]\\]([\\s\\S]*?)(?=\\n\\s*\\[|$)`, 'g');
  return [...text.matchAll(re)].map(([, body]) => body);
}

/** Cuerpo de `[name]` (hasta la siguiente seccion o el final del fichero). */
function sectionBody(text, name) {
  // OJO: no se puede usar el lookahead `(?=\n\s*\[|$)` con flag `m`, porque `$`
  // con `m` casa al final de CADA linea y el cuerpo queda cortado en la primera.
  const start = text.search(new RegExp(`^\\[${name}\\]\\s*$`, 'm'));
  if (start === -1) return '';
  const rest = text
    .slice(start)
    .replace(new RegExp(`^\\[${name}\\]\\s*\\n?`), '');
  const next = rest.search(/^\s*\[/m);
  return next === -1 ? rest : rest.slice(0, next);
}

function quoted(body, key) {
  return body.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm'))?.[1] ?? null;
}

function bool(body, key) {
  const v = body.match(new RegExp(`^\\s*${key}\\s*=\\s*(true|false)`, 'm'))?.[1];
  return v === undefined ? null : v === 'true';
}

/** `compatibility_flags = ["a", "b"]` */
function stringArray(text, key) {
  const block = text.match(new RegExp(`^\\s*${key}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm'))?.[1];
  if (block === undefined) return null;
  return [...block.matchAll(/"([^"]*)"/g)].map(([, v]) => v);
}

/** `routes = [ { pattern = "x", custom_domain = true } ]` */
function parseRoutes(text) {
  const block = text.match(/^\s*routes\s*=\s*\[([\s\S]*?)\]/m)?.[1];
  if (block === undefined) return [];
  return [...block.matchAll(/\{([^}]*)\}/g)].map(([, inner]) => {
    const route = {};
    for (const [, key, value] of inner.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("([^"]*)"|true|false)/g)) {
      route[key] = value === 'true' ? true : value === 'false' ? false : value.replace(/^"|"$/g, '');
    }
    return route;
  });
}

/**
 * Interpreta la plantilla/config. Devuelve todo lo que el deploy necesita y,
 * ademas, `unknownSections` (secciones `[[...]]`/`[...]` que este parser no
 * entiende) para que nadie despliegue creyendo que un binding se ha aplicado.
 */
export function parseWranglerToml(rawToml) {
  const text = stripComments(rawToml);

  const vars = {};
  for (const [, key, value] of sectionBody(text, 'vars').matchAll(
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"/gm,
  )) {
    vars[key] = value;
  }

  const observabilityEnabled = bool(sectionBody(text, 'observability'), 'enabled');

  const knownNames = new Set([...KNOWN_SECTIONS, 'vars', 'observability']);
  const unknownSections = [
    ...new Set(
      [...text.matchAll(/^\s*\[\[?([^\]]+)\]\]?/gm)].map(([, name]) => name.trim()),
    ),
  ].filter((name) => !knownNames.has(name));

  return {
    name: text.match(/^\s*name\s*=\s*"([^"]*)"/m)?.[1] ?? null,
    compatibilityDate: text.match(/^\s*compatibility_date\s*=\s*"([^"]*)"/m)?.[1] ?? null,
    compatibilityFlags: stringArray(text, 'compatibility_flags') ?? [],
    workersDev: bool(text, 'workers_dev'),
    routes: parseRoutes(text),
    vars,
    observabilityEnabled,
    d1Databases: arraySections(text, 'd1_databases').map((body) => ({
      binding: quoted(body, 'binding'),
      database_name: quoted(body, 'database_name'),
      database_id: quoted(body, 'database_id'),
      migrations_dir: quoted(body, 'migrations_dir'),
    })),
    r2Buckets: arraySections(text, 'r2_buckets').map((body) => ({
      binding: quoted(body, 'binding'),
      bucket_name: quoted(body, 'bucket_name'),
    })),
    kvNamespaces: arraySections(text, 'kv_namespaces').map((body) => ({
      binding: quoted(body, 'binding'),
      id: quoted(body, 'id'),
    })),
    ai: /^\[ai\]/m.test(text) ? { binding: quoted(sectionBody(text, 'ai'), 'binding') ?? 'AI' } : null,
    unknownSections,
  };
}
