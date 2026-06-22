import { applyTenantScope, STRICT_TENANT_MODELS } from './tenant-prisma.extension';

const TENANT = 'tenant-a';
const scope = (operation: string, model: string | undefined, args: unknown) =>
  applyTenantScope({ operation, model, args, tenantId: TENANT }) as Record<
    string,
    unknown
  >;

describe('applyTenantScope', () => {
  it('leaves non-tenant-scoped models untouched', () => {
    const args = { where: { id: '1' } };
    expect(scope('findMany', 'User', args)).toBe(args);
  });

  it('leaves operations on an undefined model untouched', () => {
    const args = { where: { id: '1' } };
    expect(scope('findMany', undefined, args)).toBe(args);
  });

  it('adds tenantId to the where clause for filter reads', () => {
    const out = scope('findMany', 'Student', { where: { status: 'active' } });
    expect(out.where).toEqual({ status: 'active', tenantId: TENANT });
  });

  it('adds a where clause when none was supplied', () => {
    const out = scope('count', 'Student', {});
    expect(out.where).toEqual({ tenantId: TENANT });
  });

  it('scopes updateMany and deleteMany by tenantId', () => {
    expect(scope('updateMany', 'Message', { where: { read: false } }).where).toEqual(
      { read: false, tenantId: TENANT },
    );
    expect(scope('deleteMany', 'Message', {}).where).toEqual({
      tenantId: TENANT,
    });
  });

  it('injects tenantId into create data', () => {
    const out = scope('create', 'Course', { data: { code: 'M101' } });
    expect(out.data).toEqual({ code: 'M101', tenantId: TENANT });
  });

  it('injects tenantId into every row of createMany', () => {
    const out = scope('createMany', 'Course', {
      data: [{ code: 'A' }, { code: 'B' }],
    });
    expect(out.data).toEqual([
      { code: 'A', tenantId: TENANT },
      { code: 'B', tenantId: TENANT },
    ]);
  });

  it('owns the created row of an upsert but leaves the (unique) where', () => {
    const out = scope('upsert', 'Course', {
      where: { id: 'x' },
      create: { code: 'A' },
      update: { code: 'A2' },
    });
    expect(out.create).toEqual({ code: 'A', tenantId: TENANT });
    expect(out.where).toEqual({ id: 'x' }); // unique where untouched
  });

  it('does NOT scope single update/delete/findUnique (unique where — RLS enforces)', () => {
    // these must pass through unchanged; tenantId cannot go in a unique where
    expect(scope('update', 'Student', { where: { id: '1' }, data: { x: 1 } })).toEqual(
      { where: { id: '1' }, data: { x: 1 } },
    );
    expect(scope('delete', 'Student', { where: { id: '1' } })).toEqual({
      where: { id: '1' },
    });
    expect(scope('findUnique', 'Student', { where: { id: '1' } })).toEqual({
      where: { id: '1' },
    });
  });

  it("respects a caller's explicit tenantId in the where clause", () => {
    const args = { where: { tenantId: 'other', id: '1' } };
    expect(scope('findMany', 'Student', args)).toBe(args);
  });

  it('exposes the strict tenant model set (non-empty, excludes global models)', () => {
    expect(STRICT_TENANT_MODELS.size).toBeGreaterThan(0);
    expect(STRICT_TENANT_MODELS.has('User' as never)).toBe(false);
    expect(STRICT_TENANT_MODELS.has('Role' as never)).toBe(false); // nullable tenant
    expect(STRICT_TENANT_MODELS.has('Student')).toBe(true);
  });
});
