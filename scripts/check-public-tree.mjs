#!/usr/bin/env node
// scripts/check-public-tree.mjs — Puerta: el arbol PUBLICO no lleva ids ni secretos.
//
// Este repo es publico. Este script es la barandilla que impide que el id de
// cuenta, los ids de D1/KV/R2, el DNS de despliegue o un token acaben
// commiteados. Comprueba, sobre los ficheros TRACKEADOS (fuera de `private/`):
//
//   1. Ficheros que nunca deben estar trackeados: `wrangler.toml` (config real),
//      `private/**`, `.env*`, `wrangler.secrets.toml`, `*.pem`, `*.key`.
//   2. La plantilla `wrangler*.toml` no declara ningun id real: todo id de
//      binding debe ser un placeholder (`REPLACE-ME-*`). Si alguien pega un id
//      real en la plantilla, esto falla.
//   3. Cadenas prohibidas (credenciales de demo, cabeceras de clave privada,
//      prefijos de API key de Google). Construidas por partes para que el propio
//      fichero no se detecte a si mismo.
//   4. Opcional: hashes SHA-256 de los ids reales conocidos, si el propietario
//      mantiene `scripts/real-infra-ids.sha256` (una linea por id, `#` comenta).
//      Se guardan hasheados para que ESE fichero pueda ser publico.
//   5. gitleaks sobre los ficheros publicos, si esta instalado. En CI se exige
//      con ENFORCE_SECRET_SCAN=1 (el workflow instala el binario); en un checkout
//      local sin gitleaks solo avisa.
//
// Salida: 0 limpio, 1 hallazgos, 2 no se pudo ejecutar (gitleaks exigido y ausente).
//
// Uso:
//   node scripts/check-public-tree.mjs
//   ENFORCE_SECRET_SCAN=1 node scripts/check-public-tree.mjs    # CI
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { isPlaceholder, parseWranglerToml, repoRoot } from './infra-config.mjs';

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf-8' });
  return out
    .split('\0')
    .filter(Boolean)
    // submodulos y ficheros borrados en el working tree no se escanean
    .filter((f) => existsSync(join(repoRoot, f)) && statSync(join(repoRoot, f)).isFile());
}

const findings = [];
const note = (msg) => findings.push(msg);

// `allTracked` incluye `private/`, porque el primer control es justamente que
// `private/**` NO este trackeado. `files` es el arbol publico (el resto).
const allTracked = trackedFiles();
const files = allTracked.filter((f) => !f.startsWith('private/'));

// --- 1. Rutas que no pueden existir en el arbol publico ----------------------
const FORBIDDEN_PATHS = [
  { re: /^wrangler\.toml$/, why: 'config real de Cloudflare (ids de cuenta/D1/KV/R2)' },
  { re: /^private\//, why: 'overlay privado del propietario' },
  { re: /^\.env($|\.)/, why: 'variables de entorno con secretos' },
  { re: /(^|\/)wrangler\.secrets\.toml$/, why: 'secretos del Worker' },
  { re: /\.(pem|key|p12|pfx|jks|keystore)$/, why: 'clave o certificado' },
];
for (const file of allTracked) {
  for (const { re, why } of FORBIDDEN_PATHS) {
    if (re.test(file)) note(`${file}: fichero que no debe estar trackeado (${why})`);
  }
}

// --- 2. La plantilla no lleva ids reales -------------------------------------
for (const file of files.filter((f) => /^wrangler.*\.toml$/.test(f))) {
  const parsed = parseWranglerToml(readFileSync(join(repoRoot, file), 'utf-8'));
  const entries = [
    ...parsed.d1Databases.map((d) => [d.binding, d.database_id]),
    ...parsed.r2Buckets.map((b) => [b.binding, b.bucket_name]),
    ...parsed.kvNamespaces.map((k) => [k.binding, k.id]),
  ];
  for (const [binding, value] of entries) {
    if (!isPlaceholder(value)) note(`${file}: ${binding} declara un id real ("${value}") en la plantilla publica`);
  }
  if (parsed.unknownSections.length > 0) {
    console.log(`[check-public-tree] ${file}: secciones no interpretadas: ${parsed.unknownSections.join(', ')}`);
  }
}

// --- 3. Cadenas prohibidas ---------------------------------------------------
const FORBIDDEN = [
  { what: 'password de demo', needle: ['admin', '123'].join('') },
  { what: 'cabecera de clave privada', needle: ['-----BEGIN ', 'PRIVATE KEY-----'].join('') },
  { what: 'API key de Google', needle: ['AI', 'za'].join('') },
];
const TEXT_EXT = /\.(mjs|cjs|js|ts|tsx|json|toml|ya?ml|md|astro|svelte|css|html|sh|sql|txt|example)$/i;

for (const file of files) {
  const buf = readFileSync(join(repoRoot, file));
  if (buf.includes(0)) continue; // binario
  const text = buf.toString('utf-8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const f of FORBIDDEN) {
      if (line.includes(f.needle)) note(`${file}:${i + 1}: ${f.what}`);
    }
  });
}

