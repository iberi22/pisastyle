<script lang="ts" is:inline>
  let {
    url,
    title = '',
    text = '',
    labelShare = 'Share',
    labelCopy = 'Copy',
    labelCopied = 'Copied!'
  } = $props();

  let copied = $state(false);
  let canShare = $state(true);

  $effect(() => {
    canShare = typeof navigator !== 'undefined' && !!navigator.share;
  });

  async function handleClick() {
    if (canShare) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
        setTimeout(() => { copied = false; }, 2000);
      } catch (err) {
        console.error('Failed to copy', err);
      }
    }
  }
</script>

<button type="button" class="share-btn" onclick={handleClick}>
  {copied ? labelCopied : (canShare ? labelShare : labelCopy)}
</button>

<style>
  /* Tokens del core, sin fallback literal: @swal/ui esta cargado en
     Layout.astro ANTES que el componente, asi que un fallback aqui solo
     enmascararia un token ausente — y ademas reintroducia la paleta anterior
     (--swal-surface: #fff, --swal-text: #333) que es solo de tema claro.
     MEDIDO (WCAG 2.2, alfa compuesto sobre el canvas real):
       --swal-text / --swal-surface         16.22:1 oscuro / 17.40:1 claro
       --swal-text / --swal-surface-hover   14.33:1 oscuro / 15.94:1 claro */
  .share-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--swal-space-2);
    padding: var(--swal-space-2) var(--swal-space-4);
    border: 1px solid var(--swal-border);
    border-radius: var(--swal-radius-sm);
    background-color: var(--swal-surface);
    color: var(--swal-text);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--swal-font-size-lg);
    transition: background-color var(--swal-transition-fast);
  }
  .share-btn:hover {
    background-color: var(--swal-surface-hover);
  }
</style>
