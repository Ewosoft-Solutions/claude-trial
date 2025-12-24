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
import { Prisma, PrismaClient, Permission } from '@workspace/database';
import { DeepMockProxy } from 'jest-mock-extended';

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: { rolePermissions: { include: { permission: true } } };
}>;

type UserTenantProfile = Prisma.UserTenantGetPayload<{
  include: {
    userTenantRoles: {
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } };
        };
      };
    };
    userTenantPermissions: {
      include: {
        permission: true;
      };
    };
    tenant: {
      select: {
        id: true;
        name: true;
        slug: true;
        status: true;
      };
    };
  };
}>;

type RolePermissionWithPermission = Prisma.RolePermissionGetPayload<{
  include: { permission: true };
}>;

type UserTenantPermissionWithPermission =
  Prisma.UserTenantPermissionGetPayload<{
    include: { permission: true };
  }>;

const buildPermission = (name: string): Permission => {
  const [resource = name, action = name, context] = name.split('.');
  return {
    id: `${name}-id`,
    name,
    label: name,
    description: `${name} permission`,
    resource,
    action,
    context: context ?? null,
    category: 'test',
    createdAt: new Date(),
  };
};

const buildRolePermission = (
  roleId: string,
  permissionName: string,
): RolePermissionWithPermission => {
  const permission = buildPermission(permissionName);
  return {
    id: `${roleId}-${permissionName}-rp`,
    roleId,
    permissionId: permission.id,
    grantedAt: new Date(),
    grantedBy: null,
    permission,
  };
};

const buildRole = ({
  id = 'role-id',
  name = 'Role',
  clearanceLevel = ClearanceLevel.TEACHER,
  permissions = [],
}: {
  id?: string;
  name?: string;
  clearanceLevel?: number;
  permissions?: string[];
}): RoleWithPermissions => ({
  id,
  name,
  description: null,
  createdBy: null,
  updatedBy: null,
  roleType: 'system',
  clearanceLevel,
  isSystemRole: true,
  tenantId: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  rolePermissions: permissions.map((permissionName) =>
    buildRolePermission(id, permissionName),
  ),
});

const buildUserTenantPermission = (
  userTenantId: string,
  permissionName: string,
  granted: boolean,
): UserTenantPermissionWithPermission => {
  const permission = buildPermission(permissionName);
  return {
    id: `${userTenantId}-${permissionName}-utp`,
    userTenantId,
    permissionId: permission.id,
    granted,
    grantedAt: new Date(),
    grantedBy: null,
    permission,
  };
};

const buildUserTenantProfile = ({
  id = 'profile-id',
  userId = 'user-id',
  tenantId = 'tenant-id',
  status = ProfileStatus.ACTIVE,
  suspended = false,
  roles = [] as RoleWithPermissions[],
  permissionOverrides = [] as UserTenantPermissionWithPermission[],
}: Partial<UserTenantProfile> & {
  roles?: RoleWithPermissions[];
  permissionOverrides?: UserTenantPermissionWithPermission[];
}): UserTenantProfile => ({
  id,
  userId,
  tenantId,
  status,
  suspended,
  suspendedAt: null,
  suspendedBy: null,
  suspensionReason: null,
  invitationToken: null,
  invitationExpiresAt: null,
  invitationAcceptedAt: null,
  addedBy: null,
  addedAt: new Date(),
  tenant: {
    id: tenantId,
    name: 'Tenant',
    slug: 'tenant',
    status: 'active',
  },
  userTenantRoles: roles.map((role, index) => ({
    id: `${id}-${role.id}-utr-${index}`,
    userTenantId: id,
    roleId: role.id,
    isPrimary: index === 0,
    assignedAt: new Date(),
    assignedBy: null,
    role,
  })),
  userTenantPermissions: permissionOverrides,
});

