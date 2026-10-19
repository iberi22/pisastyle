import { PISASTYLE_LOCALES } from './pisa-i18n';

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

// Seam for testing
export const testing = {
  digestSeam: undefined as ((algo: string, data: Uint8Array) => Promise<ArrayBuffer>) | undefined
};

export async function instanceRef(instanceId: string, dateIso: string): Promise<string | undefined> {
  if (typeof window === 'undefined' && typeof globalThis.crypto === 'undefined' && !testing.digestSeam) {
    return undefined;
  }

  const subtle = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto.subtle : undefined;
  const digest = testing.digestSeam || (subtle ? subtle.digest.bind(subtle) : undefined);

  if (!digest) {
    return undefined;
  }

  try {
    const input = instanceId + dateIso;
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.slice(0, 16);
  } catch (error) {
    return undefined;
  }
}

export function buildEvent(name: string, data?: Record<string, unknown>): TelemetryEvent | null {
  const event: Partial<TelemetryEvent> = {};

  // Validate event_type
  const validEventTypes = ['unit_started', 'item_answered', 'unit_finished', 'infographic_view'];
  if (validEventTypes.includes(name)) {
    event.event_type = name;
  } else {
    return null;
  }

  if (data) {
    for (const key of Object.keys(data)) {
      if (key === 'event_type' || !(allowlist as readonly string[]).includes(key)) {
        continue;
      }

      const value = data[key];

      // Primitives only
      if (typeof value === 'object' || typeof value === 'function' || typeof value === 'symbol') {
        continue;
      }

      if (key === 'duration_ms') {
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
          event.duration_ms = roundDurationMs(value);
        }
      } else if (key === 'correct') {
        if (value === 0 || value === 0.5 || value === 1) {
          event.correct = value;
        }
      } else if (key === 'device_class') {
        if (value === 'mobile' || value === 'desktop') {
          event.device_class = value;
        }
      } else if (key === 'instance_ref') {
        if (typeof value === 'string' && /^[0-9a-f]{16}$/.test(value)) {
          event.instance_ref = value;
        }
      } else if (key === 'locale') {
        if (typeof value === 'string' && (PISASTYLE_LOCALES as readonly string[]).includes(value)) {
          event.locale = value;
        }
      } else if (key === 'country_hint') {
        if (typeof value === 'string' && /^[A-Z]{2}$/.test(value)) {
          event.country_hint = value;
        }
      } else if (['unit_id', 'domain', 'process', 'content', 'context', 'level', 'app_version', 'consent_version'].includes(key)) {
        if (typeof value === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(value)) {
          (event as any)[key] = value;
        } else if (typeof value === 'number' && Number.isFinite(value) && /^[A-Za-z0-9._-]{1,64}$/.test(String(value))) {
          (event as any)[key] = String(value);
        }
      }
    }
  }

  return event as TelemetryEvent;
}

export function trackEvent(name: string, data?: Record<string, unknown>): void {
  if (!isOptedIn) return;

  const event = buildEvent(name, data);
  if (event) {
    saveToBuffer(event);
  }
}

function saveToBuffer(event: TelemetryEvent): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    let buffer: BufferedEvent[] = [];
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        buffer = parsed;
      }
    }

    // TTL cleanup & Shape enforcement
    const now = Date.now();
    buffer = buffer.filter(b => {
      return b &&
             typeof b === 'object' &&
             !Array.isArray(b) &&
             typeof b.timestamp === 'number' &&
             b.payload &&
             typeof b.payload === 'object' &&
             typeof (b.payload as any).event_type === 'string' &&
             now - b.timestamp <= TTL_MS;
    });

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

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    let buffer: BufferedEvent[] = parsed;

    // TTL cleanup on read & Shape enforcement
    const now = Date.now();
    buffer = buffer.filter(b => {
      return b &&
             typeof b === 'object' &&
             !Array.isArray(b) &&
             typeof b.timestamp === 'number' &&
             b.payload &&
             typeof b.payload === 'object' &&
             typeof (b.payload as any).event_type === 'string' &&
             now - b.timestamp <= TTL_MS;
    });

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