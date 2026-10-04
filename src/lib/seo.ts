/**
 * SEO / GEO — fuente unica de verdad del metadato por ruta y locale.
 *
 * POR QUE ESTE MODULO
 * ------------------
 * El metadato (title, description, Open Graph, JSON-LD) estaba repartido en tres
 * sitios que no se hablaban: el `title` que cada pagina pasa a Layout, el
 * `<head>` de Layout y un `SeoHead.astro` que NADIE usa (verificado: `grep -rn
 * "SeoHead" src/` → 0 usos). Con esa reparto, el unico sintoma visible era que
 * /es/novedades, /en/novedades y /pt/novedades declaraban el MISMO titulo
 * (`site.title`), o sea tres paginas distintas compitiendo por la misma
 * consulta. Aqui vive el catalogo por ruta y locale, y Layout lo consume.
 *
 * QUE NO HACE ESTE MODULO, Y POR QUE (decisiones medidas, no de gusto)
 * ------------------------------------------------------------------
 *
 * 1. `llms.txt` — NO se construye. Medido sin efecto en 300.000 dominios y John
 *    Mueller (Google, junio 2025) declaro que "no AI system currently uses
 *    llms.txt". Es infraestructura prospectiva, no una senal de ranking ni una
 *    via de cita. Publicar un fichero que un motor no lee no cuesta bytes pero
 *    si cuesta credibilidad: da la impresion de que el sitio esta optimizado
 *    para IA cuando lo unico que mide es el propio fichero. Lo que SI se hace es
 *    lo que el estudio GEO si midio como causal (Aggarwal et al., Princeton +
 *    IIT Delhi, arxiv 2311.09735): citar fuentes credibles (+41% de cuota de
 *    cita en motores de respuesta), incluir estadisticas (+31%) y citas
 *    textuales (+28%). Eso no es un fichero, es contenido: las cifras OECD que
 *    ya viven en /metodo y /explorar.
 *
 * 2. `FAQPage` — NO se emite. Google retiro los FAQ rich results el 7 de mayo de
 *    2026 (deprecacion en 3 fases). El schema sigue siendo valido como
 *    semantica, pero ya no produce resultado enriquecido, asi que hacerlo
 *   .presentaria como mecanismo principal algo que no rankea. La FAQ de
 *    /explorar se queda como contenido visible, que es donde un motor de
 *    respuesta la puede citar igual.
 *
 * 3. Requisito previo: el 92,36% de las AI Overviews citan un dominio que ya
 *    estaba en el top 10 organico. Antes de pedir citas hay que estar en la
 *    primera pagina: hreflang (ya estaba, src/lib/alternates.ts), sitemap,
 *    robots.txt y metadato unico — que es lo que se construye aqui.
 *
 * NOTA DE IDIOMA
 * --------------
 * Es codigo, no copy de producto: los comentarios y los identificadores van en
 * ingles, los datos de `copy` en el idioma del visitante. `src/data/*.json` sigue
 * siendo el sitio del copy de cuerpo largo; aqui solo el metadato, porque es lo
 * que Layout necesita antes de renderizar el cuerpo.
 */

export interface SeoRouteMeta {
  /** Path without locale, no leading slash. Never empty: `/` and `/{locale}`
   *  redirect (see SEO_ROUTES), so no route is the home page. */
  path: string;
  /** schema.org type that describes this page's content. */
  schema: 'LearningResource' | 'WebPage';
  /**
   * Per-locale copy: a unique title, a description, and the answer.
   *
   * `answer` is not a meta description. It is the ONE sentence that directly
   * answers the question the title poses, and it is rendered as the first
   * visible text on the page (see the answer band in Layout.astro).
   *
   * WHY IT IS RENDERED, NOT JUST DESCRIBED
   * An answer engine extracts a span to quote. If the key fact sits in the
   * fourth paragraph behind a hero image and two CTA buttons, the extractor has
   * a window it may not open, and the page loses to a competitor whose answer
   * was in the first 80 characters. Putting the answer first makes the page
   * quotable, which is the entire GEO lever available to a page.
   *
   * Keep these SHORT (roughly 60-160 characters). They are read as a lead, not
   * as a paragraph: an answer band that turns into a wall of text stops being
   * the answer.
   */
  copy: Record<SeoLocale, { title: string; description: string; answer: string }>;
}

