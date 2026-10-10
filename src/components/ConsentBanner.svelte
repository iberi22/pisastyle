<!--
  Contract:
  - Key: pisa-consent-v1
  - Events: pisa_consent (dispatched on window)
  - Network: 0 network requests (CERO red)
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { setOptIn, hydrateOptIn } from '../lib/pisa-telemetry';

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
    hydrateOptIn();
  });

  function handleAccept() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pisa-consent-v1', 'true');
    }
    setOptIn(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pisa_consent', { detail: { accepted: true } }));
    }
    visible = false;
  }

  function handleReject() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pisa-consent-v1', 'false');
    }
    setOptIn(false);
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
  /* Tokens del core (@swal/ui), tema Bone Warm.
     MEDIDO con la fórmula de luminancia sRGB de WCAG 2.2 componiendo el alfa
     de la superficie sobre el canvas real del tema:
       oscuro  --swal-text #f5f5f4 / --swal-surface #1a1816 -> 16.22:1
                --swal-text-secondary (74%) / --swal-surface     ->  9.11:1
                --swal-text-secondary (74%) / --swal-surface-active ->  6.92:1
       claro   --swal-text #1c1917 / --swal-surface #fefefe -> 17.40:1
                --swal-text-secondary (78%) / --swal-surface     ->  8.73:1
                --swal-text-secondary (78%) / --swal-surface-active ->  7.29:1
     Todo AA para texto normal, con el peor caso (secondary sobre active, tema
     claro) en 7.29:1. Los colores anteriores (#ffffff / #333333 / #f9f9f9 /
     #eeeeee) estaban medidos para una superficie blanca fija: en Bone oscuro
     el texto #333333 sobre #ffffff era un par de 12.63:1 que existe solo en
     tema claro y se rompía entero al cambiar de tema. */
  .consent-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background-color: var(--swal-surface);
    /* La banner flota sobre el contenido de la pagina, asi que la superficie
       translucida necesita el desenfoque del core (.swal-glass) para que el
       texto de debajo no compita con la descripcion. */
    backdrop-filter: blur(16px) saturate(1.2);
    -webkit-backdrop-filter: blur(16px) saturate(1.2);
    border-top: 1px solid var(--swal-border);
    box-shadow: var(--swal-shadow-lg);
    color: var(--swal-text);
    padding: var(--swal-space-4);
    box-sizing: border-box;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: var(--swal-space-4);
    font-family: var(--swal-font);
  }
  h2 {
    margin: 0;
    font-size: var(--swal-font-size-xl);
    color: var(--swal-text);
  }
  p {
    margin: 0;
    font-size: var(--swal-font-size-lg);
    color: var(--swal-text-secondary);
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--swal-space-2);
  }
  button {
    padding: var(--swal-space-2) var(--swal-space-4);
    border: 1px solid var(--swal-border);
    background-color: var(--swal-surface-hover);
    color: var(--swal-text);
    cursor: pointer;
    border-radius: var(--swal-radius-sm);
    font-family: inherit;
    font-size: var(--swal-font-size-lg);
    /* --swal-text sobre --swal-surface-hover: 14.33:1 oscuro / 15.94:1 claro. */
  }
  button:hover {
    background-color: var(--swal-surface-active);
  }
  /* El anillo de foco vive en el core (:focus-visible, WCAG 2.4.7) para que
     ningun componente pueda olvidarlo. */
</style>
