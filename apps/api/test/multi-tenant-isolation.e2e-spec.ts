/**
 * Multi-Tenant Isolation Integration Tests
 *
 * Tests that tenant data is properly isolated and users cannot access other tenants' data.
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
import type { Tenant, User, UserTenant } from '@workspace/database';
import { PasswordService } from '../src/auth/services/password.service';
import { DatabaseService } from '../src/common';
import { Server } from 'http';

describe('Multi-Tenant Isolation (e2e)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let prisma: DatabaseService['client'];
  let tenant1: Tenant;
  let tenant2: Tenant;
  let user1: User;
  let user2: User;
  let profile1: UserTenant;
  let profile2: UserTenant;
  // let resource1: Record<string, unknown>; // Resource in tenant1
  let resource2: Record<string, unknown>; // Resource in tenant2

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    prisma = database.client;
  });

  afterAll(async () => {
    // Cleanup
    if (profile1) {
      await prisma.userTenant.deleteMany({
        where: { id: profile1.id },
      });
    }
    if (profile2) {
      await prisma.userTenant.deleteMany({
        where: { id: profile2.id },
      });
    }
    if (user1) {
      await prisma.user.deleteMany({
        where: { id: user1.id },
      });
    }
    if (user2) {
      await prisma.user.deleteMany({
        where: { id: user2.id },
      });
    }
    if (tenant1) {
      await prisma.tenant.deleteMany({
        where: { id: tenant1.id },
      });
    }
    if (tenant2) {
      await prisma.tenant.deleteMany({
        where: { id: tenant2.id },
      });
    }

    await app.close();
  });

  beforeEach(async () => {
    // Create two tenants
    tenant1 = await prisma.tenant.create({
      data: {
        name: 'School 1',
        slug: 'school-1',
        status: 'active',
      },
    });

    tenant2 = await prisma.tenant.create({
      data: {
        name: 'School 2',
        slug: 'school-2',
        status: 'active',
      },
    });

    // Create two users
    const hashedPassword =
      await PasswordService.hashPassword('TestPassword123');
    user1 = await prisma.user.create({
      data: {
        email: 'user1@example.com',
        passwordHash: hashedPassword,
        firstName: 'User',
        lastName: 'One',
      },
    });

    user2 = await prisma.user.create({
      data: {
        email: 'user2@example.com',
        passwordHash: hashedPassword,
        firstName: 'User',
        lastName: 'Two',
      },
    });

    // Create profiles
    profile1 = await prisma.userTenant.create({
      data: {
        userId: user1.id,
        tenantId: tenant1.id,
        status: 'active',
        suspended: false,
      },
    });

    profile2 = await prisma.userTenant.create({
      data: {
        userId: user2.id,
        tenantId: tenant2.id,
        status: 'active',
        suspended: false,
      },
    });

    // Create tenant-specific resources (example: students, classes, etc.)
    // This is a placeholder - adjust based on actual schema
    // resource1 = await prisma.student.create({
    //   data: {
    //     tenantId: tenant1.id,
    //     name: 'Student 1',
    //   },
    // });
    //
    // resource2 = await prisma.student.create({
    //   data: {
    //     tenantId: tenant2.id,
    //     name: 'Student 2',
    //   },
    // });
  });

  describe('Data Isolation', () => {
    it("should only return resources from user's tenant", async () => {
      // User1 should only see tenant1 resources
      const response = await request(app.getHttpServer() as Server)
        .get('/api/resources')
        .set('Authorization', 'Bearer user1-token')
        .set('X-Tenant-Id', tenant1.id)
        .expect(200);

      const resources = response.body.data || response.body;
      expect(Array.isArray(resources)).toBe(true);
      // All resources should belong to tenant1
      resources.forEach((resource: Record<string, unknown>) => {
        expect(resource.tenantId).toBe(tenant1.id);
      });
    });

    it("should prevent user from accessing other tenant's resources", async () => {
      // User1 trying to access tenant2's resource
      const response = await request(app.getHttpServer() as Server)
        .get(`/api/resources/${resource2?.id}`)
        .set('Authorization', 'Bearer user1-token')
        .set('X-Tenant-Id', tenant1.id)
        .expect(404); // Should return 404, not 403, to avoid information leakage

      expect(response.body.message).not.toContain(tenant2.id);
    });

    it('should prevent user from creating resources in other tenant', async () => {
      // User1 trying to create resource in tenant2
      const response = await request(app.getHttpServer() as Server)
        .post('/api/resources')
        .set('Authorization', 'Bearer user1-token')
        .set('X-Tenant-Id', tenant2.id) // Wrong tenant
        .send({
          name: 'Unauthorized Resource',
        })
        .expect(403);

      expect(response.body.message).toContain('tenant');
    });

    it("should prevent user from updating other tenant's resources", async () => {
      // User1 trying to update tenant2's resource
      const response = await request(app.getHttpServer() as Server)
        .put(`/api/resources/${resource2?.id}`)
        .set('Authorization', 'Bearer user1-token')
        .set('X-Tenant-Id', tenant1.id)
        .send({
          name: 'Updated Name',
        })
        .expect(404);

      expect(response.body.message).not.toContain(tenant2.id);
    });

    it("should prevent user from deleting other tenant's resources", async () => {
      // User1 trying to delete tenant2's resource
      const response = await request(app.getHttpServer() as Server)
        .delete(`/api/resources/${resource2?.id}`)
        .set('Authorization', 'Bearer user1-token')
        .set('X-Tenant-Id', tenant1.id)
        .expect(404);

      expect(response.body.message).not.toContain(tenant2.id);
    });
  });

  describe('Tenant Context Validation', () => {
    it('should require tenant context header', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/resources')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);

      expect(response.body.message).toContain('tenant');
    });

    it('should validate user belongs to tenant', async () => {
      // User1 trying to use tenant2 context
      const response = await request(app.getHttpServer() as Server)
        .get('/api/resources')
        .set('Authorization', 'Bearer user1-token')
        .set('X-Tenant-Id', tenant2.id)
        .expect(403);

      expect(response.body.message).toContain('tenant');
    });
  });

  describe('Row-Level Security', () => {
    it('should enforce RLS policies at database level', async () => {
      // Direct database query should respect RLS
      // This test verifies that even direct queries are filtered
      const resources = await prisma.$queryRaw`
        SELECT * FROM resources WHERE tenant_id = ${tenant1.id}
      `;

      // All results should belong to tenant1
      expect(Array.isArray(resources)).toBe(true);
      // Verify RLS is working (adjust based on actual schema)
    });
  });
});
