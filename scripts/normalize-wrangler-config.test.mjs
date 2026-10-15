// scripts/normalize-wrangler-config.test.mjs — Regresion del pegamento de deploy.
//
// Cubre lo que no puede cubrir un test del bundle: que la config publica se
// parsee entera (el bug real: con flag `m`, `$` casa al final de CADA linea y el
// cuerpo de una seccion quedaba cortado en la primera), que la plantilla NO
// active bindings, que las rutas salgan con custom_domain, que un id
// `REPLACE-ME` corte el deploy en modo estricto y que staging no toque el
// dominio. Se ejecuta el script como lo ejecuta el deploy (subproceso).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { isPlaceholder, parseWranglerToml } from './infra-config.mjs';

// `import.meta.url` llega transformado por Vite (no es un file: URL), asi que la
// raiz se toma del cwd de vitest (siempre la raiz del repo) y se comprueba que
// de verdad lo sea: si no, el test falla en vez de pasar por vacio.
const repo = resolve(process.cwd());
const normalizeScript = join(repo, 'scripts', 'normalize-wrangler-config.mjs');
const exampleTomlPath = join(repo, 'wrangler.example.toml');
if (!existsSync(exampleTomlPath) || !existsSync(normalizeScript)) {
  throw new Error(`este test se ejecuta desde la raiz del repo (cwd=${repo})`);
}
const exampleToml = readFileSync(exampleTomlPath, 'utf-8');

const tempDirs = [];
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'pisa-normalize-'));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

/** Bundle minimo con lo que emite `astro build` (para exigir que se conserve). */
function writeDistFixture(dir) {
  const dist = join(dir, 'wrangler.json');
  writeFileSync(
    dist,
    JSON.stringify({
      name: 'pisastyle',
      main: 'entry.mjs',
      compatibility_date: '2026-08-28',
      compatibility_flags: [],
      vars: {},
      assets: { binding: 'ASSETS', directory: '../client' },
      kv_namespaces: [{ binding: 'SESSION' }],
      images: { binding: 'IMAGES' },
      previews: { kv_namespaces: [{ binding: 'SESSION' }], images: { binding: 'IMAGES' } },
      no_bundle: true,
    }),
  );
  return dist;
}

function runNormalize({ dist, toml, target = 'production', extraArgs = [] }) {
  const res = spawnSync('node', [normalizeScript, '--target', target, ...extraArgs], {
    cwd: repo,
    encoding: 'utf-8',
    env: { ...process.env, NORMALIZE_OUT: dist, WRANGLER_TOML_IN: toml },
  });
  return { ...res, cfg: res.status === 0 ? JSON.parse(readFileSync(dist, 'utf-8')) : null };
}

describe('parseWranglerToml', () => {
  it('lee la plantilla publica entera (nombre, compat, vars y ruta custom_domain)', () => {
    const parsed = parseWranglerToml(exampleToml);
    expect(parsed.name).toBe('pisastyle');
    expect(parsed.compatibilityDate).toBe('2024-12-01');
    expect(parsed.compatibilityFlags).toEqual(['nodejs_compat']);
    // El bug del `$` con flag `m` dejaba solo ENVIRONMENT.
    expect(Object.keys(parsed.vars).sort()).toEqual(['APP_ID', 'DOMAIN', 'ENVIRONMENT', 'XAVIER_URL']);
    expect(parsed.routes).toEqual([{ pattern: 'pisa.swal.network', custom_domain: true }]);
    expect(parsed.observabilityEnabled).toBe(true);
  });

  it('ignora los bindings comentados de la plantilla y no los activa', () => {
    const parsed = parseWranglerToml(exampleToml);
    expect(parsed.d1Databases).toEqual([]);
    expect(parsed.r2Buckets).toEqual([]);
    expect(parsed.kvNamespaces).toEqual([]);
    expect(parsed.ai).toBeNull();
  });

  it('lee bindings activos y avisa de las secciones que no entiende', () => {
    const parsed = parseWranglerToml(`
name = "otra"
[[d1_databases]]
binding = "SWAL_D1"
database_name = "db"
database_id = "REPLACE-ME-d1"
# [[r2_buckets]]
# binding = "SWAL_R2"
[[kv_namespaces]]
binding = "SWAL_KV"
id = "abc"
[ai]
binding = "AI"
[[queues.producers]]
binding = "COLA"
`);
    expect(parsed.d1Databases).toEqual([
      { binding: 'SWAL_D1', database_name: 'db', database_id: 'REPLACE-ME-d1', migrations_dir: null },
    ]);
    expect(parsed.r2Buckets).toEqual([]);
    expect(parsed.kvNamespaces).toEqual([{ binding: 'SWAL_KV', id: 'abc' }]);
    expect(parsed.ai).toEqual({ binding: 'AI' });
    expect(parsed.unknownSections).toEqual(['queues.producers']);
  });
});

