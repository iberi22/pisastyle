<script lang="ts">
  import { Card, Badge } from '@swal/ui';
  import { creditStatus, formatPriceBreakdown } from '../lib/billing';

  let { used = 0, tier = 'socio', infra = 0.5, aiBase = 0.3 }: { used?: number; tier?: 'free'|'socio'|'managed'; infra?: number; aiBase?: number } = $props();

  const ledger = $derived(creditStatus(used, tier));
  const breakdown = $derived(formatPriceBreakdown(infra, aiBase));
  const pct = $derived(ledger.limit ? Math.round((ledger.used / ledger.limit) * 100) : 0);
</script>

<Card variant="surface" padding="md">
  <div class="head">
    <Badge variant={ledger.remaining === 0 ? 'danger' : pct > 80 ? 'warning' : 'success'}>{ledger.used}/{ledger.limit} tokens</Badge>
    <span class="pct">{pct}% usado</span>
  </div>
  <div class="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
    <div class="fill" style={`width:${pct}%`}></div>
  </div>
  <p class="breakdown">{breakdown}</p>
  <p class="hint">Credito socio via Cloudflare Workers AI (402 si agotado). Infra 100% + AI 10% min + 20% handling SWAL.</p>
</Card>

<style>
  /* Tokens del core. MEDIDO (WCAG 2.2, alfa compuesto sobre el canvas real):
       --swal-text-muted / --swal-surface      5.45:1 oscuro / 5.57:1 claro
       --swal-text-secondary / --swal-surface  9.11:1 oscuro / 8.73:1 claro
     Ambos AA para texto normal: el "pct%" y el desglose de precio salen en
     tamano pequeno, asi que no pueden bajar a --swal-text-faint (decorativo). */
  .head { display: flex; gap: var(--swal-space-2); align-items: center; }
  .pct { color: var(--swal-text-muted); font-size: var(--swal-font-size-sm); }
  /* El carril va sobre --swal-surface-active, no sobre --swal-surface: los
     dos son translucidos y a la misma alfa, sobre el fondo se verian igual. */
  .bar { height: var(--swal-space-2); background: var(--swal-surface-active); border-radius: var(--swal-radius-full); overflow: hidden; margin-top: var(--swal-space-2); }
  .fill { height: 100%; background: var(--swal-accent); transition: width var(--swal-transition); }
  .breakdown { color: var(--swal-text-secondary); font-size: var(--swal-font-size-sm); margin: var(--swal-space-2) 0 0; font-family: var(--swal-font-mono); }
  .hint { color: var(--swal-text-muted); font-size: var(--swal-font-size-xs); margin: var(--swal-space-1) 0 0; }
</style>
