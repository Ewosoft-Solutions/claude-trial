/**
 * Permission Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';
import { PermissionService, UserPermissionContext } from './permission.service';
import {
  TenantQueriesService,
  ProfileStatus,
  ClearanceLevel,
} from '@workspace/api';
import {
  createMockContext,
  createPrismaClientProvider,
} from '../../common/__tests__/test-utils';
import { PrismaClient } from '@workspace/database';
import { DeepMockProxy } from 'jest-mock-extended';

// Mock TenantQueriesService
jest.mock('@workspace/api', () => ({
  ...(jest.requireActual('@workspace/api') as Record<string, unknown>),
  TenantQueriesService: {
    getUserTenantProfile: jest.fn(),
  },
  ProfileStatus: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
  },
  ClearanceLevel: {
    STUDENT: 0,
    PARENT: 1,
    TEACHER: 2,
    ADMIN: 5,
    SUPER_ADMIN: 9,
    ARCHITECT: 10,
  },
}));

describe('PermissionService', () => {
  let service: PermissionService;
  let module: TestingModule;
  let mockPrisma: DeepMockProxy<PrismaClient>;
  const mockTenantQueriesService = TenantQueriesService as jest.Mocked<
    typeof TenantQueriesService
  >;

  beforeEach(async () => {
    const mockCtx = createMockContext();
    mockPrisma = mockCtx.prisma;

    module = await Test.createTestingModule({
      providers: [PermissionService, createPrismaClientProvider(mockPrisma)],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('getUserPermissionContext', () => {
    it('should return null when user tenant profile does not exist', async () => {
      mockTenantQueriesService.getUserTenantProfile.mockResolvedValue(null);

      const result = await service.getUserPermissionContext(
        mockPrisma as PrismaClient,
        'user-id',
        'tenant-id',
        'profile-id',
      );

      expect(result).toBeNull();
    });

    it('should return null when profile is not active', async () => {
      mockTenantQueriesService.getUserTenantProfile.mockResolvedValue({
        id: 'profile-id',
        userId: 'user-id',
        tenantId: 'tenant-id',
        status: ProfileStatus.INACTIVE,
        suspended: false,
        userTenantRoles: [],
        userTenantPermissions: [],
      } as any);

      const result = await service.getUserPermissionContext(
        mockPrisma as PrismaClient,
        'user-id',
        'tenant-id',
        'profile-id',
      );

      expect(result).toBeNull();
    });

    it('should return null when profile is suspended', async () => {
      mockTenantQueriesService.getUserTenantProfile.mockResolvedValue({
        id: 'profile-id',
        userId: 'user-id',
        tenantId: 'tenant-id',
        status: ProfileStatus.ACTIVE,
        suspended: true,
        userTenantRoles: [],
        userTenantPermissions: [],
      } as unknown as UserTenantProfile);

      const result = await service.getUserPermissionContext(
        mockPrisma as PrismaClient,
        'user-id',
        'tenant-id',
        'profile-id',
      );

      expect(result).toBeNull();
    });

    it('should return permission context with roles and permissions', async () => {
      mockTenantQueriesService.getUserTenantProfile.mockResolvedValue({
        id: 'profile-id',
        userId: 'user-id',
        tenantId: 'tenant-id',
        status: ProfileStatus.ACTIVE,
        suspended: false,
        userTenantRoles: [
          {
            role: {
              id: 'role-1',
              name: 'Teacher',
              clearanceLevel: ClearanceLevel.TEACHER,
              rolePermissions: [
                {
                  permission: {
                    name: 'students.view',
                  },
                },
                {
                  permission: {
                    name: 'classes.view',
                  },
                },
              ],
            },
          },
        ],
        userTenantPermissions: [],
      } as any);

      const result = await service.getUserPermissionContext(
        mockPrisma as PrismaClient,
        'user-id',
        'tenant-id',
        'profile-id',
      );

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-id');
      expect(result?.tenantId).toBe('tenant-id');
      expect(result?.profileId).toBe('profile-id');
      expect(result?.clearanceLevel).toBe(ClearanceLevel.TEACHER);
      expect(result?.roles).toEqual(['Teacher']);
      expect(result?.permissions.get('students.view')).toBe(true);
      expect(result?.permissions.get('classes.view')).toBe(true);
    });

    it('should apply profile-specific permission overrides', async () => {
      mockTenantQueriesService.getUserTenantProfile.mockResolvedValue({
        id: 'profile-id',
        userId: 'user-id',
        tenantId: 'tenant-id',
        status: ProfileStatus.ACTIVE,
        suspended: false,
        userTenantRoles: [
          {
            role: {
              id: 'role-1',
              name: 'Teacher',
              clearanceLevel: ClearanceLevel.TEACHER,
              rolePermissions: [
                {
                  permission: {
                    name: 'students.view',
                  },
                },
              ],
            },
          },
        ],
        userTenantPermissions: [
          {
            permission: {
              name: 'students.view',
            },
            granted: false, // Override: deny permission
          },
        ],
      } as any);

      const result = await service.getUserPermissionContext(
        mockPrisma as PrismaClient,
        'user-id',
        'tenant-id',
        'profile-id',
      );

      expect(result).not.toBeNull();
      expect(result?.permissions.get('students.view')).toBe(false);
    });

    it('should calculate maximum clearance level from multiple roles', async () => {
      mockTenantQueriesService.getUserTenantProfile.mockResolvedValue({
        id: 'profile-id',
        userId: 'user-id',
        tenantId: 'tenant-id',
        status: ProfileStatus.ACTIVE,
        suspended: false,
        userTenantRoles: [
          {
            role: {
              id: 'role-1',
              name: 'Teacher',
              clearanceLevel: ClearanceLevel.TEACHER,
              rolePermissions: [],
            },
          },
          {
            role: {
              id: 'role-2',
              name: 'Admin',
              clearanceLevel: ClearanceLevel.ADMIN,
              rolePermissions: [],
            },
          },
        ],
        userTenantPermissions: [],
      } as any);

      const result = await service.getUserPermissionContext(
        mockPrisma as PrismaClient,
        'user-id',
        'tenant-id',
        'profile-id',
      );

      expect(result?.clearanceLevel).toBe(ClearanceLevel.ADMIN);
    });
  });

  describe('checkClearanceLevel', () => {
    it('should grant access when clearance level meets requirement', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.ADMIN,
        roles: ['Admin'],
        permissions: new Map(),
        roleIds: ['role-1'],
      };

      const result = service.checkClearanceLevel(
        context,
        ClearanceLevel.TEACHER,
      );

      expect(result.granted).toBe(true);
      expect(result.clearanceLevel).toBe(ClearanceLevel.ADMIN);
      expect(result.requiredClearanceLevel).toBe(ClearanceLevel.TEACHER);
    });

    it('should deny access when clearance level is insufficient', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.TEACHER,
        roles: ['Teacher'],
        permissions: new Map(),
        roleIds: ['role-1'],
      };

      const result = service.checkClearanceLevel(context, ClearanceLevel.ADMIN);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('insufficient_clearance');
      expect(result.clearanceLevel).toBe(ClearanceLevel.TEACHER);
      expect(result.requiredClearanceLevel).toBe(ClearanceLevel.ADMIN);
    });

    it('should grant access when clearance level exactly matches requirement', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.ADMIN,
        roles: ['Admin'],
        permissions: new Map(),
        roleIds: ['role-1'],
      };

      const result = service.checkClearanceLevel(context, ClearanceLevel.ADMIN);

      expect(result.granted).toBe(true);
    });
  });

  describe('checkPermission', () => {
    it('should grant access when permission is granted', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.TEACHER,
        roles: ['Teacher'],
        permissions: new Map([['students.view', true]]),
        roleIds: ['role-1'],
      };

      const result = service.checkPermission(context, 'students.view');

      expect(result.granted).toBe(true);
    });

    it('should deny access when permission is denied', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.TEACHER,
        roles: ['Teacher'],
        permissions: new Map([['students.view', false]]),
        roleIds: ['role-1'],
      };

      const result = service.checkPermission(context, 'students.view');

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('permission_denied');
    });

    it('should deny access when permission is not found', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.TEACHER,
        roles: ['Teacher'],
        permissions: new Map(),
        roleIds: ['role-1'],
      };

      const result = service.checkPermission(context, 'students.view');

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('permission_not_found');
    });

    it('should check clearance level when required', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.TEACHER,
        roles: ['Teacher'],
        permissions: new Map([['students.view', true]]),
        roleIds: ['role-1'],
      };

      const result = service.checkPermission(
        context,
        'students.view',
        ClearanceLevel.ADMIN,
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('insufficient_clearance');
    });
  });

  describe('checkPermissions', () => {
    it('should grant access when all permissions are granted', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.TEACHER,
        roles: ['Teacher'],
        permissions: new Map([
          ['students.view', true],
          ['classes.view', true],
        ]),
        roleIds: ['role-1'],
      };

      const result = service.checkPermissions(context, [
        'students.view',
        'classes.view',
      ]);

      expect(result.granted).toBe(true);
    });

    it('should deny access when any permission is missing', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.TEACHER,
        roles: ['Teacher'],
        permissions: new Map([['students.view', true]]),
        roleIds: ['role-1'],
      };

      const result = service.checkPermissions(context, [
        'students.view',
        'classes.view',
      ]);

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('missing_permission');
    });
  });

  describe('checkAnyPermission', () => {
    it('should grant access when at least one permission is granted', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.TEACHER,
        roles: ['Teacher'],
        permissions: new Map([
          ['students.view', true],
          ['classes.view', false],
        ]),
        roleIds: ['role-1'],
      };

      const result = service.checkAnyPermission(context, [
        'students.view',
        'classes.view',
      ]);

      expect(result.granted).toBe(true);
    });

    it('should deny access when no permissions are granted', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.TEACHER,
        roles: ['Teacher'],
        permissions: new Map([
          ['students.view', false],
          ['classes.view', false],
        ]),
        roleIds: ['role-1'],
      };

      const result = service.checkAnyPermission(context, [
        'students.view',
        'classes.view',
      ]);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('none_of_permissions_granted');
    });
  });
});
