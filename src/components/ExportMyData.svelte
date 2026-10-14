<script lang="ts">
  import { collectAllUserData, downloadMyData } from '../lib/exportMyData';

  let expanded = $state(false);
  let errorMsg = $state<string | null>(null);
  let loading = $state(false);

  async function handleExport(kind: 'json' | 'sql') {
    errorMsg = null;
    loading = true;
    try {
      const data = await collectAllUserData();
      const success = downloadMyData(kind, data);
      if (!success) {
        errorMsg = 'No se pudo iniciar la descarga en este entorno.';
      }
    } catch (err: any) {
      errorMsg = err.message || 'Error al exportar los datos.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="export-container">
  {#if !expanded}
    <button class="btn-ghost" onclick={() => (expanded = true)}>Exportar mis datos</button>
  {:else}
    <div class="export-options">
      <p class="warning-text">
        <strong>Atención:</strong> Los archivos exportados no están encriptados y contienen tus datos personales en texto plano.
      </p>

      {#if errorMsg}
        <div class="error-msg">{errorMsg}</div>
      {/if}

      <div class="buttons">
        <button class="btn-secondary" onclick={() => handleExport('json')} disabled={loading}>
          {loading ? 'Preparando...' : 'Descargar JSON'}
        </button>
        <button class="btn-secondary" onclick={() => handleExport('sql')} disabled={loading}>
          {loading ? 'Preparando...' : 'Descargar SQL'}
        </button>
        <button class="btn-ghost" onclick={() => { expanded = false; errorMsg = null; }} disabled={loading}>
          Cancelar
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .export-container {
    margin-top: var(--swal-space-4);
  }

  .export-options {
    background-color: var(--swal-surface);
    border: 1px solid var(--swal-border);
    border-radius: var(--swal-radius-md);
    padding: var(--swal-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--swal-space-4);
  }

  .warning-text {
    margin: 0;
    color: var(--swal-text-secondary);
    font-size: var(--swal-font-size-sm);
  }

  .warning-text strong {
    color: var(--swal-text);
  }

  .error-msg {
    color: var(--swal-accent, #e53e3e);
    font-size: var(--swal-font-size-sm);
    font-weight: bold;
    padding: var(--swal-space-2);
    background: var(--swal-surface-active);
    border-radius: var(--swal-radius-sm);
  }

  .buttons {
    display: flex;
    gap: var(--swal-space-2);
    flex-wrap: wrap;
  }

  button {
    font-family: inherit;
    font-size: var(--swal-font-size-base);
    border-radius: var(--swal-radius-sm);
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-ghost {
    background: transparent;
    color: var(--swal-text-secondary);
    border: 1px solid transparent;
    padding: var(--swal-space-2) var(--swal-space-4);
  }

  .btn-ghost:hover:not(:disabled) {
    background: var(--swal-surface-hover);
    color: var(--swal-text);
  }

  .btn-secondary {
    background: var(--swal-surface-hover);
    color: var(--swal-text);
    border: 1px solid var(--swal-border);
    padding: var(--swal-space-2) var(--swal-space-4);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--swal-surface-active);
  }
</style>
