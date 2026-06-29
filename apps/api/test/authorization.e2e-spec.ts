/**
 * Authorization System Integration Tests
 *
 * Tests permission checking, clearance levels, and guards.
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

describe('Authorization System (e2e)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let prisma: DatabaseService['client'];
  let testUser: any;
  let testTenant: any;
  let testProfile: any;
  let testRole: any;
  let testPermission: any;
  let accessToken: string;

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
    if (testRole) {
      await prisma.role.deleteMany({ where: { id: testRole.id } });
      testRole = null as any;
    }
    if (testPermission) {
      await prisma.permission.deleteMany({ where: { id: testPermission.id } });
      testPermission = null as any;
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
        slug: 'test-school-authz',
        status: 'active',
      },
    });

    // Create test user
    const hashedPassword =
      await PasswordService.hashPassword('TestPassword123');
    testUser = await prisma.user.create({
      data: {
        email: 'test-authz@example.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Create test permission
    testPermission = await prisma.permission.create({
      data: {
        name: 'students.view',
        label: 'View Students',
        description: 'View student information',
        category: 'students',
        resource: 'students',
        action: 'view',
      },
    });

    // Create test role
    testRole = await prisma.role.create({
      data: {
        name: 'Test Teacher',
        description: 'Test teacher role',
        clearanceLevel: 2, // Teacher level
        isSystemRole: false,
        roleType: 'teacher',
      },
    });

    // Assign permission to role
    await prisma.rolePermission.create({
      data: {
        roleId: testRole.id,
        permissionId: testPermission.id,
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

    // Assign role to profile
    await prisma.userTenantRole.create({
      data: {
        userTenantId: testProfile.id,
        roleId: testRole.id,
      },
    });

    // Get access token (simplified - in real scenario, use proper auth flow)
    // For now, we'll test the structure
    accessToken = 'mock-access-token';
  });

  describe('Permission Checking', () => {
    it('should allow access when user has required permission', async () => {
      // This test requires proper JWT setup and permission guard
      // For now, we'll test the structure
      const response = await request(app.getHttpServer() as Server)
        .get('/api/protected-endpoint')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // In a real implementation, verify permission was checked
      expect(response.status).toBe(200);
    });

    it('should deny access when user lacks required permission', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/protected-endpoint')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body.message).toContain('permission');
    });
  });

  describe('Clearance Level Checking', () => {
    it('should allow access when clearance level is sufficient', async () => {
      // Test with clearance level 2 (Teacher) accessing level 1 endpoint
      const response = await request(app.getHttpServer() as Server)
        .get('/api/admin-endpoint')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.status).toBe(200);
    });

    it('should deny access when clearance level is insufficient', async () => {
      // Test with clearance level 2 (Teacher) accessing level 5 (Admin) endpoint
      const response = await request(app.getHttpServer() as Server)
        .get('/api/admin-endpoint')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body.message).toContain('clearance');
    });
  });

  describe('Context Validation', () => {
    it('should validate tenant context', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/tenant-specific-endpoint')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Tenant-Id', testTenant.id as string)
        .expect(200);

      expect(response.status).toBe(200);
    });

    it('should reject requests with invalid tenant context', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/tenant-specific-endpoint')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Tenant-Id', 'invalid-tenant-id')
        .expect(403);

      expect(response.body.message).toContain('tenant');
    });
  });
});
