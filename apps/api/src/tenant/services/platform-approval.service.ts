import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { ApprovalStatus, ClearanceLevel } from '@workspace/api';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { MakerCheckerService } from '../../auth/services/maker-checker.service';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';

/** The maker-checker operation key for tenant activate/suspend. */
const TENANT_ACT_OPERATION = 'tenant.act';

type TenantActStatus = 'active' | 'suspended';

interface Actor {
  userId: string;
  /** The actor's own tenant (the platform tenant) — where audit rows are filed. */
  tenantId: string;
  clearanceLevel: number;
  /** Whether the actor holds `platform.approvals.override`. */
  canOverride: boolean;
}

/**
 * Platform Approval Service
 *
 * Enforces "SuperAdmin proposes, Architect disposes" for tenant lifecycle
 * actions (docs/platform-scope-plan.md §7.3). An Architect (clearance 10) acts
 * directly; a SuperAdmin (9) raises a maker-checker request that an Architect —
 * who is never the maker — must approve before the change takes effect.
 *
 * Everything runs inside the audited platform scope (`runPlatform`), so it is
 * RLS-correct and never touches the privileged client.
 */
@Injectable()
export class PlatformApprovalService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly makerChecker: MakerCheckerService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  private get prisma(): PrismaClient {
    return this.tenantDb.client as unknown as PrismaClient;
  }

  /** Clearance at or above which the actor is a valid checker, so acts directly. */
  private get directActionClearance(): number {
    return (
      this.makerChecker.getRequiredCheckerClearanceLevel(
        TENANT_ACT_OPERATION,
      ) ?? ClearanceLevel.ARCHITECT
    );
  }

  /**
   * Activate or suspend a tenant, subject to approval.
   *
   * @returns `applied` when the actor is an Architect (executed immediately),
   *          or `pending` with a request id when a SuperAdmin raised it.
   */
  async submitTenantStatusChange(params: {
    actor: Actor;
    targetTenantId: string;
    status: TenantActStatus;
    reason?: string;
  }): Promise<
    { outcome: 'applied' } | { outcome: 'pending'; requestId: string }
  > {
    const { actor, targetTenantId, status, reason } = params;

    await this.assertTransitionPossible(targetTenantId, status);

    // An Architect (a valid checker) acts directly — routing them through
    // approval would be pointless, since they are the approving authority.
    if (actor.clearanceLevel >= this.directActionClearance) {
      await this.applyStatusChange(actor, targetTenantId, status);
      return { outcome: 'applied' };
    }

    const requestId = await this.makerChecker.createApprovalRequest(
      this.prisma,
      TENANT_ACT_OPERATION,
      actor.userId,
      actor.clearanceLevel,
      { targetTenantId, status, reason: reason ?? null },
      actor.tenantId,
    );

    if (!requestId) {
      // Only reachable if tenant.act were de-registered as sensitive.
      throw new BadRequestException('Tenant action requires approval.');
    }
    return { outcome: 'pending', requestId };
  }

  /**
   * Approve a pending tenant action and execute the deferred change.
   *
   * Self-approval and the checker-clearance floor are enforced inside
   * `MakerCheckerService.approveRequest`; `override` lifts only the clearance
   * floor, never the maker≠checker rule.
   */
  async approve(params: {
    actor: Actor;
    requestId: string;
    reason?: string;
  }): Promise<{ status: TenantActStatus; targetTenantId: string }> {
    const { actor, requestId, reason } = params;

    const request = await this.prisma.makerCheckerRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.operation !== TENANT_ACT_OPERATION) {
      throw new NotFoundException('Approval request not found');
    }

    const result = await this.makerChecker.approveRequest(
      this.prisma,
      requestId,
      actor.userId,
      actor.clearanceLevel,
      reason,
      { override: actor.canOverride },
    );

    if (!result.approved) {
      throw new BadRequestException(result.error ?? 'Approval failed');
    }

    const data = request.requestData as {
      targetTenantId: string;
      status: TenantActStatus;
    };

    // Re-validate at execution time: the tenant's state may have moved between
    // request and approval (e.g. already suspended by another path).
    await this.assertTransitionPossible(data.targetTenantId, data.status);
    await this.applyStatusChange(actor, data.targetTenantId, data.status, {
      approvedRequestId: requestId,
      makerId: request.makerId,
    });

    return { status: data.status, targetTenantId: data.targetTenantId };
  }

  /** Reject a pending tenant action. */
  async reject(params: {
    actor: Actor;
    requestId: string;
    reason: string;
  }): Promise<void> {
    const { actor, requestId, reason } = params;

    const request = await this.prisma.makerCheckerRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.operation !== TENANT_ACT_OPERATION) {
      throw new NotFoundException('Approval request not found');
    }

    // A maker rejecting their own request is fine (withdrawal); only approval
    // is barred for the maker. But block it if they are neither maker nor a
    // valid checker, so a lower actor cannot dispose of others' requests.
    const isMaker = request.makerId === actor.userId;
    const isChecker =
      actor.canOverride || actor.clearanceLevel >= this.directActionClearance;
    if (!isMaker && !isChecker) {
      throw new BadRequestException(
        'You do not have authority to reject this request',
      );
    }

    const result = await this.makerChecker.rejectRequest(
      this.prisma,
      requestId,
      actor.userId,
      reason,
    );
    if (!result.rejected) {
      throw new BadRequestException(result.error ?? 'Rejection failed');
    }
  }

  /** Pending tenant-action requests, newest first (for the Architect's queue). */
  async listPending() {
    const rows = await this.prisma.makerCheckerRequest.findMany({
      where: {
        operation: TENANT_ACT_OPERATION,
        status: ApprovalStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => {
      const d = r.requestData as {
        targetTenantId: string;
        status: TenantActStatus;
        reason: string | null;
      };
      return {
        id: r.id,
        operation: r.operation,
        makerId: r.makerId,
        makerClearanceLevel: r.makerClearanceLevel,
        targetTenantId: d.targetTenantId,
        status: d.status,
        reason: d.reason,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      };
    });
  }

  // ---- internals ---------------------------------------------------------

  private async assertTransitionPossible(
    tenantId: string,
    nextStatus: TenantActStatus,
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.status === nextStatus) {
      throw new BadRequestException(`Tenant is already ${nextStatus}`);
    }
  }

  private async applyStatusChange(
    actor: Actor,
    tenantId: string,
    status: TenantActStatus,
    approval?: { approvedRequestId: string; makerId: string },
  ): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status },
    });

    // Platform-plane audit: filed under the actor's own (platform) tenant with
    // the target in metadata — the §7.1 filing rule — whether the change was
    // applied directly by an Architect or via an approved SuperAdmin request.
    await this.platformAudit.logTenantStatusAction({
      userId: actor.userId,
      tenantId: actor.tenantId,
      targetTenantId: tenantId,
      status,
      viaApproval: approval
        ? { requestId: approval.approvedRequestId, makerId: approval.makerId }
        : undefined,
    });
  }
}
