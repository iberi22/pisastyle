/**
 * motion — tokens de movimiento y helpers de PISAStyle.
 *
 * Por qué existe esto y no más CSS suelto: el tema del core
 * (`cores/swal-ui/src/tokens/theme.css`) ya declara las duraciones y las curvas
 * (`--swal-transition-fast|transition|transition-slow`, `--swal-ease-out|in`),
 * pero NO keyframes de entrada, ni una forma de escalonar una lista, ni una
 * regla que diga qué se anula cuando el usuario pidió menos movimiento. Cada
 * componente acababa inventando su propio `transition:` y su propio
 * `@media (prefers-reduced-motion)`, que es exactamente como un sistema de
 * motion se vuelve inmanejable.
 *
 * CONTRATO (three things, en este orden):
 *
 *  1. TODO el movimiento sale de un token. Este módulo no acepta milisegundos
 *     sueltos ni curvas escritas a mano: se elige un nombre de `MOTION_DURATIONS`
 *     o `MOTION_EASINGS` y se traduce a la variable del core. La unica
 *     excepción es la curva `standard`, que es la que va *dentro* de los tokens
 *     `--swal-transition-*` y por tanto no existe suelta (ver EASING_VAR).
 *
 *  2. `prefers-reduced-motion: reduce` es ley, no una recomendación. El CSS de
 *     `src/styles/motion.css` pone `animation: none` a todo lo que lleva la
 *     clase `motion`, y este módulo ofrece el equivalente en JS para lo que no
 *     se puede resolver con CSS (contadores, Web Animations API). Un usuario con
 *     vestibular disorder no recibe ni un frame de animación.
 *
 *  3. El movimiento NUNCA es la única diferencia entre dos estados, y nunca
 *     cambia el contraste en reposo. Lo que anima es `transform` y `opacity` con
 *     una duración acotada por token (120/180/280ms): WCAG 2.2 §1.4.3 mide el
 *     estado que se presenta, no los 180ms transitorios de una entrada, así que
 *     el AA queda garantizado por los tokens de color del core, no por la
 *     animación. Por eso no existe aquí ningún token de color y por eso
 *     `scripts/verify-swallow-tokens.py` no encuentra literales en
 *     `src/components/motion/`.
 *
 * Uso típico desde un componente:
 *
 *   <div style={motionStyle({ variant: 'fade-up', duration: 'base', index: 3 })}>
 *
 * SSR-safe por construcción: las funciones de DOM (`prefersReducedMotion`) no
 * tocan `window` si no existe, así que se pueden llamar durante el render de
 * Astro sin romper el build.
 */

/* ─── Duraciones ────────────────────────────────────────────────────────── */

/**
 * Nombres de duración. Los valores en ms son el MISMO numero que el token del
 * core al que apuntan; `motion.test.ts` lee `theme.css` y falla si divergen, de
 * modo que la copia no puede quedarse vieja en silencio.
 */
export type MotionDuration = 'instant' | 'fast' | 'base' | 'slow';

export const MOTION_DURATIONS: Readonly<Record<MotionDuration, number>> = Object.freeze({
  /** 0ms. Para lo que debe cambiar de estado sin animarse (un toggle de datos). */
  instant: 0,
  /** 120ms — micro-feedback: hover, foco, press. */
  fast: 120,
  /** 180ms — entrada y salida de un componente. */
  base: 180,
  /** 280ms — algo que ocupa pantalla (panel, hoja). Reserved. */
  slow: 280,
});

/** Token del core del que sale cada duración, sin la parte de `cubic-bezier`. */
export const DURATION_TOKEN: Readonly<Record<MotionDuration, string>> = Object.freeze({
  instant: '0ms',
  fast: '--swal-transition-fast',
  base: '--swal-transition',
  slow: '--swal-transition-slow',
});

/* ─── Curvas ────────────────────────────────────────────────────────────── */

export type MotionEasing = 'standard' | 'out' | 'in';

/**
 * `standard` no tiene token propio porque es la curva *dentro* de los tokens
 * `--swal-transition-*` (`cubic-bezier(0.4, 0, 0.2, 1)`). Se escribe literal
 * aquí y `motion.test.ts` verifica que sigue siendo la misma: si el core cambia
 * su curva estandar, el test falla en vez de dejar dos curvas distintas en el
 * bundle.
 */
