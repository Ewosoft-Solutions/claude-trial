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
import {
  INVITATION_EMAIL_JOB,
  type InvitationEmailPayload,
} from '../../common/email';

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

    // Prevent duplicate profile for same role in tenant
    const existingProfileWithRole =
      await this.dbService.client.userTenantRole.findFirst({
        where: {
          roleId: data.roleId,
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

    // Assign single role. `tenantId` is the denormalized column RLS uses to
    // scope user_tenant_roles (its policy has no NULL escape); it MUST be set
    // or the assignment is invisible to any RLS-scoped read.
    await this.dbService.client.userTenantRole.create({
      data: {
        userTenantId: userTenant.id,
        tenantId,
        roleId: data.roleId,
        isPrimary: true,
        assignedBy: createdBy,
      },
    });

    // Enqueue invitation email dispatch. The handler (EmailQueueRegistrar)
    // composes the accept link and sends via the configured EmailService.
    const [tenant, role] = await Promise.all([
      this.dbService.client.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      this.dbService.client.role.findUnique({
        where: { id: data.roleId },
        select: { name: true },
      }),
    ]);
    const recipientName =
      [data.firstName, data.lastName].filter(Boolean).join(' ') || null;
    this.queueService.enqueue<InvitationEmailPayload>(INVITATION_EMAIL_JOB, {
      email: data.email.toLowerCase(),
      invitationToken,
      tenantName: tenant?.name ?? 'your school',
      roleName: role?.name ?? null,
      recipientName,
      expiresAt: invitationExpiresAt,
    });

    // Audit log
    await this.auditService.logUserAction({
      action: AUDIT_ACTION.USER_MANAGEMENT.USER_INVITATION_CREATED,
      tenantId,
      userId: user.id,
      performedBy: createdBy,
      metadata: {
        email: data.email,
        roleId: data.roleId,
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
   * List invitations for a tenant (management surface).
   *
   * Returns pending and/or accepted invitations with the acceptance path so
   * an admin can copy/share the link until email delivery exists. The raw
   * token is only exposed to management (clearance-gated at the controller).
   *
   * @param tenantId - Tenant ID
   * @param status - Optional filter: 'pending' | 'accepted'
   */
  async listInvitations(tenantId: string, status?: string) {
    const where: {
      tenantId: string;
      invitationToken?: { not: null };
      invitationAcceptedAt?: null | { not: null };
    } = { tenantId };

    if (status === 'pending') {
      where.invitationToken = { not: null };
      where.invitationAcceptedAt = null;
    } else if (status === 'accepted') {
      where.invitationAcceptedAt = { not: null };
    } else {
      // Default: only rows that originated from an invitation.
      where.invitationToken = { not: null };
    }

    const rows = await this.dbService.client.userTenant.findMany({
      where,
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        userTenantRole: { include: { role: { select: { name: true } } } },
      },
      orderBy: { addedAt: 'desc' },
    });

    const now = new Date();
    return rows.map((row) => {
      const pending =
        !!row.invitationToken && row.invitationAcceptedAt === null;
      const expired =
        pending && !!row.invitationExpiresAt && row.invitationExpiresAt < now;
      return {
        id: row.id,
        email: row.user.email,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
        role: row.userTenantRole?.role?.name ?? null,
        status: row.invitationAcceptedAt
          ? 'accepted'
          : expired
            ? 'expired'
            : 'pending',
        invitationExpiresAt: row.invitationExpiresAt,
        invitationAcceptedAt: row.invitationAcceptedAt,
        // Present only for still-pending invites so a link can be shared.
        token: pending && !expired ? row.invitationToken : null,
        acceptPath:
          pending && !expired
            ? `/accept-invite?token=${row.invitationToken}`
            : null,
      };
    });
  }

  /**
   * Revoke a pending invitation.
   *
   * Deletes the pending profile (and its role, via cascade). Refuses to touch
   * an already-accepted invitation.
   *
   * @param tenantId - Tenant ID
   * @param invitationId - userTenant id of the invitation
   * @param revokedBy - User ID performing the revoke
   */
  async revokeInvitation(
    tenantId: string,
    invitationId: string,
    revokedBy: string,
  ) {
    const invitation = await this.dbService.client.userTenant.findFirst({
      where: { id: invitationId, tenantId },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.invitationAcceptedAt) {
      throw new ConflictException(
        'Invitation already accepted; remove the user instead',
      );
    }

    await this.dbService.client.userTenant.delete({
      where: { id: invitation.id },
    });

    await this.auditService.logUserAction({
      action: AUDIT_ACTION.USER_MANAGEMENT.USER_INVITATION_REVOKED,
      tenantId,
      userId: invitation.user.id,
      performedBy: revokedBy,
      metadata: { email: invitation.user.email },
    });

    return { success: true };
  }

  /**
   * Public preview of an invitation by token.
   *
   * Powers the accept-invitation page: shows who/what the invite is for
   * without requiring an account. Returns only non-sensitive fields and never
   * echoes the token.
   *
   * @param token - Invitation token
   */
  async getInvitationByToken(token: string) {
    const invitation = await this.dbService.client.userTenant.findFirst({
      where: { invitationToken: token },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        tenant: { select: { name: true, slug: true } },
        userTenantRole: { include: { role: { select: { name: true } } } },
      },
    });

    if (!invitation || invitation.invitationAcceptedAt) {
      throw new NotFoundException('Invitation not found or already accepted');
    }

    const expired =
      !!invitation.invitationExpiresAt &&
      invitation.invitationExpiresAt < new Date();

    return {
      valid: !expired,
      expired,
      email: invitation.user.email,
      firstName: invitation.user.firstName,
      lastName: invitation.user.lastName,
      tenantName: invitation.tenant.name,
      tenantSlug: invitation.tenant.slug,
      role: invitation.userTenantRole?.role?.name ?? null,
      invitationExpiresAt: invitation.invitationExpiresAt,
    };
  }

  /**
   * Generate invitation token
   */
  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
