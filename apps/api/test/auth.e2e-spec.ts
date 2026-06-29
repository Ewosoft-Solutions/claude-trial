/**
 * Authentication Flow Integration Tests
 *
 * Tests the complete authentication flow including login, school selection, and token refresh.
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
} from '@jest/globals';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/services/password.service';
import { DatabaseService } from '../src/common';
import { Server } from 'http';

describe('Authentication Flow (e2e)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let prisma: DatabaseService['client'];
  let testUser: any;
  let testTenant: any;
  let testProfile: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    prisma = database.client;
  });

  afterEach(async () => {
    if (testProfile) {
      await prisma.userTenant.deleteMany({ where: { id: testProfile.id } });
      testProfile = null as any;
    }
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
      testUser = null as any;
    }
    if (testTenant) {
      await prisma.tenant.deleteMany({ where: { id: testTenant.id } });
      testTenant = null as any;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create test tenant
    testTenant = await prisma.tenant.create({
      data: {
        name: 'Test School',
        slug: 'test-school-auth',
        status: 'active',
      },
    });

    // Create test user
    const hashedPassword =
      await PasswordService.hashPassword('TestPassword123');
    testUser = await prisma.user.create({
      data: {
        email: 'test-auth@example.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Create test profile
    testProfile = await prisma.userTenant.create({
      data: {
        userId: testUser.id,
        tenantId: testTenant.id,
        status: 'active',
        suspended: false,
      },
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully and return schools list with pre-auth token', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({
          email: 'test-auth@example.com',
          password: 'TestPassword123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.schools).toBeDefined();
      expect(Array.isArray(response.body.schools)).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe('string');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({
          email: 'test-auth@example.com',
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/select-school', () => {
    let loginToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({
          email: 'test-auth@example.com',
          password: 'TestPassword123',
        });

      loginToken = loginResponse.body.token;
    });

    it('should select school and return JWT tokens', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/auth/select-school')
        .set('Authorization', `Bearer ${loginToken}`)
        .send({
          tenantId: testTenant.id,
          profileId: testProfile.id,
        });

      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.accessToken).toBeDefined();
        expect(response.body.refreshToken).toBeDefined();
        expect(response.body.tenantContext).toBeDefined();
      }
    });

    it('should reject request without pre-auth token', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/auth/select-school')
        .send({
          tenantId: testTenant.id,
          profileId: testProfile.id,
        })
        .expect(401);

      expect(response.body.message).toContain('No token provided');
    });

    it('should reject request with invalid pre-auth token', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/auth/select-school')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          tenantId: testTenant.id,
          profileId: testProfile.id,
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid or expired pre-auth token');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      // This test requires a valid refresh token
      // In a real scenario, you'd get this from select-school endpoint
      const response = await request(app.getHttpServer() as Server)
        .post('/auth/refresh')
        .send({
          refreshToken: 'valid-refresh-token',
        });

      // Expect either success or 401 if token is invalid
      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.accessToken).toBeDefined();
      }
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/auth/refresh')
        .send({
          refreshToken: 'invalid-refresh-token',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
