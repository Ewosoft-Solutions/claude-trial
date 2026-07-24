/**
 * Step-Up Verification Integration Tests
 *
 * Exercises POST /auth/step-up/verify (the password proof) end-to-end on the
 * app-under-test, which boots as the non-superuser `app_runtime` role when
 * APP_RUNTIME_DATABASE_URL is set — so this is the deployed RLS-subject
 * topology, not a superuser owner. Fixtures are seeded via a superuser handle
 * (helpers/superuser-client). The WebAuthn/passkey proof needs a real
 * authenticator and is out of scope here; the password proof is fully drivable.
 *
 * Requires APP_RUNTIME_DATABASE_URL (a real Postgres DB); skips otherwise.
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
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/services/password.service';
import { DatabaseService } from '../src/common';
import { makeSuperuserClient } from './helpers/superuser-client';
import { JWTSecretService } from '@workspace/api';
import { Server } from 'http';

const HAS_DB = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

// A catalogued Account & Security operation that defaults to requiresStepUp
// (no maker-checker), so a password proof mints a challenge without any
// platform-catalog seeding — getPolicy falls back to the code definition.
const STEP_UP_OP = 'account.password.change';
const PASSWORD = 'TestPassword123';

d('Step-up verification (e2e)', () => {
  let app: INestApplication;
  let prisma: DatabaseService['client'];

  let testEmail = '';
  let testTenant: { id: string } | null = null;
  let testUser: { id: string } | null = null;
  let testRole: { id: string } | null = null;
  let testProfile: { id: string } | null = null;

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
    await app.close();
  });

  beforeEach(async () => {
    const ts = Date.now();
    testEmail = `test-stepup-${ts}@example.com`;

    testTenant = await prisma.tenant.create({
      data: { name: 'Step-up E2E School', slug: `stepup-e2e-${ts}`, status: 'active' },
    });
    await JWTSecretService.initializeTenantJWTSecret(prisma, testTenant.id);

    testUser = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: await PasswordService.hashPassword(PASSWORD),
        firstName: 'Step',
        lastName: 'Up',
        isVerified: true,
        isActive: true,
      },
    });

    testRole = await prisma.role.create({
      data: {
        name: `stepup-e2e-role-${ts}`,
        roleType: 'custom',
        clearanceLevel: 1,
        tenantId: testTenant.id,
        isActive: true,
      },
    });

    testProfile = await prisma.userTenant.create({
      data: {
        userId: testUser.id,
        tenantId: testTenant.id,
        status: 'active',
        suspended: false,
        userTenantRole: {
          create: { roleId: testRole.id, tenantId: testTenant.id, isPrimary: true },
        },
      },
    });
  });

  afterEach(async () => {
    if (testUser) {
      // Challenges minted during the test, cleaned up before the user goes.
      await prisma.mfaChallenge.deleteMany({ where: { userId: testUser.id } });
    }
    if (testProfile) {
      await prisma.userTenantRole.deleteMany({ where: { userTenantId: testProfile.id } });
      await prisma.userTenant.deleteMany({ where: { id: testProfile.id } });
      testProfile = null;
    }
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
      testUser = null;
    }
    if (testRole) {
      await prisma.role.deleteMany({ where: { id: testRole.id } });
      testRole = null;
    }
    if (testTenant) {
      await prisma.tenantJWTConfig.deleteMany({ where: { tenantId: testTenant.id } });
      await prisma.tenant.deleteMany({ where: { id: testTenant.id } });
      testTenant = null;
    }
  });

  /** login → select-school → return the issued access token. */
  async function getAccessToken(): Promise<string> {
    const loginRes = await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({ email: testEmail, password: PASSWORD });

    const selectRes = await request(app.getHttpServer() as Server)
      .post('/auth/select-school')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ tenantId: testTenant!.id, profileId: testProfile!.id });

    return selectRes.body.accessToken as string;
  }

  describe('POST /auth/step-up/verify', () => {
    it('mints a verified challenge for a valid password + catalogued operation', async () => {
      const accessToken = await getAccessToken();

      const res = await request(app.getHttpServer() as Server)
        .post('/auth/step-up/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ operation: STEP_UP_OP, password: PASSWORD })
        .expect(200);

      expect(res.body.verified).toBe(true);
      expect(typeof res.body.challengeId).toBe('string');
    });

    it('rejects a wrong password (401)', async () => {
      const accessToken = await getAccessToken();

      await request(app.getHttpServer() as Server)
        .post('/auth/step-up/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ operation: STEP_UP_OP, password: 'WrongPassword!' })
        .expect(401);
    });

    it('rejects an unsupported operation (400)', async () => {
      const accessToken = await getAccessToken();

      await request(app.getHttpServer() as Server)
        .post('/auth/step-up/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ operation: 'not.a.real.operation', password: PASSWORD })
        .expect(400);
    });

    it('requires authentication (401)', async () => {
      await request(app.getHttpServer() as Server)
        .post('/auth/step-up/verify')
        .send({ operation: STEP_UP_OP, password: PASSWORD })
        .expect(401);
    });
  });
});
