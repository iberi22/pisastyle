/**
 * GET /sitemap.xml — the canonical map of the 18 indexable routes.
 *
 * WHY A ROUTE AND NOT A FILE IN `public/`
 * ---------------------------------------
 * A checked-in `public/sitemap.xml` is a snapshot that starts lying the moment a
 * page is added: nothing fails, robots.txt keeps advertising a URL set that no
 * longer matches the site, and the drift is invisible in review. Serving it from
 * `buildSitemapXml` (src/lib/seo.ts) means the sitemap is derived from the same
 * `SEO_ROUTES` catalog that produces the titles, hreflang and JSON-LD, so the
 * four cannot disagree — a new route enters all four at once.
 *
 * `output: 'server'` means this is a real request handler, not a build artifact.
 *
 * WHY `/` AND `/{locale}` ARE ABSENT
 * ----------------------------------
 * The middleware answers both with a 302 to `/{locale}/explorar`
 * (src/middleware.ts). A URL that redirects is not a page; declaring it invites
 * the engine to crawl a hop it does not need.
 *
 * WHY hreflang LIVES IN THE SITEMAP TOO
 * -------------------------------------
 * The pages already declare alternates via <link rel="alternate">, and that is
 * the source of truth. The `xhtml:link` entries repeat the same relation in the
 * one format a crawler reads without fetching each page — the guidance is that
 * the two should agree, and `scripts/verify-seo.mjs` fails the build if they ever
 * stop agreeing.
 */
import type { APIRoute } from 'astro';
import { buildSitemapXml } from '../lib/seo';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL('https://pisa.swal.network')).origin;

  return new Response(buildSitemapXml(origin), {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Sitemaps change whenever a route or a locale is added, and are tiny.
      // A short max-age keeps the crawl loop tight without a CDN purge dance.
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
};