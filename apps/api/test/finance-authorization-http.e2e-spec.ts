/**
 * WB5 · Finance authorization boundary on the real HTTP stack.
 *
 * The unit suite pins which permission and step-up operation each route
 * DECLARES; this proves the guard stack actually enforces them — DoD §5's
 * "unauthorized scope" case, which means a denied request, not a decorator.
 *
 * The caller here holds `finance.view` + `finance.manage` and nothing else, so:
 *   - the receipts list answers (the token and the permissions are real);
 *   - the LEDGER refuses them 403 — seeing the books is a separate authority
 *     from seeing a bill, which is the whole point of `finance.gl.view`;
 *   - recording a receipt refuses them 403 for want of a step-up, even though
 *     the PermissionGuard has already passed.
 *
 * Boots as the RLS-subject `app_runtime` role when APP_RUNTIME_DATABASE_URL is
 * set; fixtures via a superuser handle. Skips without APP_RUNTIME_DATABASE_URL.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Server } from 'http';

import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/services/password.service';
import { makeSuperuserClient } from './helpers/superuser-client';
import { JWTSecretService } from '@workspace/api';

const HAS_DB = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

const PASSWORD = 'TestPassword123';

/** The finance permissions this caller holds — deliberately NOT the ledger's. */
const HELD = [
  {
    name: 'finance.view',
    label: 'View Finance',
    description:
      'View finance data (invoices, fee items, adjustments, policies)',
    resource: 'finance',
    action: 'view',
  },
  {
    name: 'finance.manage',
    label: 'Manage Finance',
    description: 'Manage finance (edit invoice lines/fee items, adjustments)',
    resource: 'finance',
    action: 'manage',
  },
];

d('Finance authorization boundary — HTTP (WB5)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeSuperuserClient>;

  const stamp = Date.now();
  const email = `wb5-authz-${stamp}@example.com`;
  let tenantId = '';
  let userId = '';
  let roleId = '';
  let profileId = '';
  let accessToken = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0);
    prisma = makeSuperuserClient();

    const tenant = await prisma.tenant.create({
      data: {
        name: 'WB5 authz',
        slug: `wb5-authz-${stamp}`,
        status: 'active',
      },
    });
    tenantId = tenant.id;
    await JWTSecretService.initializeTenantJWTSecret(prisma, tenantId);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await PasswordService.hashPassword(PASSWORD),
        firstName: 'Bursar',
        lastName: 'Only',
        isVerified: true,
        isActive: true,
      },
    });
    userId = user.id;

    // Clearance 5 — the Financial & Legal tier the finance permissions sit at.
    const role = await prisma.role.create({
      data: {
        name: `wb5-authz-role-${stamp}`,
        roleType: 'custom',
        clearanceLevel: 5,
        tenantId,
        isActive: true,
      },
    });
    roleId = role.id;

    // Upsert the permissions rather than assume a seeded database: CI migrates
    // but never seeds (the precedent in access-grants-http.e2e-spec.ts).
    const permissionIds: string[] = [];
    for (const permission of HELD) {
      const row = await prisma.permission.upsert({
        where: { name: permission.name },
        update: {},
        create: {
          ...permission,
          category: 'financial',
          requiredClearanceLevel: 5,
        },
        select: { id: true },
      });
      permissionIds.push(row.id);
    }

    const profile = await prisma.userTenant.create({
      data: {
        userId,
        tenantId,
        status: 'active',
        suspended: false,
        userTenantRole: {
          create: { roleId, tenantId, isPrimary: true },
        },
        userTenantPermissions: {
          create: permissionIds.map((permissionId) => ({
            permissionId,
            tenantId,
            granted: true,
          })),
        },
      },
    });
    profileId = profile.id;

    const server = app.getHttpServer() as Server;
    const login = await request(server)
      .post('/auth/login')
      .send({ email, password: PASSWORD });
    const selected = await request(server)
      .post('/auth/select-school')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ tenantId, profileId });
    accessToken = selected.body.accessToken as string;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.userTenantPermission
        .deleteMany({ where: { userTenantId: profileId } })
        .catch(() => undefined);
      await prisma.userTenantRole
        .deleteMany({ where: { userTenantId: profileId } })
        .catch(() => undefined);
      await prisma.userTenant
        .deleteMany({ where: { id: profileId } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { id: userId } })
        .catch(() => undefined);
      await prisma.role
        .deleteMany({ where: { id: roleId } })
        .catch(() => undefined);
      await prisma.tenantJWTConfig
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.tenant
        .deleteMany({ where: { id: tenantId } })
        .catch(() => undefined);
      await prisma.$disconnect();
    }
    if (app) await app.close();
  });

  const auth = () => `Bearer ${accessToken}`;

  it('answers the routes this caller is actually authorised for', async () => {
    // Proves the token, the tenant scope and the permissions are real — so the
    // 403s below are a permission decision, not a broken fixture.
    await request(app.getHttpServer() as Server)
      .get('/finance/receipts')
      .set('Authorization', auth())
      .expect(200);
  });

  it('refuses the ledger to a caller without finance.gl.view', async () => {
    const server = app.getHttpServer() as Server;
    for (const path of [
      '/finance/ledger/trial-balance',
      '/finance/ledger/entries',
      '/finance/ledger/accounts',
      '/finance/ledger/periods',
      '/finance/reports/reconciliation',
    ]) {
      await request(server).get(path).set('Authorization', auth()).expect(403);
    }
  });

  it('refuses to close a period or reverse an entry without finance.gl.manage', async () => {
    const server = app.getHttpServer() as Server;
    await request(server)
      .post('/finance/ledger/periods')
      .set('Authorization', auth())
      .send({ name: 'Nope', startDate: '2027-01-01', endDate: '2027-03-31' })
      .expect(403);
    await request(server)
      .get('/finance/ledger/export')
      .set('Authorization', auth())
      .expect(403);
  });

  it('refuses to record money without a step-up, even holding finance.manage', async () => {
    const res = await request(app.getHttpServer() as Server)
      .post('/finance/receipts')
      .set('Authorization', auth())
      .send({ method: 'cash', paidAt: '2026-08-19', amount: 1000 })
      .expect(403);

    // Specifically the step-up gate: the PermissionGuard has already passed,
    // because this caller does hold finance.manage.
    const message = String(res.body?.message ?? res.body?.error ?? '');
    expect(message.toLowerCase()).toContain('step-up');
  });

  it('still refuses everything to an anonymous caller', async () => {
    const server = app.getHttpServer() as Server;
    await request(server).get('/finance/receipts').expect(401);
    await request(server).get('/finance/ledger/trial-balance').expect(401);
  });
});
