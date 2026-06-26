/**
 * RLS runtime cutover — vertical-slice proof (ADR-004 Step 1).
 *
 * Boots the real AppModule and exercises the new TenantDbService, whose
 * `app_runtime` client (non-superuser, non-BYPASSRLS) enforces tenant isolation
 * via Postgres RLS. Proves the *DI-wired runtime path*, not just raw SQL:
 *   - runScoped(A) sees only tenant A's rows
 *   - the scoped client throws outside a scope (no silent un-scoped query)
 *   - a cross-tenant write is rejected by the WITH CHECK policy
 *   - runPlatform() (audited bypass) sees all tenants
 *
 * Requires APP_RUNTIME_DATABASE_URL (the restricted role). Skips otherwise —
 * without it the tenant client falls back to the privileged role and RLS is
 * bypassed (pre-cutover), so the assertions would be meaningless.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { DatabaseService, TenantDbService } from '../src/common';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('RLS runtime cutover (vertical slice)', () => {
  let app: INestApplication;
  let owner: DatabaseService['client'];
  let tenantDb: TenantDbService;
  const A = `rlsslice-a-${Date.now()}`;
  const B = `rlsslice-b-${Date.now()}`;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = app.get(DatabaseService).client;
    tenantDb = app.get(TenantDbService);

    // Seed two tenants + one announcement each, as the privileged owner.
    const ta = await owner.tenant.create({ data: { name: 'RLS Slice A', slug: A, status: 'active' } });
    const tb = await owner.tenant.create({ data: { name: 'RLS Slice B', slug: B, status: 'active' } });
    tenantAId = ta.id;
    tenantBId = tb.id;
    await owner.announcement.createMany({
      data: [
        { tenantId: tenantAId, targetType: 'all', title: 'SLICE-A', content: 'x' },
        { tenantId: tenantBId, targetType: 'all', title: 'SLICE-B', content: 'y' },
      ],
    });
  });

  afterAll(async () => {
    if (owner) {
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
    }
    if (app) await app.close();
  });

  it('runScoped(tenant A) sees only tenant A rows', async () => {
    const rows = await tenantDb.runScoped(tenantAId, undefined, () =>
      tenantDb.client.announcement.findMany({
        where: { title: { in: ['SLICE-A', 'SLICE-B'] } },
      }),
    );
    expect(rows.map((r) => r.title)).toEqual(['SLICE-A']);
  });

  it('runScoped(tenant B) sees only tenant B rows', async () => {
    const rows = await tenantDb.runScoped(tenantBId, undefined, () =>
      tenantDb.client.announcement.findMany({
        where: { title: { in: ['SLICE-A', 'SLICE-B'] } },
      }),
    );
    expect(rows.map((r) => r.title)).toEqual(['SLICE-B']);
  });

  it('the scoped client throws when used outside a scope', () => {
    expect(() => tenantDb.client).toThrow(/outside an RLS scope/);
  });

  it('rejects a cross-tenant write (WITH CHECK)', async () => {
    await expect(
      tenantDb.runScoped(tenantAId, undefined, () =>
        tenantDb.client.announcement.create({
          data: { tenantId: tenantBId, targetType: 'all', title: 'SLICE-EVIL', content: 'z' },
        }),
      ),
    ).rejects.toThrow();
  });

  it('a cross-tenant updateMany affects 0 rows', async () => {
    const res = await tenantDb.runScoped(tenantAId, undefined, () =>
      tenantDb.client.announcement.updateMany({
        where: { title: 'SLICE-B' },
        data: { content: 'hacked' },
      }),
    );
    expect(res.count).toBe(0);
  });

  it('runPlatform() (audited bypass) sees all tenants', async () => {
    const rows = await tenantDb.runPlatform(undefined, () =>
      tenantDb.client.announcement.findMany({
        where: { title: { in: ['SLICE-A', 'SLICE-B'] } },
      }),
    );
    expect(rows.map((r) => r.title).sort()).toEqual(['SLICE-A', 'SLICE-B']);
  });
});