describe('isPlaceholder', () => {
  it('distingue placeholders de ids reales', () => {
    for (const value of ['REPLACE-ME-d1', '<tu-id>', 'your-bucket', '0000-0000', '', null, undefined]) {
      expect(isPlaceholder(value), `${value}`).toBe(true);
    }
    for (const value of ['0123456789abcdef0123456789abcdef', 'swal-pisastyle-vault', 'auth-token']) {
      expect(isPlaceholder(value), `${value}`).toBe(false);
    }
  });
});

describe('normalize-wrangler-config', () => {
  it('produccion sobre la plantilla: ruta custom_domain, workers_dev=false y sin bindings', () => {
    const dir = tempDir();
    const dist = writeDistFixture(dir);
    const toml = join(dir, 'wrangler.example.toml');
    writeFileSync(toml, exampleToml);

    const res = runNormalize({ dist, toml });
    expect(res.status, res.stderr).toBe(0);
    expect(res.cfg.routes).toEqual([{ pattern: 'pisa.swal.network', custom_domain: true }]);
    expect(res.cfg.workers_dev).toBe(false);
    expect(res.cfg.compatibility_date).toBe('2024-12-01');
    expect(res.cfg.compatibility_flags).toContain('nodejs_compat');
    expect(res.cfg.vars.DOMAIN).toBe('pisa.swal.network');
    expect(res.cfg.observability).toEqual({ enabled: true });
    // Los bindings que inyecta el adapter sin declararse se retiran (cuota compartida).
    expect(res.cfg.kv_namespaces).toBeUndefined();
    expect(res.cfg.images).toBeUndefined();
    expect(res.cfg.previews).toBeUndefined();
    // Lo que emite Astro y sigue siendo util no se pierde.
    expect(res.cfg.assets).toEqual({ binding: 'ASSETS', directory: '../client' });
    expect(res.cfg.main).toBe('entry.mjs');
  });

  it('staging: sin dominio propio y con workers_dev', () => {
    const dir = tempDir();
    const dist = writeDistFixture(dir);
    const toml = join(dir, 'wrangler.example.toml');
    writeFileSync(toml, exampleToml);

    const res = runNormalize({ dist, toml, target: 'staging' });
    expect(res.status, res.stderr).toBe(0);
    expect(res.cfg.routes).toBeUndefined();
    expect(res.cfg.workers_dev).toBe(true);
  });

  it('modo estricto: un binding con id REPLACE-ME corta el deploy', () => {
    const dir = tempDir();
    const dist = writeDistFixture(dir);
    const toml = join(dir, 'wrangler.toml');
    writeFileSync(
      toml,
      `${exampleToml}\n[[d1_databases]]\nbinding = "SWAL_D1"\ndatabase_name = "swal-pisastyle"\ndatabase_id = "REPLACE-ME-d1"\n`,
    );

    const res = runNormalize({ dist, toml, extraArgs: ['--strict'] });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('SWAL_D1');
    expect(res.stderr).toContain('DEPLOY NO SEGURO');
  });

  it('modo estricto: con ids reales los inyecta en el bundle', () => {
    const dir = tempDir();
    const dist = writeDistFixture(dir);
    const toml = join(dir, 'wrangler.toml');
    writeFileSync(
      toml,
      `${exampleToml}\n[[d1_databases]]\nbinding = "SWAL_D1"\ndatabase_name = "swal-pisastyle"\ndatabase_id = "01234567-89ab-cdef-0123-456789abcdef"\n[[kv_namespaces]]\nbinding = "SWAL_KV"\nid = "0123456789abcdef0123456789abcdef"\n`,
    );

    const res = runNormalize({ dist, toml, extraArgs: ['--strict'] });
    expect(res.status, res.stderr).toBe(0);
    expect(res.cfg.d1_databases).toEqual([
      {
        binding: 'SWAL_D1',
        database_name: 'swal-pisastyle',
        database_id: '01234567-89ab-cdef-0123-456789abcdef',
      },
    ]);
    expect(res.cfg.kv_namespaces).toEqual([{ binding: 'SWAL_KV', id: '0123456789abcdef0123456789abcdef' }]);
  });

  it('un comentario o un valor vacio en un id no cuela como real', () => {
    const dir = tempDir();
    const dist = writeDistFixture(dir);
    const toml = join(dir, 'wrangler.toml');
    writeFileSync(
      toml,
      `${exampleToml}\n[[kv_namespaces]]\nbinding = "SWAL_KV"\nid = ""\n# id = "0123456789abcdef0123456789abcdef"\n`,
    );

    const res = runNormalize({ dist, toml, extraArgs: ['--strict'] });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('SWAL_KV');
  });
});
