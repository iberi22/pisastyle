import { describe, it, expect, beforeEach, vi } from 'vitest';
import { collectAllUserData, buildJson, buildSqlDump } from './exportMyData';
import { getMemoryAdapter, setStorageAdapter, createEntity } from './domain';
import { domainConfig } from './domain.config';
import initSqlJs from 'sql.js';
import type { StorageAdapter, DomainRecord } from './domain';

describe('exportMyData', () => {
  beforeEach(() => {
    const mem = getMemoryAdapter();
    mem.clear();
    setStorageAdapter(mem);
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('JSON round-trip: collects entities and localStorage, builds matching JSON', async () => {
    // Seed at least 1 record per entity
    const instanceId = domainConfig.instanceId as string;
    for (const def of domainConfig.entities) {
      await createEntity(def.name, { test_data: `seed-${def.name}` }, instanceId);
    }

    // Seed localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pisa-consent-v1', 'true');
      localStorage.setItem('pisastyle.contrib.draft.es', 'draft content');
    }

    const data = await collectAllUserData();
    const jsonStr = buildJson(data);
    const parsed = JSON.parse(jsonStr);

    // Verify meta
    expect(parsed.meta.appId).toEqual(domainConfig.appId);
    expect(parsed.meta.format).toEqual('v1');

    // Verify entities deep equal
    for (const def of domainConfig.entities) {
      const entityName = def.name;
      expect(parsed.entities[entityName]).toBeDefined();
      expect(parsed.entities[entityName].length).toEqual(1);
      expect(parsed.entities[entityName][0].test_data).toEqual(`seed-${entityName}`);
    }

    // Verify KV
    expect(parsed.kv['pisa-consent-v1']).toEqual('true');
    expect(parsed.kv['pisastyle.contrib.draft.es']).toEqual('draft content');
  });

  it('SQL dump restores into an empty store matching counts and values', async () => {
    // Seed data with quotes
    const instanceId = domainConfig.instanceId as string;
    for (const def of domainConfig.entities) {
      await createEntity(def.name, { test_data: `value with 'single' quote` }, instanceId);
    }

    const data = await collectAllUserData();
    const sqlDump = buildSqlDump(data);

    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Execute SQL dump
    db.run(sqlDump);

    // Verify _export_meta
    const resMeta = db.exec('SELECT * FROM _export_meta');
    expect(resMeta[0].values.length).toEqual(4);

    // Verify entities tables counts
    for (const def of domainConfig.entities) {
      const entityName = def.name;
      const res = db.exec(`SELECT * FROM "${entityName}"`);
      expect(res[0].values.length).toEqual(1);

      const dataStr = res[0].values[0][5] as string; // index 5 is 'data' TEXT
      expect(dataStr).toContain("value with 'single' quote");
    }
  });

  it('Decrypt-via-adapter proof: collect calls ONLY adapter.list and returns plaintext', async () => {
    const fakePlaintext: DomainRecord[] = [
      { id: '123', instance_id: domainConfig.instanceId as string, created_at: '', updated_at: '', test_plain: true }
    ];

    const testAdapter: StorageAdapter = {
      create: vi.fn(),
      list: vi.fn().mockResolvedValue(fakePlaintext),
      get: vi.fn(),
      update: vi.fn(),
      del: vi.fn()
    };

    const data = await collectAllUserData(testAdapter);

    // Verify only adapter.list was called
    expect(testAdapter.list).toHaveBeenCalled();
    expect(testAdapter.create).not.toHaveBeenCalled();
    expect(testAdapter.get).not.toHaveBeenCalled();

    // Check output contains plaintext directly from adapter
    const firstEntity = domainConfig.entities[0].name;
    expect(data.entities[firstEntity]).toEqual(fakePlaintext);
  });
});
