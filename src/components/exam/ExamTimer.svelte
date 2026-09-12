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
  .exam-timer {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--swal-font-mono, monospace);
    background: var(--swal-surface, #f8fafc);
    color: var(--swal-text, #0f172a);
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.875rem;
    border: 1px solid var(--swal-border, #e2e8f0);
  }
  .label {
    font-weight: 500;
  }
  .time {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .paused {
    color: var(--swal-danger, #ef4444);
    font-size: 0.75rem;
    text-transform: uppercase;
  }
</style>