export const EASING_VAR: Readonly<Record<MotionEasing, string>> = Object.freeze({
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  out: 'var(--swal-ease-out)',
  in: 'var(--swal-ease-in)',
});

/** Curva estándar tal y como la declara el core. Para los tests. */
export const STANDARD_EASING = EASING_VAR.standard;

/* ─── Variantes ─────────────────────────────────────────────────────────── */

/**
 * Variantes de entrada. El nombre es la clase CSS (`motion-fade-up`) y el valor
 * es el desplazamiento en px, que se publica como `--motion-distance` para que
 * `motion.css` lo use en el keyframe sin repetir el numero en dos sitios.
 * `fade` no se mueve: solo aparece.
 */
export type MotionVariant =
  | 'none'
  | 'fade'
  | 'fade-up'
  | 'fade-down'
  | 'scale'
  | 'slide-left'
  | 'slide-right';

export const MOTION_VARIANTS: readonly MotionVariant[] = Object.freeze([
  'none',
  'fade',
  'fade-up',
  'fade-down',
  'scale',
  'slide-left',
  'slide-right',
]);

const DISTANCE_PX: Readonly<Record<MotionVariant, number>> = Object.freeze({
  none: 0,
  fade: 0,
  'fade-up': 8,
  'fade-down': 8,
  scale: 0.96,
  'slide-left': 12,
  'slide-right': 12,
});

export const motionClass = (variant: MotionVariant): string => `motion motion-${variant}`;

export const motionDistance = (variant: MotionVariant): number => DISTANCE_PX[variant];

/**
 * `--motion-distance` tal y como va al CSS. `scale()` toma un FACTOR sin
 * unidad, no un desplazamiento: escribir `scale(12px)` es una regla invalida y el
 * navegador descarta el keyframe entero, con lo que el elemento apareceria sin
 * animar. Por eso el factor lleva su propio sufijo y el resto, px.
 *
 * En `reduced` el factor de `scale` cae a 1 (identidad), no a 0: `scale(0)`
 * colapsaria el elemento y lo dejaria invisible si la animacion llegara a
 * ejecutarse por un bug de orden de cascada.
 */
export function motionDistanceValue(variant: MotionVariant, reduced = false): string {
  const raw = reduced ? (variant === 'scale' ? 1 : 0) : DISTANCE_PX[variant];
  return variant === 'scale' ? String(raw) : `${raw}px`;
}

/* ─── Escalonado ────────────────────────────────────────────────────────── */

/**
 * Retardo de entrada por posicion. Se ACOTA en `maxItems`: una lista de 200
 * elementos con 60ms de escalonado deja el ultimo element esperando 12s, que es
 * una carga Useful Motiongone y hace que la pagina parezca rota. A partir de
 * `maxItems` el retardo se congela.
 */
export function staggerDelay(index: number, step = 60, maxItems = 6): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  const safeStep = Number.isFinite(step) && step > 0 ? step : 0;
  return Math.floor(Math.min(index, Math.max(0, Math.floor(maxItems)))) * safeStep;
}

/* ─── Estilos ───────────────────────────────────────────────────────────── */

export interface MotionStyleOptions {
  variant?: MotionVariant;
  duration?: MotionDuration;
  easing?: MotionEasing;
  /** Retardo explicito en ms. Gana sobre `index` si vienen los dos. */
  delay?: number;
  /** Posicion en la lista: se traduce a retardo con `staggerDelay`. */
  index?: number;
  staggerStep?: number;
  maxStagger?: number;
  /** Fuerza el modo reducido y publica solo opacidad, sin desplazamiento. */
  reduced?: boolean;
}

/**
 * Custom properties inline para un elemento con animacion. Se escriben
 * propiedades, no `animation:` completo, para que `motion.css` siga siendo el
 * unico sitio que decide el keyframe y el unico que puede anularlo con
 * `prefers-reduced-motion`.
 *
 * Devuelve '' para `variant: 'none'`: el elemento no lleva clase ni estilo y se
 * queda exactamente como esta hoy.
 */
