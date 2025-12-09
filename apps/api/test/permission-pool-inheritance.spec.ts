/**
 * Permission Pool Inheritance Validation Tests
 *
 * Validates that permission pool inheritance logic works correctly.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { PermissionPoolService } from '../src/auth/services/permission-pool.service';
import {
  createMockContext,
  MockContext,
} from '../src/common/__tests__/test-utils';
import type { PrismaClient, Role } from '@workspace/database';
import { ClearanceLevel, RoleType } from '@workspace/api';

describe('Permission Pool Inheritance Validation', () => {
  let service: PermissionPoolService;
  let mockCtx: MockContext;
  let mockPrisma: MockContext['prisma'];

  beforeEach(async () => {
    mockCtx = createMockContext();
    mockPrisma = mockCtx.prisma;

    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionPoolService],
    }).compile();

    service = module.get<PermissionPoolService>(PermissionPoolService);
  });

  describe('Permission Pool Inheritance by Clearance Level', () => {
    it('should inherit permissions from lower clearance levels', async () => {
      // Mock permission pools
      mockPrisma.permissionPool?.findMany?.mockResolvedValue([
        {
          id: 'pool-1',
          name: 'Student Pool',
          clearanceLevel: ClearanceLevel.STUDENT,
          description: 'pool-1',
          isSystemPool: false,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'pool-2',
          name: 'Teacher Pool',
          clearanceLevel: ClearanceLevel.TEACHER,
          description: 'pool-2',
          isSystemPool: false,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Get permission pools for Teacher level (should include Student pool)
      const pools = await service.getPermissionPoolsByClearanceLevel(
        mockPrisma as unknown as PrismaClient,
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
      mockPrisma.permissionPool?.findMany?.mockResolvedValue([
        {
          id: 'pool-1',
          name: 'Student Pool',
          clearanceLevel: ClearanceLevel.STUDENT,
          description: 'pool-1',
          isSystemPool: false,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'pool-2',
          name: 'Admin Pool',
          clearanceLevel: ClearanceLevel.PARENT,
          description: 'pool-2',
          isSystemPool: false,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Get permission pools for Student level (should NOT include Admin pool)
      const pools = await service.getPermissionPoolsByClearanceLevel(
        mockPrisma as unknown as PrismaClient,
        ClearanceLevel.STUDENT,
      );

      const allPermissions = pools.flatMap((p) => p.permissions);
      const permissionNames = allPermissions.map((p) => p.name);
      expect(permissionNames).toContain('students.view.own');
      expect(permissionNames).not.toContain('users.manage');
    });

    it('should handle multiple pools at same clearance level', async () => {
      mockPrisma.permissionPool?.findMany?.mockResolvedValue([
        {
          id: 'pool-1',
          name: 'Teacher Pool A',
          clearanceLevel: ClearanceLevel.TEACHER,
          description: 'pool-1',
          isSystemPool: false,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'pool-2',
          name: 'Teacher Pool B',
          clearanceLevel: ClearanceLevel.TEACHER,
          description: 'pool-2',
          isSystemPool: false,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
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
      mockPrisma.permissionPool?.findMany?.mockResolvedValue([
        {
          id: 'pool-1',
          name: 'Teacher Pool',
          clearanceLevel: 2,
          description: 'pool-1',
          isSystemPool: false,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Get permissions from pools
      const pools = await service.getPermissionPoolsByClearanceLevel(
        mockPrisma as unknown as PrismaClient,
        2,
      );
      const poolIds = pools.map((p) => p.id);
      const validPermissions = await service.getPermissionsFromPools(
        mockPrisma as unknown as PrismaClient,
        poolIds,
      );

      const permissionNames = validPermissions.map((p) => p.name);
      expect(permissionNames).toContain('students.view.all');
      expect(permissionNames).toContain('classes.manage');
    });

    it('should reject custom role with permissions outside permission pool', async () => {
      mockPrisma.permissionPool?.findMany?.mockResolvedValue([
        {
          id: 'pool-1',
          name: 'Teacher Pool',
          clearanceLevel: 2,
          description: 'pool-1',
          isSystemPool: false,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Get permissions from pools
      const pools = await service.getPermissionPoolsByClearanceLevel(
        mockPrisma as unknown as PrismaClient,
        2,
      );
      const poolIds = pools.map((p) => p.id);
      const validPermissions = await service.getPermissionsFromPools(
        mockPrisma as unknown as PrismaClient,
        poolIds,
      );

      const permissionNames = validPermissions.map((p) => p.name);
      expect(permissionNames).toContain('students.view.all');
      expect(permissionNames).not.toContain('users.manage');
    });

    it('should validate permissions across all inherited pools', async () => {
      mockPrisma.permissionPool?.findMany?.mockResolvedValue([
        {
          id: 'pool-1',
          name: 'Student Pool',
          clearanceLevel: 0,
          description: 'pool-1',
          isSystemPool: false,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'pool-2',
          name: 'Teacher Pool',
          clearanceLevel: 2,
          description: 'pool-2',
          isSystemPool: false,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Get pools for Teacher level (should include Student pool)
      const pools = await service.getPermissionPoolsByClearanceLevel(
        mockPrisma as unknown as PrismaClient,
        2, // Teacher level
      );

      // Get all permissions from pools
      const poolIds = pools.map((p) => p.id);
      const permissions = await service.getPermissionsFromPools(
        mockPrisma as unknown as PrismaClient,
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
      const role: Role = {
        id: 'role-1',
        clearanceLevel: 2,
        name: 'role-1',
        description: 'role-1',
        roleType: RoleType.SYSTEM,
        isSystemRole: false,
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: 'user-1',
        isActive: true,
      };

      mockPrisma.role?.findUnique?.mockResolvedValue(role);

      // Pools at level 2 and below should be valid
      mockPrisma.permissionPool?.findMany?.mockResolvedValue([
        {
          id: 'pool-1',
          name: 'pool-1',
          clearanceLevel: 2,
          description: 'pool-1',
          isSystemPool: false,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'pool-2',
          name: 'pool-2',
          clearanceLevel: 0,
          description: 'pool-2',
          isSystemPool: false,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.validatePermissionPoolAssignment(
        mockPrisma as unknown as PrismaClient,
        'role-1',
        ['pool-1', 'pool-2'],
      );

      expect(result.valid).toBe(true);
    });

    it('should reject permission pool assignment exceeding role clearance level', async () => {
      const role: Role = {
        id: 'role-1',
        clearanceLevel: 2,
        name: 'role-1',
        description: 'role-1',
        roleType: RoleType.CUSTOM,
        isSystemRole: false,
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: 'user-1',
        isActive: true,
      };

      mockPrisma.role?.findUnique?.mockResolvedValue(role);

      // Pool at level 5 exceeds role's level 2
      mockPrisma.permissionPool?.findMany?.mockResolvedValue([
        {
          id: 'pool-1',
          clearanceLevel: 5,
          name: 'pool-1',
          description: 'pool-1',
          isSystemPool: false,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.validatePermissionPoolAssignment(
        mockPrisma as unknown as PrismaClient,
        'role-1',
        ['pool-1'],
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceed');
    });
  });
});
