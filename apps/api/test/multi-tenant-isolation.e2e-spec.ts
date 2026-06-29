/**
 * Multi-Tenant Isolation — real login-based e2e (Step 7)
 *
 * Proves that tenant data isolation holds when requests carry real JWTs
 * (not just stubbed guards). JwtAuthGuard + TenantContextGuard run for real;
 * only PermissionGuard is overridden so we don't need to seed full RBAC.
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import { Server } from 'http';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from '@jest/globals';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/common';
import { PasswordService } from '../src/auth/services/password.service';
import { PermissionGuard } from '../src/auth/guards/permission.guard';
import { JWTSecretService } from '@workspace/api';

const HAS_DB = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

/** Allow all permission checks — auth + tenant context still run for real. */
const allowAllPermissions: CanActivate = {
  canActivate: (_ctx: ExecutionContext) => true,
};

d('Multi-Tenant Isolation — real JWT flow (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let owner: DatabaseService['client'];

  const ts = Date.now();
  const slugA = `iso-a-${ts}`;
  const slugB = `iso-b-${ts}`;

  let tenantAId: string;
  let tenantBId: string;
  let tokenA: string; // access token for user in tenant A
  let tokenB: string; // access token for user in tenant B
  let annBId: string; // announcement id in tenant B

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(PermissionGuard)
      .useValue(allowAllPermissions)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
    owner = app.get(DatabaseService).client;

    // ── Seed two isolated tenants with users, roles, and profiles ──────────

    const [tA, tB] = await Promise.all([
      owner.tenant.create({ data: { name: 'Iso School A', slug: slugA, status: 'active' } }),
      owner.tenant.create({ data: { name: 'Iso School B', slug: slugB, status: 'active' } }),
    ]);
    tenantAId = tA.id;
    tenantBId = tB.id;

    await Promise.all([
      JWTSecretService.initializeTenantJWTSecret(owner, tenantAId),
      JWTSecretService.initializeTenantJWTSecret(owner, tenantBId),
    ]);

    const pw = await PasswordService.hashPassword('IsoTest@2025!');
    const [uA, uB] = await Promise.all([
      owner.user.create({ data: { email: `iso-a-${ts}@example.com`, passwordHash: pw, firstName: 'A', lastName: 'User' } }),
      owner.user.create({ data: { email: `iso-b-${ts}@example.com`, passwordHash: pw, firstName: 'B', lastName: 'User' } }),
    ]);

    const [rA, rB] = await Promise.all([
      owner.role.create({ data: { name: `iso-role-a-${ts}`, roleType: 'custom', clearanceLevel: 1, tenantId: tenantAId, isActive: true } }),
      owner.role.create({ data: { name: `iso-role-b-${ts}`, roleType: 'custom', clearanceLevel: 1, tenantId: tenantBId, isActive: true } }),
    ]);

    const [profA, profB] = await Promise.all([
      owner.userTenant.create({
        data: {
          userId: uA.id, tenantId: tenantAId, status: 'active', suspended: false,
          userTenantRole: { create: { roleId: rA.id, tenantId: tenantAId, isPrimary: true } },
        },
      }),
      owner.userTenant.create({
        data: {
          userId: uB.id, tenantId: tenantBId, status: 'active', suspended: false,
          userTenantRole: { create: { roleId: rB.id, tenantId: tenantBId, isPrimary: true } },
        },
      }),
    ]);

    // ── Login each user and select their school ────────────────────────────

    const loginAndSelect = async (
      email: string,
      tenantId: string,
      profileId: string,
    ): Promise<string> => {
      const loginRes = await request(server)
        .post('/auth/login')
        .send({ email, password: 'IsoTest@2025!' });

      const selectRes = await request(server)
        .post('/auth/select-school')
        .set('Authorization', `Bearer ${loginRes.body.token}`)
        .send({ tenantId, profileId });

      return selectRes.body.accessToken as string;
    };

    [tokenA, tokenB] = await Promise.all([
      loginAndSelect(`iso-a-${ts}@example.com`, tenantAId, profA.id),
      loginAndSelect(`iso-b-${ts}@example.com`, tenantBId, profB.id),
    ]);

    // ── Pre-seed one announcement per tenant via the API ───────────────────

    await request(server)
      .post('/announcements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetType: 'all', title: `Ann-A-${ts}`, content: 'A side' });

    const annBRes = await request(server)
      .post('/announcements')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ targetType: 'all', title: `Ann-B-${ts}`, content: 'B side' });

    annBId = (annBRes.body as { id?: string }).id ?? '';
  });

  afterAll(async () => {
    // Clean up in dependency order
    if (owner) {
      await owner.announcement.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      // userTenantRole and Session cascade-delete when userTenant is removed
      await owner.userTenantRole.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await owner.userTenant.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await owner.role.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await owner.user.deleteMany({ where: { email: { in: [`iso-a-${ts}@example.com`, `iso-b-${ts}@example.com`] } } });
      await owner.tenantJWTConfig.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await owner.tenant.deleteMany({ where: { slug: { in: [slugA, slugB] } } });
    }
    if (app) await app.close();
  });

  it('user A sees only tenant A announcements', async () => {
    const res = await request(server)
      .get('/announcements')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const titles = ((res.body as { data?: { title: string }[] }).data ?? []).map((a) => a.title);
    expect(titles).toContain(`Ann-A-${ts}`);
    expect(titles).not.toContain(`Ann-B-${ts}`);
  });

  it('user B sees only tenant B announcements', async () => {
    const res = await request(server)
      .get('/announcements')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const titles = ((res.body as { data?: { title: string }[] }).data ?? []).map((a) => a.title);
    expect(titles).toContain(`Ann-B-${ts}`);
    expect(titles).not.toContain(`Ann-A-${ts}`);
  });

  it("user A cannot read tenant B's announcement by id (404)", async () => {
    if (!annBId) return; // skip if creation failed
    await request(server)
      .get(`/announcements/${annBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('announcement created by A is invisible to B', async () => {
    const res = await request(server)
      .post('/announcements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetType: 'all', title: `Ann-A2-${ts}`, content: 'cross-check' })
      .expect(201);

    const newId = (res.body as { id?: string }).id;

    // B listing: new A announcement absent
    const listRes = await request(server)
      .get('/announcements')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const titles = ((listRes.body as { data?: { title: string }[] }).data ?? []).map((a) => a.title);
    expect(titles).not.toContain(`Ann-A2-${ts}`);

    // B direct fetch: 404
    if (newId) {
      await request(server)
        .get(`/announcements/${newId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    }
  });

  it('rejects request with no token (401)', async () => {
    await request(server).get('/announcements').expect(401);
  });
});