export type SeoLocale = 'es' | 'en' | 'pt';

export const SEO_LOCALES: SeoLocale[] = ['es', 'en', 'pt'];

/**
 * Imagen Open Graph por locale. Un solo `og:image` para todo el sitio pierde
 * la señal de idioma en el preview de WhatsApp/Slack/X de cada locale, asi que
 * hay una por locale (mismo diseno, texto traducido). Archivos en `public/og/`.
 */
export const OG_IMAGES: Record<SeoLocale, string> = {
  es: '/og/es.png',
  en: '/og/en.png',
  pt: '/og/pt.png',
};

// Single source of truth for the card geometry: Layout emits it as og:image:*
// and scripts/generate-og.mjs renders at exactly these dimensions. Hardcoding
// 1200x630 in both places is how a card ends up declared 630x1200.
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export const SITE_ORIGIN = 'https://pisa.swal.network';

/** The publisher. The logo is the site SVG, which is what exists. */
export const ORGANIZATION = {
  name: 'SouthWest AI Labs',
  alternateName: 'SWAL',
  url: 'https://swal.network',
  logo: `${SITE_ORIGIN}/icons/icon-512.svg`,
  description:
    'SouthWest AI Labs (SWAL) is the lab behind PISAStyle, a free multilingual preparation platform for the PISA programme.',
} as const;

/**
 * The public routes, in all three locales = 15 canonical URLs (5 pages x 3 locales).
 *
 * WHY THERE IS NO `''` ENTRY (the home page)
 * ------------------------------------------
 * `/` and `/{locale}` are NOT indexable pages in this app: the middleware
 * answers both with a 302 to `/{locale}/explorar` (src/middleware.ts:52-53).
 * Declaring a canonical or a sitemap entry for a URL that redirects is a
 * self-inflicted inconsistency — Google is told the content lives at /es while
 * requesting /es lands on /es/explorar.
 *
 * So the catalog holds exactly the five real pages. The copy that used to be the
 * home hero now lives on /explorar, which is where the visitor actually lands
 * and which is the page that has to rank.
 */
