<script lang="ts">
  import { downloadMyData } from '../lib/exportMyData';

  let errorMsg = $state<string | null>(null);

  async function handleDownload(kind: 'json' | 'sql') {
    try {
      errorMsg = null;
      await downloadMyData(kind);
    } catch (e: any) {
      errorMsg = e.message || 'Error al exportar los datos.';
      console.error(e);
    }
  }
</script>

<div class="export-container">
  <h2>Exportar mis datos</h2>
  <div class="notice notice-warn">
    <p>
      <strong>Atención:</strong> Los archivos descargados contienen tus datos desencriptados en texto plano.
      Asegúrate de guardarlos en un lugar seguro.
    </p>
  </div>

  {#if errorMsg}
    <div class="notice error">
      <p>{errorMsg}</p>
    </div>
  {/if}

  <div class="actions">
    <button type="button" class="btn-secondary" onclick={() => handleDownload('json')}>
      Descargar JSON
    </button>
    <button type="button" class="btn-secondary" onclick={() => handleDownload('sql')}>
      Descargar SQL
    </button>
  </div>
</div>

<style>
  .export-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    border: 1px solid var(--swal-border);
    border-radius: var(--swal-radius-sm, 6px);
    background: var(--swal-surface);
  }
  h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--swal-text);
    margin: 0;
  }
  .notice {
    border: 1px solid var(--swal-border);
    border-left: 4px solid var(--swal-accent);
    border-radius: 6px;
    padding: 0.7rem 0.9rem;
    font-size: 0.88rem;
    color: var(--swal-text);
    background: var(--swal-bg);
  }
  .notice-warn {
    border-left-color: var(--pisa-partial, #E69F00);
  }
  .error {
    border-left-color: var(--pisa-incorrect, #D55E00);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  button {
    font-family: inherit;
    cursor: pointer;
    border-radius: var(--swal-radius-sm, 6px);
    font-size: 0.95rem;
  }
  .btn-secondary {
    padding: 0.6rem 1rem;
    border: 1px solid var(--swal-border);
    background: var(--swal-surface);
    color: var(--swal-text);
    min-height: 2.75rem;
  }
  .btn-secondary:hover {
    background: var(--swal-surface-hover);
  }
</style>
