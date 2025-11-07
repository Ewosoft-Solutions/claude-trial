import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { CreateUserDto, BulkCreateUsersDto, AddUserToTenantDto } from '../dto';
import { EmailDomainValidationService } from './email-domain-validation.service';
import { TenantAuditService } from './tenant-audit.service';
import { ProfileStatus } from '@workspace/api';
import * as bcrypt from 'bcrypt';

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
    private readonly emailValidationService: EmailDomainValidationService,
    private readonly auditService: TenantAuditService,
  ) {}

  /**
   * Create user directly (without invitation)
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param data - User creation data
   * @param createdBy - User ID of the creator
   * @returns Created user
   */
  async createUser(
    prisma: PrismaClient,
    tenantId: string,
    data: CreateUserDto,
    createdBy: string,
  ) {
    // Validate email domain if tenant has email domain configured
    const emailValidation =
      await this.emailValidationService.validateEmailForTenant(
        prisma,
        tenantId,
        data.email,
      );

    if (!emailValidation.valid) {
      throw new BadRequestException(emailValidation.error);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: { id: true },
    });

    if (existingUser) {
      // Check if user already has access to this tenant
      const existingAccess = await prisma.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId: existingUser.id,
            tenantId,
          },
        },
        select: { id: true },
      });

      if (existingAccess) {
        throw new ConflictException('User already has access to this tenant');
      }

      // Add existing user to tenant
      return this.addUserToTenant(
        prisma,
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
    const user = await prisma.user.create({
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
    const userTenant = await prisma.userTenant.create({
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
          prisma.userTenantRole.create({
            data: {
              userTenantId: userTenant.id,
              roleId,
              isPrimary: index === 0, // First role is primary
              assignedBy: createdBy,
            },
          }),
        ),
      );
    }

    // 6.11: Audit log
    await this.auditService.logUserAction(prisma, {
      action: 'user_created',
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
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param data - Bulk user creation data
   * @param createdBy - User ID of the creator
   * @returns Bulk creation results
   */
  async bulkCreateUsers(
    prisma: PrismaClient,
    tenantId: string,
    data: BulkCreateUsersDto,
    createdBy: string,
  ) {
    const results = [];

    for (const userData of data.users) {
      try {
        const result = await this.createUser(
          prisma,
          tenantId,
          userData,
          createdBy,
        );
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
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param data - Add user data
   * @param createdBy - User ID of the creator
   * @returns Created profile
   */
  async addUserToTenant(
    prisma: PrismaClient,
    tenantId: string,
    data: AddUserToTenantDto,
    createdBy: string,
  ) {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already has access to this tenant
    const existingAccess = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: data.userId,
          tenantId,
        },
      },
      select: { id: true },
    });

    if (existingAccess) {
      throw new ConflictException('User already has access to this tenant');
    }

    // Validate email domain if tenant has email domain configured
    const emailValidation =
      await this.emailValidationService.validateEmailForTenant(
        prisma,
        tenantId,
        user.email,
      );

    if (!emailValidation.valid) {
      throw new BadRequestException(emailValidation.error);
    }

    // Create user-tenant relationship (profile)
    const userTenant = await prisma.userTenant.create({
      data: {
        userId: data.userId,
        tenantId,
        status: ProfileStatus.ACTIVE,
        addedBy: createdBy,
      },
    });

    // Assign roles
    if (data.roleIds.length > 0) {
      await Promise.all(
        data.roleIds.map((roleId, index) =>
          prisma.userTenantRole.create({
            data: {
              userTenantId: userTenant.id,
              roleId,
              isPrimary: index === 0, // First role is primary
              assignedBy: createdBy,
            },
          }),
        ),
      );
    }

    // 6.11: Audit log
    await this.auditService.logUserAction(prisma, {
      action: 'user_added_to_tenant',
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
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param filters - Optional filters
   * @returns User profiles
   */
  async getUserProfiles(
    prisma: PrismaClient,
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
      prisma.userTenant.findMany({
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
          userTenantRoles: {
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
      prisma.userTenant.count({ where }),
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
}
