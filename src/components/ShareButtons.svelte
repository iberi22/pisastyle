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
  .share-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 1rem;
    border: 1px solid var(--swal-border, #ccc);
    border-radius: 4px;
    background-color: var(--swal-surface, #fff);
    color: var(--swal-text, #333);
    cursor: pointer;
    font-family: inherit;
    font-size: 1rem;
    transition: background-color 0.2s;
  }
  .share-btn:hover {
    background-color: var(--swal-surface-hover, #f5f5f5);
  }
</style>
