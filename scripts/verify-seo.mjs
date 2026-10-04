/**
 * verify-seo.mjs — the SEO/GEO gate.
 *
 * WHY THIS EXISTS WHEN src/lib/seo.test.ts ALREADY EXISTS
 * -------------------------------------------------------
 * The unit tests assert that the CATALOG is coherent. They cannot assert that
 * Layout.astro actually emits it. The gap is not hypothetical: a Layout that
 * stops passing `route` through, or a `<script>` tag that renders empty, or an
 * Astro upgrade that drops `set:html`, all produce a perfectly green test suite
 * and a site with zero structured data. That failure is invisible until a
 * validator is run against production.
 *
 * So this reads the SERVED HTML over HTTP and parses it the way a consumer
 * would. Everything asserted here is asserted against bytes that a crawler
 * would actually receive.
 *
 * WHAT IT CHECKS
 *   1. All 15 routes answer 200.
 *   2. Each has exactly one title, one description, one canonical, and the
 *      canonical matches the URL that was requested (no self-canonical mismatch).
 *   3. hreflang is complete and reciprocal on every page.
 *   4. The JSON-LD script is present AND parses with JSON.parse, and contains
 *      Organization + WebSite + the page type. Presence without parseability is
 *      the failure this catches.
 *   5. Open Graph is complete: title, description, url, image, and a locale.
 *   6. Titles and descriptions are unique across all 15 pages.
 *   7. The answer-first lead is visible text and lands in the first ~200
 *      characters of the body.
 *   8. /sitemap.xml is valid XML with 15 URLs and hreflang on each.
 *   9. robots.txt allows the retrieval crawlers and blocks the training ones.
 *
 * Usage:  node scripts/verify-seo.mjs [--base http://127.0.0.1:4321]
 *
 * It does NOT start a server. Pass a running dev/preview base URL, or let BASE
 * come from --base / SEO_VERIFY_BASE.
 */
import { setTimeout as delay } from 'node:timers/promises';

const argv = process.argv.slice(2);
const baseArg = argv.indexOf('--base');
const BASE = (
  baseArg !== -1 ? argv[baseArg + 1] : process.env.SEO_VERIFY_BASE ?? 'http://127.0.0.1:4321'
).replace(/\/$/, '');

const LOCALES = ['es', 'en', 'pt'];
const PATHS = ['explorar', 'metodo', 'novedades', 'evaluar', 'contribuir'];

const failures = [];
const notes = [];

function fail(where, msg) {
  failures.push(`${where}: ${msg}`);
}

/** Fetches with a timeout, so one hung route cannot wedge the gate. */
async function get(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'manual' });
    const text = await res.text();
    return { status: res.status, text, headers: res.headers };
  } catch (e) {
    return { status: 0, text: '', headers: new Headers(), error: String(e) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * All values of `attrName` across every tag matching `tagRe`.
 *
 * The inner RegExp is built ONCE, not per tag: this runs 15 routes x 2 link
 * families on every gate invocation, and rebuilding it per match was pure waste.
 */
function attrAll(html, tagRe, attrName) {
  const attrRe = new RegExp(`${attrName}\\s*=\\s*"([^"]*)"`, 'i');
  const out = [];
  const re = new RegExp(tagRe, 'gi');
  let m;
  while ((m = re.exec(html))) {
    const a = attrRe.exec(m[0]);
    out.push(a ? a[1] : null);
  }
  return out;
}

function metaContent(html, key, kind = 'name') {
  const m = new RegExp(`<meta[^>]*${kind}\\s*=\\s*"${key}"[^>]*>`, 'i').exec(html);
  if (!m) return null;
  const c = /content\s*=\s*"([^"]*)"/i.exec(m[0]);
  return c ? c[1] : null;
}

