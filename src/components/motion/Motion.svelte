<!--
  Motion — envoltorio de entrada.

  Que resuelve: sin esto cada componente que quiere "aparecer con un fade"
  tiene que declarar la clase `.motion motion-fade-up` y tres custom properties
  inline a mano, y es facil equivocarse en el retardo o en la curva. Este
  componente hace de unico sitio donde se decide eso.

  Uso:
    <Motion variant="fade-up" index={2}>
      <section>...</section>
    </Motion>

  Reglas:
   - El HIJO se renderiza tal cual (`{@render children()}`): este componente no
     pone ni quita `display`, ni width, ni nada que el consumidor no pidiera. Un
     wrapper que estira al hijo rompe grids y flexbox.
   - Se elige un tag (default `div`) para que el marcado semantico lo ponga el
     consumidor. Animar un `<div class="motion">` dentro de un `<ul>` dejaria un
     hijo invalido en la lista.
   - NO lleva `<style>`. Todo el CSS vive en `src/styles/motion.css` y lo
     importa Layout.astro; repetirlo aqui lo duplicaria por componente y el
     gate de tokens lo veria N veces.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    motionClass,
    motionStyle,
    type MotionDuration,
    type MotionEasing,
    type MotionVariant,
  } from '../../lib/motion';

  interface Props {
    children: Snippet;
    variant?: MotionVariant;
    duration?: MotionDuration;
    easing?: MotionEasing;
    /** Retardo explicito en ms. */
    delay?: number;
    /** Posicion en la lista: se traduce a retardo con el tope de `motion.ts`. */
    index?: number;
    staggerStep?: number;
    maxStagger?: number;
    /** `true` para forzar el modo reducido (por ejemplo desde una prop de la URL). */
    reduced?: boolean;
    /** Tag del contenedor. Sin valor por defecto porque `<div>` no siempre vale. */
    as?: 'div' | 'span' | 'li' | 'section' | 'article';
    class?: string;
  }

  let {
    children,
    variant = 'fade-up',
    duration = 'base',
    easing = 'out',
    delay,
    index,
    staggerStep,
    maxStagger,
    reduced = false,
    as = 'div',
    class: extra = '',
  }: Props = $props();

  // `motion-none` no se emite con estilo: el elemento queda como esta hoy.
  const cls = $derived([motionClass(variant), extra].filter(Boolean).join(' '));
  const style = $derived(
    motionStyle({ variant, duration, easing, delay, index, staggerStep, maxStagger, reduced }),
  );
</script>

<svelte:element this={as} class={cls} style={style || undefined}>
  {@render children()}
</svelte:element>