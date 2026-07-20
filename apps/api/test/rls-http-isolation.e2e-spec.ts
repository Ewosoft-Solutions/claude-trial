/**
 * RLS runtime cutover — HTTP-level proof (ADR-004 Step 1).
 *
 * Drives real HTTP requests through the real global RlsTenantInterceptor and the
 * migrated CommunicationService (which uses TenantDbService.client) against the
 * `app_runtime` connection. The auth guards are stubbed (authn/authz is
 * orthogonal to tenant data isolation) so a request can act as tenant A or B via
 * an X-Test-Tenant header. Proves a request for tenant A cannot read tenant B.
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise (the tenant client would
 * fall back to the privileged role and RLS would be bypassed).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { Server } from 'http';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/common';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../src/auth/guards/tenant-context.guard';
import { PermissionGuard } from '../src/auth/guards/permission.guard';

/** Stub guard: sets request.user from the X-Test-Tenant header. */
const headerTenantGuard: CanActivate = {
  canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const tenantId = req.headers['x-test-tenant'];
    req.user = {
      userId: 'test-user',
      tenantId,
      profileId: 'test-profile',
      roleId: 'test-role',
    };
    return true;
  },
};

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('RLS HTTP isolation (vertical slice)', () => {
  let app: INestApplication;
  let server: Server;
  let owner: DatabaseService['client'];
  const slugA = `rlshttp-a-${Date.now()}`;
  const slugB = `rlshttp-b-${Date.now()}`;
  let A: string;
  let B: string;
  let annBId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(headerTenantGuard)
      .overrideGuard(TenantContextGuard)
      .useValue(headerTenantGuard)
      .overrideGuard(PermissionGuard)
      .useValue(headerTenantGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
    owner = app.get(DatabaseService).client;

    const ta = await owner.tenant.create({ data: { name: 'A', slug: slugA, status: 'active' } });
    const tb = await owner.tenant.create({ data: { name: 'B', slug: slugB, status: 'active' } });
    A = ta.id;
    B = tb.id;
    await owner.announcement.create({
      data: { tenantId: A, targetType: 'all', title: 'HTTP-A', content: 'x' },
    });
    const annB = await owner.announcement.create({
      data: { tenantId: B, targetType: 'all', title: 'HTTP-B', content: 'y' },
    });
    annBId = annB.id;
  });

  afterAll(async () => {
    if (owner) await owner.tenant.deleteMany({ where: { slug: { in: [slugA, slugB] } } });
    if (app) await app.close();
  });

  const titles = (body: { data?: { title: string }[] }) =>
    (body.data ?? []).map((a) => a.title);

  it('GET /announcements returns only the caller tenant rows (A)', async () => {
    const res = await request(server)
      .get('/announcements')
      .set('X-Test-Tenant', A)
      .expect(200);
    expect(titles(res.body)).toContain('HTTP-A');
    expect(titles(res.body)).not.toContain('HTTP-B');
  });

  it('GET /announcements returns only the caller tenant rows (B)', async () => {
    const res = await request(server)
      .get('/announcements')
      .set('X-Test-Tenant', B)
      .expect(200);
    expect(titles(res.body)).toContain('HTTP-B');
    expect(titles(res.body)).not.toContain('HTTP-A');
  });

  it("tenant A cannot read tenant B's announcement by id (404)", async () => {
    await request(server)
      .get(`/announcements/${annBId}`)
      .set('X-Test-Tenant', A)
      .expect(404);
  });

  it('a tenant A request that creates is owned by A and invisible to B', async () => {
    await request(server)
      .post('/announcements')
      .set('X-Test-Tenant', A)
      .send({ targetType: 'all', title: 'HTTP-A2', content: 'z' })
      .expect(201);

    const asB = await request(server)
      .get('/announcements')
      .set('X-Test-Tenant', B)
      .expect(200);
    expect(titles(asB.body)).not.toContain('HTTP-A2');
  });

  it('a second migrated module (/academic-years) is also tenant-isolated', async () => {
    await owner.academicYear.createMany({
      data: [
        { tenantId: A, name: 'AY-A', startDate: new Date(), endDate: new Date() },
        { tenantId: B, name: 'AY-B', startDate: new Date(), endDate: new Date() },
      ],
    });
    const asA = await request(server)
      .get('/academic-years')
      .set('X-Test-Tenant', A)
      .expect(200);
    const names = (asA.body as { name: string }[]).map((y) => y.name);
    expect(names).toContain('AY-A');
    expect(names).not.toContain('AY-B');
  });
});
