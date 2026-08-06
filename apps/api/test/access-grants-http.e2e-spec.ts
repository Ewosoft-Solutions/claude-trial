/**
 * Access-grant HTTP guard boundary (WB1-6 follow-up) — proves the step-up gate
 * on the real HTTP stack.
 *
 * The WB1-6 review found the web panel couldn't complete a grant because the
 * endpoint (correctly) requires an MFA step-up (`users.role.assign`) the UI
 * never performed — and no test exercised that leg through the guards, so it
 * shipped. This closes that gap: an AUTHENTICATED caller who holds
 * `access.grants.manage` but sends no (or a forged) step-up challenge is
 * rejected with 403 by the StepUpGuard — the PermissionGuard has already passed,
 * so the 403 is specifically the step-up, not a permission miss.
 *
 * Boots as the RLS-subject `app_runtime` role when APP_RUNTIME_DATABASE_URL is
 * set; fixtures via a superuser handle. Skips without APP_RUNTIME_DATABASE_URL.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { Server } from 'http';

import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/services/password.service';
import { makeSuperuserClient } from './helpers/superuser-client';
import { JWTSecretService } from '@workspace/api';

const HAS_DB = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

const PASSWORD = 'TestPassword123';

d('Access-grant HTTP guard boundary — step-up (WB1-6)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeSuperuserClient>;

  let email = '';
  let tenant: { id: string } | null = null;
  let user: { id: string } | null = null;
  let role: { id: string } | null = null;
  let profile: { id: string } | null = null;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0);
    prisma = makeSuperuserClient();
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
  });

  beforeEach(async () => {
    const ts = Date.now();
    email = `test-grant-http-${ts}@example.com`;

    tenant = await prisma.tenant.create({
      data: { name: 'Grant HTTP E2E', slug: `grant-http-${ts}`, status: 'active' },
    });
    await JWTSecretService.initializeTenantJWTSecret(prisma, tenant.id);

    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await PasswordService.hashPassword(PASSWORD),
        firstName: 'Grant',
        lastName: 'Admin',
        isVerified: true,
        isActive: true,
      },
    });

    // Clearance 7 so the access.grants.manage permission's clearance floor is met.
    role = await prisma.role.create({
      data: {
        name: `grant-http-role-${ts}`,
        roleType: 'custom',
        clearanceLevel: 7,
        tenantId: tenant.id,
        isActive: true,
      },
    });

    // The caller must HOLD access.grants.manage so the PermissionGuard passes and
    // the 403 we assert is the StepUpGuard, not a permission miss. Grant it as a
    // profile-level permission override (no pool wiring needed).
    const grantPerm = await prisma.permission.findUnique({
      where: { name: 'access.grants.manage' },
      select: { id: true },
    });
    if (!grantPerm) {
      throw new Error(
        'access.grants.manage not seeded — run pnpm db:seed before this e2e.',
      );
    }

    profile = await prisma.userTenant.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        status: 'active',
        suspended: false,
        userTenantRole: {
          create: { roleId: role.id, tenantId: tenant.id, isPrimary: true },
        },
        userTenantPermissions: {
          create: { permissionId: grantPerm.id, tenantId: tenant.id, granted: true },
        },
      },
    });
  });

  afterEach(async () => {
    if (profile) {
      await prisma.userTenantPermission.deleteMany({
        where: { userTenantId: profile.id },
      });
      await prisma.userTenantRole.deleteMany({
        where: { userTenantId: profile.id },
      });
      await prisma.userTenant.deleteMany({ where: { id: profile.id } });
      profile = null;
    }
    if (user) {
      await prisma.user.deleteMany({ where: { id: user.id } });
      user = null;
    }
    if (role) {
      await prisma.role.deleteMany({ where: { id: role.id } });
      role = null;
    }
    if (tenant) {
      await prisma.tenantJWTConfig.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenant.deleteMany({ where: { id: tenant.id } });
      tenant = null;
    }
  });

  /** login → select-school → the issued access token. */
  async function getAccessToken(): Promise<string> {
    const loginRes = await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({ email, password: PASSWORD });
    const selectRes = await request(app.getHttpServer() as Server)
      .post('/auth/select-school')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ tenantId: tenant!.id, profileId: profile!.id });
    return selectRes.body.accessToken as string;
  }

  it('rejects a grant WITHOUT a step-up challenge (403 step-up required)', async () => {
    const accessToken = await getAccessToken();

    const res = await request(app.getHttpServer() as Server)
      .post('/access/grants')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ profileId: profile!.id, roleId: role!.id })
      .expect(403);

    // Confirms it is the STEP-UP guard (not a permission miss): the caller holds
    // access.grants.manage, so PermissionGuard passed.
    const message = String(res.body?.message ?? res.body?.error ?? '');
    expect(message.toLowerCase()).toContain('step-up');
  });

  it('rejects a FORGED step-up challenge (403 — server-verified, not trusted)', async () => {
    const accessToken = await getAccessToken();

    await request(app.getHttpServer() as Server)
      .post('/access/grants')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        profileId: profile!.id,
        roleId: role!.id,
        stepUpChallengeId: 'not-a-real-challenge',
      })
      .expect(403);
  });

  it('rejects an unauthenticated grant (401)', async () => {
    await request(app.getHttpServer() as Server)
      .post('/access/grants')
      .send({ profileId: 'x', roleId: 'y' })
      .expect(401);
  });
});