/** Visible text: strips <head>, scripts, styles and tags. */
function visibleText(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when a string is well-formed JSON. */
function isJson(s) {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

async function checkPage(loc, path) {
  const route = `/${loc}/${path}`;
  const url = `${BASE}${route}`;
  const where = route;

  const res = await get(url);
  if (res.status !== 200) {
    fail(where, `expected 200, got ${res.status}${res.error ? ` (${res.error})` : ''}`);
    return null;
  }
  const html = res.text;

  // ── title / description / canonical ──
  // Count only the DOCUMENT title, not every <title> element. An SVG carries its
  // own <title> for accessibility (RankingBars has one), and counting those
  // reports a duplicate document title that does not exist.
  const titleM = /<title(?![^>]*\bid=)[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleM ? titleM[1].trim() : null;
  if (!title) fail(where, 'no document <title>');
  const docTitles = [...html.matchAll(/<title(?![^>]*\bid=)[^>]*>/gi)].length;
  if (docTitles !== 1) fail(where, `expected exactly 1 document <title>, found ${docTitles}`);

  const description = metaContent(html, 'description');
  if (!description) fail(where, 'no meta description');
  else if (description.length > 200) fail(where, `description is ${description.length} chars (>200)`);

  const canonicals = attrAll(html, '<link[^>]*rel="canonical"[^>]*>', 'href').filter(Boolean);
  if (canonicals.length !== 1) fail(where, `expected 1 canonical, found ${canonicals.length}`);
  else if (canonicals[0] !== `https://pisa.swal.network${route}`) {
    fail(where, `canonical is ${canonicals[0]}, expected https://pisa.swal.network${route}`);
  }

  // ── hreflang ──
  const hreflangs = attrAll(html, '<link[^>]*rel="alternate"[^>]*>', 'hreflang').filter(Boolean);
  for (const lang of [...LOCALES, 'x-default']) {
    if (!hreflangs.includes(lang)) fail(where, `missing hreflang for ${lang}`);
  }
  for (const [lang, href] of Object.entries(expectedAlternates(route))) {
    const found = attrAll(
      html,
      `<link[^>]*hreflang="${lang}"[^>]*>`,
      'href',
    )[0];
    if (found && found !== href) fail(where, `hreflang ${lang} points to ${found}, expected ${href}`);
  }

  // ── JSON-LD: present AND parseable ──
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  if (blocks.length !== 1) {
    fail(where, `expected 1 ld+json script, found ${blocks.length}`);
  } else {
    const raw = blocks[0][1].trim();
    if (!raw) {
      fail(where, 'ld+json script is EMPTY — Astro rendered nothing into it');
    } else if (!isJson(raw)) {
      fail(where, `ld+json does NOT parse: ${raw.slice(0, 120)}`);
    } else {
      const g = JSON.parse(raw);
      const types = (g['@graph'] ?? []).map((n) => n['@type']);
      for (const t of ['Organization', 'WebSite']) {
        if (!types.includes(t)) fail(where, `JSON-LD graph is missing ${t}`);
      }
      if (!types.includes('LearningResource') && !types.includes('WebPage')) {
        fail(where, 'JSON-LD graph is missing the page entity (LearningResource|WebPage)');
      }
      const org = (g['@graph'] ?? []).find((n) => n['@type'] === 'Organization');
      if (org && org.name !== 'SouthWest AI Labs') {
        fail(where, `Organization name is "${org.name}", expected "SouthWest AI Labs"`);
      }
      // inLanguage must match the route locale, or hreflang collapses.
      const page = (g['@graph'] ?? []).at(-1);
      if (page && page['@type'] !== 'WebSite' && page.inLanguage !== loc) {
        fail(where, `JSON-LD inLanguage is ${page.inLanguage}, expected ${loc}`);
      }
    }
  }

  // ── Open Graph ──
  const ogRequired = ['og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:locale'];
  for (const k of ogRequired) {
    if (!metaContent(html, k, 'property')) fail(where, `missing ${k}`);
  }
  const ogLocale = metaContent(html, 'og:locale', 'property');
  // DELIBERATELY duplicated from seo.ts rather than imported. If this called
  // `ogLocale()` it would assert that og:locale equals whatever ogLocale()
  // returns — true by construction, checking nothing. A gate that imports the
  // implementation cannot catch the implementation being wrong. Same rule as the
  // 15 routes and the xhtml:link count below.
  const expectedOg = { es: 'es_ES', en: 'en_US', pt: 'pt_BR' }[loc];
  if (ogLocale && ogLocale !== expectedOg) {
    fail(where, `og:locale is ${ogLocale}, expected ${expectedOg}`);
  }
  const ogImage = metaContent(html, 'og:image', 'property');
  if (ogImage && !ogImage.includes(`/og/${loc}.`)) {
    fail(where, `og:image is ${ogImage}, expected the ${loc} card`);
  }
  if (ogImage && !ogImage.startsWith('https://')) {
    fail(where, `og:image is not absolute: ${ogImage}`);
  }
  for (const k of ['twitter:card', 'twitter:title', 'twitter:image']) {
    if (!metaContent(html, k)) fail(where, `missing ${k}`);
  }

  // ── answer-first: visible, and early in the visible text ──
  const text = visibleText(html);
  const band = /<p class="answer-lead">([\s\S]*?)<\/p>/i.exec(html);
  if (!band) {
    fail(where, 'no .answer-lead — the page does not answer its own title in the first screen');
  } else {
    const lead = band[1].replace(/\s+/g, ' ').trim();
    if (lead.length < 40) fail(where, `answer lead is only ${lead.length} chars: "${lead}"`);
    const at = text.indexOf(lead);
    if (at === -1) {
      fail(where, 'answer lead is not in the visible text (it may be display:none or inside <head>)');
    } else if (at > 0) {
      fail(where, `answer lead starts at visible char ${at}, not first — something precedes it`);
    }
  }

  return { route, title, description, canonical: canonicals[0], hreflangs };
}

function expectedAlternates(route) {
  const path = route.replace(/^\/(es|en|pt)/, '');
  const out = {};
  for (const l of LOCALES) out[l] = `https://pisa.swal.network/${l}${path}`;
  out['x-default'] = `https://pisa.swal.network/en${path}`;
  return out;
}

async function checkSitemap() {
  const res = await get(`${BASE}/sitemap.xml`);
  if (res.status !== 200) {
    fail('/sitemap.xml', `expected 200, got ${res.status}`);
    return;
  }
  const xml = res.text;
  if (!/<urlset[\s\S]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(xml)) {
    fail('/sitemap.xml', 'no <urlset> with the sitemaps.org namespace');
  }
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const expected = [];
  for (const p of PATHS) for (const l of LOCALES) expected.push(`https://pisa.swal.network/${l}/${p}`);
  if (locs.length !== expected.length) {
    fail('/sitemap.xml', `has ${locs.length} <loc>, expected ${expected.length}`);
  }
  for (const e of expected) if (!locs.includes(e)) fail('/sitemap.xml', `missing ${e}`);
  for (const l of locs) if (!l.startsWith('https://')) fail('/sitemap.xml', `<loc> not absolute: ${l}`);
  const blocks = xml.split('<url>').filter((u) => u.includes('<loc>'));
  for (const b of blocks) {
    const n = (b.match(/xhtml:link/g) ?? []).length;
    if (n !== 4) fail('/sitemap.xml', `a <url> has ${n} xhtml:link entries, expected 4`);
  }
  notes.push(`sitemap: ${locs.length} URLs, hreflang on each`);
}

async function checkRobots() {
  const res = await get(`${BASE}/robots.txt`);
  if (res.status !== 200) {
    fail('/robots.txt', `expected 200, got ${res.status}`);
    return;
  }
  const txt = res.text;

  // Retrieval crawlers: answer engines quote from these. Blocking one is the
  // expensive mistake, so each is asserted explicitly allowed.
  const mustAllow = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'Googlebot', 'ChatGPT-User'];
  // Training crawlers: no opt-in to corpora.
  const mustBlock = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot'];

  const groups = {};
  let current = null;
  for (const raw of txt.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#') || !line) continue;
    const ua = /^User-agent:\s*(.+)$/i.exec(line);
    if (ua) {
      current = ua[1].trim().toLowerCase();
      groups[current] ??= [];
      continue;
    }
    const dis = /^Disallow:\s*(.*)$/i.exec(line);
    const allow = /^Allow:\s*(.*)$/i.exec(line);
    if (current && dis) groups[current].push({ dir: 'disallow', path: dis[1].trim() });
    else if (current && allow) groups[current].push({ dir: 'allow', path: allow[1].trim() });
  }

  for (const agent of mustAllow) {
    const g = groups[agent.toLowerCase()];
    if (!g) {
      fail('/robots.txt', `no explicit group for ${agent}`);
      continue;
    }
    const blocked = g.some((r) => r.dir === 'disallow' && r.path === '/');
    if (blocked) fail('/robots.txt', `${agent} is DISALLOWED — this removes the page from answer engines`);
  }

  for (const agent of mustBlock) {
    const g = groups[agent.toLowerCase()];
    if (!g) {
      fail('/robots.txt', `no explicit group for ${agent}`);
      continue;
    }
    const blocked = g.some((r) => r.dir === 'disallow' && r.path === '/');
    if (!blocked) fail('/robots.txt', `${agent} is not blocked — PISAStyle does not opt in to training`);
  }

  if (!/^Sitemap:\s*https:\/\/pisa\.swal\.network\/sitemap\.xml/m.test(txt)) {
    fail('/robots.txt', 'no Sitemap: directive pointing at /sitemap.xml');
  }
  notes.push(`robots: ${Object.keys(groups).length} explicit crawler groups`);
}

async function main() {
  console.log(`verify-seo — checking ${BASE}\n`);

  const pages = [];
  for (const loc of LOCALES) {
    for (const p of PATHS) {
      const r = await checkPage(loc, p);
      if (r) pages.push(r);
      process.stdout.write(r ? '.' : 'x');
    }
  }
  process.stdout.write('\n\n');

  // Uniqueness across the SERVED pages, not the catalog.
  for (const key of ['title', 'description', 'canonical']) {
    const seen = new Map();
    for (const p of pages) {
      const v = p[key];
      if (seen.has(v)) fail('uniqueness', `${key} "${v}" appears on both ${seen.get(v)} and ${p.route}`);
      else seen.set(v, p.route);
    }
  }

  // Reciprocity: /es/x lists /en/x, so /en/x must list /es/x.
  for (const p of pages) {
    const path = p.route.replace(/^\/(es|en|pt)/, '');
    for (const l of LOCALES) {
      if (!p.hreflangs.includes(l)) {
        fail('reciprocity', `${p.route} does not list ${l} for ${path}`);
      }
    }
  }

  await checkSitemap();
  await checkRobots();

  for (const n of notes) console.log(`  ${n}`);

  if (failures.length) {
    console.error(`\nFAIL — ${failures.length} problem(s):\n`);
    for (const f of failures) console.error(`  x ${f}`);
    process.exit(1);
  }

  console.log(`\nOK — ${pages.length} routes: 200, unique metadata, parseable JSON-LD, complete OG, answer-first, sitemap + robots verified.`);
}

main().catch((e) => {
  console.error('verify-seo crashed:', e);
  process.exit(2);
});