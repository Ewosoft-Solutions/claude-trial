import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@workspace/database';
import { ProfileStatus } from '@workspace/api';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import type { EnvConfig } from '../../common/config/env.config';
import { SecureLinkService } from '../../communication/delivery/services/secure-link.service';
import { DeliveryService } from '../../communication/delivery/services/delivery.service';
import { SessionService } from '../../auth/services/session.service';
import { UserInvitationService } from '../../tenant/services/user-invitation.service';
import type {
  InvitePersonDto,
  SuspendAccountDto,
} from '../dto/provisioning.dto';

/**
 * Account provisioning (WB1-3) — the safe way to give a person a login and
 * manage its lifecycle from the People workbench:
 *
 *   • **invite**   — create a pending account and email the person an expiring
 *                    F5 `SecureLink`; they set their OWN password on accept. No
 *                    password is ever generated or transmitted (retires C034).
 *   • **resend**   — re-issue the invitation link.
 *   • **suspend**  — block login (audited); the login path already refuses a
 *                    suspended profile, and live sessions are revoked.
 *   • **reactivate** — restore the account.
 *   • **reset**    — send an admin-initiated password-reset link (again, the
 *                    user chooses the new password).
 *
 * Delivery goes through the F5 `DeliveryService` (consent-aware, cost/DND
 * ledgered) and every token is governed as a `SecureLink` (hashed at rest,
 * revocable, audited). Account/user-row persistence is delegated to
 * `UserInvitationService` (which holds the grandfathered privileged client for
 * the RLS-covered, tenant-global `users` table); everything else runs on the
 * request's tenant-scoped client. Must be called inside a `@TenantScoped`
 * request.
 */