export const SEO_ROUTES: SeoRouteMeta[] = [
  {
    path: 'explorar',
    schema: 'LearningResource',
    copy: {
      es: {
        title: 'Domina PISA con el Método PISAStyle',
        description:
          'Unidad PISA completa: estímulo, contenido de estudio y 5 ítems por dominio (matemáticas, lectura, ciencias), con las cifras OECD 2022 citadas. Gratis, sin registro.',
        answer:
          'Estímulo + contenido de estudio + ítems de PISA en las tres áreas, con las cifras OECD 2022 citadas.',
      },
      en: {
        title: 'Master PISA with the PISAStyle Method',
        description:
          'One complete PISA unit: a stimulus, study content and 5 items per domain (mathematics, reading, science), with the OECD 2022 figures cited. Free, no sign-up.',
        answer:
          'A PISA stimulus, study content and items across the three areas, with the OECD 2022 figures cited.',
      },
      pt: {
        title: 'Domine o PISA com o Método PISAStyle',
        description:
          'Unidade PISA completa: estímulo, conteúdo de estudo e 5 itens por domínio (matemática, leitura, ciências), com os números OECD 2022 citados. Grátis, sem cadastro.',
        answer:
          'Estímulo + conteúdo de estudo + itens de PISA nas três áreas, com os números OECD 2022 citados.',
      },
    },
  },
  {
    path: 'metodo',
    schema: 'LearningResource',
    copy: {
      es: {
        title: 'Método PISAStyle v1.1: cómo se estudia para PISA',
        description:
          'El método PISAStyle v1.1 en tres pasos (estímulo, estudio de 1-2 h, examen) sobre el ciclo PISA de formular, emplear e interpretar, con datos de referencia PISA 2022.',
        answer:
          'Tres pasos por unidad — estímulo, estudio de 1-2 h y examen — sobre el ciclo PISA de formular, emplear e interpretar.',
      },
      en: {
        title: 'PISAStyle Method v1.1: how to study for PISA',
        description:
          'The PISAStyle v1.1 method in three steps (stimulus, 1-2 h of study, exam) built on the PISA cycle of formulating, employing and interpreting, with PISA 2022 reference data.',
        answer:
          'Three steps per unit — stimulus, 1-2 h of study and exam — on the PISA cycle of formulating, employing and interpreting.',
      },
      pt: {
        title: 'Método PISAStyle v1.1: como estudar para o PISA',
        description:
          'O método PISAStyle v1.1 em três etapas (estímulo, 1-2 h de estudo, exame) sobre o ciclo PISA de formular, empregar e interpretar, com dados de referência PISA 2022.',
        answer:
          'Três etapas por unidade — estímulo, 1-2 h de estudo e exame — sobre o ciclo PISA de formular, empregar e interpretar.',
      },
    },
  },
  {
    path: 'novedades',
    schema: 'WebPage',
    copy: {
      es: {
        title: 'Novedades PISA: resultados y cambios del programa',
        description:
          'Resultados PISA 2022 y cambios del programa, cada noticia con su fecha y su fuente OECD. Sin afiliación con la OCDE.',
        answer:
          'Resultados PISA 2022 por país y cambios del programa, cada noticia con fecha y fuente OECD.',
      },
      en: {
        title: 'PISA news: results and programme changes',
        description:
          'PISA 2022 results and programme changes, each item with its date and its OECD source. No affiliation with the OECD.',
        answer:
          'PISA 2022 results by country and programme changes, each item with its date and OECD source.',
      },
      pt: {
        title: 'Novidades PISA: resultados e mudanças do programa',
        description:
          'Resultados PISA 2022 e mudanças do programa, cada notícia com sua data e sua fonte OECD. Sem afiliação com a OCDE.',
        answer:
          'Resultados PISA 2022 por país e mudanças do programa, cada notícia com data e fonte OECD.',
      },
    },
  },
  {
    path: 'evaluar',
    schema: 'LearningResource',
    copy: {
      es: {
        title: 'Evalúa tu nivel de PISA en 15 preguntas',
        description:
          'Autoevaluación orientativa: 15 preguntas, 5 por dominio, que estiman tu nivel de desempeño PISA. No es un examen oficial y no predice resultados.',
        answer:
          'Quince preguntas, cinco por dominio, que estiman tu nivel de desempeño PISA. Orientativo: no es un examen oficial.',
      },
      en: {
        title: 'Check your PISA level in 15 questions',
        description:
          'A self-check, not an exam: 15 questions, 5 per domain, that estimate your PISA performance level. It is not an official test and does not predict results.',
        answer:
          'Fifteen questions, five per domain, that estimate your PISA performance level. Indicative: not an official test.',
      },
      pt: {
        title: 'Avalie seu nível PISA em 15 questões',
        description:
          'Autoavaliação orientativa: 15 questões, 5 por domínio, que estimam seu nível de desempenho PISA. Não é um exame oficial e não prevê resultados.',
        answer:
          'Quinze questões, cinco por domínio, que estimam seu nível de desempenho PISA. Orientativo: não é um exame oficial.',
      },
    },
  },
  {
    path: 'contribuir',
    schema: 'WebPage',
    copy: {
      es: {
        title: 'Corrige o propone un ítem PISA — PISAStyle',
        description:
          'Propón una corrección o un ítem nuevo de PISAStyle. Se abre una issue en GitHub con los 14 campos del Protocolo v1.1, sin login y sin datos personales.',
        answer:
          'Abre una issue de GitHub con los 14 campos del Protocolo v1.1 ya escritos. Sin login y sin datos personales.',
      },
      en: {
        title: 'Report a correction or propose a PISA item — PISAStyle',
        description:
          'Propose a correction or a new PISAStyle item. A GitHub issue opens with the 14 Protocol v1.1 fields filled in, no sign-up and no personal data.',
        answer:
          'Opens a GitHub issue with the 14 Protocol v1.1 fields already written out. No sign-up, no personal data.',
      },
      pt: {
        title: 'Corrige ou proponha um item PISA — PISAStyle',
        description:
          'Proponha uma correção ou um novo item do PISAStyle. Abre-se uma issue no GitHub com os 14 campos do Protocolo v1.1, sem login e sem dados pessoais.',
        answer:
          'Abre uma issue do GitHub com os 14 campos do Protocolo v1.1 já escritos. Sem login e sem dados pessoais.',
      },
    },
  },
];