export function motionStyle(options: MotionStyleOptions = {}): string {
  const {
    variant = 'fade-up',
    duration = 'base',
    easing = 'out',
    delay,
    index,
    staggerStep,
    maxStagger,
    reduced = false,
  } = options;

  if (variant === 'none') return '';

  const ms = reduced ? 0 : MOTION_DURATIONS[duration];
  const resolvedDelay = reduced
    ? 0
    : delay !== undefined
      ? Math.max(0, Math.floor(delay))
      : index !== undefined
        ? staggerDelay(index, staggerStep, maxStagger)
        : 0;

  return [
    `--motion-duration:${ms}ms`,
    `--motion-easing:${reduced ? EASING_VAR.standard : EASING_VAR[easing]}`,
    `--motion-delay:${resolvedDelay}ms`,
    `--motion-distance:${motionDistanceValue(variant, reduced)}`,
  ].join(';');
}

/* ─── prefers-reduced-motion en JS ──────────────────────────────────────── */

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Estado de la preferencia en el momento de la llamada. SSR-safe: sin
 * `window` devuelve `false` (no hay preferencia que respetar todavia) y el
 * primer render sale sin retardo, igual que hace hoy el resto de la app.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia(REDUCED_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * Suscribe un callback a los cambios de la preferencia (el usuario la puede
 * cambiar en caliente desde las preferencias del SO). Devuelve la funcion para
 * cancelar la suscripcion; si `matchMedia` no existe devuelve un noop, para que
 * el consumidor no tenga que comprobar nada.
 */
export function onReducedMotionChange(callback: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  let mql: MediaQueryList;
  try {
    mql = window.matchMedia(REDUCED_QUERY);
  } catch {
    return () => {};
  }
  const handler = (event: MediaQueryListEvent | MediaQueryList) => callback(event.matches);
  // Safari <14 solo tiene addListener/removeListener.
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler as (e: MediaQueryListEvent) => void);
    return () => mql.removeEventListener('change', handler as (e: MediaQueryListEvent) => void);
  }
  // Safari <14 solo expone addListener/removeListener. Se castea a una forma
  // propia porque esos dos metodos estan deprecated en lib.dom y referenciarlos
  // sale como hint en `astro check` aunque el codigo sea correcto.
  const legacy = mql as unknown as {
    addListener?: (cb: (e: MediaQueryListEvent) => void) => void;
    removeListener?: (cb: (e: MediaQueryListEvent) => void) => void;
  };
  const legacyHandler = handler as (e: MediaQueryListEvent) => void;
  legacy.addListener?.(legacyHandler);
  return () => legacy.removeListener?.(legacyHandler);
}

/**
 * ¿El elemento esta ya dentro de la ventana? Solo tiene sentido en el navegador.
 *
 * Lee `getBoundingClientRect()`, que FUERZA reflow: por eso esta fuera de los
 * helpers puros y su uso se limita a un `onMount` por elemento, nunca dentro de
 * un bucle de scroll.
 *
 * Devuelve `true` sin navegador. Es el lado seguro: si no se puede medir, se
 * asume "ya visible" y no se oculta nada. Con SSR o en un test sin DOM, este
 * componente tiene que devolver lo que el servidor ya renderizo.
 */
export function isInViewport(el: Element | null | undefined): boolean {
  if (!el || typeof el.getBoundingClientRect !== 'function') return true;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return true; // no medible: no esconder
  return r.bottom > 0 && r.top < (window.innerHeight || 0) && r.right > 0 && r.left < (window.innerWidth || 0);
}

/**
 * Decision final para animaciones dirigidas por JS (contadores, WAAPI): si el
 * usuario pidio menos movimiento, el valor final se pinta de golpe y no hay
 * ningun frame intermedio. Devuelve el valor final siempre, para que el estado
 * del DOM sea el mismo en los dos casos y no dependa del timing.
 */
export function resolveJsAnimation(
  target: number,
  reduced: boolean = prefersReducedMotion(),
): { value: number; animate: boolean } {
  return { value: Number.isFinite(target) ? target : 0, animate: !reduced };
}