// --- 4. Hashes de ids reales conocidos (opcional) ----------------------------
const hashFile = join(repoRoot, 'scripts', 'real-infra-ids.sha256');
let hashCount = 0;
const hashes = new Set(
  existsSync(hashFile)
    ? readFileSync(hashFile, 'utf-8')
        .split('\n')
        .map((l) => l.split('#')[0].trim().toLowerCase())
        .filter((l) => /^[0-9a-f]{64}$/.test(l))
    : [],
);
if (hashes.size > 0) {
  hashCount = hashes.size;
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  for (const file of files) {
    const buf = readFileSync(join(repoRoot, file));
    if (buf.includes(0)) continue;
    const lines = buf.toString('utf-8').split('\n');
    lines.forEach((line, i) => {
      for (const token of line.matchAll(/[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*/g)) {
        const parts = token[0].split(/[-_]/);
        const seps = token[0].match(/[-_]/g) ?? [];
        for (let a = 0; a < parts.length; a++) {
          let cand = '';
          for (let b = a; b < Math.min(parts.length, a + 5); b++) {
            cand = b === a ? parts[a] : `${cand}${seps[b - 1]}${parts[b]}`;
            if (cand.length >= 8 && hashes.has(sha(cand))) {
              note(`${file}:${i + 1}: id de infra real (coincide con un hash conocido)`);
            }
          }
        }
      }
    });
  }
}

// --- 5. gitleaks (solo ficheros publicos) ------------------------------------
const textFiles = files.filter((f) => TEXT_EXT.test(f));
let gitleaksStatus = 'no ejecutado';
const enforce = process.env.ENFORCE_SECRET_SCAN === '1';
const bin = process.env.SECRET_SCAN_BIN || 'gitleaks';
const probe = spawnSync(bin, ['version'], { encoding: 'utf-8' });
if (probe.status !== 0) {
  gitleaksStatus = `AUSENTE (${bin} no esta en PATH)`;
  if (enforce) {
    console.error(`[check-public-tree] gitleaks exigido (ENFORCE_SECRET_SCAN=1) y no encontrado: ${bin}`);
    process.exit(2);
  }
  console.warn('[check-public-tree] AVISO: gitleaks no esta instalado; se omite el escaneo de secretos.');
} else {
  const tmp = mkdtempSync(join(tmpdir(), 'pisa-public-tree-'));
  try {
    for (const f of textFiles) {
      mkdirSync(join(tmp, dirname(f)), { recursive: true });
      copyFileSync(join(repoRoot, f), join(tmp, f));
    }
    const gitleaksConfig = join(repoRoot, '.gitleaks.toml');
    const run = spawnSync(
      bin,
      [
        'dir',
        tmp,
        ...(existsSync(gitleaksConfig) ? ['--config', gitleaksConfig] : []),
        '--no-banner',
        '--no-color',
        '--redact',
        '--verbose',
        '--exit-code',
        '1',
      ],
      { encoding: 'utf-8' },
    );
    const out = `${run.stdout ?? ''}${run.stderr ?? ''}`.replaceAll(`${tmp}/`, '');
    if (run.status === 1) {
      gitleaksStatus = 'HALLAZGOS';
      note(`gitleaks:\n${out.trim()}`);
    } else if (run.status !== 0) {
      console.error(`[check-public-tree] gitleaks no pudo ejecutarse (exit ${run.status}):\n${out}`);
      process.exit(2);
    } else {
      gitleaksStatus = `limpio (${probe.stdout.trim()})`;
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`[check-public-tree] ficheros publicos escaneados: ${files.length}`);
console.log(`[check-public-tree] ids reales conocidos (hashes): ${hashCount}`);
console.log(`[check-public-tree] gitleaks: ${gitleaksStatus}`);
if (findings.length > 0) {
  console.error(`[check-public-tree] FAIL: ${findings.length} hallazgo(s)`);
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('[check-public-tree] OK: sin ids de infra reales, sin cadenas prohibidas, sin secretos');
