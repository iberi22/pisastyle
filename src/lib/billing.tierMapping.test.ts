import { describe, it, expect } from 'vitest';
import { LEGACY_TIER_MAP, resolveTierId, TIERS, calculatePrice } from './billing';

/**
 * Regresion del bug de 'socio-managed' (fix 2026-10-03).
 *
 * LEGACY_TIER_MAP tenia la clave 'managed' donde el template canonico y las
 * apps ya migradas (swal-training, content-studio) usan 'socio-managed'. Un
 * cliente que mandaba tierId='socio-managed' pasaba por resolveTierId() sin
 * mapear, recibia un id inexistente en TIERS y el pricing quedaba undefined
 * — es decir, cobro roto silenciosamente en vez de un error visible.
 *
 * Estos tests fijan el comportamiento para que la regresion no vuelva.
 */
describe('resolveTierId — mapeo de tiers legacy', () => {
  it('mapea los ids legacy a un tier canonico que existe en TIERS', () => {
    const legacy = ['socio', 'managed', 'socio-managed'];
    for (const id of legacy) {
      const resolved = resolveTierId(id);
      expect(TIERS[resolved], `${id} -> ${resolved} debe existir en TIERS`).toBeDefined();
    }
  });

  it("'socio-managed' y 'managed' resuelven al mismo canonico", () => {
    expect(resolveTierId('socio-managed')).toBe('payg-managed');
    // 'managed' se conserva como alias para clientes previos a la renombra.
    expect(resolveTierId('managed')).toBe(resolveTierId('socio-managed'));
  });

  it('cada clave de LEGACY_TIER_MAP apunta a un tier real', () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_TIER_MAP)) {
      expect(canonical, `${legacy} apunta a un canonico, no a otro legacy`).not.toBe(legacy);
      expect(TIERS[canonical], `${legacy} -> ${canonical} debe existir`).toBeDefined();
    }
  });

  it('un id canonico pasa sin transformar', () => {
    for (const id of ['free', 'mesh-only', 'payg', 'payg-managed'] as const) {
      expect(resolveTierId(id)).toBe(id);
    }
  });

  it('un id desconocido NO revienta: degrada sin pricing inventado', () => {
    // Debe ser explicito si algun dia se decide rechazar, pero hoy el
    // comportamiento es pass-through. Este test documenta el contrato.
    const resolved = resolveTierId('no-existe');
    expect(resolved).toBe('no-existe');
    expect(TIERS[resolved as keyof typeof TIERS]).toBeUndefined();
  });
});

describe('calculatePrice', () => {
  it('aplica infra 100% + AI con 10% de margen + 5% de handling', () => {
    const infra = 0.02;
    const aiBase = 0.00001;
    const { aiWithMargin, subtotal, handling, total } = calculatePrice(infra, aiBase);

    expect(aiWithMargin).toBeCloseTo(aiBase * 1.1, 10);
    expect(subtotal).toBeCloseTo(infra + aiBase * 1.1, 10);
    expect(handling).toBeCloseTo(subtotal * 0.05, 10);
    expect(total).toBeCloseTo(subtotal * 1.05, 10);
    // La suma debe ser exacta: nada de redondeo oculto que descuadre la factura.
    expect(aiWithMargin + handling + infra).toBeCloseTo(total, 10);
  });

  it('con coste cero el total es cero (tier free no se factura)', () => {
    expect(calculatePrice(0, 0).total).toBe(0);
  });
});