import { describe, it, expect } from 'vitest';
import {
  SEO_LOCALES,
  SEO_ROUTES,
  SITE_ORIGIN,
  allSeoUrls,
  buildJsonLd,
  buildSitemapXml,
  ogImageUrl,
  ogLocale,
  routeMeta,
  serializeJsonLd,
} from './seo';

/**
 * These tests pin the properties that decide whether the pages can be cited by
 * an answer engine at all. They are not cosmetic assertions about strings; each
 * one corresponds to a failure that produces a silent loss of visibility.
 *
 * What is deliberately NOT tested here: that the rendered HTML contains these
 * values. A unit test on the catalog cannot catch a Layout that stops passing
 * them through, so that is asserted at runtime instead — see
 * scripts/verify-seo.mjs, which parses the real HTML of all 18 routes.
 */

describe('SEO catalog', () => {
  it('has exactly the five indexable routes, x3 locales = 15 URLs', () => {
    // Five, not six: `/` and `/{locale}` answer 302 (src/middleware.ts), so they
    // are not pages and get no canonical and no sitemap entry.
    expect(SEO_ROUTES.length).toBe(5);
    expect(allSeoUrls().length).toBe(15);
  });

  it('omits / and /{locale}, which answer 302 and are not pages', () => {
    // The middleware redirects both to /{locale}/explorar. Declaring a redirect
    // in a sitemap or as a canonical invites a crawl hop that buys nothing.
    const urls = allSeoUrls().map((u) => u.url);
    expect(urls).not.toContain(`${SITE_ORIGIN}/`);
    // No bare /es, /en, /pt — those are the redirecting index routes.
    expect(urls.some((u) => /\/(es|en|pt)$/.test(u))).toBe(false);
  });

  it('titles are unique across every route AND locale — no page competes with itself', () => {
    const titles = SEO_ROUTES.flatMap((r) => SEO_LOCALES.map((l) => r.copy[l].title));
    const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect(dupes).toEqual([]);
  });

  it('descriptions are unique across every route AND locale', () => {
    const descs = SEO_ROUTES.flatMap((r) => SEO_LOCALES.map((l) => r.copy[l].description));
    expect(descs.filter((d, i) => descs.indexOf(d) !== i)).toEqual([]);
  });

  it('titles are unique WITHIN a locale (the case that actually shipped broken)', () => {
    // This is the regression that motivated the catalog: /es/novedades,
    // /en/novedades and /pt/novedades all declared `site.title`, so three
    // different pages competed for one query.
    for (const loc of SEO_LOCALES) {
      const titles = SEO_ROUTES.map((r) => r.copy[loc].title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it('every locale title is actually translated, not English left in place', () => {
    // The es/pt pages used to render an English tagline. A title that is
    // identical across locales is technically unique per page but useless to a
    // Spanish-speaking query, and it collapses hreflang into a duplicate.
    for (const route of SEO_ROUTES) {
      const { es, en, pt } = route.copy;
      expect(es.title).not.toBe(en.title);
      expect(pt.title).not.toBe(en.title);
      expect(es.title).not.toBe(pt.title);
      expect(es.answer).not.toBe(en.answer);
      expect(pt.answer).not.toBe(en.answer);
    }
  });

  it('titles and descriptions fit the space search results actually give them', () => {
    // Google truncates around 60 chars for a title and 160 for a description.
    // Over that, the differentiating part is the part that gets cut.
    for (const route of SEO_ROUTES) {
      for (const loc of SEO_LOCALES) {
        const { title, description } = route.copy[loc];
        expect(title.length).toBeLessThanOrEqual(75);
        expect(title.length).toBeGreaterThanOrEqual(15);
        expect(description.length).toBeLessThanOrEqual(175);
        expect(description.length).toBeGreaterThanOrEqual(50);
      }
    }
  });

  it('routeMeta normalizes slashes so callers cannot miss the catalog', () => {
    expect(routeMeta('/metodo/')?.path).toBe('metodo');
    expect(routeMeta('metodo')?.path).toBe('metodo');
    // '' resolves to nothing on purpose: it is the redirecting home route.
    expect(routeMeta('')).toBeUndefined();
    expect(routeMeta('nope')).toBeUndefined();
  });
});

describe('answer-first copy', () => {
  it('every route in every locale has an answer', () => {
    for (const route of SEO_ROUTES) {
      for (const loc of SEO_LOCALES) {
        expect(route.copy[loc].answer, `${loc}/${route.path}`).toBeTruthy();
      }
    }
  });

  it('answers are short enough to be a lead, not a paragraph', () => {
    // The extraction window is the point. An answer band longer than a couple of
    // sentences stops being "the answer" and becomes another block to skip.
    for (const route of SEO_ROUTES) {
      for (const loc of SEO_LOCALES) {
        expect(route.copy[loc].answer.length, `${loc}/${route.path}`).toBeLessThanOrEqual(180);
        expect(route.copy[loc].answer.length).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('answers avoid an unescaped apostrophe, which would break the TS string', () => {
    for (const route of SEO_ROUTES) {
      for (const loc of SEO_LOCALES) {
        // A raw ' inside a single-quoted literal is a syntax error; the catalog
        // escaping convention forbids them outright rather than relying on a
        // reader to notice.
        expect(route.copy[loc].answer, `${loc}/${route.path}`).not.toContain("'");
        expect(route.copy[loc].title).not.toContain("'");
      }
    }
  });
});

describe('hreflang and URLs', () => {
  it('every URL declares all three locales plus x-default', () => {
    for (const u of allSeoUrls()) {
      expect(Object.keys(u.alternates).sort()).toEqual(['en', 'es', 'pt', 'x-default']);
    }
  });

  it('x-default points at the default locale, not the first in the list', () => {
    // PISASTYLE_DEFAULT_LOCALE is `en` (pisa-i18n.ts): the international PISA
    // fallback. Pointing x-default at the first locale would send every
    // language-unknown visitor to Spanish.
    for (const u of allSeoUrls()) {
      expect(u.alternates['x-default']).toBe(u.alternates.en);
    }
  });

  it('alternates of one route always agree across locales — the hreflang reciprocity rule', () => {
    // Google requires that if /es/metodo lists /en/metodo, then /en/metodo lists
    // /es/metodo. Asymmetric declarations are ignored wholesale.
    const byRoute = new Map<string, Record<string, string>[]>();
    for (const u of allSeoUrls()) {
      const key = u.path;
      byRoute.set(key, [...(byRoute.get(key) ?? []), u.alternates]);
    }
    for (const [path, all] of byRoute) {
      for (const a of all) {
        for (const [lang, href] of Object.entries(a)) {
          const fromOther = all.find((other) => other[lang] === href);
          expect(fromOther, `${path} -> ${lang}`).toBeDefined();
          expect(fromOther![lang]).toBe(href);
        }
      }
    }
  });
});

describe('JSON-LD', () => {
  const url = `${SITE_ORIGIN}/es/explorar`;

  it('serializes to JSON that actually parses', () => {
    // The whole point of the gate: markup that LOOKS like JSON-LD but does not
    // parse is worse than none, because validators report "present, invalid"
    // and the entities are lost.
    const raw = serializeJsonLd(
      buildJsonLd({
        locale: 'es',
        path: 'explorar',
        title: 'Explorar Unidad PISA',
        description: 'Una unidad PISA completa.',
        url,
      }),
    );
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(JSON.parse(raw)['@context']).toBe('https://schema.org');
  });

  it('carries Organization, WebSite and the page type in one graph', () => {
    const g = JSON.parse(
      serializeJsonLd(
        buildJsonLd({ locale: 'es', path: 'explorar', title: 'T', description: 'D', url }),
      ),
    );
    const types = g['@graph'].map((n: { '@type': string }) => n['@type']);
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
    expect(types).toContain('LearningResource');
  });

  it('names SouthWest AI Labs as the publisher, not the site', () => {
    // The product is PISAStyle; the organisation that publishes it is SWAL.
    // Attributing the content to the product alone loses the lab entity that the
    // product is meant to build credibility for.
    const g = JSON.parse(
      serializeJsonLd(buildJsonLd({ locale: 'es', path: 'metodo', title: 'T', description: 'D', url })),
    );
    const org = g['@graph'].find((n: { '@type': string }) => n['@type'] === 'Organization');
    expect(org.name).toBe('SouthWest AI Labs');
    expect(org.logo).toBeDefined();
  });

  it('uses stable @ids so entities link instead of duplicating', () => {
    const g = JSON.parse(
      serializeJsonLd(buildJsonLd({ locale: 'es', path: 'metodo', title: 'T', description: 'D', url })),
    );
    const org = g['@graph'].find((n: { '@type': string }) => n['@type'] === 'Organization');
    const site = g['@graph'].find((n: { '@type': string }) => n['@type'] === 'WebSite');
    expect(site.publisher['@id']).toBe(org['@id']);
    expect(org['@id']).toBe(`${SITE_ORIGIN}/#organization`);
  });

  it('LearningResource carries the attributes a resource needs, WebPage does not pretend to', () => {
    const lr = JSON.parse(
      serializeJsonLd(buildJsonLd({ locale: 'es', path: 'evaluar', title: 'T', description: 'D', url })),
    )['@graph'].find((n: { '@type': string }) => n['@type'] === 'LearningResource');
    expect(lr.learningResourceType).toBeTruthy();
    expect(lr.educationalUse).toBe('student');
    expect(lr.isAccessibleForFree).toBe(true);
    expect(lr.timeRequired).toBe('PT60M');

    const wp = JSON.parse(
      serializeJsonLd(buildJsonLd({ locale: 'es', path: 'novedades', title: 'T', description: 'D', url })),
    )['@graph'].find((n: { '@type': string }) => n['@type'] === 'WebPage');
    // A news listing is not a course. Emitting learningResourceType on it would
    // be a lie a validator flags.
    expect(wp.learningResourceType).toBeUndefined();
  });

  it('declares inLanguage per page, so the three locales are distinct entities', () => {
    for (const loc of SEO_LOCALES) {
      const g = JSON.parse(
        serializeJsonLd(
          buildJsonLd({ locale: loc, path: 'metodo', title: 'T', description: 'D', url }),
        ),
      );
      const page = g['@graph'].at(-1);
      expect(page.inLanguage).toBe(loc);
    }
  });

  it('neutralises a </script> inside the data', () => {
    // The one way JSON-LD breaks silently: a literal closing tag in the content
    // terminates the <script> early and the rest of the document becomes
    // markup. The result is not a parse error you can see in the HTML.
    const nasty = serializeJsonLd(
      buildJsonLd({
        locale: 'es',
        path: 'metodo',
        title: 'x',
        description: 'y',
        url,
        origin: '</script><script>alert(1)</script>',
      }),
    );
    expect(nasty).not.toContain('</script>');
    expect(() => JSON.parse(nasty)).not.toThrow();
  });

  it('returns only the site entities for an unknown route (404/500 stay valid)', () => {
    const g = JSON.parse(
      serializeJsonLd(buildJsonLd({ locale: 'es', path: 'nope', title: '404', description: 'x', url })),
    );
    expect(g['@graph'].length).toBe(2);
  });
});

describe('sitemap', () => {
  const xml = buildSitemapXml();

  it('declares the sitemaps and xhtml namespaces', () => {
    expect(xml).toContain('http://www.sitemaps.org/schemas/sitemap/0.9');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it('lists 15 <url> entries', () => {
    expect((xml.match(/<url>/g) ?? []).length).toBe(15);
  });

  it('carries hreflang alternates on EVERY url, not just the first', () => {
    // The old failure mode of a hand-written sitemap: the alternates were right
    // for one page and silently absent for the rest.
    const urls = xml.split('<url>').filter((u) => u.includes('<loc>'));
    expect(urls.length).toBe(15);
    for (const u of urls) {
      expect((u.match(/xhtml:link/g) ?? []).length).toBe(4);
    }
  });

  it('sitemap <loc> values match the page hreflang exactly', () => {
    // Same catalog, but this asserts the two cannot drift apart — which is what
    // happens when one is generated and the other is hand-maintained.
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(new Set(locs)).toEqual(new Set(allSeoUrls().map((u) => u.url)));
  });

  it('every loc is absolute https, since a relative loc is invalid', () => {
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      expect(m[1]).toMatch(/^https:\/\/pisa\.swal\.network\//);
    }
  });
});

describe('Open Graph', () => {
  it('maps locales to the OG format', () => {
    expect(ogLocale('es')).toBe('es_ES');
    expect(ogLocale('en')).toBe('en_US');
    expect(ogLocale('pt')).toBe('pt_BR');
  });

  it('has a distinct absolute image per locale', () => {
    // One shared image means every Portuguese share renders a Spanish card, and
    // the og:image URL is a duplicate across all 18 pages.
    const imgs = SEO_LOCALES.map((l) => ogImageUrl(l));
    expect(new Set(imgs).size).toBe(3);
    for (const i of imgs) expect(i).toMatch(/^https:\/\//);
  });
});