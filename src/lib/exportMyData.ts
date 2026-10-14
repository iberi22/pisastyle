import { domainConfig } from './domain.config';
import { getStorageAdapter, type StorageAdapter, type DomainRecord } from './domain';

export type UserData = {
  meta: {
    appId: string;
    exportedAt: string;
    schemaVersion: string;
    format: string;
  };
  entities: Record<string, DomainRecord[]>;
  kv: Record<string, string>;
};

export async function collectAllUserData(adapter: StorageAdapter = getStorageAdapter()): Promise<UserData> {
  const data: UserData = {
    meta: {
      appId: domainConfig.appId,
      exportedAt: new Date().toISOString(),
      schemaVersion: '1',
      format: 'v1'
    },
    entities: {},
    kv: {}
  };

  const instanceId = domainConfig.instanceId as string;

  // Recolectar entidades
  for (const entityDef of domainConfig.entities) {
    const entityName = entityDef.name;
    const records = await adapter.list(entityName, instanceId);
    data.entities[entityName] = records;
  }

  // Recolectar localStorage
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const consent = localStorage.getItem('pisa-consent-v1');
    if (consent !== null) {
      data.kv['pisa-consent-v1'] = consent;
    }

    // pisastyle.contrib.draft.*
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pisastyle.contrib.draft.')) {
        const val = localStorage.getItem(key);
        if (val !== null) {
          data.kv[key] = val;
        }
      }
    }
  }

  return data;
}

export function buildJson(data: UserData): string {
  return JSON.stringify(data, null, 2);
}

function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''");
}

function checkIdentifier(id: string) {
  if (!/^[A-Za-z0-9_]+$/.test(id)) {
    throw new Error(`Invalid identifier: ${id}`);
  }
}

export function buildSqlDump(data: UserData): string {
  const lines: string[] = [];
  lines.push('PRAGMA foreign_keys=OFF;');
  lines.push('BEGIN;');

  // _export_meta table
  lines.push(`CREATE TABLE IF NOT EXISTS "_export_meta" (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  lines.push(`INSERT INTO "_export_meta" (key, value) VALUES ('format', '${escapeSqlString(data.meta.format)}');`);
  lines.push(`INSERT INTO "_export_meta" (key, value) VALUES ('app_id', '${escapeSqlString(data.meta.appId)}');`);
  lines.push(`INSERT INTO "_export_meta" (key, value) VALUES ('exported_at', '${escapeSqlString(data.meta.exportedAt)}');`);
  lines.push(`INSERT INTO "_export_meta" (key, value) VALUES ('schema_version', '${escapeSqlString(data.meta.schemaVersion)}');`);

  // _kv table
  lines.push(`CREATE TABLE IF NOT EXISTS "_kv" (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  for (const [k, v] of Object.entries(data.kv)) {
    lines.push(`INSERT INTO "_kv" (key, value) VALUES ('${escapeSqlString(k)}', '${escapeSqlString(v)}');`);
  }

  // Entities tables
  for (const [entityName, records] of Object.entries(data.entities)) {
    checkIdentifier(entityName);
    lines.push(`CREATE TABLE IF NOT EXISTS "${entityName}" (id TEXT PRIMARY KEY, instance_id TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT, data TEXT NOT NULL);`);

    for (const record of records) {
      const id = escapeSqlString(record.id);
      const instanceId = escapeSqlString(record.instance_id || '');
      const createdAt = escapeSqlString(record.created_at || '');
      const updatedAt = escapeSqlString(record.updated_at || '');
      // 'deleted_at' no existe en DomainRecord por defecto, pero se pide en el contrato que se exporte.
      // Si la app soportara soft-delete tendria este campo.
      const deletedAt = escapeSqlString((record as any).deleted_at || '');
      const dataJson = escapeSqlString(JSON.stringify(record));

      lines.push(`INSERT INTO "${entityName}" (id, instance_id, created_at, updated_at, deleted_at, data) VALUES ('${id}', '${instanceId}', '${createdAt}', '${updatedAt}', '${deletedAt ? deletedAt : ''}', '${dataJson}');`);
    }
  }

  lines.push('COMMIT;');
  return lines.join('\n');
}

export async function downloadMyData(kind: 'json' | 'sql') {
  if (typeof document === 'undefined') return;

  const data = await collectAllUserData();
  let content = '';
  let mime = '';
  let ext = '';

  if (kind === 'json') {
    content = buildJson(data);
    mime = 'application/json;charset=utf-8';
    ext = 'json';
  } else if (kind === 'sql') {
    content = buildSqlDump(data);
    mime = 'application/sql;charset=utf-8';
    ext = 'sql';
  }

  const blob = new Blob([content], { type: mime });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.download = `pisastyle-export-${ts}.${ext}`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
