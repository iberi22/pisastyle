<!--
  Contract:
  - Key: pisa-consent-v1
  - Events: pisa_consent (dispatched on window)
  - Network: 0 network requests (CERO red)
-->
<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    title: string;
    description: string;
    acceptText: string;
    rejectText: string;
  }

  let { title, description, acceptText, rejectText }: Props = $props();

  let visible = $state(false);

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      const consent = localStorage.getItem('pisa-consent-v1');
      if (consent === null) {
        visible = true;
      }
    }
  });

  function handleAccept() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pisa-consent-v1', 'true');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pisa_consent', { detail: { accepted: true } }));
    }
    visible = false;
  }

  function handleReject() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pisa-consent-v1', 'false');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pisa_consent', { detail: { accepted: false } }));
    }
    visible = false;
  }
</script>

{#if visible}
  <div class="consent-banner">
    <h2>{title}</h2>
    <p>{description}</p>
    <div class="buttons">
      <button onclick={handleReject}>{rejectText}</button>
      <button onclick={handleAccept}>{acceptText}</button>
    </div>
  </div>
{/if}

<style>
  .consent-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background-color: #ffffff;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    padding: 1rem;
    box-sizing: border-box;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  p {
    margin: 0;
    font-size: 1rem;
    color: #333333;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  button {
    padding: 0.5rem 1rem;
    border: 1px solid #ccc;
    background-color: #f9f9f9;
    cursor: pointer;
    border-radius: 4px;
    font-size: 1rem;
  }
  button:hover {
    background-color: #eeeeee;
  }
</style>
