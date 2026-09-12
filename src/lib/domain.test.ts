import { describe, it, expect, beforeEach } from 'vitest';
import { createEntity, listEntities, getEntity, updateEntity, deleteEntity, surrealDefineTable, getMemoryAdapter, setStorageAdapter } from './domain';

describe('domain CRUD + instance isolation', () => {
  beforeEach(() => {
    getMemoryAdapter().clear();
    setStorageAdapter(getMemoryAdapter());
  });

  it('create + list filtra por instance_id', async () => {
    const a = await createEntity('pisa_unit', { name: 'A' }, 'inst1');
    await createEntity('pisa_unit', { name: 'B' }, 'inst2');
    expect(a.instance_id).toBe('inst1');
    const l1 = await listEntities('pisa_unit', 'inst1');
    const l2 = await listEntities('pisa_unit', 'inst2');
    expect(l1).toHaveLength(1);
    expect(l2).toHaveLength(1);
    expect(l1[0].id).toBe(a.id);
  });

  it('get respeta instance_id', async () => {
    const r = await createEntity('exam_attempt', { itemId: 'x' }, 'inst1');
    expect(await getEntity('exam_attempt', r.id, 'inst1')).not.toBeNull();
    expect(await getEntity('exam_attempt', r.id, 'inst2')).toBeNull();
  });

  it('update + delete', async () => {
    const r = await createEntity('pisa_unit', { name: 'old' }, 'inst1');
    const upd = await updateEntity('pisa_unit', r.id, { name: 'new' } as any, 'inst1');
    expect(upd?.name).toBe('new');
    expect(await deleteEntity('pisa_unit', r.id, 'inst1')).toBe(true);
    expect(await getEntity('pisa_unit', r.id, 'inst1')).toBeNull();
  });

  it('rechaza entity no whitelisteada', async () => {
    await expect(createEntity('evil' as any, {} as any)).rejects.toThrow(/no whitelisteada/);
  });

  it('surrealDefineTable genera DDL con instance_id index', () => {
    const ddl = surrealDefineTable('pisa_unit');
    expect(ddl).toContain('DEFINE TABLE pisa_unit');
    expect(ddl).toContain('instance_id');
    expect(ddl).toContain('DEFINE INDEX pisa_unit_instance_idx');
  });

  it('default instance_id usa domain.config', async () => {
    const r = await createEntity('pisa_unit', { name: 'def' });
    expect(r.instance_id).toBe('default');
  });
});
