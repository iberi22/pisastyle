import { getStorageAdapter, isApprovedLocalAdapter, type StorageAdapter, type DomainRecord } from './domain';
import { domainConfig } from './domain.config';



export type ExportData = {
  entities: Record<string, DomainRecord[]>;
  kv: Record<string, string>;
};

// 2. Data collection
export async function collectAllUserData(adapter: StorageAdapter = getStorageAdapter()): Promise<ExportData> {
  if (!isApprovedLocalAdapter(adapter)) {
    throw new Error('Export blocked: adapter is not the allowed local StorageAdapter.');
  }

  const data: ExportData = {
    entities: {},
    kv: {},
  };

  // Collect entities
  const instanceId = domainConfig.instanceId as string;
  for (const entityDef of domainConfig.entities) {
    const entityName = entityDef.name;
    const records = await adapter.list(entityName, instanceId);
    data.entities[entityName] = records;
  }

  // Collect localStorage keys (DRAFT_KEY and consent)
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const pisaConsent = localStorage.getItem('pisa-consent-v1');
    if (pisaConsent !== null) {
      data.kv['pisa-consent-v1'] = pisaConsent;
    }

    // Grab all drafts
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pisastyle.contrib.draft.')) {
        const val = localStorage.getItem(key);
        if (val) data.kv[key] = val;
      }
    }
  }

  return data;
}

// 3. Builders
export function buildJson(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

export function buildSqlDump(data: ExportData): string {
  const lines: string[] = [];
  lines.push('PRAGMA foreign_keys=OFF;');
  lines.push('BEGIN;');

  // _export_meta
  lines.push(
    `CREATE TABLE IF NOT EXISTS "_export_meta" (key TEXT PRIMARY KEY, value TEXT NOT NULL);`
  );
  lines.push(
    `INSERT OR REPLACE INTO "_export_meta" (key, value) VALUES ('format', 'swal_export_v1');`
  );
  lines.push(
    `INSERT OR REPLACE INTO "_export_meta" (key, value) VALUES ('app_id', '${domainConfig.appId}');`
  );
  lines.push(
    `INSERT OR REPLACE INTO "_export_meta" (key, value) VALUES ('exported_at', '${new Date().toISOString()}');`
  );

  // _kv
  lines.push(`CREATE TABLE IF NOT EXISTS "_kv" (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  for (const [key, value] of Object.entries(data.kv)) {
    lines.push(
      `INSERT OR REPLACE INTO "_kv" (key, value) VALUES (${escapeSqlString(key)}, ${escapeSqlString(value)});`
    );
  }

  // Entities
  const idRegex = /^[A-Za-z0-9_]+$/;

  for (const entityDef of domainConfig.entities) {
    const entityName = entityDef.name;
    if (!idRegex.test(entityName)) {
      throw new Error(`Invalid entity name for SQL dump: ${entityName}`);
    }

    lines.push(
      `CREATE TABLE IF NOT EXISTS "${entityName}" (id TEXT PRIMARY KEY, instance_id TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT, data TEXT NOT NULL);`
    );

    const records = data.entities[entityName] || [];
    for (const record of records) {
      const id = record.id;
      const instanceId = record.instance_id || domainConfig.instanceId;
      const createdAt = record.created_at || new Date().toISOString();
      const updatedAt = record.updated_at || new Date().toISOString();
      // DomainRecord does not have deleted_at natively right now, but we export it if it exists.
      const deletedAt = (record as any).deleted_at || null;
      const dataJson = JSON.stringify(record);

      lines.push(
        `INSERT INTO "${entityName}" (id, instance_id, created_at, updated_at, deleted_at, data) VALUES (${escapeSqlString(id)}, ${escapeSqlString(instanceId)}, ${escapeSqlString(createdAt)}, ${escapeSqlString(updatedAt)}, ${deletedAt ? escapeSqlString(deletedAt) : 'NULL'}, ${escapeSqlString(dataJson)});`
      );
    }
  }

  lines.push('COMMIT;');
  return lines.join('\n');
}

function escapeSqlString(str: string): string {
  return `'${str.replace(/'/g, "''")}'`;
}

// 4. Download
export async function downloadMyData(kind: 'json' | 'sql') {
  if (typeof window === 'undefined') return;

  const data = await collectAllUserData();
  let content = '';
  let mimeType = '';
  let ext = '';

  if (kind === 'json') {
    content = buildJson(data);
    mimeType = 'application/json';
    ext = 'json';
  } else if (kind === 'sql') {
    content = buildSqlDump(data);
    mimeType = 'application/sql';
    ext = 'sql';
  } else {
    throw new Error('Unsupported format');
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pisastyle_export_${new Date().toISOString().slice(0, 10)}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
