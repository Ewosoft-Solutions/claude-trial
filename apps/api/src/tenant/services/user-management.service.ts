import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateUserDto,
  BulkCreateUsersDto,
  AddUserToTenantDto,
  UpdateUserDto,
  UpdateUserProfileDto,
} from '../dto';
import { EmailDomainValidationService } from './email-domain-validation.service';
import { TenantAuditService } from './tenant-audit.service';
import { DatabaseService } from '../../common/database/database.service';
import { ProfileStatus } from '@workspace/api';
import * as bcrypt from 'bcrypt';
import { AUDIT_ACTION } from '../../common/audit/audit.constants';

/**
 * User Management Service
 *
 * Handles user addition to tenants (direct creation, invitation, bulk import).
 * 6.4: Implement admin-controlled user addition (direct creation, invitation, bulk import)
 * 6.10: Implement multi-school user management (profile-based)
 * 6.11: Implement audit logging for user additions
 */
@Injectable()
export class UserManagementService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly emailValidationService: EmailDomainValidationService,
    private readonly auditService: TenantAuditService,
  ) {}

  /**
   * Create user directly (without invitation)
   *
   * @param tenantId - Tenant ID
   * @param data - User creation data
   * @param createdBy - User ID of the creator
   * @returns Created user
   */
  async createUser(tenantId: string, data: CreateUserDto, createdBy: string) {
    // Validate email domain if tenant has email domain configured
    const emailValidation =
      await this.emailValidationService.validateEmailForTenant(
        tenantId,
        data.email,
      );

    if (!emailValidation.valid) {
      throw new BadRequestException(emailValidation.error);
    }

    // Check if user already exists
    const existingUser = await this.dbService.client.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: { id: true },
    });

    if (existingUser) {
      // Add existing user to tenant (one profile per role enforcement handled downstream)
      return this.addUserToTenant(
        tenantId,
        {
          userId: existingUser.id,
          roleIds: data.roleIds,
        },
        createdBy,
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await this.dbService.client.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        isActive: true,
        isVerified: true,
        emailVerifiedAt: new Date(),
        createdBy,
      },
    });

    // Create user-tenant relationship (profile)
    const userTenant = await this.dbService.client.userTenant.create({
      data: {
        userId: user.id,
        tenantId,
        status: ProfileStatus.ACTIVE,
        addedBy: createdBy,
      },
    });

    // Assign roles
    if (data.roleIds.length > 0) {
      await Promise.all(
        data.roleIds.map((roleId, index) =>
          this.dbService.client.userTenantRole.create({
            data: {
              userTenantId: userTenant.id,
              tenantId, // denormalized for RLS scoping (policy has no NULL escape)
              roleId,
              isPrimary: index === 0, // First role is primary
              assignedBy: createdBy,
            },
          }),
        ),
      );
    }

    // 6.11: Audit log
    await this.auditService.logUserAction({
      action: AUDIT_ACTION.USER_MANAGEMENT.USER_CREATED,
      tenantId,
      userId: user.id,
      performedBy: createdBy,
      metadata: {
        email: data.email,
        method: 'direct_creation',
        roleIds: data.roleIds,
      },
    });

    return {
      user,
      profile: userTenant,
    };
  }

  /**
   * Bulk create users
   *
   * @param tenantId - Tenant ID
   * @param data - Bulk user creation data
   * @param createdBy - User ID of the creator
   * @returns Bulk creation results
   */
  async bulkCreateUsers(
    tenantId: string,
    data: BulkCreateUsersDto,
    createdBy: string,
  ) {
    const results = [];

    for (const userData of data.users) {
      try {
        const result = await this.createUser(tenantId, userData, createdBy);
        results.push({ success: true, data: result });
      } catch (error: any) {
        results.push({
          success: false,
          email: userData.email,
          error: error.message,
        });
      }
    }

    return {
      total: data.users.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Add existing user to tenant
   *
   * @param tenantId - Tenant ID
   * @param data - Add user data
   * @param createdBy - User ID of the creator
   * @returns Created profile
   */
  async addUserToTenant(
    tenantId: string,
    data: AddUserToTenantDto,
    createdBy: string,
  ) {
    // Check if user exists
    const user = await this.dbService.client.user.findUnique({
      where: { id: data.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (data.roleIds.length !== 1) {
      throw new BadRequestException(
        'Exactly one role must be provided per profile',
      );
    }

    // Check if user already has this role in this tenant (one profile per role)
    const existingProfileWithRole =
      await this.dbService.client.userTenantRole.findFirst({
        where: {
          roleId: data.roleIds[0],
          userTenant: {
            userId: data.userId,
            tenantId,
          },
        },
        select: { id: true },
      });

    if (existingProfileWithRole) {
      throw new ConflictException(
        'User already has this role in the tenant (profile exists)',
      );
    }

    // Validate email domain if tenant has email domain configured
    const emailValidation =
      await this.emailValidationService.validateEmailForTenant(
        tenantId,
        user.email,
      );

    if (!emailValidation.valid) {
      throw new BadRequestException(emailValidation.error);
    }

    // Create user-tenant relationship (profile)
    const userTenant = await this.dbService.client.userTenant.create({
      data: {
        userId: data.userId,
        tenantId,
        status: ProfileStatus.ACTIVE,
        addedBy: createdBy,
      },
    });

    // Assign single role to the new profile
    await this.dbService.client.userTenantRole.create({
      data: {
        userTenantId: userTenant.id,
        tenantId, // denormalized for RLS scoping (policy has no NULL escape)
        roleId: data.roleIds[0],
        isPrimary: true,
        assignedBy: createdBy,
      },
    });

    // 6.11: Audit log
    await this.auditService.logUserAction({
      action: AUDIT_ACTION.USER_MANAGEMENT.USER_ADDED_TO_TENANT,
      tenantId,
      userId: data.userId,
      performedBy: createdBy,
      metadata: {
        email: user.email,
        roleIds: data.roleIds,
      },
    });

    return userTenant;
  }

  /**
   * Get user profiles for a tenant
   *
   * 6.10: Multi-school user management (profile-based)
   *
   * @param tenantId - Tenant ID
   * @param filters - Optional filters
   * @returns User profiles
   */
  async getUserProfiles(
    tenantId: string,
    filters?: {
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.user = {
        OR: [
          { email: { contains: filters.search, mode: 'insensitive' } },
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    const [profiles, total] = await Promise.all([
      this.dbService.client.userTenant.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              isActive: true,
              isVerified: true,
            },
          },
          userTenantRole: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  clearanceLevel: true,
                },
              },
            },
          },
        },
        orderBy: {
          addedAt: 'desc',
        },
      }),
      this.dbService.client.userTenant.count({ where }),
    ]);

    return {
      data: profiles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get user profile by ID (12.3)
   *
   * @param tenantId - Tenant ID
   * @param profileId - Profile ID (UserTenant ID)
   * @returns User profile
   */
  async getUserProfile(tenantId: string, profileId: string) {
    const profile = await this.dbService.client.userTenant.findFirst({
      where: {
        id: profileId,
        tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            isVerified: true,
            lastLoginAt: true,
          },
        },
        userTenantRole: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                description: true,
                clearanceLevel: true,
                roleType: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    return profile;
  }

  /**
   * Update user (12.3)
   *
   * @param userId - User ID
   * @param data - Update data
   * @param updatedBy - User ID of the updater
   * @returns Updated user
   */
  async updateUser(userId: string, data: UpdateUserDto, updatedBy: string) {
    const user = await this.dbService.client.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {
      updatedBy,
    };

    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName;
    }
    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName;
    }
    if (data.phone !== undefined) {
      updateData.phone = data.phone;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const updatedUser = await this.dbService.client.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        isVerified: true,
        updatedAt: true,
      },
    });

    // Audit log
    await this.auditService.logUserAction({
      action: AUDIT_ACTION.USER_MANAGEMENT.USER_UPDATED,
      tenantId: '', // Will be set by caller if needed
      userId,
      performedBy: updatedBy,
      metadata: {
        changes: data,
      },
    });

    return updatedUser;
  }

  /**
   * Update user profile (12.3)
   *
   * @param tenantId - Tenant ID
   * @param profileId - Profile ID (UserTenant ID)
   * @param data - Update data
   * @param updatedBy - User ID of the updater
   * @returns Updated profile
   */
  async updateUserProfile(
    tenantId: string,
    profileId: string,
    data: UpdateUserProfileDto,
    updatedBy: string,
  ) {
    const profile = await this.dbService.client.userTenant.findFirst({
      where: {
        id: profileId,
        tenantId,
      },
      select: { id: true, userId: true },
    });

    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    const updateData: any = {};

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    const updatedProfile = await this.dbService.client.userTenant.update({
      where: { id: profileId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
          },
        },
        userTenantRole: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                clearanceLevel: true,
              },
            },
          },
        },
      },
    });

    // Update roles if provided
    if (data.roleIds && data.roleIds.length > 0) {
      // Remove existing roles
      await this.dbService.client.userTenantRole.deleteMany({
        where: { userTenantId: profileId },
      });

      // Add new roles
      await Promise.all(
        data.roleIds.map((roleId, index) =>
          this.dbService.client.userTenantRole.create({
            data: {
              userTenantId: profileId,
              tenantId, // denormalized for RLS scoping (policy has no NULL escape)
              roleId,
              isPrimary: index === 0,
              assignedBy: updatedBy,
            },
          }),
        ),
      );
    }

    // Audit log
    await this.auditService.logUserAction({
      action: AUDIT_ACTION.USER_MANAGEMENT.USER_PROFILE_UPDATED,
      tenantId,
      userId: profile.userId,
      performedBy: updatedBy,
      metadata: {
        profileId,
        changes: data,
      },
    });

    return this.getUserProfile(tenantId, profileId);
  }

  /**
   * Delete user profile (remove from tenant) (12.3)
   *
   * @param tenantId - Tenant ID
   * @param profileId - Profile ID (UserTenant ID)
   * @param deletedBy - User ID of the deleter
   * @returns Success response
   */
  async deleteUserProfile(
    tenantId: string,
    profileId: string,
    deletedBy: string,
  ) {
    const profile = await this.dbService.client.userTenant.findFirst({
      where: {
        id: profileId,
        tenantId,
      },
      select: { id: true, userId: true },
    });

    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    // Delete profile (cascade will handle roles)
    await this.dbService.client.userTenant.delete({
      where: { id: profileId },
    });

    // Audit log
    await this.auditService.logUserAction({
      action: AUDIT_ACTION.USER_MANAGEMENT.USER_PROFILE_DELETED,
      tenantId,
      userId: profile.userId,
      performedBy: deletedBy,
      metadata: {
        profileId,
      },
    });

    return {
      success: true,
      message: 'User profile deleted successfully',
    };
  }
}
