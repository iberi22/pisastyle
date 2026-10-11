import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { xavierSearch, xavierAdd } from './xavier';

describe('xavier stub honesty', () => {
  it('xavierSearch returns empty memories on fetch reject', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('fetch failed');
    }));
    const res = await xavierSearch('ping', 1);
    expect(res).toEqual({ memories: [] });
  });

  it('xavierAdd returns null on fetch reject', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('fetch failed');
    }));
    const res = await xavierAdd('x', 'episodic');
    expect(res).toBeNull();
  });

  it('xavierSearch returns parsed json on fetch success', async () => {
    const mockMemories = { memories: [{ id: 't' }] };
    vi.stubGlobal('fetch', vi.fn(async () => {
      return {
        ok: true,
        json: async () => mockMemories
      };
    }));
    const res = await xavierSearch('ping', 1);
    expect(res).toEqual(mockMemories);
  });

  it('xavier.ts and xavierSync.ts do not mention IndexedDB or WASM', () => {
    const xavierContent = fs.readFileSync(path.join(__dirname, 'xavier.ts'), 'utf-8');
    const xavierSyncContent = fs.readFileSync(path.join(__dirname, 'xavierSync.ts'), 'utf-8');

    expect(xavierContent).not.toMatch(/indexeddb/i);
    expect(xavierContent).not.toMatch(/wasm/i);

    expect(xavierSyncContent).not.toMatch(/indexeddb/i);
    expect(xavierSyncContent).not.toMatch(/wasm/i);
    expect(xavierSyncContent).not.toMatch(/idb/i);
  });
});
