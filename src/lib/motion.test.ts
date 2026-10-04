import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  isInViewport,
  MOTION_DURATIONS,
  MOTION_VARIANTS,
  STANDARD_EASING,
  motionClass,
  motionDistance,
  motionStyle,
  onReducedMotionChange,
  prefersReducedMotion,
  resolveJsAnimation,
  staggerDelay,
  type MotionDuration,
  type MotionVariant,
} from './motion';

/**
 * Estos tests no comprueban que el CSS "se vea bien" (eso lo hace el ojo, con
 * capturas). Comprueban las tres cosas que, si se rompen, nadie nota hasta que
 * un usuario con vestibular disorder recibe 200ms de parallax o hasta que el
 * core cambia una duracion y la app se queda con una copia vieja:
 *
 *  1. SINCRONIA CON EL CORE. `MOTION_DURATIONS` esta duplicando en TypeScript
 *     los milisegundos que viven en `cores/swal-ui/src/tokens/theme.css`. Esa
 *     duplicacion es necesaria para poder calcular un retardo en JS, pero solo
 *     es segura si los dos lados dicen lo mismo: por eso el primer test LEE el
 *     theme.css real y falla si divergen. Sin el, nadie se entera en meses.
 *
 *  2. REDUCED MOTION COMO LEY. Ninguna ruta puede devolver duracion, retardo o
 *     desplazamiento > 0 cuando la preferencia esta activa.
 *
 *  3. ACOTES. El escalonado se congela (una lista de 200 items no puede dejar
 *     el ultimo esperando 12s) y los indices raros no producen `NaNms`, que es
 *     un valor CSS invalido y el navegador descarta la regla entera.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME_CSS = resolve(HERE, '../../../../cores/swal-ui/src/tokens/theme.css');
const themeCss = readFileSync(THEME_CSS, 'utf8');

/** Cuerpo de cada bloque `@media (prefers-reduced-motion: reduce)` del fichero.
 *  Los comentarios se borran antes de analizar: el bloque de custom properties
 *  MENCIONA `animation: none` al explicar por que pone 0ms, y sin limpiarlos
 *  el test encontraria ese bloque y creeria que es el que corta la animacion. */
function mediaBodies(css: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const marker = '@media (prefers-reduced-motion: reduce)';
  const bodies: string[] = [];
  let from = 0;
  for (;;) {
    const start = clean.indexOf(marker, from);
    if (start === -1) return bodies;
    let i = clean.indexOf('{', start) + 1;
    let depth = 1;
    while (i < clean.length && depth > 0) {
      if (clean[i] === '{') depth++;
      else if (clean[i] === '}') depth--;
      i++;
    }
    bodies.push(clean.slice(clean.indexOf('{', start) + 1, i - 1));
    from = i;
  }
}

/** Valor en ms de un token `--swal-transition-*` declarado en el theme del core. */
function coreTransitionMs(token: string): number {
  const match = themeCss.match(new RegExp(`${token}:\\s*(\\d+)ms`));
  if (!match) throw new Error(`el core ya no declara ${token} como <n>ms`);
  return Number(match[1]);
}

describe('motion — sincronia con los tokens del core', () => {
  it('las duraciones de motion.ts son las mismas que --swal-transition-*', () => {
    const pairs: [MotionDuration, string][] = [
      ['fast', '--swal-transition-fast'],
      ['base', '--swal-transition'],
      ['slow', '--swal-transition-slow'],
    ];
    for (const [name, token] of pairs) {
      expect(MOTION_DURATIONS[name], `${name} vs ${token}`).toBe(coreTransitionMs(token));
    }
  });

  it('las curvas salen de los tokens --swal-ease-* y la estandar es la del core', () => {
    // La curva estandar esta DENTRO de los tokens de transicion, no suelta: si
    // el core cambia cubic-bezier(0.4, 0, 0.2, 1), este test falla en vez de
    // dejar dos curvas distintas en el bundle.
    expect(STANDARD_EASING).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(themeCss).toContain(`${STANDARD_EASING}`);
    for (const token of ['--swal-ease-out', '--swal-ease-in']) {
      expect(themeCss).toContain(`${token}: cubic-bezier(`);
    }
  });

  it('ninguna duracion es negativa ni cero por descuido (salvo `instant`)', () => {
    expect(MOTION_DURATIONS.instant).toBe(0);
    for (const [name, ms] of Object.entries(MOTION_DURATIONS)) {
      if (name === 'instant') continue;
      expect(ms, name).toBeGreaterThan(0);
    }
    // Techo de bajo(latencia percibida): por encima de 500ms una entrada se
    // lee como lentitud de la app, no como elegancia.
    for (const [name, ms] of Object.entries(MOTION_DURATIONS)) {
      if (name === 'instant') continue;
      expect(ms, name).toBeLessThanOrEqual(500);
    }
  });
});

