/**
 * Custom Role Creation Constraints Validation Tests
 *
 * Validates that custom role creation constraints are enforced correctly.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RoleService } from '../src/auth/services/role.service';
import { PermissionPoolService } from '../src/auth/services/permission-pool.service';
import {
  createMockContext,
  MockContext,
} from '../src/common/__tests__/test-utils';
import { PrismaClient } from '@workspace/database';
import { RoleType } from '@workspace/api';
import { PRISMA_CLIENT_TOKEN } from '../src/common';
import { MakerCheckerService } from '../src/auth/services/maker-checker.service';

describe('Custom Role Creation Constraints Validation', () => {
  let roleService: RoleService;
  let permissionPoolService: PermissionPoolService;
  let mockPrisma: MockContext['prisma'];
  let makerCheckerService: MakerCheckerService;

  beforeEach(async () => {
    const mockCtx = createMockContext();
    mockPrisma = mockCtx.prisma;

    makerCheckerService = {
      createApprovalRequest: jest.fn().mockResolvedValue('approval-1'),
      approveRequest: jest.fn(),
      rejectRequest: jest.fn(),
      requiresApproval: jest.fn(),
      getRequiredCheckerClearanceLevel: jest.fn(),
      getSensitiveOperation: jest.fn(),
    } as unknown as MakerCheckerService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        PermissionPoolService,
        {
          provide: MakerCheckerService,
          useValue: makerCheckerService,
        },
        {
          provide: PRISMA_CLIENT_TOKEN,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    roleService = module.get<RoleService>(RoleService);
    permissionPoolService = module.get<PermissionPoolService>(
      PermissionPoolService,
    );
  });

  describe('Clearance Level Constraints (0-7 only)', () => {
    it('should allow custom role creation at clearance level 0', async () => {
      const result = await roleService.validateCustomRoleCreation(
        mockPrisma as PrismaClient,
        {
          name: 'Custom Student Role',
          clearanceLevel: 0,
          tenantId: 'tenant-id',
          createdBy: 'user-id',
        },
      );

      expect(result.valid).toBe(true);
    });

    it('should allow custom role creation at clearance level 7', async () => {
      const result = await roleService.validateCustomRoleCreation(
        mockPrisma as PrismaClient,
        {
          name: 'Custom Admin Role',
          clearanceLevel: 7,
          tenantId: 'tenant-id',
          createdBy: 'user-id',
        },
      );

      expect(result.valid).toBe(true);
    });

    it('should reject custom role creation at clearance level 8', async () => {
      const result = await roleService.validateCustomRoleCreation(
        mockPrisma as PrismaClient,
        {
          name: 'Custom Super Admin Role',
          clearanceLevel: 8,
          tenantId: 'tenant-id',
          createdBy: 'user-id',
        },
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('clearance level');
    });

    it('should reject custom role creation at clearance level 9', async () => {
      const result = await roleService.validateCustomRoleCreation(
        mockPrisma as PrismaClient,
        {
          name: 'Custom Super Admin Role',
          clearanceLevel: 9,
          tenantId: 'tenant-id',
          createdBy: 'user-id',
        },
      );

      expect(result.valid).toBe(false);
    });

    it('should reject custom role creation at clearance level 10', async () => {
      const result = await roleService.validateCustomRoleCreation(
        mockPrisma as PrismaClient,
        {
          name: 'Custom Architect Role',
          clearanceLevel: 10,
          tenantId: 'tenant-id',
          createdBy: 'user-id',
        },
      );

      expect(result.valid).toBe(false);
    });
  });

  describe('Permission Pool Validation', () => {
    it('should validate permissions are within permission pool', async () => {
      // Mock permission pools for clearance level 2
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

      const pools =
        await permissionPoolService.getPermissionPoolsByClearanceLevel(
          mockPrisma as PrismaClient,
          2,
        );

      const poolIds = pools.map((p) => p.id);
      const permissions = await permissionPoolService.getPermissionsFromPools(
        mockPrisma as PrismaClient,
        poolIds,
      );

      const permissionNames = permissions.map((p) => p.name);
      expect(permissionNames).toContain('students.view.all');
      expect(permissionNames).toContain('classes.manage');
    });

    it('should reject permissions outside permission pool', async () => {
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

      const pools =
        await permissionPoolService.getPermissionPoolsByClearanceLevel(
          mockPrisma as PrismaClient,
          2,
        );

      const poolIds = pools.map((p) => p.id);
      const permissions = await permissionPoolService.getPermissionsFromPools(
        mockPrisma as PrismaClient,
        poolIds,
      );

      const permissionNames = permissions.map((p) => p.name);
      // 'users.manage' is not in the pool
      expect(permissionNames).not.toContain('users.manage');
    });
  });

  describe('Role Name Uniqueness', () => {
    it('should validate role name uniqueness for platform/system roles', async () => {
      // Mock existing platform role
      mockPrisma.role?.findFirst?.mockResolvedValue({
        id: 'existing-role',
        name: 'Existing Role',
        roleType: RoleType.PLATFORM,
        clearanceLevel: 0,
        description: 'Existing Role',
        tenantId: 'tenant-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-id',
        updatedBy: 'user-id',
        isActive: true,
        isSystemRole: true,
      });

      const result = await roleService.validateRoleNameUniqueness(
        mockPrisma as PrismaClient,
        'Existing Role',
        RoleType.PLATFORM,
      );

      expect(result.unique).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should validate role name uniqueness for custom roles per tenant', async () => {
      // Mock existing custom role for tenant
      mockPrisma.role?.findFirst?.mockResolvedValue({
        id: 'existing-role',
        name: 'Existing Role',
        roleType: RoleType.CUSTOM,
        tenantId: 'tenant-id',
        clearanceLevel: 0,
        description: 'Existing Role',
        isSystemRole: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-id',
        updatedBy: 'user-id',
        isActive: true,
      });

      const result = await roleService.validateRoleNameUniqueness(
        mockPrisma as PrismaClient,
        'Existing Role',
        RoleType.CUSTOM,
        'tenant-id',
      );

      expect(result.unique).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should allow role name if it does not exist', async () => {
      mockPrisma.role?.findFirst?.mockResolvedValue(null);

      const result = await roleService.validateRoleNameUniqueness(
        mockPrisma as PrismaClient,
        'New Role',
        RoleType.CUSTOM,
        'tenant-id',
      );

      expect(result.unique).toBe(true);
    });
  });

  describe('Level-7 custom role approvals', () => {
    it('creates level-7 custom role as pending and raises maker-checker request', async () => {
      mockPrisma.role.findFirst.mockResolvedValue(null);
      mockPrisma.permissionPool.findMany.mockResolvedValue([
        {
          id: 'pool-7',
          name: 'Level7_SchoolManagement',
          clearanceLevel: 7,
          description: 'pool',
          isSystemPool: true,
          tenantId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          poolPermissions: [
            {
              id: 'pp-1',
              poolId: 'pool-7',
              permissionId: 'perm-1',
              addedAt: new Date(),
              addedBy: 'user-1',
              permission: {
                id: 'perm-1',
                name: 'students.view',
                label: 'View',
                description: '',
                resource: 'students',
                action: 'view',
                context: null,
                category: 'academic',
                requiredClearanceLevel: 3,
                createdAt: new Date(),
              },
            },
          ],
        },
      ]);
      mockPrisma.role.create.mockResolvedValue({
        id: 'role-1',
        name: 'Management Custom',
        description: 'desc',
        roleType: RoleType.CUSTOM,
        clearanceLevel: 7,
        tenantId: 'tenant-1',
        isSystemRole: false,
        isActive: false,
        createdBy: 'user-1',
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.rolePermissionPool.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.rolePermission.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.role.findUnique.mockResolvedValue({
        id: 'role-1',
        name: 'Management Custom',
        description: 'desc',
        roleType: RoleType.CUSTOM,
        clearanceLevel: 7,
        tenantId: 'tenant-1',
        isSystemRole: false,
        isActive: false,
        createdBy: 'user-1',
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        rolePermissions: [],
        rolePools: [],
      });

      const result = await roleService.createCustomRole(
        mockPrisma as unknown as PrismaClient,
        {
          name: 'Management Custom',
          description: 'desc',
          clearanceLevel: 7,
          tenantId: 'tenant-1',
          permissionPoolIds: ['pool-7'],
          createdBy: 'user-1',
          creatorClearanceLevel: 8,
        },
      );

      expect(result.approvalStatus).toBe('pending_approval');
      expect(result.approvalRequestId).toBe('approval-1');
      expect(makerCheckerService.createApprovalRequest).toHaveBeenCalledWith(
        mockPrisma,
        'roles.custom.level7.create',
        'user-1',
        8,
        expect.objectContaining({ roleId: 'role-1' }),
        'tenant-1',
      );
      expect(result.role?.isActive).toBe(false);
    });
  });
});
