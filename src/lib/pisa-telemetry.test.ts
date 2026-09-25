import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  buildEvent,
  trackEvent,
  setOptIn,
  getOptIn,
  allowlist,
  getTelemetryBuffer,
  clearTelemetryBuffer
} from './pisa-telemetry';

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

    vi.useFakeTimers();
    clearTelemetryBuffer();
    setOptIn(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('buildEvent creates valid event', () => {
    const event = buildEvent('test_event', { foo: 'bar' });
    expect(event.id).toBeDefined();
    expect(typeof event.id).toBe('string');
    expect(event.name).toBe('test_event');
    expect(event.timestamp).toBeLessThanOrEqual(Date.now());
    expect(event.data).toEqual({ foo: 'bar' });
  });

  it('allowlist should be empty initially', () => {
    expect(allowlist).toEqual([]);
  });

  it('trackEvent respects opt-in gate', () => {
    trackEvent('ignored_event');
    expect(getTelemetryBuffer().length).toBe(0);

    setOptIn(true);
    trackEvent('tracked_event');
    const buffer = getTelemetryBuffer();
    expect(buffer.length).toBe(1);
    expect(buffer[0].name).toBe('tracked_event');
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
    expect(buffer[0].name).toBe('event_50');
    expect(buffer[199].name).toBe('event_249');
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
    expect(buffer.some(e => e.name === 'old_event')).toBe(false);
    expect(buffer.some(e => e.name === 'recent_event')).toBe(true);
    expect(buffer.some(e => e.name === 'new_event')).toBe(true);
  });
});