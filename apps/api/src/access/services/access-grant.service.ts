/**
 * Access-grant service (WB1-6)
 *
 * Time-boxed + scoped role grants with maker-checker/step-up for the risky ones
 * — the last Workbench-1 slice. A grant assigns a role to a profile
 * (`UserTenantRole`, one per profile) with an optional campus `scope` and an
 * optional `expiresAt`:
 *
 *   • **low-risk** grant → applied immediately.
 *   • **high-risk** grant (the role carries a SENSITIVE capability per the WB1-5
 *     effective-access evaluator — money / export / PII / clearance ≥ 7) → a
 *     `MakerCheckerRequest` is raised; the grant is applied only when a SECOND
 *     approver (maker ≠ checker, both Management+) signs off. Step-up is enforced
 *     at the route (`@RequireStepUp('users.role.assign')`). (Scenario 4.)
 *   • **expiry** — the live per-request authz path stops honouring an expired
 *     grant, so a 5-day substitute cover auto-expires. (Scenario 3.)
 *   • **scope** — a campus-scoped actor can only grant within its campus, and the
 *     grant's scope is enforced by `AccessScopeService` at every later decision.
 *     (Scenario 2, completed end-to-end once WB5/WB2 tag their rows with a campus.)
 *
 * Runs on the request's tenant-scoped client (RLS; no privileged client) inside
 * a `@TenantScoped` request — every statement is already in one transaction.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@workspace/database';
import { ApprovalStatus, RoleType } from '@workspace/api';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { EffectiveAccessService } from '../../auth/services/effective-access.service';
import { MakerCheckerService } from '../../auth/services/maker-checker.service';
import {
  AccessScopeService,
  parseScope,
  type ScopeDescriptor,
} from '../../auth/services/access-scope.service';
import type { RequestGrantDto, ScopeDescriptorDto } from '../dto/access.dto';

/** The requester's own authority, resolved from their permission context. */
export interface GrantActor {
  userId: string;
  clearanceLevel: number;
  grantScope?: ScopeDescriptor | null;
}

export type GrantOutcome =
  | { status: 'active'; profileId: string; roleId: string }
  | { status: 'pending_approval'; approvalRequestId: string };

/** Shape stored on the maker-checker request for a high-risk grant. */
interface GrantRequestData {
  profileId: string;
  roleId: string;
  scope: ScopeDescriptor | null;
  expiresAt: string | null;
  reason: string | null;
}

const MAKER_CHECKER_OP = 'access.grant.high_risk';