describe('PermissionService', () => {
  let service: PermissionService;
  let module: TestingModule;
  let mockPrisma: DeepMockProxy<PrismaClient>;
  let getUserTenantProfileSpy: jest.SpiedFunction<
    typeof TenantQueriesService.getUserTenantProfile
  >;

  beforeEach(async () => {
    const mockCtx = createMockContext();
    mockPrisma = mockCtx.prisma;

    module = await Test.createTestingModule({
      providers: [PermissionService, createPrismaClientProvider(mockPrisma)],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
    getUserTenantProfileSpy = jest.spyOn(
      TenantQueriesService,
      'getUserTenantProfile',
    );
    getUserTenantProfileSpy.mockReset();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await module.close();
  });

  describe('getUserPermissionContext', () => {
    it('should return null when user tenant profile does not exist', async () => {
      getUserTenantProfileSpy.mockResolvedValue(null);

      const result = await service.getUserPermissionContext(
        mockPrisma as PrismaClient,
        'user-id',
        'tenant-id',
        'profile-id',
      );

      expect(result).toBeNull();
    });

    it('should return null when profile is not active', async () => {
      getUserTenantProfileSpy.mockResolvedValue(
        buildUserTenantProfile({ status: ProfileStatus.INACTIVE }),
      );

      const result = await service.getUserPermissionContext(
        mockPrisma as PrismaClient,
        'user-id',
        'tenant-id',
        'profile-id',
      );

      expect(result).toBeNull();
    });

    it('should return null when profile is suspended', async () => {
      getUserTenantProfileSpy.mockResolvedValue(
        buildUserTenantProfile({ suspended: true }),
      );

      const result = await service.getUserPermissionContext(
        mockPrisma as PrismaClient,
        'user-id',
        'tenant-id',
        'profile-id',
      );

      expect(result).toBeNull();
    });

    it('should return permission context with roles and permissions', async () => {
      const role = buildRole({
        id: 'role-1',
        name: 'Teacher',
        clearanceLevel: ClearanceLevel.TEACHER,
        permissions: ['students.view', 'classes.view'],
      });

      getUserTenantProfileSpy.mockResolvedValue(
        buildUserTenantProfile({
          roles: [role],
        }),
      );

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
      expect(result?.roles.map((r) => r.name)).toEqual(['Teacher']);
      expect(result?.permissions.get('students.view')).toBe(true);
      expect(result?.permissions.get('classes.view')).toBe(true);
    });

    it('should apply profile-specific permission overrides', async () => {
      const role = buildRole({
        id: 'role-1',
        name: 'Teacher',
        clearanceLevel: ClearanceLevel.TEACHER,
        permissions: ['students.view'],
      });
      const override = buildUserTenantPermission(
        'profile-id',
        'students.view',
        false,
      );

      getUserTenantProfileSpy.mockResolvedValue(
        buildUserTenantProfile({
          roles: [role],
          permissionOverrides: [override],
        }),
      );

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
      const teacher = buildRole({
        id: 'role-1',
        name: 'Teacher',
        clearanceLevel: ClearanceLevel.TEACHER,
      });
      const admin = buildRole({
        id: 'role-2',
        name: 'Admin',
        clearanceLevel: ClearanceLevel.MANAGEMENT,
      });

      getUserTenantProfileSpy.mockResolvedValue(
        buildUserTenantProfile({
          roles: [teacher, admin],
        }),
      );

      const result = await service.getUserPermissionContext(
        mockPrisma as PrismaClient,
        'user-id',
        'tenant-id',
        'profile-id',
      );

      expect(result?.clearanceLevel).toBe(ClearanceLevel.MANAGEMENT);
    });
  });

  describe('checkClearanceLevel', () => {
    it('should grant access when clearance level meets requirement', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.MANAGEMENT,
        roles: [],
        permissions: new Map(),
        roleIds: ['role-1'],
      };

      const result = service.checkClearanceLevel(
        context,
        ClearanceLevel.TEACHER,
      );

      expect(result.granted).toBe(true);
      expect(result.clearanceLevel).toBe(ClearanceLevel.MANAGEMENT);
      expect(result.requiredClearanceLevel).toBe(ClearanceLevel.TEACHER);
    });

    it('should deny access when clearance level is insufficient', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.TEACHER,
        roles: [],
        permissions: new Map(),
        roleIds: ['role-1'],
      };

      const result = service.checkClearanceLevel(
        context,
        ClearanceLevel.MANAGEMENT,
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('insufficient_clearance');
      expect(result.clearanceLevel).toBe(ClearanceLevel.TEACHER);
      expect(result.requiredClearanceLevel).toBe(ClearanceLevel.MANAGEMENT);
    });

    it('should grant access when clearance level exactly matches requirement', () => {
      const context: UserPermissionContext = {
        userId: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        clearanceLevel: ClearanceLevel.MANAGEMENT,
        roles: [],
        permissions: new Map(),
        roleIds: ['role-1'],
      };

      const result = service.checkClearanceLevel(
        context,
        ClearanceLevel.MANAGEMENT,
      );

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
        roles: [],
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
        roles: [],
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
        roles: [],
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
        roles: [],
        permissions: new Map([['students.view', true]]),
        roleIds: ['role-1'],
      };

      const result = service.checkPermission(
        context,
        'students.view',
        ClearanceLevel.MANAGEMENT,
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
        roles: [],
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
        roles: [],
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
        roles: [],
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
        roles: [],
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
