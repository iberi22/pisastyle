// billing.ts — Pay-per-use + mesh-only gratis + 5% handling SWAL
// Cloudflare es backend opcional: si no usas R2/D1/KV/AI, costo 0 y datos viven en mesh P2P (edge-mesh Yjs).
// Si usas backend, precio = infra (R2+D1+KV+Workers) + AI con margen + handling (ver docs privados).
// 1 camion = 100 camiones mismo costo: no hay cobro por vehiculo, solo por consumo real.
// Limites soft en backend (R2 10GB, D1 1M rows, AI 50k tokens) — overage se cobra pay-per-use, no bloquea.
// Filosofia: mesh-only gratis via replica en otros nodos gara-g (Yjs y-webrtc + y-indexeddb) para persistencia sin pagar.

import { domainConfig } from './domain.config';

// --- Modos ---
export type BillingMode = 'mesh-only' | 'self-managed' | 'swal-managed';
// mesh-only: sin Cloudflare, datos en IndexedDB + replica P2P en otros nodos gara-g, costo 0
// self-managed: trae su Cloudflare account (X-CF-Account-Id), SWAL solo cobra 5% handling
// swal-managed: SWAL gestiona infra en su cuenta, cobra infra+AI+5%

export type SocioTier = {
  id: 'free' | 'mesh-only' | 'payg' | 'payg-managed';
  monthlyCredit: number; // credito mensual AI tokens incluido (soft, overage cobra)
  r2QuotaGB: number; // soft limit, overage cobra por GB
  basePrice: number; // 0 en payg, solo consumo
};

// Catalogo pay-per-use: basePrice 0, solo infra+AI+5%. Quotas son soft limits para metering.
export const TIERS: Record<SocioTier['id'], SocioTier> = {
  free: { id: 'free', monthlyCredit: 0, r2QuotaGB: 1, basePrice: 0 },
  'mesh-only': { id: 'mesh-only', monthlyCredit: 0, r2QuotaGB: 0, basePrice: 0 },
  payg: { id: 'payg', monthlyCredit: 50000, r2QuotaGB: 10, basePrice: 0 },
  'payg-managed': { id: 'payg-managed', monthlyCredit: 50000, r2QuotaGB: 50, basePrice: 0 },
};

// Backward compat: mapping socio -> payg
export const LEGACY_TIER_MAP: Record<string, SocioTier['id']> = {
  socio: 'payg',
  'managed': 'payg-managed',
};

export function resolveTierId(id: string): SocioTier['id'] {
  return (LEGACY_TIER_MAP[id] ?? id) as SocioTier['id'];
}

// --- Pricing (5% handling + 10% AI margin minimo) ---
export const SWAL_HANDLING_PCT = 0.05; // 5% sobre (infra + AI) — antes 20%
export const AI_MARGIN_MIN_PCT = 0.10; // 10% minimo sobre costo base Workers AI

/**
 * Calcula precio final pay-per-use.
 * @param infraCost costo Cloudflare 100% (R2+D1+KV+Workers) en USD
 * @param aiCostBase costo base Workers AI sin margen
 */
export function calculatePrice(infraCost: number, aiCostBase: number): {
  infra: number;
  aiWithMargin: number;
  subtotal: number;
  handling: number;
  total: number;
} {
  const aiWithMargin = aiCostBase * (1 + AI_MARGIN_MIN_PCT);
  const subtotal = infraCost + aiWithMargin;
  const handling = subtotal * SWAL_HANDLING_PCT;
  const total = subtotal + handling;
  return { infra: infraCost, aiWithMargin, subtotal, handling, total };
}

// --- Credito inferencia ---
export type CreditLedger = { used: number; limit: number; remaining: number };

