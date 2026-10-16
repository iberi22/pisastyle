export const allowlist = [
  'event_type',
  'unit_id',
  'domain',
  'process',
  'content',
  'context',
  'level',
  'correct',
  'duration_ms',
  'locale',
  'country_hint',
  'device_class',
  'app_version',
  'instance_ref',
  'consent_version'
] as const;

export type TelemetryEvent = Partial<Record<typeof allowlist[number], unknown>> & { event_type: string };

interface BufferedEvent {
  timestamp: number;
  payload: TelemetryEvent;
}

const MAX_BUFFER_SIZE = 200;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY = 'pisa_telemetry_events';

let isOptedIn = false;

export function setOptIn(value: boolean): void {
  isOptedIn = value;

  if (!value) {
    clearTelemetryBuffer();
  }

  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem('pisa-consent-v1', value ? 'true' : 'false');
  } catch (error) {
    // Ignore storage errors
  }
}

export function hydrateOptIn(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return getOptIn();
  try {
    const consent = localStorage.getItem('pisa-consent-v1');
    if (consent === 'true') {
      isOptedIn = true;
    } else if (consent === 'false') {
      isOptedIn = false;
    }
  } catch (error) {
    // Ignore storage errors
  }
  return getOptIn();
}

export function getOptIn(): boolean {
  return isOptedIn;
}

export function roundDurationMs(ms: number): number {
  return Math.round(ms / 5000) * 5000;
}

export async function instanceRef(instanceId: string, dateIso: string): Promise<string> {
  const input = instanceId + dateIso;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.slice(0, 16);
}

export function buildEvent(name: string, data?: Record<string, unknown>): TelemetryEvent {
  const event: TelemetryEvent = { event_type: name };

  if (data) {
    for (const key of Object.keys(data)) {
      if (key !== 'event_type' && (allowlist as readonly string[]).includes(key)) {
        if (key === 'duration_ms' && typeof data[key] === 'number') {
          event.duration_ms = roundDurationMs(data[key] as number);
        } else {
          (event as any)[key] = data[key];
        }
      }
    }
  }

  return event;
}

export function trackEvent(name: string, data?: Record<string, unknown>): void {
  if (!isOptedIn) return;

  const event = buildEvent(name, data);
  saveToBuffer(event);
}

function saveToBuffer(event: TelemetryEvent): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    let buffer: BufferedEvent[] = [];
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      buffer = JSON.parse(stored);
    }

    // TTL cleanup
    const now = Date.now();
    buffer = buffer.filter(b => now - b.timestamp <= TTL_MS);

    // Add new event
    buffer.push({ timestamp: now, payload: event });

    // Enforce size <= 200
    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer = buffer.slice(-MAX_BUFFER_SIZE);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
  } catch (error) {
    // Ignore storage errors to avoid breaking the app
    console.error('Telemetry storage failed', error);
  }
}

export function getTelemetryBuffer(): TelemetryEvent[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    let buffer: BufferedEvent[] = JSON.parse(stored);

    // TTL cleanup on read
    const now = Date.now();
    buffer = buffer.filter(b => now - b.timestamp <= TTL_MS);

    return buffer.map(b => b.payload);
  } catch {
    return [];
  }
}

export function clearTelemetryBuffer(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}