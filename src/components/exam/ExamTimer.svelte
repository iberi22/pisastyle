<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let {
    durationMs = 0,
    textTimeRemaining = 'Time remaining',
    textPaused = 'Paused',
    onTick,
    onExpire
  }: {
    durationMs: number;
    textTimeRemaining?: string;
    textPaused?: string;
    onTick?: (e: CustomEvent) => void;
    onExpire?: (e: CustomEvent) => void;
  } = $props();

  let remainingMs = $state(durationMs);
  let timerId: ReturnType<typeof setInterval> | null = null;
  let lastTick = $state(Date.now());
  let isPaused = $state(false);

  function tick() {
    if (isPaused) {
      lastTick = Date.now();
      return;
    }
    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;

    remainingMs -= delta;

    if (remainingMs <= 0) {
      remainingMs = 0;
      stop();
      if (onExpire) {
        onExpire(new CustomEvent('expire', { detail: { remainingMs: 0 } }));
      }
    } else {
      if (onTick) {
        onTick(new CustomEvent('tick', { detail: { remainingMs } }));
      }
    }
  }

  function start() {
    if (typeof window === 'undefined') return;
    lastTick = Date.now();
    timerId = setInterval(tick, 1000);
  }

  function stop() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function handleVisibility() {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      isPaused = true;
    } else {
      isPaused = false;
      lastTick = Date.now();
    }
  }

  onMount(() => {
    remainingMs = durationMs;
    start();
    document.addEventListener('visibilitychange', handleVisibility);
  });

  onDestroy(() => {
    stop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
  });

  const minutes = $derived(Math.floor(remainingMs / 60000));
  const seconds = $derived(Math.floor((remainingMs % 60000) / 1000));
  const formattedTime = $derived(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
</script>

<div class="exam-timer">
  <span class="label">{textTimeRemaining}:</span>
  <span class="time">{formattedTime}</span>
  {#if isPaused}
    <span class="paused">({textPaused})</span>
  {/if}
</div>

<style>
  /* Tokens del core, sin fallback literal (ver ShareButtons.svelte): los
     fallbacks anteriores (#f8fafc, #0f172a, #e2e8f0, #ef4444) eran de la
     paleta Edge-Hive, medida para fondo blanco, y se rompian en Bone oscuro.
     MEDIDO (WCAG 2.2, alfa compuesto sobre el canvas real):
       --swal-text / --swal-surface   16.22:1 oscuro / 17.40:1 claro
       --swal-danger / --swal-surface  6.57:1 oscuro /  4.80:1 claro */
  .exam-timer {
    display: inline-flex;
    align-items: center;
    gap: var(--swal-space-2);
    font-family: var(--swal-font-mono);
    background: var(--swal-surface);
    color: var(--swal-text);
    padding: var(--swal-space-1) var(--swal-space-3);
    border-radius: var(--swal-radius-sm);
    font-size: var(--swal-font-size);
    border: 1px solid var(--swal-border);
  }
  .label {
    font-weight: 500;
  }
  .time {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .paused {
    color: var(--swal-danger);
    font-size: var(--swal-font-size-xs);
    text-transform: uppercase;
  }
</style>
