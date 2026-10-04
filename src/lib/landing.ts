/**
 * Llamadas a la accion (CTA) de la landing.
 *
 * — POR QUE ESTE MODULO —
 * El hero con los botones vivia en `[locale]/index.astro`, que es INALCANZABLE:
 * el middleware redirige `/` y `/{locale}` a `/{locale}/explorar`
 * (src/middleware.ts:68). Traducido: el visitante aterriza en explorar y no ve
 * ningun boton, solo un `<h1>` suelto — de ahi la queja de que "no parece una
 * app". Y los `<Button>` de index.astro no tenian `href`: eran botones sin
 * destino, ni siquiera enlaces.
 *
 * Aqui se definen los destinos de verdad, ya resueltos por locale, para que la
 * landing tenga por donde entrar y el test pueda comprobar que ningun CTA
 * apunta a "#" ni a un href vacio.
 */

import type { PisaLocale } from './pisa-i18n';

export interface LandingCta {
  /** Texto visible, ya traducido. */
  label: string;
  /** Ruta interna con el locale aplicado. Nunca '#' ni vacio. */
  href: string;
  /** El CTA principal: la accion que el visitante vino a hacer. */
  primary?: boolean;
  /** Variante visual del boton del core. */
  variant: 'primary' | 'ghost';
}

const COPY: Record<PisaLocale, { primary: string; secondary: string }> = {
  // El primario es el evaluador: el goal explicito era "no veo un evaluar aqui".
  es: { primary: 'Evalúa tu nivel', secondary: 'Ver la unidad de hoy' },
  en: { primary: 'Check your level', secondary: "See today's unit" },
  pt: { primary: 'Avalie seu nível', secondary: 'Ver a unidade de hoje' },
};

/**
 * CTAs de la landing, en orden de importancia.
 *
 * El primario va a `/evaluar` porque es la accion que el visitante busca al
 * entrar; el secundario lleva a la unidad que se esta mostrando. Ambos tienen
 * destino real: no hay CTA decorativo.
 */
export function landingCtas(locale: PisaLocale): LandingCta[] {
  const t = COPY[locale];
  return [
    { label: t.primary, href: `/${locale}/evaluar`, primary: true, variant: 'primary' },
    { label: t.secondary, href: `/${locale}/explorar`, variant: 'ghost' },
  ];
}

/**
 * Subtitulo de la landing. Se queda aqui y no en el JSON porque es el texto que
 * explica que se puede hacer en la pagina: sin el, el visitante aterriza en un
 * grafico sin entender que ofrece la app.
 */
export const LANDING_TAGLINE: Record<PisaLocale, string> = {
  es: 'Quince preguntas para saber tu nivel de PISA y una unidad de estudio por dominio. Sin registro.',
  en: 'Fifteen questions to find your PISA level and one study unit per domain. No sign-up.',
  pt: 'Quinze questões para saber seu nível PISA e uma unidade de estudo por domínio. Sem cadastro.',
};