@Injectable()
export class AccountProvisioningService {
  private readonly logger = new Logger(AccountProvisioningService.name);
  private readonly webUrl: string;

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly secureLinks: SecureLinkService,
    private readonly delivery: DeliveryService,
    private readonly invitations: UserInvitationService,
    configService: ConfigService,
  ) {
    this.webUrl = configService.getOrThrow<EnvConfig>('env', {
      infer: true,
    }).APP_WEB_URL;
  }

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  private async loadPerson(tenantId: string, personId: string) {
    const person = await this.client.person.findFirst({
      where: { id: personId, tenantId },
      select: {
        id: true,
        status: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        userTenantId: true,
        contactPoints: {
          where: { kind: 'email' },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: { value: true },
          take: 1,
        },
        account: {
          select: {
            id: true,
            userId: true,
            status: true,
            suspended: true,
            suspendedAt: true,
            suspensionReason: true,
            invitationAcceptedAt: true,
            invitationExpiresAt: true,
            addedAt: true,
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
                lastLoginAt: true,
              },
            },
            userTenantRole: {
              select: { role: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!person) throw new NotFoundException('Person not found');
    return person;
  }

  private displayName(p: {
    firstName: string;
    lastName: string;
    preferredName: string | null;
  }): string {
    return (p.preferredName || `${p.firstName} ${p.lastName}`).trim();
  }

  /** The account/access state the workbench shows on the person detail. */
  async getState(tenantId: string, personId: string) {
    const person = await this.loadPerson(tenantId, personId);
    const account = person.account;
    if (!account) {
      return {
        hasAccount: false as const,
        canInvite: person.status === 'active',
      };
    }
    const pending = account.invitationAcceptedAt === null;
    const expired =
      pending &&
      account.invitationExpiresAt != null &&
      account.invitationExpiresAt < new Date();
    return {
      hasAccount: true as const,
      userTenantId: account.id,
      email: account.user?.email ?? null,
      role: account.userTenantRole?.role?.name ?? null,
      status: account.status,
      suspended: account.suspended,
      suspendedAt: account.suspendedAt,
      suspensionReason: account.suspensionReason,
      lastLoginAt: account.user?.lastLoginAt ?? null,
      invitation: pending
        ? {
            state: expired ? ('expired' as const) : ('pending' as const),
            expiresAt: account.invitationExpiresAt,
          }
        : null,
    };
  }

  /**
   * Invite a person to have an account. Creates a pending profile with the given
   * role and emails an expiring SecureLink; the person sets their own password
   * on accept via the existing accept-invite page. No plaintext password.
   */
  async invite(
    tenantId: string,
    actorId: string,
    personId: string,
    dto: InvitePersonDto,
  ) {
    const person = await this.loadPerson(tenantId, personId);
    if (person.status !== 'active') {
      throw new ConflictException(`Person is ${person.status}, not active`);
    }
    if (person.userTenantId || person.account) {
      throw new ConflictException('This person already has an account');
    }
    const email = (dto.email ?? person.contactPoints[0]?.value)?.trim();
    if (!email) {
      throw new BadRequestException(
        'No email to send the invitation to — provide one or add an email contact',
      );
    }

    // One shared token: the accept-invite page resolves it via the existing
    // UserTenant.invitationToken store, and it is governed here as a SecureLink.
    const token = randomBytes(32).toString('hex');
    const created = await this.invitations.createInvitation(
      tenantId,
      {
        email,
        firstName: dto.firstName ?? person.firstName,
        lastName: dto.lastName ?? person.lastName,
        roleId: dto.roleId,
        expirationHours: dto.expirationHours,
      },
      actorId,
      { skipLegacyEmail: true, invitationToken: token },
    );

    // Link the new account to this Person (one identity, one account here).
    await this.client.person.update({
      where: { id: personId },
      data: { userTenantId: created.id },
    });

    await this.issueAndSendInvite({
      tenantId,
      actorId,
      personId,
      userTenantId: created.id,
      token,
      email,
      expiresAt: created.invitationExpiresAt,
      tenantName: created.tenantName,
      roleName: created.roleName,
      recipientName: created.recipientName ?? this.displayName(person),
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'provisioning.account.invite',
      resource: 'person',
      resourceId: personId,
      actorId,
      description: `invited ${email}`,
      metadata: { userTenantId: created.id, roleId: dto.roleId },
    });

    return {
      userTenantId: created.id,
      invitation: {
        state: 'pending' as const,
        expiresAt: created.invitationExpiresAt,
      },
    };
  }

  /** Re-issue the invitation link for a still-pending account. */
  async resend(tenantId: string, actorId: string, personId: string) {
    const person = await this.loadPerson(tenantId, personId);
    const account = person.account;
    if (!account) throw new ConflictException('This person has no account');
    if (account.invitationAcceptedAt) {
      throw new ConflictException('This invitation was already accepted');
    }

    const email = account.user?.email;
    if (!email) throw new BadRequestException('Account has no email');

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 168); // 7 days

    await this.client.userTenant.update({
      where: { id: account.id },
      data: { invitationToken: token, invitationExpiresAt: expiresAt },
    });

    await this.issueAndSendInvite({
      tenantId,
      actorId,
      personId,
      userTenantId: account.id,
      token,
      email,
      expiresAt,
      tenantName: null,
      roleName: account.userTenantRole?.role?.name ?? null,
      recipientName: this.displayName(person),
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'provisioning.account.resend_invite',
      resource: 'person',
      resourceId: personId,
      actorId,
      description: `re-sent invitation to ${email}`,
      metadata: { userTenantId: account.id },
    });

    return {
      userTenantId: account.id,
      invitation: { state: 'pending' as const, expiresAt },
    };
  }

  /** Mint the SecureLink + deliver the invite email. Shared by invite/resend. */
  private async issueAndSendInvite(args: {
    tenantId: string;
    actorId: string;
    personId: string;
    userTenantId: string;
    token: string;
    email: string;
    expiresAt: Date | null;
    tenantName: string | null;
    roleName: string | null;
    recipientName: string | null;
  }) {
    const ttlSeconds = args.expiresAt
      ? Math.max(60, Math.floor((args.expiresAt.getTime() - Date.now()) / 1000))
      : 168 * 3600;

    const link = await this.secureLinks.create(args.tenantId, args.actorId, {
      purpose: 'invitation',
      targetType: 'user_tenant',
      targetId: args.userTenantId,
      token: args.token,
      ttlSeconds,
      maxUses: 1,
      audiencePersonId: args.personId,
      metadata: {
        roleName: args.roleName,
        tenantName: args.tenantName,
        personId: args.personId,
      },
    });

    const acceptUrl = `${this.webUrl}/accept-invite?token=${encodeURIComponent(args.token)}`;
    await this.delivery.send({
      tenantId: args.tenantId,
      channel: 'email',
      category: 'critical', // account-essential; never suppressed by opt-out
      personId: args.personId,
      destination: args.email,
      subject: `You're invited to ${args.tenantName ?? 'your school workspace'}`,
      body: this.inviteBody(args.recipientName, args.tenantName, acceptUrl),
      secureLinkId: link.id,
      dedupeKey: `invite:${link.id}`,
      actorId: args.actorId,
    });
  }

  /** Suspend an account — blocks login (audited) and revokes live sessions. */
  async suspend(
    tenantId: string,
    actorId: string,
    personId: string,
    dto: SuspendAccountDto,
  ) {
    const person = await this.loadPerson(tenantId, personId);
    const account = person.account;
    if (!account) throw new ConflictException('This person has no account');
    if (account.suspended) {
      throw new ConflictException('Account is already suspended');
    }

    await this.client.userTenant.update({
      where: { id: account.id },
      data: {
        status: ProfileStatus.SUSPENDED,
        suspended: true,
        suspendedAt: new Date(),
        suspendedBy: actorId,
        suspensionReason: dto.reason ?? null,
      },
    });

    // Kill live sessions so a suspend takes effect immediately (best-effort; the
    // login path already refuses a suspended profile regardless).
    try {
      await SessionService.revokeAllProfileSessions(this.client, account.id);
    } catch (e) {
      this.logger.warn(
        `suspend: could not revoke sessions for ${account.id}: ${String(e)}`,
      );
    }

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.SECURITY_EVENT,
      action: 'provisioning.account.suspend',
      resource: 'person',
      resourceId: personId,
      actorId,
      description: `suspended account`,
      metadata: { userTenantId: account.id, reason: dto.reason ?? null },
    });

    return this.getState(tenantId, personId);
  }

  /** Reactivate a suspended account (restores to its pre-suspension status). */
  async reactivate(tenantId: string, actorId: string, personId: string) {
    const person = await this.loadPerson(tenantId, personId);
    const account = person.account;
    if (!account) throw new ConflictException('This person has no account');
    if (!account.suspended) {
      throw new ConflictException('Account is not suspended');
    }

    // Restore to active if the invite was accepted, else back to pending.
    const restored = account.invitationAcceptedAt
      ? ProfileStatus.ACTIVE
      : ProfileStatus.PENDING;

    await this.client.userTenant.update({
      where: { id: account.id },
      data: {
        status: restored,
        suspended: false,
        suspendedAt: null,
        suspendedBy: null,
        suspensionReason: null,
      },
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.SECURITY_EVENT,
      action: 'provisioning.account.reactivate',
      resource: 'person',
      resourceId: personId,
      actorId,
      description: `reactivated account`,
      metadata: { userTenantId: account.id, restoredTo: restored },
    });

    return this.getState(tenantId, personId);
  }

  /**
   * Send an admin-initiated password-reset link. Sets the same hashed, expiring
   * reset token the self-service flow uses (so the existing /reset-password page
   * resolves it), governs it as a SecureLink, and delivers via F5 — the user
   * still chooses the new password.
   */
  async sendPasswordReset(tenantId: string, actorId: string, personId: string) {
    const person = await this.loadPerson(tenantId, personId);
    const account = person.account;
    if (!account) throw new ConflictException('This person has no account');
    if (!account.invitationAcceptedAt) {
      throw new ConflictException(
        'This account has not been activated yet — resend the invitation instead',
      );
    }
    const email = account.user?.email;
    if (!email) throw new BadRequestException('Account has no email');

    const { token, expiresAt } = await this.invitations.issueAdminPasswordReset(
      tenantId,
      account.userId,
      actorId,
    );

    const ttlSeconds = Math.max(
      60,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );
    const link = await this.secureLinks.create(tenantId, actorId, {
      purpose: 'password_reset',
      targetType: 'user',
      targetId: account.userId,
      token,
      ttlSeconds,
      maxUses: 1,
      audiencePersonId: personId,
      metadata: { personId },
    });

    const resetUrl = `${this.webUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.delivery.send({
      tenantId,
      channel: 'email',
      category: 'critical',
      personId,
      destination: email,
      subject: 'Reset your password',
      body: this.resetBody(this.displayName(person), resetUrl),
      secureLinkId: link.id,
      dedupeKey: `reset:${link.id}`,
      actorId,
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.SECURITY_EVENT,
      action: 'provisioning.account.reset',
      resource: 'person',
      resourceId: personId,
      actorId,
      description: `sent a password-reset link to ${email}`,
      metadata: { userTenantId: account.id },
    });

    return { sent: true, expiresAt };
  }

  private inviteBody(
    recipientName: string | null,
    tenantName: string | null,
    acceptUrl: string,
  ): string {
    const hi = recipientName ? `Hi ${recipientName},` : 'Hello,';
    return [
      hi,
      '',
      `You've been invited to ${tenantName ?? 'your school workspace'}. Set your password to activate your account:`,
      acceptUrl,
      '',
      'This link expires soon. If you were not expecting this, you can ignore this email.',
    ].join('\n');
  }

  private resetBody(recipientName: string, resetUrl: string): string {
    return [
      `Hi ${recipientName},`,
      '',
      'A password reset was requested for your account. Choose a new password here:',
      resetUrl,
      '',
      'This link expires in one hour. If you did not request this, you can ignore this email.',
    ].join('\n');
  }
}
