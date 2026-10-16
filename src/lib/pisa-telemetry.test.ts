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
  beforeEach(() => {
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

    vi.stubGlobal('crypto', {
      subtle: webcrypto.subtle
    });

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
    const event = buildEvent('test_event', {
      correct: 1,
      duration_ms: 47000,
      email: 'student@example.com',
      ip: '127.0.0.1'
    });

    expect(event.event_type).toBe('test_event');
    expect(event.correct).toBe(1);
    expect(event.duration_ms).toBe(45000); // Should be rounded
    expect((event as any).email).toBeUndefined(); // Forbidden
    expect((event as any).ip).toBeUndefined(); // Forbidden
  });

  it('trackEvent respects opt-in gate', () => {
    trackEvent('ignored_event');
    expect(getTelemetryBuffer().length).toBe(0);

    setOptIn(true);
    trackEvent('tracked_event');
    const buffer = getTelemetryBuffer();
    expect(buffer.length).toBe(1);
    expect(buffer[0].event_type).toBe('tracked_event');
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
      trackEvent(`event_${i}`);
    }

    const buffer = getTelemetryBuffer();
    expect(buffer.length).toBe(200);
    // The oldest 50 should be dropped, so it starts at event_50
    expect(buffer[0].event_type).toBe('event_50');
    expect(buffer[199].event_type).toBe('event_249');
  });

  it('localStorage buffer respects TTL (24 hours)', () => {
    setOptIn(true);

    // Add event at time 0
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    trackEvent('old_event');

    // Add event at time +12 hours
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    trackEvent('recent_event');

    // Advance time to +25 hours from start
    vi.setSystemTime(new Date('2024-01-02T01:00:00Z'));

    // trackEvent should trigger TTL cleanup before saving new event
    trackEvent('new_event');

    const buffer = getTelemetryBuffer();
    // old_event (25h old) should be gone.
    // recent_event (13h old) should remain.
    // new_event (0h old) should remain.
    expect(buffer.length).toBe(2);
    expect(buffer.some(e => e.event_type === 'old_event')).toBe(false);
    expect(buffer.some(e => e.event_type === 'recent_event')).toBe(true);
    expect(buffer.some(e => e.event_type === 'new_event')).toBe(true);
  });

  it('setOptIn(false) clears the telemetry buffer', () => {
    setOptIn(true);
    trackEvent('kept');
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