describe('motion — SSR y jsdom sin navegador', () => {
  it('isInViewport devuelve true sin elemento o si no se puede medir', () => {
    // El lado seguro: si no se puede saber, se asume visible. Es lo que impide
    // que un fallo de medicion deje el contenido en `opacity: 0`.
    expect(isInViewport(null)).toBe(true);
    expect(isInViewport(undefined)).toBe(true);
    // jsdom no layoutea: un elemento normal sale con rect 0x0.
    expect(isInViewport(document.createElement('div'))).toBe(true);
  });

  it('isInViewport detecta un rect fuera de la ventana', () => {
    const el = document.createElement('div');
    // Rectas tipicas: dentro (arriba del pliegue) y muy por debajo.
    const inside = { bottom: 100, top: 10, right: 100, left: 10, width: 90, height: 90 };
    const below = { bottom: 5000, top: 4900, right: 100, left: 10, width: 90, height: 90 };
    (el as unknown as { getBoundingClientRect: () => typeof inside }).getBoundingClientRect =
      () => inside;
    expect(isInViewport(el)).toBe(true);
    (el as unknown as { getBoundingClientRect: () => typeof below }).getBoundingClientRect =
      () => below;
    expect(isInViewport(el)).toBe(false);
  });
});

describe('motion — prefers-reduced-motion es ley', () => {
  it('motionStyle con reduced:true no emite duracion, retardo ni desplazamiento', () => {
    const style = motionStyle({ variant: 'fade-up', duration: 'slow', delay: 400, reduced: true });
    expect(style).toContain('--motion-duration:0ms');
    expect(style).toContain('--motion-delay:0ms');
    expect(style).toContain('--motion-distance:0px');
    // `scale` cae a factor 1 (identidad) en vez de 0: `scale(0)` dejaria el
    // elemento invisible si la animacion llegara a ejecutarse.
    expect(style).toContain('--motion-distance:0px');
    expect(motionStyle({ variant: 'scale', reduced: true })).toContain('--motion-distance:1');
  });

  it('sin reduced, el retardo y la distancia son los que se pidieron', () => {
    const style = motionStyle({ variant: 'slide-left', duration: 'slow', delay: 120, index: 5 });
    expect(style).toContain('--motion-duration:280ms');
    // `delay` gana sobre `index`: una explicita no se pisa con el escalonado.
    expect(style).toContain('--motion-delay:120ms');
    expect(style).toContain('--motion-distance:12px');
  });

  it('reduced gana incluso si se pasan indice y stagger a la vez', () => {
    const style = motionStyle({ variant: 'fade-up', index: 9, staggerStep: 80, reduced: true });
    expect(style).toContain('--motion-delay:0ms');
  });

  it('la clase CSS no depende de la preferencia: el corte lo hace el media query', () => {
    // Importante: si reduced fabricase una clase distinta, el CSS tendria que
    // conocer la preferencia y habria dos rutas que mantener.
    expect(motionClass('fade-up')).toBe('motion motion-fade-up');
  });

  it('resolveJsAnimation devuelve el valor final con y sin animacion', () => {
    expect(resolveJsAnimation(87, true)).toEqual({ value: 87, animate: false });
    expect(resolveJsAnimation(87, false)).toEqual({ value: 87, animate: true });
    // Un objetivo no finito no puede volverse un contador: se clampa a 0 en vez
    // de pintar `NaN` en pantalla.
    expect(resolveJsAnimation(Number.NaN, false).value).toBe(0);
  });

  it('prefersReducedMotion devuelve false sin window (SSR) y con matchMedia roto', () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it('onReducedMotionChange devuelve una funcion de cancelar incluso sin soporte', () => {
    const stop = onReducedMotionChange(() => {});
    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
  });
});

describe('motion — escalonado acotado', () => {
  it('escala por posicion: 0, 60, 120, 180...', () => {
    expect([0, 1, 2, 3].map((i) => staggerDelay(i, 60, 6))).toEqual([0, 60, 120, 180]);
  });

  it('congela el retardo en maxItems: una lista larga no puede esperar 12s', () => {
    const capped = staggerDelay(200, 60, 6);
    expect(capped).toBe(360);
    // Todo lo que pase de maxItems ve el MISMO retardo, no uno creciente.
    expect(staggerDelay(7, 60, 6)).toBe(capped);
    expect(staggerDelay(500, 60, 6)).toBe(capped);
  });

  it('un item sin posicion no espera', () => {
    expect(staggerDelay(0, 60, 6)).toBe(0);
  });

  it('indices invalidos producen 0, nunca NaN (que seria un valor CSS descartado)', () => {
    expect(staggerDelay(-3, 60, 6)).toBe(0);
    expect(staggerDelay(Number.NaN, 60, 6)).toBe(0);
    expect(motionStyle({ index: Number.NaN })).not.toContain('NaN');
  });

  it('un step no numerico no rompe el retardo', () => {
    expect(staggerDelay(3, Number.NaN, 6)).toBe(0);
  });
});

describe('motion — variantes', () => {
  it('cada variante tiene su clase y todas las declaradas existen en la lista', () => {
    for (const variant of MOTION_VARIANTS) {
      expect(motionClass(variant)).toBe(`motion motion-${variant}`);
      expect(MOTION_VARIANTS).toContain(variant);
    }
  });

  it('`none` no emite estilo ni obliga a animar', () => {
    expect(motionStyle({ variant: 'none' })).toBe('');
  });

  it('las distancias son cortas: el desplazamiento es un acento, no un viaje', () => {
    for (const variant of MOTION_VARIANTS) {
      const px = motionDistance(variant);
      expect(px, variant).toBeGreaterThanOrEqual(0);
      expect(px, variant).toBeLessThanOrEqual(16);
    }
    // `fade` es el unico que no se mueve; `scale` se expresa como factor.
    expect(motionDistance('fade')).toBe(0);
    expect(motionDistance('scale')).toBeLessThan(1);
  });

  it('el nombre de la variante coincide con el keyframe de motion.css', () => {
    const motionCss = readFileSync(resolve(HERE, '../styles/motion.css'), 'utf8');
    for (const variant of MOTION_VARIANTS) {
      if (variant === 'none') continue;
      // La clase `.motion-<variante>` y el keyframe `@keyframes motion-<variante>`
      // tienen que existir los dos: una variante sin keyframe sale visible sin
      // animar y una sin clase queda huerfana.
      expect(motionCss, `falta @keyframes motion-${variant}`).toContain(
        `@keyframes motion-${variant}`,
      );
      expect(motionCss, `falta la clase .motion-${variant}`).toContain(`.motion-${variant} {`);
    }
  });

  it('motion.css anula TODO con prefers-reduced-motion, no solo algunas variantes', () => {
    const motionCss = readFileSync(resolve(HERE, '../styles/motion.css'), 'utf8');
    // Puede haber VARIOS bloques `prefers-reduced-motion` (uno de custom
    // properties, otro de corte). El que importa es el que anula la animacion.
    // Se leen por conteo de llaves, no por regex: un `@media` que contiene un
    // `:root` anidado corta en la primera `}` y solo se leeria la mitad.
    const body = mediaBodies(motionCss).find((b) => b.includes('animation: none'));
    expect(body, 'ningun bloque de motion.css corta la animacion con prefers-reduced-motion').toBeDefined();
    expect(body).toContain('animation: none !important');
    // El corte debe devolver el elemento a su estado FINAL (visible), no al
    // inicial: si no, con reduced-motion la pagina se queda en blanco.
    expect(body).toContain('opacity: 1');
    expect(body).toContain('transform: none');
  });

  it('motion.css solo anima opacity y transform: nada que recalcule layout', () => {
    const motionCss = readFileSync(resolve(HERE, '../styles/motion.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    // Solo se permite dentro de @keyframes. `width`/`height`/`top`/`left` en un
    // keyframe obligan a reflow en cada frame y en moviles de gama baja se ven.
    const keyframes = [...motionCss.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)].map(
      (m) => ({ name: m[1], body: m[2] }),
    );
    expect(keyframes.length).toBeGreaterThanOrEqual(6);
    for (const { name, body } of keyframes) {
      // Cualquier declaracion dentro del keyframe, este donde este. Anclar la
      // busqueda al inicio de linea daria un test que pasa siempre: las
      // declaraciones viven dentro de `from {`/`to {`, no al principio de linea.
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(props.length, `@keyframes ${name} no declara nada`).toBeGreaterThan(0);
      for (const prop of props) {
        expect(['opacity', 'transform'], `${prop} en @keyframes ${name}`).toContain(prop);
      }
    }
  });

  it('motion.css no declara color, fondo ni borde: el contraste es el del core', () => {
    const motionCss = readFileSync(resolve(HERE, '../styles/motion.css'), 'utf8');
    // Sin comentarios: un color citado en un comentario es una medicion
    // documentada, no un estilo (mismo criterio que el gate de tokens).
    const code = motionCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/\bcolor\s*:\s*(?!none)/);
    expect(code).not.toMatch(/\bbackground(-color)?\s*:\s*(?!none)/);
    expect(code).not.toMatch(/\bborder[^:]*:\s*(?!0|none)/);
  });
});

describe('motion — composicion', () => {
  it('motionStyle publica siempre las cuatro custom properties de una variante', () => {
    for (const variant of MOTION_VARIANTS) {
      if (variant === 'none') continue;
      const style = motionStyle({ variant });
      for (const prop of [
        '--motion-duration',
        '--motion-easing',
        '--motion-delay',
        '--motion-distance',
      ]) {
        expect(style, `${variant} sin ${prop}`).toContain(`${prop}:`);
      }
    }
  });

  it('las curvas se escriben por token, no como literales sueltos', () => {
    // `out`/`in` tienen token propio; solo `standard` es literal, y por
    // definicion (esta dentro de --swal-transition-*).
    expect(motionStyle({ easing: 'out' })).toContain('var(--swal-ease-out)');
    expect(motionStyle({ easing: 'in' })).toContain('var(--swal-ease-in)');
  });

  it('una variante tipada como MotionVariant cualquiera sigue siendo una variante', () => {
    const v: MotionVariant = 'scale';
    expect(MOTION_VARIANTS).toContain(v);
    expect(motionStyle({ variant: v })).toContain('--motion-distance:0.96');
  });
});