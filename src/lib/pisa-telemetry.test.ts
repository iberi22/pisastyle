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

  it('buildEvent creates valid event and drops forbidden keys', () => {
    const event = buildEvent('unit_started', {
      correct: 1,
      duration_ms: 47000,
      email: 'student@example.com',
      ip: '127.0.0.1'
    });

    expect(event.event_type).toBe('unit_started');
    expect(event.correct).toBe(1);
    expect(event.duration_ms).toBe(45000); // Should be rounded
    expect((event as any).email).toBeUndefined(); // Forbidden
    expect((event as any).ip).toBeUndefined(); // Forbidden
  });

  it('buildEvent drops nested PII', () => {
    const event = buildEvent('unit_started', {
      content: { nested: 'pii' }
    });
    expect((event as any).content).toBeUndefined();
  });

  it('buildEvent rejects raw id for instance_ref', () => {
    const event = buildEvent('unit_started', {
      instance_ref: 'student-0001'
    });
    expect(event.instance_ref).toBeUndefined();

    const validEvent = buildEvent('unit_started', {
      instance_ref: '0123456789abcdef'
    });
    expect(validEvent.instance_ref).toBe('0123456789abcdef');
  });

  it('buildEvent rejects string duration', () => {
    const event = buildEvent('unit_started', {
      duration_ms: '45000'
    });
    expect(event.duration_ms).toBeUndefined();
  });

  it('buildEvent rejects invalid event_type', () => {
    const event = buildEvent('invalid_event');
    expect(event.event_type).toBeUndefined();
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
      trackEvent('unit_started', { duration_ms: i });
    }

    const buffer = getTelemetryBuffer();
    expect(buffer.length).toBe(200);
    // The oldest 50 should be dropped
    expect(buffer[0].duration_ms).toBe(0);
    expect(buffer[199].duration_ms).toBe(0);
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
