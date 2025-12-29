import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  CreateInvitationDto,
  BulkCreateInvitationsDto,
  AcceptInvitationDto,
} from '../dto';
import { EmailDomainValidationService } from './email-domain-validation.service';
import { TenantAuditService } from './tenant-audit.service';
import { DatabaseService } from '../../common/database/database.service';
import { ProfileStatus } from '@workspace/api';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { AUDIT_ACTION } from '../../common/audit/audit.constants';
import { QueueService } from '../../common/queue/queue.service';

/**
 * User Invitation Service
 *
 * Handles user invitation system with token-based invitations.
 * 6.5: Implement user invitation system (token-based, email links, expiration)
 */
@Injectable()
export class UserInvitationService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly emailValidationService: EmailDomainValidationService,
    private readonly auditService: TenantAuditService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Create user invitation
   *
   * @param tenantId - Tenant ID
   * @param data - Invitation data
   * @param createdBy - User ID of the creator
   * @returns Created invitation
   */
  async createInvitation(
    tenantId: string,
    data: CreateInvitationDto,
    createdBy: string,
  ) {
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
    let user = await this.dbService.client.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: { id: true },
    });

    // Generate invitation token
    const invitationToken = this.generateInvitationToken();
    const expirationHours = data.expirationHours || 168; // Default: 7 days
    const invitationExpiresAt = new Date();
    invitationExpiresAt.setHours(
      invitationExpiresAt.getHours() + expirationHours,
    );

    // Create or get user
    // Create user without password (will be set when invitation is accepted)
    user ??= await this.dbService.client.user.create({
      data: {
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        isActive: true,
        isVerified: false, // Will be verified when invitation is accepted
      },
    });

    if (data.roleIds.length !== 1) {
      throw new BadRequestException(
        'Exactly one role must be provided per invitation/profile',
      );
    }

    // Prevent duplicate profile for same role in tenant
    const existingProfileWithRole =
      await this.dbService.client.userTenantRole.findFirst({
        where: {
          roleId: data.roleIds[0],
          userTenant: {
            userId: user.id,
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

    // Create user-tenant relationship with invitation
    const userTenant = await this.dbService.client.userTenant.create({
      data: {
        userId: user.id,
        tenantId,
        status: ProfileStatus.PENDING, // Pending until invitation is accepted
        invitationToken,
        invitationExpiresAt,
        addedBy: createdBy,
      },
    });

    // Assign single role
    await this.dbService.client.userTenantRole.create({
      data: {
        userTenantId: userTenant.id,
        roleId: data.roleIds[0],
        isPrimary: true,
        assignedBy: createdBy,
      },
    });

    // Enqueue invitation email dispatch (stub for async processing)
    this.queueService.enqueue('invitation-email', {
      tenantId,
      userId: user.id,
      userTenantId: userTenant.id,
      email: data.email.toLowerCase(),
      roles: data.roleIds,
    });

    // Audit log
    await this.auditService.logUserAction({
      action: AUDIT_ACTION.USER_MANAGEMENT.USER_INVITATION_CREATED,
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
   * @param tenantId - Tenant ID
   * @param data - Bulk invitation data
   * @param createdBy - User ID of the creator
   * @returns Created invitations
   */
  async bulkCreateInvitations(
    tenantId: string,
    data: BulkCreateInvitationsDto,
    createdBy: string,
  ) {
    const results = [];

    for (const invitation of data.invitations) {
      try {
        const result = await this.createInvitation(
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
   * @param data - Acceptance data
   * @returns Accepted invitation
   */
  async acceptInvitation(data: AcceptInvitationDto) {
    // Find invitation by token
    const userTenant = await this.dbService.client.userTenant.findFirst({
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
    await this.dbService.client.user.update({
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
    await this.dbService.client.userTenant.update({
      where: { id: userTenant.id },
      data: {
        status: ProfileStatus.ACTIVE,
        invitationAcceptedAt: new Date(),
        invitationToken: null, // Clear token
      },
    });

    // Audit log
    await this.auditService.logUserAction({
      action: AUDIT_ACTION.USER_MANAGEMENT.USER_INVITATION_ACCEPTED,
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
