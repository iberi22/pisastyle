<script lang="ts">
  import { downloadMyData } from '../lib/exportMyData';
  import { Button, Card, Notice } from '@swal/ui';

  let exporting = $state(false);
  let errorMsg = $state<string | null>(null);

  async function handleExport(kind: 'json' | 'sql') {
    if (exporting) return;
    exporting = true;
    errorMsg = null;
    try {
      await downloadMyData(kind);
    } catch (e: any) {
      errorMsg = e.message || 'Error exporting data';
    } finally {
      exporting = false;
    }
  }
</script>

<Card padding="md" variant="surface">
  <div class="export-container">
    <h3>Exportar mis datos</h3>
    <Notice tone="warning">
      Atención: Los archivos exportados contendrán tus datos sin encriptar (en texto plano). Guárdalos en un lugar seguro.
    </Notice>

    <div class="actions">
      <Button disabled={exporting} variant="secondary" onclick={() => handleExport('json')}>
        Descargar JSON
      </Button>
      <Button disabled={exporting} variant="secondary" onclick={() => handleExport('sql')}>
        Descargar SQL
      </Button>
    </div>

    {#if errorMsg}
      <Notice tone="error">{errorMsg}</Notice>
    {/if}
  </div>
</Card>

<style>
  .export-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--swal-text);
  }

  .actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
</style>
