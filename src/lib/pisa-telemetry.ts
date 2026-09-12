export interface TelemetryEvent {
  id: string;
  name: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export const allowlist: string[] = [];

const MAX_BUFFER_SIZE = 200;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY = 'pisa_telemetry_events';

let isOptedIn = false;

export function setOptIn(value: boolean): void {
  isOptedIn = value;
}

export function getOptIn(): boolean {
  return isOptedIn;
}

export function buildEvent(name: string, data?: Record<string, unknown>): TelemetryEvent {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
    name,
    timestamp: Date.now(),
    data
  };
}

export function trackEvent(name: string, data?: Record<string, unknown>): void {
  if (!isOptedIn) return;

  const event = buildEvent(name, data);
  saveToBuffer(event);
}

function saveToBuffer(event: TelemetryEvent): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    let buffer: TelemetryEvent[] = [];
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      buffer = JSON.parse(stored);
    }

    // TTL cleanup
    const now = Date.now();
    buffer = buffer.filter(e => now - e.timestamp <= TTL_MS);

    // Add new event
    buffer.push(event);

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

    let buffer: TelemetryEvent[] = JSON.parse(stored);

    // TTL cleanup on read
    const now = Date.now();
    buffer = buffer.filter(e => now - e.timestamp <= TTL_MS);

    return buffer;
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