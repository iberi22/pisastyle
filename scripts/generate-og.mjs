/**
 * Generates the Open Graph cards in `public/og/{es,en,pt}.png`.
 *
 * WHY A GENERATOR AND NOT CHECKED-IN PNGs
 * ---------------------------------------
 * The card carries the same promise the site makes in prose: what this page is
 * and who published it, in the visitor's language. A checked-in binary cannot be
 * diffed, so the next edit would silently drift from the copy. A generator makes
 * the drift a failing test instead.
 *
 * WHY `magick` AND NOT ASTRO'S IMAGE PIPELINE
 * -------------------------------------------
 * Astro 7 with @astrojs/cloudflare delegates image processing to Cloudflare
 * Images, which needs the remote `IMAGES` binding. This script runs offline in
 * CI. The alternative — shipping a PNG with no way to regenerate it — is worse.
 *
 * WHY NO SVG FOR OG
 * -----------------
 * Facebook, LinkedIn and Slack do not render SVG for og:image. It has to be a
 * raster, which is why this exists at all instead of pointing at favicon.svg.
 *
 * Colours are the site's own: --swal-bg #121211 and #f5f5f4 from
 * public/favicon.svg, so the card and the app cannot drift apart visually.
 *
 * Usage: node scripts/generate-og.mjs [--check]
 *   --check  exit non-zero if a card on disk differs from the rendered one.
 *            Wired into scripts/verify-seo.mjs, so the drift fails the gate.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'og');

// Card geometry comes from src/lib/seo.ts — the same constants Layout emits as
// og:image:width/height. Imported, not re-declared: the whole reason og:image
// carries explicit dimensions is that a validator compares them against the
// real file, so the generator and the meta tag MUST agree, and two hand-typed
// copies are how they stop agreeing.
const { OG_IMAGE_WIDTH: W, OG_IMAGE_HEIGHT: H } = await import(
  new URL('../src/lib/seo.ts', import.meta.url).href
);
const BG = '#121211';
const FG = '#f5f5f4';
const MUTED = '#a8a29e';
const FONT = 'DejaVu-Sans-Bold';

/** Per-locale card copy. Kept here, next to the renderer, so both change together. */
const CARDS = {
  es: {
    kicker: 'PISAStyle by SWAL',
    title: 'Domina PISA',
    title2: 'con el Método PISAStyle',
    stats: 'COL 383/409/411  ·  OCDE 472/476/485  ·  SGP 575/543/561',
    foot: 'Preparación PISA en español · Contenido no oficial, sin afiliación OECD',
  },
  en: {
    kicker: 'PISAStyle by SWAL',
    title: 'Master PISA',
    title2: 'with the PISAStyle Method',
    stats: 'COL 383/409/411  ·  OECD 472/476/485  ·  SGP 575/543/561',
    foot: 'PISA preparation in English · Unofficial content, no OECD affiliation',
  },
  pt: {
    kicker: 'PISAStyle by SWAL',
    title: 'Domine o PISA',
    title2: 'com o Método PISAStyle',
    stats: 'COL 383/409/411  ·  OCDE 472/476/485  ·  SGP 575/543/561',
    foot: 'Preparação PISA em português · Conteúdo não oficial, sem afiliação OECD',
  },
};

/**
 * XML-escapes the text. The stats line carries `·` and the foot line carries
 * accents; unescaped `&` in a foot line would abort the whole render.
 */
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function svgFor(locale) {
  const c = CARDS[locale];
  // Title font size steps down for the longer Portuguese/English second lines so
  // nothing overflows the 1200px card: measured, not guessed.
  const t1 = 96;
  const t2 = locale === 'es' ? 64 : 56;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}" />
  <rect x="0" y="0" width="10" height="${H}" fill="${FG}" />
  <text x="80" y="130" font-family="DejaVu-Sans" font-size="30" fill="${MUTED}" letter-spacing="4">${esc(c.kicker)}</text>
  <text x="80" y="290" font-family="${FONT}" font-size="${t1}" fill="${FG}">${esc(c.title)}</text>
  <text x="80" y="${290 + t2 + 24}" font-family="${FONT}" font-size="${t2}" fill="${FG}">${esc(c.title2)}</text>
  <rect x="80" y="452" width="1040" height="2" fill="#3f3f3c" />
  <text x="80" y="512" font-family="DejaVu-Sans" font-size="30" fill="${MUTED}">${esc(c.stats)}</text>
  <text x="80" y="576" font-family="DejaVu-Sans" font-size="26" fill="${MUTED}">${esc(c.foot)}</text>
  <circle cx="1030" cy="250" r="112" fill="${FG}" />
  <text x="1030" y="281" font-family="${FONT}" font-size="72" fill="${BG}" text-anchor="middle">PISA</text>
</svg>`;
}

/** Renders one card to PNG bytes via `magick`. */
async function render(locale) {
  const dir = await mkdtemp(join(tmpdir(), 'pisa-og-'));
  const svgPath = join(dir, 'card.svg');
  const pngPath = join(dir, 'card.png');
  await writeFile(svgPath, svgFor(locale), 'utf8');
  await run('magick', ['-background', 'none', svgPath, pngPath]);
  const bytes = await readFile(pngPath);
  return bytes;
}

/**
 * Number of differing pixels between two PNGs (0 = identical to the eye).
 *
 * Uses `compare -metric AE`, which writes a single number to stderr and NOTHING
 * to stdout. That matters: piping the raw pixel data through execFile needs a
 * 2.2 MB stdout buffer per card and dies with ERR_CHILD_PROCESS_STDIO_MAXBUFFER,
 * which is what the first pixel-comparison attempt did. The metric keeps the
 * buffer empty.
 */
async function pixelDiff(aPath, bPath) {
  try {
    await run('magick', ['compare', '-metric', 'AE', aPath, bPath, 'null:']);
    return 0; // identical: compare exits 0 and prints "0"
  } catch (e) {
    // compare exits 1 when the images DIFFER, with the count on stderr.
    const n = Number(/^([\d.e+]+)/.exec(String(e.stderr ?? '').trim())?.[1] ?? Number.NaN);
    return Number.isNaN(n) ? Infinity : n;
  }
}

async function main() {
  const check = process.argv.includes('--check');
  if (!(await hasMagick())) {
    console.error('magick (ImageMagick) not found — cannot render og cards');
    process.exit(2);
  }
  await mkdir(OUT_DIR, { recursive: true });

  let drift = 0;
  for (const locale of Object.keys(CARDS)) {
    const bytes = await render(locale);
    const out = join(OUT_DIR, `${locale}.png`);

    if (!check) {
      await writeFile(out, bytes);
      console.log(`wrote public/og/${locale}.png (${bytes.length} bytes)`);
      continue;
    }

    if (!existsSync(out)) {
      console.error(`DRIFT: public/og/${locale}.png is missing — run \`pnpm og:generate\``);
      drift++;
      continue;
    }
    // Compare what a reader sees, not the file bytes: PNG metadata (a tIME
    // chunk) changes on every render and would make this fail forever.
    const tmp = join(await mkdtemp(join(tmpdir(), 'pisa-og-')), 'card.png');
    await writeFile(tmp, bytes);
    const differing = await pixelDiff(out, tmp);
    if (differing !== 0) {
      console.error(
        `DRIFT: public/og/${locale}.png differs from the generated card ` +
          `(${differing} px) — run \`pnpm og:generate\``,
      );
      drift++;
    }
  }
  process.exit(drift ? 1 : 0);
}

async function hasMagick() {
  try {
    await run('magick', ['-version']);
    return true;
  } catch {
    return false;
  }
}

main();