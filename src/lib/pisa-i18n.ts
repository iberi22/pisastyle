/**
 * pisa-i18n — catalogo ES/EN/PT para PISAStyle (Fase 1).
 * Country (CO/MX/BR/...) y locale (es/en/pt) son ejes separados:
 * - locale: idioma UI (URL /es|en|pt + ?lang= + cookie + Accept-Language + navigator.language)
 * - country: solo hint de contenidos/moneda via CF-IPCountry, NUNCA impone idioma.
 * Fallback area internacional PISA: en (no es).
 */

export type PisaLocale = 'es' | 'en' | 'pt';
export const PISASTYLE_LOCALES: PisaLocale[] = ['es', 'en', 'pt'];
export const PISASTYLE_DEFAULT_LOCALE: PisaLocale = 'en';

type Catalog = Record<string, string>;

const es: Catalog = {
  'site.title': 'PISAStyle by SWAL — Preparación PISA',
  'site.tagline': 'Matemáticas, Lectura, Ciencias y Mundo Digital. Contenido no oficial, sin afiliación con la OECD.',
  'nav.study': 'Estudiar',
  'nav.practice': 'Practicar',
  'nav.rankings': 'Rankings',
  'nav.infographics': 'Infografías',
  'hero.title': 'Domina PISA con el Método PISAStyle',
  'hero.subtitle': 'Unidades con estímulo + estudio de 1-2h + examen. Fuentes OECD al final de cada unidad.',
  'unit.studyMinutes': 'Estudio estimado',
  'unit.minutes': 'min',
  'unit.sources': 'Fuentes',
  'unit.protocol': 'Protocolo usado',
  'unit.process': 'Proceso',
  'unit.domain': 'Dominio',
  'consent.telemetry': 'Comparto telemetría anonimizada a cambio de tokens SWAL',
  'footer.disclaimer': 'Contenido educativo no oficial. PISA es un programa de la OECD. Sin afiliación.',
};

const en: Catalog = {
  'site.title': 'PISAStyle by SWAL — PISA Readiness',
  'site.tagline': 'Mathematics, Reading, Science and Learning in the Digital World. Unofficial content, no OECD affiliation.',
  'nav.study': 'Study',
  'nav.practice': 'Practice',
  'nav.rankings': 'Rankings',
  'nav.infographics': 'Infographics',
  'hero.title': 'Master PISA with the PISAStyle Method',
  'hero.subtitle': 'Stimulus units + 1-2h study + exam. OECD sources at the end of each unit.',
  'unit.studyMinutes': 'Estimated study',
  'unit.minutes': 'min',
  'unit.sources': 'Sources',
  'unit.protocol': 'Protocol used',
  'unit.process': 'Process',
  'unit.domain': 'Domain',
  'consent.telemetry': 'I share anonymized telemetry in exchange for SWAL tokens',
  'footer.disclaimer': 'Unofficial educational content. PISA is an OECD programme. No affiliation.',
};

const pt: Catalog = {
  'site.title': 'PISAStyle by SWAL — Preparação PISA',
  'site.tagline': 'Matemática, Leitura, Ciências e Mundo Digital. Conteúdo não oficial, sem afiliação com a OECD.',
  'nav.study': 'Estudar',
  'nav.practice': 'Praticar',
  'nav.rankings': 'Rankings',
  'nav.infographics': 'Infográficos',
  'hero.title': 'Domine o PISA com o Método PISAStyle',
  'hero.subtitle': 'Unidades com estímulo + estudo de 1-2h + exame. Fontes OECD ao final de cada unidade.',
  'unit.studyMinutes': 'Estudo estimado',
  'unit.minutes': 'min',
  'unit.sources': 'Fontes',
  'unit.protocol': 'Protocolo usado',
  'unit.process': 'Processo',
  'unit.domain': 'Domínio',
  'consent.telemetry': 'Compartilho telemetria anonimizada em troca de tokens SWAL',
  'footer.disclaimer': 'Conteúdo educacional não oficial. PISA é um programa da OECD. Sem afiliação.',
};

const catalogs: Record<PisaLocale, Catalog> = { es, en, pt };

export function normalizePisaLocale(value?: string | null): PisaLocale {
  if (!value) return PISASTYLE_DEFAULT_LOCALE;
  const v = value.toLowerCase();
  if (v.startsWith('es')) return 'es';
  if (v.startsWith('pt')) return 'pt';
  if (v.startsWith('en')) return 'en';
  return PISASTYLE_DEFAULT_LOCALE;
}

/** Orden: URL ?lang= > cookie locale > Accept-Language > fallback en. */
export function resolveLocaleFromRequest(req: Request, cookies = ''): PisaLocale {
  const url = new URL(req.url);
  const q = url.searchParams.get('lang');
  if (q) return normalizePisaLocale(q);
  const m = cookies.match(/(?:^|;\s*)locale=(es|en|pt)/i);
  if (m) return normalizePisaLocale(m[1]);
  const al = req.headers.get('accept-language');
  if (al) {
    const first = al.split(',')[0]?.split(';')[0]?.trim();
    if (first && !first.startsWith('*')) {
      // Solo aceptamos es/en/pt en Fase 1; otro idioma -> fallback en
      const n = normalizePisaLocale(first);
      if (['es', 'en', 'pt'].includes(first.slice(0, 2).toLowerCase())) return n;
      return PISASTYLE_DEFAULT_LOCALE;
    }
  }
  return PISASTYLE_DEFAULT_LOCALE;
}

export function t(key: string, locale: PisaLocale = PISASTYLE_DEFAULT_LOCALE): string {
  return catalogs[locale]?.[key] ?? catalogs.en[key] ?? key;
}
