import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  buildEvent,
  trackEvent,
  setOptIn,
  hydrateOptIn,
  getOptIn,
  allowlist,
  getTelemetryBuffer,
  clearTelemetryBuffer,
  roundDurationMs,
  instanceRef
} from './pisa-telemetry';
import { webcrypto } from 'node:crypto';

describe('pisa-telemetry', () => {
  beforeEach(async () => {
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => {
        for (const key in store) delete store[key];
      }
    });

    // Seam injection
    const pisaTelemetry = await import('./pisa-telemetry');
    pisaTelemetry.testing.digestSeam = webcrypto.subtle.digest.bind(webcrypto.subtle) as any;

    vi.useFakeTimers();
    clearTelemetryBuffer();
    setOptIn(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('allowlist should contain schema fields and not be empty', () => {
    expect(allowlist.length).toBeGreaterThanOrEqual(11);
    expect(allowlist).toContain('event_type');
    expect(allowlist).toContain('instance_ref');
  });

  it('roundDurationMs correctly rounds to nearest 5000', () => {
    expect(roundDurationMs(47000)).toBe(45000);
    expect(roundDurationMs(47500)).toBe(50000);
    expect(roundDurationMs(1200)).toBe(0);
    expect(roundDurationMs(4999)).toBe(5000);
  });

  it('instanceRef returns deterministic rotating hash', async () => {
    const hash1 = await instanceRef('student-0001', '2026-10-16');
    const hash2 = await instanceRef('student-0001', '2026-10-16');
    const hash3 = await instanceRef('student-0001', '2026-10-17');

    expect(hash1).toHaveLength(16);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('instanceRef without crypto => undefined', async () => {
    const pisaTelemetry = await import('./pisa-telemetry');
    const originalSeam = pisaTelemetry.testing.digestSeam;

    // Simulate no crypto
    pisaTelemetry.testing.digestSeam = undefined;
    const globalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });

    const result = await instanceRef('student-0001', '2026-10-16');
    expect(result).toBeUndefined();

    // Restore
    Object.defineProperty(globalThis, 'crypto', { value: globalCrypto, configurable: true });
    pisaTelemetry.testing.digestSeam = originalSeam;
  });

  it('buildEvent creates valid event and drops forbidden keys', () => {
    const event = buildEvent('unit_started', {
      correct: 1,
      duration_ms: 47000,
      email: 'student@example.com',
      ip: '127.0.0.1'
    });

    expect(event?.event_type).toBe('unit_started');
    expect(event?.correct).toBe(1);
    expect(event?.duration_ms).toBe(45000); // Should be rounded
    expect((event as any)?.email).toBeUndefined(); // Forbidden
    expect((event as any)?.ip).toBeUndefined(); // Forbidden
  });

  it('buildEvent drops nested PII', () => {
    const event = buildEvent('unit_started', {
      content: { nested: 'pii' }
    });
    expect((event as any)?.content).toBeUndefined();
  });

  it('buildEvent rejects raw id for instance_ref', () => {
    const event = buildEvent('unit_started', {
      instance_ref: 'student-0001'
    });
    expect(event?.instance_ref).toBeUndefined();

    const validEvent = buildEvent('unit_started', {
      instance_ref: '0123456789abcdef'
    });
    expect(validEvent?.instance_ref).toBe('0123456789abcdef');
  });

  it('buildEvent rejects string duration', () => {
    const event = buildEvent('unit_started', {
      duration_ms: '45000'
    });
    expect(event?.duration_ms).toBeUndefined();
  });

  it('buildEvent rejects invalid event_type', () => {
    const event = buildEvent('invalid_event');
    expect(event).toBeNull();
  });

  it('buildEvent rejects country_hint if invalid', () => {
    let event = buildEvent('unit_started', { country_hint: 'COL' });
    expect(event?.country_hint).toBeUndefined();

    event = buildEvent('unit_started', { country_hint: 'c1' });
    expect(event?.country_hint).toBeUndefined();

    event = buildEvent('unit_started', { country_hint: 'CO' });
    expect(event?.country_hint).toBe('CO');
  });

  it('buildEvent rejects locale if not in PISASTYLE_LOCALES', () => {
    let event = buildEvent('unit_started', { locale: 'fr' });
    expect(event?.locale).toBeUndefined();

    event = buildEvent('unit_started', { locale: 'es' });
    expect(event?.locale).toBe('es');
  });

  it('buildEvent rejects token fields if they have spaces or are too long', () => {
    let event = buildEvent('unit_started', { unit_id: 'literal string with spaces' });
    expect(event?.unit_id).toBeUndefined();

    const longString = 'a'.repeat(65);
    event = buildEvent('unit_started', { unit_id: longString });
    expect(event?.unit_id).toBeUndefined();

    event = buildEvent('unit_started', { unit_id: 'valid-token.1_2' });
    expect(event?.unit_id).toBe('valid-token.1_2');
  });

  it('buildEvent rejects correct outside 0, 0.5, 1', () => {
    let event = buildEvent('unit_started', { correct: 0.8 });
    expect(event?.correct).toBeUndefined();

    event = buildEvent('unit_started', { correct: 2 });
    expect(event?.correct).toBeUndefined();

    event = buildEvent('unit_started', { correct: 0.5 });
    expect(event?.correct).toBe(0.5);
  });

  it('buildEvent rejects device_class outside enum', () => {
    let event = buildEvent('unit_started', { device_class: 'tablet' });
    expect(event?.device_class).toBeUndefined();

    event = buildEvent('unit_started', { device_class: 'mobile' });
    expect(event?.device_class).toBe('mobile');
  });

  it('buildEvent drops NaN, Infinity, -Infinity for unit_id', () => {
    const invalidValues = [NaN, Infinity, -Infinity];
    for (const val of invalidValues) {
      const event = buildEvent('unit_started', { unit_id: val });
      expect(event).not.toBeNull();
      if (event) {
        expect('unit_id' in event).toBe(false);
      }
    }
  });

  it('buildEvent drops non-finite numbers for other string fields', () => {
    const invalidValues = [NaN, Infinity, -Infinity];
    const stringFields = ['domain', 'level'];

    for (const field of stringFields) {
      for (const val of invalidValues) {
        const event = buildEvent('unit_started', { [field]: val });
        expect(event).not.toBeNull();
        if (event) {
          expect(field in event).toBe(false);
        }
      }
    }
  });

  it('buildEvent accepts finite numbers for string fields', () => {
    const event = buildEvent('unit_started', { unit_id: 12, level: 1.5 });
    expect(event?.unit_id).toBe('12');
    expect((event as any)?.level).toBe('1.5');
  });

  it('trackEvent with NaN does not store NaN in buffer', () => {
    setOptIn(true);
    localStorage.clear();

    trackEvent('unit_started', { unit_id: NaN });
    const buffer = getTelemetryBuffer();
    expect(buffer.length).toBe(1);

    const storedString = JSON.stringify(buffer);
    expect(storedString).not.toContain('NaN');
  });

  it('trackEvent writes nothing when event_type is invalid', () => {
    setOptIn(true);
    trackEvent('invalid_event_type', { duration_ms: 1000 });
    expect(getTelemetryBuffer().length).toBe(0);
  });

  it('getTelemetryBuffer returns [] for old buffer shape', () => {
    const oldBuffer = [{ id: '1', name: 'unit_started', timestamp: Date.now(), data: {} }];
    localStorage.setItem('pisa_telemetry_events', JSON.stringify(oldBuffer));
    expect(getTelemetryBuffer()).toEqual([]);
  });

  it('trackEvent respects opt-in gate', () => {
    trackEvent('unit_started');
    expect(getTelemetryBuffer().length).toBe(0);

    setOptIn(true);
    trackEvent('unit_started');
    const buffer = getTelemetryBuffer();
    expect(buffer.length).toBe(1);
    expect(buffer[0].event_type).toBe('unit_started');
  });

  it('getOptIn returns current opt-in status', () => {
    expect(getOptIn()).toBe(false);
    setOptIn(true);
    expect(getOptIn()).toBe(true);
  });

  it('localStorage buffer respects MAX_BUFFER_SIZE <= 200', () => {
    setOptIn(true);
    // Add 250 events
    for (let i = 0; i < 250; i++) {
      trackEvent('unit_started', { duration_ms: i * 5000 });
    }

    const buffer = getTelemetryBuffer();
    expect(buffer.length).toBe(200);
    // The oldest 50 should be dropped
    expect(buffer[0].duration_ms).toBe(250000);
    expect(buffer[199].duration_ms).toBe(1245000);
  });

  it('localStorage buffer respects TTL (24 hours)', () => {
    setOptIn(true);

    // Add event at time 0
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    trackEvent('unit_started', { duration_ms: 1000 });

    // Add event at time +12 hours
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    trackEvent('unit_finished', { duration_ms: 2000 });

    // Advance time to +25 hours from start
    vi.setSystemTime(new Date('2024-01-02T01:00:00Z'));

    // trackEvent should trigger TTL cleanup before saving new event
    trackEvent('item_answered', { duration_ms: 3000 });

    const buffer = getTelemetryBuffer();
    expect(buffer.length).toBe(2);
    expect(buffer.some(e => e.event_type === 'unit_started')).toBe(false);
    expect(buffer.some(e => e.event_type === 'unit_finished')).toBe(true);
    expect(buffer.some(e => e.event_type === 'item_answered')).toBe(true);
  });

  it('setOptIn(false) clears the telemetry buffer', () => {
    setOptIn(true);
    trackEvent('unit_started');
    expect(getTelemetryBuffer().length).toBe(1);

    setOptIn(false);
    expect(getTelemetryBuffer().length).toBe(0);
    expect(getOptIn()).toBe(false);
  });

  it('hydrateOptIn respects stored pisa-consent-v1 value', () => {
    setOptIn(true);
    expect(localStorage.getItem('pisa-consent-v1')).toBe('true');

    // Simulate initial state reset
    setOptIn(false);
    expect(getOptIn()).toBe(false);

    localStorage.setItem('pisa-consent-v1', 'true');
    expect(hydrateOptIn()).toBe(true);
    expect(getOptIn()).toBe(true);

    localStorage.removeItem('pisa-consent-v1');
    expect(hydrateOptIn()).toBe(true);
    expect(localStorage.getItem('pisa-consent-v1')).toBeNull();
  });
});
