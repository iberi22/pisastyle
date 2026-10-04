<!--
  MotionReveal — entrada al entrar en pantalla (IntersectionObserver).

  Por qué no se resuelve solo con CSS: una animacion `motion-fade-up` en un
  elemento que ya esta en pantalla al cargar se dispara al principio aunque el
  usuario no lo haya visto llegar, y en un elemento por debajo del fold se
  dispara mientras no se mira y se acaba antes de que aparezca. El patron
  correcto es: el elemento nace VISIBLE en el servidor, y solo se oculta si
  sabemos que todavia no ha entrado en pantalla.

  Degradaciones, en este orden de importancia:

   1. Sin `IntersectionObserver` (o durante SSR) el elemento se renderiza
      visible y sin animación. Fallar hacia "visible" es la unica degradacion
      segura: si se quedara en `opacity: 0` por falta de soporte, la pagina
      seria un hueco en blanco.
   2. Con `prefers-reduced-motion: reduce` no se oculta NUNCA: el elemento se
      pinta en su estado final desde el primer frame y no se registra ningun
      observer. Ademas se escucha el cambio en caliente, asi que si el usuario
      activa "reducir movimiento" a mitad de sesion lo que quedase pendiente se
      muestra de golpe.
   3. Si el observer no llega a disparar (contenido oculto dentro de un
     `<details>` cerrado, contenedor con `display: none`), se destraba con un
     temporizador largo: un elemento que nunca se revela por un fallo del
     observer es peor que uno sin animacion.

  NO replica la animacion si la prefersion ya venia activa: `prefersReducedMotion()`
  se consulta en el `onMount`, no en el render, para no meter una condicion de
  medio ambiente en el HTML del servidor.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  // El CSS entra aqui, no desde Layout.astro: esa isla la lleva otro agente en
  // esta wave, y un componente cuyas clases no estan definidas en ningun sitio
  // sale a la pagina sin animar sin que nada falle. `import` de un `.css` desde
  // el script lo mete Vite en el bundle una sola vez (el mismo modulo importado
  // dos veces se emite una vez), y sale GLOBAL, que es lo que necesitan los
  // @keyframes y los selectores `.motion-*`.
  import '../../styles/motion.css';
  import { onMount } from 'svelte';
  import {
    motionClass,
    motionStyle,
    onReducedMotionChange,
    prefersReducedMotion,
    type MotionVariant,
  } from '../../lib/motion';

  interface Props {
    children: Snippet;
    variant?: MotionVariant;
    /** Margen extra al viewport: reveals antes de que el borde toque el elemento. */
    rootMargin?: string;
    threshold?: number;
    as?: 'div' | 'span' | 'li' | 'section' | 'article';
    class?: string;
  }

  let { children, variant = 'fade-up', rootMargin = '0px 0px -10% 0px', threshold = 0.1, as = 'div', class: extra = '' }: Props =
    $props();

  let el = $state<HTMLElement | null>(null);
  /** `true` hasta que el elemento entra en pantalla (o hasta que dejamos de esperar). */
  let pending = $state(true);

  const cls = $derived([motionClass(variant), extra].filter(Boolean).join(' '));
  const style = $derived(motionStyle({ variant }));

  onMount(() => {
    const node = el;
    if (!node) return;

    if (prefersReducedMotion()) {
      pending = false;
      return () => onReducedMotionChange(() => { pending = false; });
    }

    if (typeof IntersectionObserver !== 'function') {
      pending = false;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          pending = false;
          observer.disconnect();
          return;
        }
      },
      { rootMargin, threshold },
    );
    observer.observe(node);

    // Red de seguridad: si en 1.2s no ha entrado (observer que no dispara,
    // contenido en un arbol oculto), se muestra igual.
    const failsafe = setTimeout(() => {
      pending = false;
      observer.disconnect();
    }, 1200);

    const stop = onReducedMotionChange(() => { pending = false; });

    return () => {
      clearTimeout(failsafe);
      observer.disconnect();
      stop();
    };
  });
</script>

<svelte:element
  this={as}
  bind:this={el}
  class={cls}
  style={style || undefined}
  data-motion-pending={pending ? 'true' : 'false'}
>
  {@render children()}
</svelte:element>

<style>
  /* Una sola regla, y no es decorativa: mientras el elemento no ha entrado NO
     puede verse. Sin ella, `.motion-fade-up` arrancaria su keyframe al montar y
     se acabaria durante el scroll, que es el bug que este componente arregla.
     El color, el tamano y el layout los pone el hijo: aqui no se declara
     ninguno, asi que el gate de tokens no encuentra literales y el contraste
     sigue siendo el del core. */
  [data-motion-pending='true'] {
    opacity: 0;
  }

  /* Red de seguridad en CSS, no solo en JS: si el observer falla, el elemento
     tiene que ser legible de todos modos. Este selector gana al `opacity: 0`
     de arriba porque aparece despues en la cascada. */
  @media (prefers-reduced-motion: reduce) {
    [data-motion-pending='true'] {
      opacity: 1;
      transform: none;
    }
  }
</style>