import { getStorageAdapter, type StorageAdapter } from './domain';
import { domainConfig } from './domain.config';

export interface UserData {
  entities: Record<string, any[]>;
  kv: Record<string, string>;
}

export async function collectAllUserData(adapter: StorageAdapter = getStorageAdapter()): Promise<UserData> {
  if (adapter.constructor.name === 'SurrealAdapter') {
    throw new Error('Export is only supported with local storage adapters. Remote sync adapters (like SurrealAdapter) are not supported for on-device export to avoid network calls.');
  }

  const data: UserData = {
    entities: {},
    kv: {},
  };

  const instanceId = domainConfig.instanceId as string;

  for (const entityDef of domainConfig.entities) {
    const entityName = entityDef.name;
    const records = await adapter.list(entityName, instanceId);
    data.entities[entityName] = records;
  }

  if (typeof localStorage !== 'undefined') {
    const consent = localStorage.getItem('pisa-consent-v1');
    if (consent !== null) {
      data.kv['pisa-consent-v1'] = consent;
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pisastyle.contrib.draft.')) {
        data.kv[key] = localStorage.getItem(key) as string;
      }
    }
  }

  return data;
}

export function buildJson(data: UserData): string {
  return JSON.stringify(data, null, 2);
}

function escapeSqlIdentifier(id: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(id)) {
    throw new Error(`Invalid SQL identifier: ${id}`);
  }
  return id;
}

function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''");
}

export function buildSqlDump(data: UserData): string {
  const lines: string[] = [];
  lines.push('PRAGMA foreign_keys=OFF;');
  lines.push('BEGIN;');

  lines.push('CREATE TABLE IF NOT EXISTS "_export_meta" (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
  lines.push(`INSERT OR REPLACE INTO "_export_meta" (key, value) VALUES ('format', 'export-v1');`);
  lines.push(`INSERT OR REPLACE INTO "_export_meta" (key, value) VALUES ('app_id', '${escapeSqlString(domainConfig.appId as string)}');`);
  lines.push(`INSERT OR REPLACE INTO "_export_meta" (key, value) VALUES ('exported_at', '${new Date().toISOString()}');`);
  lines.push(`INSERT OR REPLACE INTO "_export_meta" (key, value) VALUES ('schema_version', '1');`);

  lines.push('CREATE TABLE IF NOT EXISTS "_kv" (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
  for (const [key, value] of Object.entries(data.kv)) {
    lines.push(`INSERT OR REPLACE INTO "_kv" (key, value) VALUES ('${escapeSqlString(key)}', '${escapeSqlString(value)}');`);
  }

  for (const [entityName, records] of Object.entries(data.entities)) {
    const safeEntity = escapeSqlIdentifier(entityName);
    lines.push(`CREATE TABLE IF NOT EXISTS "${safeEntity}" (id TEXT PRIMARY KEY, instance_id TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT, data TEXT NOT NULL);`);
    for (const record of records) {
      const id = escapeSqlString(record.id || '');
      const instance_id = escapeSqlString(record.instance_id || '');
      const created_at = escapeSqlString(record.created_at || '');
      const updated_at = escapeSqlString(record.updated_at || '');
      const deleted_at = record.deleted_at ? escapeSqlString(record.deleted_at) : '';
      const dataStr = escapeSqlString(JSON.stringify(record));

      lines.push(`INSERT OR REPLACE INTO "${safeEntity}" (id, instance_id, created_at, updated_at, deleted_at, data) VALUES ('${id}', '${instance_id}', '${created_at}', '${updated_at}', '${deleted_at}', '${dataStr}');`);
    }
  }

  lines.push('COMMIT;');
  return lines.join('\n');
}

export function downloadMyData(kind: 'json' | 'sql', data: UserData): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  let content: string;
  let type: string;
  let filename: string;

  if (kind === 'json') {
    content = buildJson(data);
    type = 'application/json;charset=utf-8';
    filename = `export_${domainConfig.appId}_${new Date().toISOString().slice(0, 10)}.json`;
  } else {
    content = buildSqlDump(data);
    type = 'application/sql;charset=utf-8';
    filename = `export_${domainConfig.appId}_${new Date().toISOString().slice(0, 10)}.sql`;
  }

  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(href), 1000);

  return true;
}
