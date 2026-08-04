import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../../common/database/tenant-db.service';
import { AuditService } from '../../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../../common/audit/audit.constants';
import {
  PermissionService,
  type UserPermissionContext,
} from '../../../auth/services/permission.service';

export interface CreateSecureLinkInput {
  purpose: string;
  targetType: string;
  targetId: string;
  /** TTL in seconds (an expiry is mandatory — a SecureLink is never permanent). */
  ttlSeconds: number;
  requiredPermission?: string;
  audiencePersonId?: string;
  audienceProfileId?: string;
  maxUses?: number;
  metadata?: Record<string, unknown>;
  /**
   * A caller-supplied raw token. Normally omitted (a CSPRNG token is minted).
   * Provisioning (WB1-3) supplies the same token it also writes to the existing
   * invitation / password-reset store, so one token is governed here (hashed at
   * rest, revocable, audited) yet still resolvable by the existing accept-invite
   * / reset-password pages. Never logged; only its hash is stored.
   */
  token?: string;
}

export interface RedeemContext {
  userContext?: UserPermissionContext | null;
  personId?: string | null;
  profileId?: string | null;
}

export interface RedeemedLink {
  id: string;
  purpose: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
}

/**
 * SecureLink — access-controlled, expiring, permission-checked tokens that
 * replace the legacy "tokenized but effectively public" result/payment URL
 * (C108). Only the SHA-256 hash of the random token is stored; the raw token is
 * returned once at creation. Redemption requires the link to be live (not
 * expired/revoked/exhausted) AND the redeemer to satisfy its access rules
 * (required permission and/or bound audience) — so a leaked URL alone discloses
 * nothing.
 *
 * NOTE: a link can be created with a caller-supplied `token` (WB1-3 invite /
 * reset) so it MIRRORS a token that also lives in another store; in that case
 * the other store (e.g. UserTenant.invitationToken) is the operative redemption
 * path and revoking this SecureLink alone would not block it. For result/payment
 * links (the primary use) this SecureLink IS the redemption check.
 */
@Injectable()
export class SecureLinkService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly permissions: PermissionService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  private static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(
    tenantId: string,
    actorId: string | undefined,
    input: CreateSecureLinkInput,
  ): Promise<{ id: string; token: string; expiresAt: Date }> {
    const token = input.token ?? randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);
    const link = await this.client.secureLink.create({
      data: {
        id: randomUUID(),
        tenantId,
        tokenHash: SecureLinkService.hash(token),
        purpose: input.purpose,
        targetType: input.targetType,
        targetId: input.targetId,
        requiredPermission: input.requiredPermission ?? null,
        audiencePersonId: input.audiencePersonId ?? null,
        audienceProfileId: input.audienceProfileId ?? null,
        expiresAt,
        maxUses: input.maxUses ?? null,
        metadata: (input.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        createdBy: actorId ?? null,
      },
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'communication.secure_link.create',
      resource: 'secure_link',
      resourceId: link.id,
      actorId: actorId ?? null,
      description: `secure link ${input.purpose} → ${input.targetType}:${input.targetId}`,
      metadata: {
        purpose: input.purpose,
        requiredPermission: input.requiredPermission ?? null,
        hasAudienceBinding: !!(
          input.audiencePersonId || input.audienceProfileId
        ),
        expiresAt,
      },
    });

    // The raw token is returned ONLY here; it is never stored or logged.
    return { id: link.id, token, expiresAt };
  }

  /**
   * Redeem a token. Throws NotFound (unknown), Gone (expired/revoked/exhausted),
   * or Forbidden (redeemer fails the access rules). On success bumps the use
   * counter + last-accessed and records an audit event.
   */
  async redeem(
    tenantId: string,
    token: string,
    redeemer: RedeemContext,
  ): Promise<RedeemedLink> {
    const link = await this.client.secureLink.findFirst({
      where: { tenantId, tokenHash: SecureLinkService.hash(token) },
    });
    if (!link) throw new NotFoundException('Invalid link');

    if (link.revokedAt) throw new GoneException('This link has been revoked');
    if (link.expiresAt.getTime() <= Date.now()) {
      throw new GoneException('This link has expired');
    }
    if (link.maxUses != null && link.useCount >= link.maxUses) {
      throw new GoneException('This link has already been used');
    }

    await this.enforceAccess(tenantId, link, redeemer);

    // Atomically claim one use so a maxUses cap cannot be raced: a single-use
    // link is redeemed at most once even under concurrent requests (the row lock
    // serializes the conditional update; a loser gets 0 rows affected → Gone).
    const claimed = await this.client.$executeRaw`
      UPDATE "communication"."secure_links"
      SET "use_count" = "use_count" + 1, "last_accessed_at" = now()
      WHERE "id" = ${link.id}
        AND ("max_uses" IS NULL OR "use_count" < "max_uses")
    `;
    if (claimed === 0) {
      throw new GoneException('This link has already been used');
    }

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.AUTHORIZATION,
      action: 'communication.secure_link.redeem',
      resource: 'secure_link',
      resourceId: link.id,
      actorId: redeemer.profileId ?? null,
      description: `redeemed ${link.purpose}`,
      metadata: { purpose: link.purpose, targetType: link.targetType },
    });

    return {
      id: link.id,
      purpose: link.purpose,
      targetType: link.targetType,
      targetId: link.targetId,
      metadata: link.metadata,
    };
  }

  async revoke(tenantId: string, id: string, actorId: string | undefined) {
    const link = await this.client.secureLink.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!link) throw new NotFoundException('Link not found');
    await this.client.secureLink.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'communication.secure_link.revoke',
      resource: 'secure_link',
      resourceId: id,
      actorId: actorId ?? null,
      description: 'secure link revoked',
      metadata: {},
    });
    return { revoked: true };
  }

  /**
   * A leaked URL is not enough: when the link carries a required permission the
   * redeemer must hold it, and when it is bound to an audience principal the
   * redeemer must be that principal. Every DENIAL is written as a security-event
   * audit before throwing — an unauthorized attempt to open someone else's
   * result/payment link leaves a trail (the C108 hazard this feature closes).
   */
  private async enforceAccess(
    tenantId: string,
    link: {
      id: string;
      purpose: string;
      targetType: string;
      requiredPermission: string | null;
      audiencePersonId: string | null;
      audienceProfileId: string | null;
    },
    redeemer: RedeemContext,
  ): Promise<void> {
    const deny = async (reason: string, message: string): Promise<never> => {
      await this.audit.write({
        tenantId,
        eventType: AUDIT_EVENT.SECURITY_EVENT,
        action: 'communication.secure_link.denied',
        resource: 'secure_link',
        resourceId: link.id,
        actorId: redeemer.profileId ?? null,
        description: `secure link denied (${reason})`,
        metadata: {
          purpose: link.purpose,
          targetType: link.targetType,
          reason,
        },
      });
      throw new ForbiddenException(message);
    };

    if (link.requiredPermission) {
      const ctx = redeemer.userContext;
      const granted =
        !!ctx &&
        this.permissions.checkPermission(ctx, link.requiredPermission).granted;
      if (!granted) {
        await deny(
          'permission',
          'You do not have permission to open this link',
        );
      }
    }
    if (
      link.audiencePersonId &&
      link.audiencePersonId !== (redeemer.personId ?? null)
    ) {
      await deny('audience', 'This link is addressed to someone else');
    }
    if (
      link.audienceProfileId &&
      link.audienceProfileId !== (redeemer.profileId ?? null)
    ) {
      await deny('audience', 'This link is addressed to someone else');
    }
  }
}
