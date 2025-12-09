/**
 * MFA Flow Integration Tests
 *
 * Tests MFA setup, verification, and all MFA methods (SMS, Email, TOTP, WebAuthn).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@workspace/database';
import { PasswordService } from '../src/auth/services/password.service';
import { PRISMA_CLIENT_TOKEN } from '../src/common';

describe('MFA Flows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let testUser: any;
  let testTenant: any;
  let testProfile: any;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PRISMA_CLIENT_TOKEN);
  });

  afterAll(async () => {
    // Cleanup
    if (testProfile) {
      await prisma.userTenant.deleteMany({
        where: { id: testProfile.id },
      });
    }
    if (testUser) {
      await prisma.user.deleteMany({
        where: { id: testUser.id },
      });
    }
    if (testTenant) {
      await prisma.tenant.deleteMany({
        where: { id: testTenant.id },
      });
    }

    await app.close();
  });

  beforeEach(async () => {
    // Create test tenant
    testTenant = await prisma.tenant.create({
      data: {
        name: 'Test School',
        slug: 'test-school',
        status: 'active',
      },
    });

    // Create test user
    const hashedPassword =
      await PasswordService.hashPassword('TestPassword123');
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
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

    accessToken = 'mock-access-token';
  });

  describe('MFA Setup', () => {
    it('should setup SMS MFA method', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/mfa/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          method: 'sms',
          phoneNumber: '+1234567890',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.methodId).toBeDefined();
    });

    it('should setup Email MFA method', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/mfa/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          method: 'email',
          email: 'test@example.com',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.methodId).toBeDefined();
    });

    it('should setup TOTP MFA method', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/mfa/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          method: 'totp',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.secret).toBeDefined();
      expect(response.body.qrCode).toBeDefined();
    });

    it('should setup WebAuthn MFA method', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/mfa/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          method: 'webauthn',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.options).toBeDefined();
    });
  });

  describe('MFA Verification', () => {
    let mfaMethodId: string;

    beforeEach(async () => {
      // Setup MFA method for testing
      const setupResponse = await request(app.getHttpServer())
        .post('/auth/mfa/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          method: 'sms',
          phoneNumber: '+1234567890',
        });

      mfaMethodId = setupResponse.body.methodId;
    });

    it('should verify SMS MFA code', async () => {
      // First, initiate challenge
      const challengeResponse = await request(app.getHttpServer())
        .post('/auth/mfa/challenge')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          methodId: mfaMethodId,
          operation: 'login',
        })
        .expect(200);

      const challengeId = challengeResponse.body.challengeId;

      // Then verify code (mock code for testing)
      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/mfa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          challengeId,
          code: '123456', // Mock code
        })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.verified).toBe(true);
    });

    it('should reject invalid MFA code', async () => {
      const challengeResponse = await request(app.getHttpServer())
        .post('/auth/mfa/challenge')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          methodId: mfaMethodId,
          operation: 'login',
        });

      const challengeId = challengeResponse.body.challengeId;

      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/mfa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          challengeId,
          code: '000000', // Invalid code
        })
        .expect(401);

      expect(verifyResponse.body.success).toBe(false);
    });

    it('should verify TOTP code', async () => {
      // Setup TOTP
      const totpSetup = await request(app.getHttpServer())
        .post('/auth/mfa/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          method: 'totp',
        });

      const totpMethodId = totpSetup.body.methodId;
      const secret = totpSetup.body.secret;

      // Generate TOTP code (in real scenario, use speakeasy library)
      // For testing, we'll use a mock
      const totpCode = '123456';

      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/mfa/verify-totp')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          methodId: totpMethodId,
          code: totpCode,
        })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
    });
  });

  describe('MFA Login Flow', () => {
    it('should require MFA after initial login', async () => {
      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123',
        })
        .expect(200);

      expect(loginResponse.body.requiresMfa).toBe(true);
      expect(loginResponse.body.mfaChallengeId).toBeDefined();
    });

    it('should complete login after MFA verification', async () => {
      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123',
        });

      const challengeId = loginResponse.body.mfaChallengeId;

      // Verify MFA
      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/verify-mfa-login')
        .send({
          challengeId,
          code: '123456',
        })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.schools).toBeDefined();
    });
  });

  describe('MFA Recovery', () => {
    it('should allow recovery code usage', async () => {
      // Setup MFA with recovery codes
      const setupResponse = await request(app.getHttpServer())
        .post('/auth/mfa/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          method: 'totp',
        });

      const recoveryCodes = setupResponse.body.recoveryCodes;

      // Use recovery code
      const recoveryResponse = await request(app.getHttpServer())
        .post('/auth/mfa/recover')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          recoveryCode: recoveryCodes[0],
        })
        .expect(200);

      expect(recoveryResponse.body.success).toBe(true);
    });

    it('should invalidate used recovery code', async () => {
      const setupResponse = await request(app.getHttpServer())
        .post('/auth/mfa/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          method: 'totp',
        });

      const recoveryCodes = setupResponse.body.recoveryCodes;

      // Use recovery code first time
      await request(app.getHttpServer())
        .post('/auth/mfa/recover')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          recoveryCode: recoveryCodes[0],
        })
        .expect(200);

      // Try to use same code again
      const secondResponse = await request(app.getHttpServer())
        .post('/auth/mfa/recover')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          recoveryCode: recoveryCodes[0],
        })
        .expect(401);

      expect(secondResponse.body.success).toBe(false);
    });
  });
});
