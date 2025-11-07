import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import {
  CreateInvitationDto,
  BulkCreateInvitationsDto,
  AcceptInvitationDto,
} from '../dto';
import { EmailDomainValidationService } from './email-domain-validation.service';
import { TenantAuditService } from './tenant-audit.service';
import { ProfileStatus } from '@workspace/api';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * User Invitation Service
 *
 * Handles user invitation system with token-based invitations.
 * 6.5: Implement user invitation system (token-based, email links, expiration)
 */
@Injectable()
export class UserInvitationService {
  constructor(
    private readonly emailValidationService: EmailDomainValidationService,
    private readonly auditService: TenantAuditService,
  ) {}

  /**
   * Create user invitation
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param data - Invitation data
   * @param createdBy - User ID of the creator
   * @returns Created invitation
   */
  async createInvitation(
    prisma: PrismaClient,
    tenantId: string,
    data: CreateInvitationDto,
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
    let user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: { id: true },
    });

    // Check if user already has access to this tenant
    if (user) {
      const existingAccess = await prisma.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId: user.id,
            tenantId,
          },
        },
        select: { id: true },
      });

      if (existingAccess) {
        throw new ConflictException('User already has access to this tenant');
      }
    }

    // Generate invitation token
    const invitationToken = this.generateInvitationToken();
    const expirationHours = data.expirationHours || 168; // Default: 7 days
    const invitationExpiresAt = new Date();
    invitationExpiresAt.setHours(
      invitationExpiresAt.getHours() + expirationHours,
    );

    // Create or get user
    if (!user) {
      // Create user without password (will be set when invitation is accepted)
      user = await prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          firstName: data.firstName,
          lastName: data.lastName,
          isActive: true,
          isVerified: false, // Will be verified when invitation is accepted
        },
      });
    }

    // Create user-tenant relationship with invitation
    const userTenant = await prisma.userTenant.create({
      data: {
        userId: user.id,
        tenantId,
        status: ProfileStatus.PENDING, // Pending until invitation is accepted
        invitationToken,
        invitationExpiresAt,
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

    // Audit log
    await this.auditService.logUserAction(prisma, {
      action: 'user_invitation_created',
      tenantId,
      userId: user.id,
      performedBy: createdBy,
      metadata: {
        email: data.email,
        roleIds: data.roleIds,
        expirationHours,
      },
    });

    return {
      id: userTenant.id,
      invitationToken,
      invitationExpiresAt,
      email: data.email,
    };
  }

  /**
   * Bulk create invitations
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param data - Bulk invitation data
   * @param createdBy - User ID of the creator
   * @returns Created invitations
   */
  async bulkCreateInvitations(
    prisma: PrismaClient,
    tenantId: string,
    data: BulkCreateInvitationsDto,
    createdBy: string,
  ) {
    const results = [];

    for (const invitation of data.invitations) {
      try {
        const result = await this.createInvitation(
          prisma,
          tenantId,
          invitation,
          createdBy,
        );
        results.push({ success: true, data: result });
      } catch (error: any) {
        results.push({
          success: false,
          email: invitation.email,
          error: error.message,
        });
      }
    }

    return {
      total: data.invitations.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Accept invitation
   *
   * @param prisma - Prisma client instance
   * @param data - Acceptance data
   * @returns Accepted invitation
   */
  async acceptInvitation(prisma: PrismaClient, data: AcceptInvitationDto) {
    // Find invitation by token
    const userTenant = await prisma.userTenant.findFirst({
      where: {
        invitationToken: data.token,
        invitationExpiresAt: {
          gt: new Date(), // Not expired
        },
        invitationAcceptedAt: null, // Not already accepted
      },
      include: {
        user: true,
        tenant: true,
      },
    });

    if (!userTenant) {
      throw new NotFoundException('Invitation not found or expired');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Update user
    await prisma.user.update({
      where: { id: userTenant.userId },
      data: {
        passwordHash,
        firstName: data.firstName || userTenant.user.firstName,
        lastName: data.lastName || userTenant.user.lastName,
        isVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    // Update user-tenant relationship
    await prisma.userTenant.update({
      where: { id: userTenant.id },
      data: {
        status: ProfileStatus.ACTIVE,
        invitationAcceptedAt: new Date(),
        invitationToken: null, // Clear token
      },
    });

    // Audit log
    await this.auditService.logUserAction(prisma, {
      action: 'user_invitation_accepted',
      tenantId: userTenant.tenantId,
      userId: userTenant.userId,
      performedBy: userTenant.userId,
      metadata: {
        email: userTenant.user.email,
      },
    });

    return {
      success: true,
      userId: userTenant.userId,
      tenantId: userTenant.tenantId,
    };
  }

  /**
   * Generate invitation token
   */
  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
