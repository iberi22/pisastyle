import { describe, it, expect } from 'vitest';
import {
  calculatePrice,
  creditStatus,
  canAffordInference,
  formatPriceBreakdown,
  SWAL_HANDLING_PCT,
  AI_MARGIN_MIN_PCT,
  TIERS,
  isMeshOnlyMode,
  shouldUseCloudBackend,
  checkR2Quota,
  isOverage,
  resolveTierId,
} from './billing';

describe('billing calculatePrice (5% handling + 10% AI min) pay-per-use', () => {
  it('ejemplo: infra 0.50 + aiBase 0.30 -> total con 5%', () => {
    const p = calculatePrice(0.5, 0.3);
    expect(p.aiWithMargin).toBeCloseTo(0.33, 5);
    expect(p.subtotal).toBeCloseTo(0.83, 5);
    expect(p.handling).toBeCloseTo(0.0415, 5); // 5% de 0.83
    expect(p.total).toBeCloseTo(0.8715, 5);
  });

  it('infra 0 + aiBase 1 -> total con 10% y 5%', () => {
    const p = calculatePrice(0, 1);
    expect(p.aiWithMargin).toBeCloseTo(1.1, 5);
    expect(p.subtotal).toBeCloseTo(1.1, 5);
    expect(p.handling).toBeCloseTo(0.055, 5);
    expect(p.total).toBeCloseTo(1.155, 5);
  });

  it('handling es 5% de subtotal (no 20%)', () => {
    const p = calculatePrice(2, 3);
    expect(SWAL_HANDLING_PCT).toBe(0.05);
    expect(p.handling).toBeCloseTo(p.subtotal * 0.05, 5);
  });

  it('ai margin es 10% sobre base', () => {
    const p = calculatePrice(0, 10);
    expect(p.aiWithMargin).toBeCloseTo(10 * (1 + AI_MARGIN_MIN_PCT), 5);
  });

  it('1 camion vs 100 camiones mismo costo (pay-per-use puro)', () => {
    const oneTruck = calculatePrice(0.02, 0.01);
    const hundredTrucks = calculatePrice(0.02 * 100, 0.01 * 100);
    // costo escala con uso, no con numero vehiculos; precio por uso 100x lineal, no hay fee por vehiculo
    expect(hundredTrucks.total).toBeCloseTo(oneTruck.total * 100, 5);
  });
});

describe('billing credito payg', () => {
  it('creditStatus payg 50k', () => {
    expect(creditStatus(0, 'payg').remaining).toBe(50000);
    expect(creditStatus(10000, 'payg').remaining).toBe(40000);
    expect(creditStatus(50000, 'payg').remaining).toBe(0);
    expect(creditStatus(60000, 'payg').remaining).toBe(0);
  });

  it('legacy socio -> payg mapping', () => {
    expect(resolveTierId('socio')).toBe('payg');
    expect(resolveTierId('managed')).toBe('payg-managed');
    expect(resolveTierId('payg')).toBe('payg');
  });

  it('mesh-only no tiene credito AI', () => {
    expect(TIERS['mesh-only'].monthlyCredit).toBe(0);
    expect(canAffordInference(1, 0, 'mesh-only')).toBe(false);
    expect(isMeshOnlyMode('mesh-only')).toBe(true);
    expect(shouldUseCloudBackend('mesh-only', true)).toBe(false);
    expect(shouldUseCloudBackend('payg', false)).toBe(false);
    expect(shouldUseCloudBackend('payg', true)).toBe(true);
  });

  it('canAffordInference payg', () => {
    expect(canAffordInference(1000, 0, 'payg')).toBe(true);
    expect(canAffordInference(60000, 0, 'payg')).toBe(false);
    expect(canAffordInference(40000, 10000, 'payg')).toBe(true);
  });

  it('isOverage detecta overage pero permite uso (pay-per-use)', () => {
    expect(isOverage(60000, 'payg')).toBe(true);
    expect(isOverage(1000, 'payg')).toBe(false);
  });

  it('checkR2Quota overage', () => {
    const tenGB = 10 * 1024 * 1024 * 1024;
    expect(checkR2Quota(0, 10).overage).toBe(false);
    expect(checkR2Quota(tenGB + 1, 10).overage).toBe(true);
  });

  it('formatPriceBreakdown contiene 5%', () => {
    const s = formatPriceBreakdown(0.5, 0.3);
    expect(s).toContain('Infra $0.50');
    expect(s).toContain('AI $0.33');
    expect(s).toContain('handling SWAL 5%');
    expect(s).toContain('total $0.87');
  });
});
