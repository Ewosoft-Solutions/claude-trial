/**
 * Authentication Flow Integration Tests
 *
 * Tests the complete auth flow: login → select-school → refresh.
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
import { JWTSecretService } from '@workspace/api';
import { Server } from 'http';

const HAS_DB = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

d('Authentication Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: DatabaseService['client'];

  // Per-test fixtures (recreated fresh for each test)
  let testEmail = '';
  let testTenant: { id: string; slug: string } | null = null;
  let testUser: { id: string } | null = null;
  let testRole: { id: string } | null = null;
  let testProfile: { id: string } | null = null;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(DatabaseService).client;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const ts = Date.now();
    const slug = `auth-e2e-${ts}`;
    testEmail = `test-auth-${ts}@example.com`;

    testTenant = await prisma.tenant.create({
      data: { name: 'Auth E2E School', slug, status: 'active' },
    });

    // JWT config is required for select-school to issue tokens
    await JWTSecretService.initializeTenantJWTSecret(prisma, testTenant.id);

    const hashedPassword = await PasswordService.hashPassword('TestPassword123');
    testUser = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        isVerified: true,
        isActive: true,
      },
    });

    testRole = await prisma.role.create({
      data: {
        name: `auth-e2e-role-${Date.now()}`,
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
          create: {
            roleId: testRole.id,
            tenantId: testTenant.id,
            isPrimary: true,
          },
        },
      },
    });
  });

  afterEach(async () => {
    // Delete in dependency order: role assignment → profile → user → JWT config → tenant
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

  describe('POST /auth/login', () => {
    it('should return user + schools list + pre-auth token', async () => {
      const res = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({ email: testEmail, password: 'TestPassword123' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
      expect(Array.isArray(res.body.schools)).toBe(true);
      expect(typeof res.body.token).toBe('string');
    });

    it('should reject wrong password', async () => {
      await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({ email: testEmail, password: 'WrongPassword' })
        .expect(401);
    });

    it('should reject non-existent user', async () => {
      await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'TestPassword123' })
        .expect(401);
    });
  });

  describe('POST /auth/select-school', () => {
    let preAuthToken: string;

    beforeEach(async () => {
      const loginRes = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({ email: testEmail, password: 'TestPassword123' });
      preAuthToken = loginRes.body.token as string;
    });

    it('should issue access + refresh tokens after school selection', async () => {
      const res = await request(app.getHttpServer() as Server)
        .post('/auth/select-school')
        .set('Authorization', `Bearer ${preAuthToken}`)
        .send({ tenantId: testTenant!.id, profileId: testProfile!.id })
        .expect(200);

      expect(typeof res.body.accessToken).toBe('string');
      expect(typeof res.body.refreshToken).toBe('string');
      expect(res.body.tenantContext).toBeDefined();
      expect(res.body.tenantContext.tenantId).toBe(testTenant!.id);
    });

    it('should reject request without pre-auth token', async () => {
      const res = await request(app.getHttpServer() as Server)
        .post('/auth/select-school')
        .send({ tenantId: testTenant!.id, profileId: testProfile!.id })
        .expect(401);

      expect(res.body.message).toContain('No token provided');
    });

    it('should reject request with invalid pre-auth token', async () => {
      const res = await request(app.getHttpServer() as Server)
        .post('/auth/select-school')
        .set('Authorization', 'Bearer invalid-token')
        .send({ tenantId: testTenant!.id, profileId: testProfile!.id })
        .expect(401);

      expect(res.body.message).toContain('Invalid or expired pre-auth token');
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const loginRes = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({ email: testEmail, password: 'TestPassword123' });

      const selectRes = await request(app.getHttpServer() as Server)
        .post('/auth/select-school')
        .set('Authorization', `Bearer ${loginRes.body.token}`)
        .send({ tenantId: testTenant!.id, profileId: testProfile!.id });

      refreshToken = selectRes.body.refreshToken as string;
    });

    it('should issue a new access token for a valid refresh token', async () => {
      const res = await request(app.getHttpServer() as Server)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(typeof res.body.accessToken).toBe('string');
    });

    it('should reject an invalid refresh token', async () => {
      await request(app.getHttpServer() as Server)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);
    });
  });
});