const ROUTE_BY_KEY = new Map(SEO_ROUTES.map((r) => [r.path, r]));

/** Meta de una ruta, o undefined si no esta en el catalogo (404/500, etc). */
export function routeMeta(path: string): SeoRouteMeta | undefined {
  return ROUTE_BY_KEY.get(path.replace(/^\/+|\/+$/g, ''));
}

/** Las 18 rutas canonicales, como {locale, path, url}. */
export interface SeoUrl {
  locale: SeoLocale;
  path: string;
  url: string;
  alternates: Record<string, string>;
}

/**
 * Todas las URLs indexables con sus alternates hreflang.
 *
 * `x-default` apunta al locale por defecto (`en`), no al primero de la lista:
 * es el idioma de reserva internacional de PISA y es el que un motor usa cuando
 * no puede decidir el idioma del visitante.
 */
export function allSeoUrls(origin: string = SITE_ORIGIN): SeoUrl[] {
  const out: SeoUrl[] = [];
  for (const route of SEO_ROUTES) {
    const alternates: Record<string, string> = {};
    for (const loc of SEO_LOCALES) {
      alternates[loc] = `${origin}/${loc}${route.path ? `/${route.path}` : ''}`;
    }
    alternates['x-default'] = `${origin}/en${route.path ? `/${route.path}` : ''}`;

    for (const loc of SEO_LOCALES) {
      out.push({ locale: loc, path: route.path, url: alternates[loc], alternates });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * JSON-LD
 * ------------------------------------------------------------------ */

/**
 * Quita el marcado de schema.org. Un `&` sin escapar rompe el parseo del
 * documento entero, y el error no se ve en el HTML: sale como "no valid".
 * Menos es mas aqui.
 */
function escapeText(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** `og:locale` y su alterno, en el formato que exige Open Graph. */
const OG_LOCALE: Record<SeoLocale, string> = {
  es: 'es_ES',
  en: 'en_US',
  pt: 'pt_BR',
};

export interface JsonLdInput {
  locale: SeoLocale;
  /** Path sin locale. `''` = portada. */
  path: string;
  title: string;
  description: string;
  /** URL canonica de esta pagina concreta. */
  url: string;
  origin?: string;
}

/**
 * Grafo JSON-LD de una pagina: Organization + WebSite + (LearningResource |
 * WebPage), en un unico `<script type="application/ld+json">`.
 *
 * Por que un grafo y no dos scripts: `Organization` y `WebSite` son las mismas
 * en las 18 paginas, asi que van en un `@graph` para que un validador los lea
 * una vez. Por que `LearningResource` y no `Course`: LearningResource es la
 * subclase concreta de un recurso educativo (Course significaria un programa
 * con carga horaria y temario, que es lo que describe /metodo, no cada unidad).
 */
export function buildJsonLd({ locale, path, title, description, url, origin = SITE_ORIGIN }: JsonLdInput) {
  const route = routeMeta(path);

  const website = {
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: 'PISAStyle by SWAL',
    url: origin,
    inLanguage: SEO_LOCALES,
    publisher: { '@id': `${origin}/#organization` },
  };

  const graph: unknown[] = [
    {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      ...ORGANIZATION,
      logo: {
        '@type': 'ImageObject',
        url: ORGANIZATION.logo,
      },
    },
    website,
  ];

  if (!route) return { '@context': 'https://schema.org', '@graph': graph };

  const about = {
    '@type': 'Thing',
    name: 'PISA — Programme for International Student Assessment (OECD)',
    description:
      'PISA is the OECD programme that assesses fifteen-year-olds' + "'" + ' reading, mathematics and science.',
  };

  const page: Record<string, unknown> = {
    '@type': route.schema,
    '@id': `${url}#${route.schema}`,
    name: escapeText(title),
    description: escapeText(description),
    url,
    inLanguage: locale,
    isPartOf: { '@id': `${origin}/#website` },
    publisher: { '@id': `${origin}/#organization` },
    about,
  };

  if (route.schema === 'LearningResource') {
    // `timeRequired` en ISO 8601: es el atributo que un motor puede leer para
    // responder "cuanto tarda", y ya es la promesa del producto (1-2 h).
    Object.assign(page, {
      learningResourceType: locale === 'es'
        ? 'Unidad de preparación PISA'
        : locale === 'pt'
          ? 'Unidade de preparação PISA'
          : 'PISA preparation unit',
      educationalLevel: 'Secondary education (PISA: 15-year-olds)',
      educationalUse: 'student',
      timeRequired: 'PT60M',
      isAccessibleForFree: true,
      typicalAgeRange: '14-16',
    });
  }

  graph.push(page);
  return { '@context': 'https://schema.org', '@graph': graph };
}

/**
 * Serializa el grafo a texto para el `<script type="application/ld+json">`.
 *
 * `JSON.stringify` escapa ya `<`, `>` y `&` como \u003c, \u003e y \u0026 (Astro
 * pasa el valor por `set:html`, que exige que el texto este escapado una vez).
 * El unico peligro real es un `</script>` literal dentro de los datos, que
 * cierra la etiqueta antes de tiempo; se neutraliza explicitamente.
 */
export function serializeJsonLd(graph: unknown): string {
  return JSON.stringify(graph, null, 2).replace(/<\//g, '<\\/');
}

export function ogLocale(locale: SeoLocale): string {
  return OG_LOCALE[locale];
}

export function ogImageUrl(locale: SeoLocale, origin: string = SITE_ORIGIN): string {
  return `${origin}${OG_IMAGES[locale]}`;
}

/**
 * sitemap.xml con hreflang en cada URL.
 *
 * `xhtml:link` por alterno es la forma canonica de declarar la relacion entre
 * idiomas (Google la leo desde 2012). Alternativa descartada: `<urlset>` simple,
 * que declara 18 paginas y Google deducira los idiomas de las paginas, con lo
 * que un corte de traduccion se interpreta como duplicado.
 */
export function buildSitemapXml(origin: string = SITE_ORIGIN): string {
  const entries = allSeoUrls(origin)
    .map((u) => {
      const alts = SEO_LOCALES.map(
        (loc) => `    <xhtml:link rel="alternate" hreflang="${loc}" href="${u.alternates[loc]}" />`,
      ).join('\n');
      const xd = `    <xhtml:link rel="alternate" hreflang="x-default" href="${u.alternates['x-default']}" />`;
      return [
        '  <url>',
        `    <loc>${u.url}</loc>`,
        alts,
        xd,
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    entries,
    '</urlset>',
    '',
  ].join('\n');
}