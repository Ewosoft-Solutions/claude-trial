/**
 * Breach Response System Integration Tests
 *
 * Tests breach detection, response mechanisms, and security measures.
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

describe('Breach Response System (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let testUser: any;
  let testTenant: any;
  let testProfile: any;
  let adminToken: string;

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

    adminToken = 'mock-admin-token';
  });

  describe('Breach Detection', () => {
    it('should detect suspicious login patterns', async () => {
      // Simulate multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).post('/auth/login').send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });
      }

      // Check if breach is detected
      const breachResponse = await request(app.getHttpServer())
        .get('/auth/breach-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(breachResponse.body.breachDetected).toBe(true);
    });

    it('should detect unusual access patterns', async () => {
      // Simulate access from multiple IPs in short time
      // This would be detected by monitoring system
      const response = await request(app.getHttpServer())
        .post('/auth/breach/detect')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser.id,
          severity: 'medium',
          reason: 'unusual_access_pattern',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Breach Response - MFA Re-authentication', () => {
    it('should force MFA re-authentication for medium severity breach', async () => {
      // Trigger breach response
      const breachResponse = await request(app.getHttpServer())
        .post('/auth/breach/respond')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser.id,
          severity: 'medium',
          action: 'force_mfa_reauth',
        })
        .expect(200);

      expect(breachResponse.body.success).toBe(true);
      expect(breachResponse.body.action).toBe('force_mfa_reauth');

      // User should be required to re-authenticate with MFA
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123',
        })
        .expect(200);

      expect(loginResponse.body.requiresMfa).toBe(true);
      expect(loginResponse.body.forceMfaReauth).toBe(true);
    });
  });

  describe('Breach Response - Password Reset', () => {
    it('should force password reset for high severity breach', async () => {
      // Trigger breach response
      const breachResponse = await request(app.getHttpServer())
        .post('/auth/breach/respond')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser.id,
          severity: 'high',
          action: 'force_password_reset',
        })
        .expect(200);

      expect(breachResponse.body.success).toBe(true);
      expect(breachResponse.body.action).toBe('force_password_reset');

      // User should be required to reset password
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123',
        })
        .expect(403);

      expect(loginResponse.body.message).toContain('password reset');
    });
  });

  describe('Platform-Wide Breach Response', () => {
    it('should trigger platform-wide breach response', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/breach/platform-wide')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          severity: 'high',
          action: 'force_mfa_reauth',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.affectedUsers).toBeGreaterThan(0);
    });
  });

  describe('School-Specific Breach Response', () => {
    it('should trigger school-specific breach response', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/breach/school')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tenantId: testTenant.id,
          severity: 'medium',
          action: 'force_mfa_reauth',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.affectedUsers).toBeGreaterThan(0);
    });
  });

  describe('Profile-Level Breach Response', () => {
    it('should trigger profile-level breach response', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/breach/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          profileId: testProfile.id,
          severity: 'low',
          action: 'force_mfa_reauth',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Security Investigation Mode', () => {
    it('should enable security investigation mode', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/breach/investigation-mode')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser.id,
          enabled: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.investigationMode).toBe(true);
    });

    it('should log all activities during investigation mode', async () => {
      // Enable investigation mode
      await request(app.getHttpServer())
        .post('/auth/breach/investigation-mode')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser.id,
          enabled: true,
        });

      // Perform some actions
      await request(app.getHttpServer())
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      // Check audit logs
      const logsResponse = await request(app.getHttpServer())
        .get('/auth/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          userId: testUser.id,
        })
        .expect(200);

      expect(logsResponse.body.logs.length).toBeGreaterThan(0);
    });
  });
});
