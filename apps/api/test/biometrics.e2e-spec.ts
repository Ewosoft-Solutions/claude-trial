/**
 * Biometrics (passkey) Integration Tests
 *
 * Exercises the JWT-only biometrics surfaces (register options, device list,
 * enrolment policy) and the StepUpGuard on the removal endpoint, end-to-end on
 * the app-under-test which boots as the non-superuser `app_runtime` role when
 * APP_RUNTIME_DATABASE_URL is set (the deployed RLS-subject topology). Fixtures
 * are seeded via a superuser handle (helpers/superuser-client).
 *
 * The full WebAuthn register/verify + passkey-login ceremonies need a real (or
 * virtual) authenticator and are out of scope; this covers auth/RLS/gating and
 * the server-authoritative single-use step-up guard via a password proof.
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

const PASSWORD = 'TestPassword123';

d('Biometrics (e2e)', () => {
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
    testEmail = `test-bio-${ts}@example.com`;

    testTenant = await prisma.tenant.create({
      data: { name: 'Biometrics E2E School', slug: `bio-e2e-${ts}`, status: 'active' },
    });
    await JWTSecretService.initializeTenantJWTSecret(prisma, testTenant.id);

    testUser = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: await PasswordService.hashPassword(PASSWORD),
        firstName: 'Bio',
        lastName: 'Metric',
        isVerified: true,
        isActive: true,
      },
    });

    testRole = await prisma.role.create({
      data: {
        name: `bio-e2e-role-${ts}`,
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
      await prisma.mfaChallenge.deleteMany({ where: { userId: testUser.id } });
    }
    if (testTenant) {
      // registerOptions/getOrCreateDefaultPolicy may create a default policy row.
      await prisma.schoolSecurityPolicy.deleteMany({
        where: { schoolId: testTenant.id },
      });
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

  /** Mint a verified step-up challenge for `operation` via the password proof. */
  async function mintStepUp(
    accessToken: string,
    operation: string,
  ): Promise<string> {
    const res = await request(app.getHttpServer() as Server)
      .post('/auth/step-up/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ operation, password: PASSWORD })
      .expect(200);
    return res.body.challengeId as string;
  }

  describe('JWT-only surfaces', () => {
    it('returns platform registration options', async () => {
      const accessToken = await getAccessToken();
      const res = await request(app.getHttpServer() as Server)
        .post('/auth/biometrics/register/options')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(typeof res.body.challengeId).toBe('string');
      expect(res.body.options).toBeDefined();
    });

    it('lists an empty device set for a newly-provisioned user', async () => {
      const accessToken = await getAccessToken();
      const res = await request(app.getHttpServer() as Server)
        .get('/auth/biometrics/devices')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('returns the enrolment policy for the session', async () => {
      const accessToken = await getAccessToken();
      const res = await request(app.getHttpServer() as Server)
        .get('/auth/biometrics/policy')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(['require', 'allow', 'forbid']).toContain(res.body.policy);
    });

    it('requires authentication (401)', async () => {
      await request(app.getHttpServer() as Server)
        .get('/auth/biometrics/devices')
        .expect(401);
    });
  });

  describe('StepUpGuard on DELETE /auth/biometrics/devices/:id', () => {
    it('rejects removal without a step-up challenge (403)', async () => {
      const accessToken = await getAccessToken();
      await request(app.getHttpServer() as Server)
        .delete('/auth/biometrics/devices/does-not-exist')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(403);
    });

    it('rejects a challenge minted for a different operation (403)', async () => {
      const accessToken = await getAccessToken();
      // A challenge bound to a *different* operation must not satisfy the guard.
      const wrongOpChallenge = await mintStepUp(accessToken, 'account.password.change');

      await request(app.getHttpServer() as Server)
        .delete('/auth/biometrics/devices/does-not-exist')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ stepUpChallengeId: wrongOpChallenge })
        .expect(403);
    });

    it('accepts a valid challenge once, then rejects the replay (single-use)', async () => {
      const accessToken = await getAccessToken();
      const challengeId = await mintStepUp(accessToken, 'biometrics.remove');

      // First use: the guard consumes the challenge and lets the request through
      // to the handler (which 404s — no such device — proving the guard passed,
      // not a 403 step-up rejection).
      const first = await request(app.getHttpServer() as Server)
        .delete('/auth/biometrics/devices/does-not-exist')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ stepUpChallengeId: challengeId });
      expect(first.status).not.toBe(403);

      // Second use of the same challenge: already consumed → rejected.
      await request(app.getHttpServer() as Server)
        .delete('/auth/biometrics/devices/does-not-exist')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ stepUpChallengeId: challengeId })
        .expect(403);
    });
  });
});
