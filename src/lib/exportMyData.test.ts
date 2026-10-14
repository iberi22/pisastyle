import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { collectAllUserData, buildJson, buildSqlDump } from './exportMyData';
import { getStorageAdapter, setStorageAdapter, getMemoryAdapter, type StorageAdapter, type DomainRecord } from './domain';
import { SurrealAdapter } from './surreal';
import { domainConfig } from './domain.config';
import initSqlJs from 'sql.js';

describe('exportMyData', () => {
  const originalAdapter = getStorageAdapter();

  beforeEach(() => {
    localStorage.clear();
    getMemoryAdapter().clear();
    setStorageAdapter(getMemoryAdapter());
  });

  afterEach(() => {
    setStorageAdapter(originalAdapter);
    localStorage.clear();
    getMemoryAdapter().clear();
    vi.restoreAllMocks();
  });

  it('throws an error if adapter is a remote adapter (SurrealAdapter) and makes no fetch calls', async () => {
    // Setup a dummy surreal adapter
    const surreal = new SurrealAdapter('http://dummy');
    setStorageAdapter(surreal);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(collectAllUserData()).rejects.toThrow(/remote sync adapters/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('JSON round-trip: exports seeded records and kv accurately', async () => {
    const mem = getMemoryAdapter();
    const instanceId = domainConfig.instanceId as string;

    // Seed some data
    await mem.create('pisa_unit', { id: 'u1', instance_id: instanceId, domain: 'math', status: 'draft' } as unknown as DomainRecord);
    await mem.create('telemetry_event', { id: 't1', instance_id: instanceId, event_type: 'click' } as unknown as DomainRecord);

    localStorage.setItem('pisa-consent-v1', 'true');
    localStorage.setItem('pisastyle.contrib.draft.es', 'dummy-draft-content');

    const data = await collectAllUserData();
    const jsonStr = buildJson(data);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.entities.pisa_unit).toHaveLength(1);
    expect(parsed.entities.pisa_unit[0].id).toEqual('u1');
    expect(parsed.entities.telemetry_event).toHaveLength(1);
    expect(parsed.entities.telemetry_event[0].event_type).toEqual('click');
    expect(parsed.kv['pisa-consent-v1']).toEqual('true');
    expect(parsed.kv['pisastyle.contrib.draft.es']).toEqual('dummy-draft-content');
  });

  it('Decrypt-via-adapter proof: reads only via adapter.list and returns plaintext', async () => {
    const instanceId = domainConfig.instanceId as string;

    // Test double simulating decrypted data
    class PlaintextMockAdapter implements StorageAdapter {
      async create() { return {} as any; }
      async get() { return null; }
      async update() { return null; }
      async del() { return true; }

      async list(entity: string, _iid: string) {
        if (entity === 'pisa_unit') {
          return [{ id: 'u2', instance_id: instanceId, _plaintext: true }] as any[];
        }
        return [];
      }
    }

    const mockAdapter = new PlaintextMockAdapter();
    setStorageAdapter(mockAdapter);

    const listSpy = vi.spyOn(mockAdapter, 'list');

    const data = await collectAllUserData();

    // Check that spy was called for every configured entity
    expect(listSpy).toHaveBeenCalledTimes(domainConfig.entities.length);

    // Check that we got plaintext
    expect(data.entities.pisa_unit).toHaveLength(1);
    expect((data.entities.pisa_unit[0] as any)._plaintext).toEqual(true);
  });

  it('SQL dump correctly restores into in-memory SQLite database', async () => {
    const mem = getMemoryAdapter();
    const instanceId = domainConfig.instanceId as string;

    // Create record with a single quote
    await mem.create('pisa_unit', { id: 'u3', instance_id: instanceId, domain: "O'Reilly" } as unknown as DomainRecord);
    localStorage.setItem('pisa-consent-v1', "user's consent");

    const data = await collectAllUserData();
    const sqlStr = buildSqlDump(data);

    // Spin up sql.js to verify
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    db.run(sqlStr);

    // Verify kv
    const kvRows = db.exec("SELECT key, value FROM _kv");
    expect(kvRows.length).toBeGreaterThan(0);
    const kvData = kvRows[0].values;
    const consentRow = kvData.find((r) => r[0] === 'pisa-consent-v1');
    expect(consentRow).toBeDefined();
    expect(consentRow![1]).toEqual("user's consent");

    // Verify entity table
    const pisaRows = db.exec("SELECT data FROM pisa_unit");
    expect(pisaRows.length).toBeGreaterThan(0);
    const rowStr = pisaRows[0].values[0][0] as string;
    const rowJson = JSON.parse(rowStr);
    expect(rowJson.domain).toEqual("O'Reilly");
  });
});