export function creditStatus(used: number, tierIdRaw: string = 'payg'): CreditLedger {
  const tierId = resolveTierId(tierIdRaw);
  const limit = (TIERS as any)[tierId]?.monthlyCredit ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export function canAffordInference(estimatedTokens: number, used: number, tierIdRaw: string = 'payg'): boolean {
  const tierId = resolveTierId(tierIdRaw);
  // mesh-only y free nunca pueden usar AI cloud, necesitan payg
  if (tierId === 'mesh-only' || tierId === 'free') return false;
  const { remaining, limit } = creditStatus(used, tierId);
  // payg: si excede limite, aún puede pero entra en overage (no bloquear, solo cobrar extra)
  // Para UI: canAfford = true si dentro de limite, false si overage — Worker decide cobrar
  void limit;
  return estimatedTokens <= remaining;
}

// Overage check: true si está en overage (se cobra extra pero se permite)
export function isOverage(used: number, tierIdRaw: string = 'payg'): boolean {
  const { remaining } = creditStatus(used, tierIdRaw);
  return remaining === 0 && used > 0;
}

export function deductCredit(used: number, consumed: number): number {
  return used + consumed;
}

// --- Helpers mesh-only ---
export function isMeshOnlyMode(mode: BillingMode | string): boolean {
  return mode === 'mesh-only' || mode === 'free';
}

export function shouldUseCloudBackend(mode: BillingMode | string, hasCloudBindings: boolean): boolean {
  if (isMeshOnlyMode(mode)) return false;
  return hasCloudBindings;
}

// --- Cloudflare proxy para LLM (Workers AI) ---
const CF_AI_ENDPOINT = '/api/ai/infer';

export async function cfAiInfer(
  prompt: string,
  opts: { tierId?: string; mode?: BillingMode; estimatedTokens?: number } = {},
): Promise<{ text: string; tokensUsed: number; cost: number } | null> {
  const tierId = resolveTierId(opts.tierId ?? 'payg');
  const mode = opts.mode ?? 'swal-managed';
  if (isMeshOnlyMode(mode) || tierId === 'mesh-only') {
    console.warn('[billing] mesh-only: AI requiere payg, usando fallback local');
    return null;
  }
  try {
    const res = await fetch(CF_AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, tierId, mode, appId: domainConfig.appId }),
    });
    if (res.status === 402) {
      console.warn('[billing] overage o credito agotado, se cobrará pay-per-use');
      // en payg no bloquea, pero UI puede mostrar aviso
      return null;
    }
    if (!res.ok) throw new Error(`cf ai ${res.status}`);
    return (await res.json()) as { text: string; tokensUsed: number; cost: number };
  } catch (e) {
    console.warn('[billing] cfAiInfer fallback a llm local', e);
    return null;
  }
}

// --- Quota helpers para R2/D1 ---
export function checkR2Quota(usedBytes: number, quotaGB: number): { overage: boolean; remainingBytes: number } {
  const quotaBytes = quotaGB * 1024 * 1024 * 1024;
  return { overage: usedBytes > quotaBytes, remainingBytes: Math.max(0, quotaBytes - usedBytes) };
}

export function formatPriceBreakdown(infra: number, aiBase: number): string {
  const p = calculatePrice(infra, aiBase);
  return `Infra $${p.infra.toFixed(2)} + AI $${p.aiWithMargin.toFixed(2)} (base $${aiBase.toFixed(2)} + ${AI_MARGIN_MIN_PCT * 100}% min) = subtotal $${p.subtotal.toFixed(2)} + handling SWAL 5% $${p.handling.toFixed(2)} = total $${p.total.toFixed(2)}`;
}

// Wrangler bindings esperados:
// [[r2_buckets]] binding = "SWAL_R2" bucket_name = "swal-{appId}-vault"
// [[d1_databases]] binding = "SWAL_D1" database_name = "swal-billing"
// [[kv_namespaces]] binding = "SWAL_KV" id = "..."
// [ai] binding = "AI"
// Ver workers/ai.ts — si no hay bindings, modo mesh-only (costo 0, replica P2P)