@Injectable()
export class AccessGrantService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly effectiveAccess: EffectiveAccessService,
    private readonly makerChecker: MakerCheckerService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  /** MakerCheckerService is typed for the full client; the scoped tx satisfies it. */
  private get prisma(): PrismaClient {
    return this.tenantDb.client as unknown as PrismaClient;
  }

  // ---- reads --------------------------------------------------------------

  /** The active grant + any pending high-risk request for a profile. */
  async getState(tenantId: string, profileId: string) {
    const profile = await this.loadProfile(tenantId, profileId);
    const grant = profile.userTenantRole;
    const pending = await this.pendingRequestsForProfile(tenantId, profileId);
    return {
      profileId,
      holder: profile.user
        ? {
            name:
              [profile.user.firstName, profile.user.lastName]
                .filter(Boolean)
                .join(' ') || profile.user.email,
            email: profile.user.email,
          }
        : null,
      activeGrant: grant
        ? {
            roleId: grant.roleId,
            roleName: grant.role?.name ?? null,
            scope: parseScope(grant.scope),
            expiresAt: grant.expiresAt,
            expired: isExpired(grant.expiresAt),
            grantReason: grant.grantReason,
            assignedAt: grant.assignedAt,
          }
        : null,
      pendingRequests: pending,
    };
  }

  // ---- request ------------------------------------------------------------

  /**
   * Request a grant. Applies it directly when low-risk; raises a maker-checker
   * request when high-risk. Returns which happened.
   */
  async requestGrant(
    tenantId: string,
    actor: GrantActor,
    dto: RequestGrantDto,
  ): Promise<GrantOutcome> {
    await this.loadProfile(tenantId, dto.profileId); // 404s if not this tenant's
    const role = await this.loadGrantableRole(tenantId, dto.roleId);
    const scope = await this.resolveScope(tenantId, dto.scope);
    const expiresAt = this.parseExpiry(dto.expiresAt);
    const reason = dto.reason?.trim() || null;

    // The actor may not grant a role above their own authority…
    if (role.clearanceLevel > actor.clearanceLevel) {
      throw new ForbiddenException(
        'You cannot grant a role above your own clearance level.',
      );
    }
    // …nor outside their own campus scope (a Campus-A admin can't grant Campus-B
    // or unscoped access). This is the scope ENFORCEMENT WB1-5 only explained.
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: scope?.type === 'campus' ? scope.value : undefined,
    });

    const highRisk = await this.isHighRisk(
      tenantId,
      dto.roleId,
      role.clearanceLevel,
    );

    if (!highRisk) {
      await this.applyGrant(tenantId, actor.userId, {
        profileId: dto.profileId,
        roleId: dto.roleId,
        scope,
        expiresAt,
        reason,
      });
      await this.audit.write({
        tenantId,
        eventType: AUDIT_EVENT.DATA_CHANGE,
        action: 'access.grant.apply',
        resource: 'user_tenant_role',
        resourceId: dto.profileId,
        actorId: actor.userId,
        description: `granted role ${role.name} to profile ${dto.profileId}`,
        metadata: {
          roleId: dto.roleId,
          scope,
          expiresAt: expiresAt?.toISOString() ?? null,
          highRisk: false,
        },
      });
      return { status: 'active', profileId: dto.profileId, roleId: dto.roleId };
    }

    // High-risk: raise a maker-checker request; DO NOT apply yet.
    const requestData: GrantRequestData = {
      profileId: dto.profileId,
      roleId: dto.roleId,
      scope,
      expiresAt: expiresAt?.toISOString() ?? null,
      reason,
    };
    const approvalRequestId = await this.makerChecker.createApprovalRequest(
      this.prisma,
      MAKER_CHECKER_OP,
      actor.userId,
      actor.clearanceLevel,
      requestData as unknown as Prisma.InputJsonValue,
      tenantId,
    );
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'access.grant.request',
      resource: 'user_tenant_role',
      resourceId: dto.profileId,
      actorId: actor.userId,
      description: `requested high-risk grant of role ${role.name} (awaiting a second approver)`,
      metadata: { roleId: dto.roleId, approvalRequestId, highRisk: true },
    });
    return { status: 'pending_approval', approvalRequestId };
  }

  // ---- approve / reject ---------------------------------------------------

  /** A second approver signs off a pending high-risk grant → it is applied. */
  async approveGrant(
    tenantId: string,
    checker: GrantActor,
    requestId: string,
    reason?: string,
  ) {
    const request = await this.loadPendingRequest(tenantId, requestId);
    const data = request.requestData as unknown as GrantRequestData;

    // Re-validate at APPROVAL time, before the approval is consumed: the role
    // must still be grantable (not deleted/deactivated since the request) and
    // within the approver's own authority (its clearance could have risen). Done
    // first so a failed check leaves the request pending rather than approved-
    // but-unapplied.
    const role = await this.loadGrantableRole(tenantId, data.roleId);
    if (role.clearanceLevel > checker.clearanceLevel) {
      throw new ForbiddenException(
        'This role now exceeds your clearance level; it cannot be approved.',
      );
    }

    // MakerCheckerService enforces separation-of-duties: the maker can never
    // approve their own request, and the checker must clear the clearance floor.
    const result = await this.makerChecker.approveRequest(
      this.prisma,
      requestId,
      checker.userId,
      checker.clearanceLevel,
      reason,
    );
    if (!result.approved) {
      // "You cannot approve your own request" / "Insufficient clearance …".
      throw new ForbiddenException(result.error ?? 'Approval failed');
    }

    await this.applyGrant(tenantId, checker.userId, {
      profileId: data.profileId,
      roleId: data.roleId,
      scope: data.scope ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      reason: data.reason ?? null,
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'access.grant.approve',
      resource: 'user_tenant_role',
      resourceId: data.profileId,
      actorId: checker.userId,
      description: `approved + applied high-risk grant (request ${requestId})`,
      metadata: { requestId, roleId: data.roleId, makerId: request.makerId },
    });
    return { status: 'active' as const, profileId: data.profileId };
  }

  /** Reject a pending high-risk grant. */
  async rejectGrant(
    tenantId: string,
    checker: GrantActor,
    requestId: string,
    reason: string,
  ) {
    await this.loadPendingRequest(tenantId, requestId);
    const result = await this.makerChecker.rejectRequest(
      this.prisma,
      requestId,
      checker.userId,
      reason,
    );
    if (!result.rejected) {
      throw new BadRequestException(result.error ?? 'Rejection failed');
    }
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'access.grant.reject',
      resource: 'user_tenant_role',
      resourceId: requestId,
      actorId: checker.userId,
      description: `rejected high-risk grant request ${requestId}`,
      metadata: { requestId },
    });
    return { status: 'rejected' as const };
  }

  // ---- revoke -------------------------------------------------------------

  /** Revoke a profile's role grant (the profile is left with no active role). */
  async revokeGrant(tenantId: string, actor: GrantActor, profileId: string) {
    const profile = await this.loadProfile(tenantId, profileId);
    if (!profile.userTenantRole) {
      throw new NotFoundException('This profile has no role grant to revoke.');
    }
    // A campus-scoped actor may only revoke grants within their own campus — the
    // same scope enforcement requestGrant applies. Without this a Campus-A admin
    // could revoke a whole-school or Campus-B grant.
    const targetScope = parseScope(profile.userTenantRole.scope);
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: targetScope?.type === 'campus' ? targetScope.value : undefined,
    });
    await this.client.userTenantRole.delete({
      where: { userTenantId: profileId },
    });
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'access.grant.revoke',
      resource: 'user_tenant_role',
      resourceId: profileId,
      actorId: actor.userId,
      description: `revoked the role grant on profile ${profileId}`,
      metadata: { roleId: profile.userTenantRole.roleId },
    });
    return { status: 'revoked' as const };
  }

  // ---- internals ----------------------------------------------------------

  /** Apply a grant: upsert the profile's single role with scope + expiry. */
  private async applyGrant(
    tenantId: string,
    actorId: string,
    input: {
      profileId: string;
      roleId: string;
      scope: ScopeDescriptor | null;
      expiresAt: Date | null;
      reason: string | null;
    },
  ) {
    const scopeJson = (input.scope ?? undefined) as unknown as
      | Prisma.InputJsonValue
      | undefined;
    await this.client.userTenantRole.upsert({
      where: { userTenantId: input.profileId },
      create: {
        userTenantId: input.profileId,
        roleId: input.roleId,
        tenantId,
        assignedBy: actorId,
        scope: scopeJson,
        expiresAt: input.expiresAt,
        grantReason: input.reason,
      },
      update: {
        roleId: input.roleId,
        assignedBy: actorId,
        scope: scopeJson ?? Prisma.JsonNull,
        expiresAt: input.expiresAt,
        grantReason: input.reason,
      },
    });
  }

  /** Is granting `roleId` high-risk? Sensitive capability or clearance ≥ 7. */
  private async isHighRisk(
    tenantId: string,
    roleId: string,
    clearanceLevel: number,
  ): Promise<boolean> {
    if (clearanceLevel >= 7) return true;
    const access = await this.effectiveAccess.evaluateRole(
      this.prisma,
      tenantId,
      roleId,
    );
    return access.sensitive.length > 0;
  }

  private async loadProfile(tenantId: string, profileId: string) {
    const profile = await this.client.userTenant.findFirst({
      where: { id: profileId, tenantId },
      select: {
        id: true,
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
        userTenantRole: {
          select: {
            roleId: true,
            role: { select: { name: true } },
            scope: true,
            expiresAt: true,
            grantReason: true,
            assignedAt: true,
          },
        },
      },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  /** A role grantable in this tenant: an active system role or its own custom role. */
  private async loadGrantableRole(tenantId: string, roleId: string) {
    const role = await this.client.role.findFirst({
      where: {
        id: roleId,
        isActive: true,
        OR: [
          {
            tenantId: null,
            roleType: { in: [RoleType.PLATFORM, RoleType.SYSTEM] },
          },
          { tenantId, roleType: RoleType.CUSTOM },
        ],
      },
      select: { id: true, name: true, clearanceLevel: true },
    });
    if (!role) {
      throw new NotFoundException('Role not found or not grantable here');
    }
    return role;
  }

  /** Validate a campus scope against the tenant's campuses; global stays as-is. */
  private async resolveScope(
    tenantId: string,
    scope: ScopeDescriptorDto | null | undefined,
  ): Promise<ScopeDescriptor | null> {
    if (!scope || scope.type === 'global') return null;
    if (scope.type === 'campus') {
      if (!scope.value) {
        throw new BadRequestException('A campus scope needs a campus.');
      }
      const campus = await this.client.campus.findFirst({
        where: { id: scope.value, tenantId },
        select: { id: true, name: true },
      });
      if (!campus) {
        throw new BadRequestException(
          'Scope campus not found for this tenant.',
        );
      }
      return { type: 'campus', value: campus.id, label: campus.name };
    }
    return null;
  }

  private parseExpiry(raw: string | undefined): Date | null {
    if (!raw) return null;
    const when = new Date(raw);
    if (Number.isNaN(when.getTime())) {
      throw new BadRequestException('Invalid expiry date.');
    }
    if (when.getTime() <= Date.now()) {
      throw new BadRequestException('Expiry must be in the future.');
    }
    return when;
  }

  private async loadPendingRequest(tenantId: string, requestId: string) {
    const request = await this.client.makerCheckerRequest.findFirst({
      where: { id: requestId, tenantId, operation: MAKER_CHECKER_OP },
    });
    if (!request) {
      throw new NotFoundException('Grant request not found');
    }
    if (request.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('This grant request is already closed.');
    }
    return request;
  }

  private async pendingRequestsForProfile(tenantId: string, profileId: string) {
    const requests = await this.client.makerCheckerRequest.findMany({
      where: {
        tenantId,
        operation: MAKER_CHECKER_OP,
        status: ApprovalStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return requests
      .filter(
        (r) =>
          (r.requestData as unknown as GrantRequestData)?.profileId ===
          profileId,
      )
      .map((r) => {
        const data = r.requestData as unknown as GrantRequestData;
        return {
          requestId: r.id,
          roleId: data.roleId,
          scope: data.scope ?? null,
          expiresAt: data.expiresAt,
          reason: data.reason,
          makerId: r.makerId,
          createdAt: r.createdAt,
          expiresAtRequest: r.expiresAt,
        };
      });
  }
}

function isExpired(expiresAt: Date | null): boolean {
  return expiresAt != null && expiresAt.getTime() <= Date.now();
}
