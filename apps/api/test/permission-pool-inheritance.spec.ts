/**
 * Permission Pool Inheritance Validation Tests
 *
 * Validates that permission pool inheritance logic works correctly.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PermissionPoolService } from '../src/auth/services/permission-pool.service';
import { createMockPrismaClient } from '../src/common/__tests__/test-utils';
import { PrismaClient } from '@workspace/database';
import { ClearanceLevel } from '@workspace/api';
import { PRISMA_CLIENT_TOKEN } from '../src/common';

// Mock Prisma
jest.mock('@workspace/database');

describe('Permission Pool Inheritance Validation', () => {
  let service: PermissionPoolService;
  let mockPrisma: Partial<PrismaClient>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionPoolService,
        {
          provide: PRISMA_CLIENT_TOKEN,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PermissionPoolService>(PermissionPoolService);
  });

  describe('Permission Pool Inheritance by Clearance Level', () => {
    it('should inherit permissions from lower clearance levels', async () => {
      // Mock permission pools
      (mockPrisma.permissionPool?.findMany as jest.Mock<any>).mockResolvedValue(
        [
          {
            id: 'pool-1',
            name: 'Student Pool',
            clearanceLevel: ClearanceLevel.STUDENT,
            permissions: [
              { permission: { name: 'students.view.own' } },
              { permission: { name: 'classes.view.own' } },
            ],
          },
          {
            id: 'pool-2',
            name: 'Teacher Pool',
            clearanceLevel: ClearanceLevel.TEACHER,
            permissions: [
              { permission: { name: 'students.view.all' } },
              { permission: { name: 'classes.manage' } },
            ],
          },
        ],
      );

      // Get permission pools for Teacher level (should include Student pool)
      const pools = await service.getPermissionPoolsByClearanceLevel(
        mockPrisma as PrismaClient,
        ClearanceLevel.TEACHER,
      );

      // Should include both Student and Teacher pools
      const poolNames = pools.map((p) => p.name);
      expect(poolNames.length).toBeGreaterThanOrEqual(2);

      // Get all permissions from pools
      const allPermissions = pools.flatMap((p) => p.permissions);
      const permissionNames = allPermissions.map((p) => p.name);
      expect(permissionNames).toContain('students.view.own');
      expect(permissionNames).toContain('classes.view.own');
      expect(permissionNames).toContain('students.view.all');
      expect(permissionNames).toContain('classes.manage');
    });

    it('should not inherit permissions from higher clearance levels', async () => {
      (mockPrisma.permissionPool?.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pool-1',
          name: 'Student Pool',
          clearanceLevel: ClearanceLevel.STUDENT,
          permissions: [{ permission: { name: 'students.view.own' } }],
        },
        {
          id: 'pool-2',
          name: 'Admin Pool',
          clearanceLevel: ClearanceLevel.ADMIN,
          permissions: [{ permission: { name: 'users.manage' } }],
        },
      ]);

      // Get permission pools for Student level (should NOT include Admin pool)
      const pools = await service.getPermissionPoolsByClearanceLevel(
        mockPrisma as PrismaClient,
        ClearanceLevel.STUDENT,
      );

      const allPermissions = pools.flatMap((p) => p.permissions);
      const permissionNames = allPermissions.map((p) => p.name);
      expect(permissionNames).toContain('students.view.own');
      expect(permissionNames).not.toContain('users.manage');
    });

    it('should handle multiple pools at same clearance level', async () => {
      (mockPrisma.permissionPool?.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pool-1',
          name: 'Teacher Pool A',
          clearanceLevel: ClearanceLevel.TEACHER,
          permissions: [{ permission: { name: 'students.view.all' } }],
        },
        {
          id: 'pool-2',
          name: 'Teacher Pool B',
          clearanceLevel: ClearanceLevel.TEACHER,
          permissions: [{ permission: { name: 'classes.manage' } }],
        },
      ]);

      const pools = await service.getPermissionPoolsByClearanceLevel(
        mockPrisma as PrismaClient,
        ClearanceLevel.TEACHER,
      );

      const allPermissions = pools.flatMap((p) => p.permissions);
      const permissionNames = allPermissions.map((p) => p.name);
      expect(permissionNames).toContain('students.view.all');
      expect(permissionNames).toContain('classes.manage');
    });
  });

  describe('Permission Pool Validation for Custom Roles', () => {
    it('should validate that custom role permissions are within permission pool', async () => {
      // Mock permission pools for clearance level 2 (Teacher)
      (mockPrisma.permissionPool?.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pool-1',
          name: 'Teacher Pool',
          clearanceLevel: 2,
          permissions: [
            { permission: { name: 'students.view.all' } },
            { permission: { name: 'classes.manage' } },
          ],
        },
      ]);

      // Get permissions from pools
      const poolIds = pools.map((p) => p.id);
      const validPermissions = await service.getPermissionsFromPools(
        mockPrisma as PrismaClient,
        poolIds,
      );

      const permissionNames = validPermissions.map((p) => p.name);
      expect(permissionNames).toContain('students.view.all');
      expect(permissionNames).toContain('classes.manage');
    });

    it('should reject custom role with permissions outside permission pool', async () => {
      (mockPrisma.permissionPool?.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pool-1',
          name: 'Teacher Pool',
          clearanceLevel: 2,
          permissions: [{ permission: { name: 'students.view.all' } }],
        },
      ]);

      // Get permissions from pools
      const poolIds = pools.map((p) => p.id);
      const validPermissions = await service.getPermissionsFromPools(
        mockPrisma as PrismaClient,
        poolIds,
      );

      const permissionNames = validPermissions.map((p) => p.name);
      expect(permissionNames).toContain('students.view.all');
      expect(permissionNames).not.toContain('users.manage');
    });

    it('should validate permissions across all inherited pools', async () => {
      (mockPrisma.permissionPool?.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pool-1',
          name: 'Student Pool',
          clearanceLevel: 0,
          permissions: [{ permission: { name: 'students.view.own' } }],
        },
        {
          id: 'pool-2',
          name: 'Teacher Pool',
          clearanceLevel: 2,
          permissions: [{ permission: { name: 'students.view.all' } }],
        },
      ]);

      // Get pools for Teacher level (should include Student pool)
      const pools = await service.getPermissionPoolsByClearanceLevel(
        mockPrisma as PrismaClient,
        2, // Teacher level
      );

      // Get all permissions from pools
      const poolIds = pools.map((p) => p.id);
      const permissions = await service.getPermissionsFromPools(
        mockPrisma as PrismaClient,
        poolIds,
      );

      const permissionNames = permissions.map((p) => p.name);
      expect(permissionNames).toContain('students.view.own');
      expect(permissionNames).toContain('students.view.all');
    });
  });

  describe('Permission Pool Assignment Validation', () => {
    it('should validate permission pool assignment matches role clearance level', async () => {
      // Create a role with clearance level 2
      const role = {
        id: 'role-1',
        clearanceLevel: 2,
      };

      (mockPrisma.role?.findUnique as jest.Mock).mockResolvedValue(role);

      // Pools at level 2 and below should be valid
      (mockPrisma.permissionPool?.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pool-1',
          clearanceLevel: 2,
        },
        {
          id: 'pool-2',
          clearanceLevel: 0,
        },
      ]);

      const result = await service.validatePermissionPoolAssignment(
        mockPrisma as PrismaClient,
        'role-1',
        ['pool-1', 'pool-2'],
      );

      expect(result.valid).toBe(true);
    });

    it('should reject permission pool assignment exceeding role clearance level', async () => {
      const role = {
        id: 'role-1',
        clearanceLevel: 2,
      };

      (mockPrisma.role?.findUnique as jest.Mock).mockResolvedValue(role);

      // Pool at level 5 exceeds role's level 2
      (mockPrisma.permissionPool?.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pool-1',
          clearanceLevel: 5,
        },
      ]);

      const result = await service.validatePermissionPoolAssignment(
        mockPrisma as PrismaClient,
        'role-1',
        ['pool-1'],
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceed');
    });
  });
});
