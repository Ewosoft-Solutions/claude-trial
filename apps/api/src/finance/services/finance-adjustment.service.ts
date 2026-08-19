import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaClient } from '@workspace/database';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { MakerCheckerService } from '../../auth/services/maker-checker.service';
import { LedgerService, SYSTEM_ACCOUNT } from './ledger.service';
import { refreshInvoiceTotals } from '../invoice-financials';
import {
  CreateAdjustmentDto,
  CreateDiscountPolicyDto,
} from '../dto/adjustment.dto';

/** The acting user + their clearance, for maker-checker sign-off. */
export interface AdjustmentActor {
  userId: string;
  clearanceLevel: number;
}

const OP_ADJUSTMENT = 'finance.adjustment.discretionary';
const OP_POLICY_ACTIVATE = 'finance.discount_policy.activate';

/**
 * Fee adjustments (discounts / waivers / scholarships / corrections) and the
 * discount policies that auto-grant them.
 *
 * Authority is enforced here: a **discretionary** adjustment and **activating a
 * policy** each raise a WB1-6 maker-checker request, so a second authority signs
 * off (maker ≠ checker). A **policy** adjustment is pre-authorised by its
 * (already-approved) policy and is applied automatically at invoice issue.
 *
 * "Applying" an adjustment is only a status transition — the amount reduces the
 * invoice balance where the balance is DERIVED (gross − adjustments − paid),
 * built in the next slice.
 */
@Injectable()
export class FinanceAdjustmentService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly makerChecker: MakerCheckerService,
    private readonly ledger: LedgerService,
  ) {}

  // Tenant-scoped only (every route is `@TenantScoped()`): reads/writes go
  // through the RLS-scoped client, never the privileged one.
  private get client() {
    return this.tenantDb.client;
  }

  /** MakerCheckerService is typed for the full client; the scoped tx satisfies it. */
  private get pc(): PrismaClient {
    return this.client as unknown as PrismaClient;
  }

  // ---- Discretionary adjustments (maker-checker) ----------------------

  /** Raise a discretionary adjustment; it stays `pending` until approved. */
  async requestAdjustment(
    tenantId: string,
    actor: AdjustmentActor,
    dto: CreateAdjustmentDto,
  ) {
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id: dto.invoiceId, tenantId },
      select: { id: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const adjustment = await this.client.feeAdjustment.create({
      data: {
        tenantId,
        invoiceId: dto.invoiceId,
        lineId: dto.lineId ?? null,
        type: dto.type,
        source: 'discretionary',
        amount: dto.amount,
        reason: dto.reason ?? null,
        status: 'pending',
        requestedBy: actor.userId,
      },
    });

    const approvalRequestId = await this.makerChecker.createApprovalRequest(
      this.pc,
      OP_ADJUSTMENT,
      actor.userId,
      actor.clearanceLevel,
      {
        adjustmentId: adjustment.id,
        invoiceId: dto.invoiceId,
        type: dto.type,
        amount: dto.amount,
      },
      tenantId,
    );

    return this.client.feeAdjustment.update({
      where: { id: adjustment.id },
      data: { approvalRequestId },
    });
  }

  /** Approve a pending adjustment (checker ≠ requester, enforced by MakerChecker). */
  async approveAdjustment(
    tenantId: string,
    checker: AdjustmentActor,
    adjustmentId: string,
    reason?: string,
  ) {
    const adj = await this.client.feeAdjustment.findFirst({
      where: { id: adjustmentId, tenantId },
    });
    if (!adj) throw new NotFoundException('Adjustment not found');
    if (adj.status !== 'pending' || !adj.approvalRequestId) {
      throw new BadRequestException('Adjustment is not awaiting approval');
    }

    const result = await this.makerChecker.approveRequest(
      this.pc,
      adj.approvalRequestId,
      checker.userId,
      checker.clearanceLevel,
      reason,
    );
    if (!result.approved) {
      throw new BadRequestException(result.error ?? 'Approval failed');
    }

    const now = new Date();
    const applied = await this.client.feeAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: 'applied',
        approvedBy: checker.userId,
        approvedAt: now,
        appliedAt: now,
      },
    });

    await this.postAdjustment(tenantId, applied, checker.userId);
    return applied;
  }

  /**
   * A discount reduces what is owed, so it has to leave the books: the money
   * forgiven becomes an expense and the receivable falls by the same amount.
   * The original charge is untouched — that is the whole point of recording a
   * discount rather than editing the invoice.
   */
  private async postAdjustment(
    tenantId: string,
    adjustment: { id: string; invoiceId: string; amount: number; reason: string | null },
    userId?: string,
  ) {
    if (adjustment.amount <= 0) return;
    await this.ledger.ensureOpeningBalance(tenantId, userId);
    const { invoice } = await refreshInvoiceTotals(
      this.client,
      tenantId,
      adjustment.invoiceId,
    );
    await this.ledger.post(tenantId, {
      entryDate: new Date(),
      memo: `Adjustment on invoice ${invoice.invoiceNumber}${adjustment.reason ? ` — ${adjustment.reason}` : ''}`,
      sourceType: 'adjustment',
      sourceId: adjustment.id,
      postedBy: userId ?? null,
      lines: [
        {
          account: SYSTEM_ACCOUNT.DISCOUNTS_ALLOWED,
          debit: adjustment.amount,
          description: adjustment.reason ?? 'Discount / waiver',
          invoiceId: invoice.id,
          householdId: invoice.householdId,
          studentId: invoice.studentId,
        },
        {
          account: SYSTEM_ACCOUNT.AR_CONTROL,
          credit: adjustment.amount,
          description: `Invoice ${invoice.invoiceNumber}`,
          invoiceId: invoice.id,
          householdId: invoice.householdId,
          studentId: invoice.studentId,
        },
      ],
    });
  }

  /** Reject a pending adjustment. */
  async rejectAdjustment(
    tenantId: string,
    checker: AdjustmentActor,
    adjustmentId: string,
    reason: string,
  ) {
    const adj = await this.client.feeAdjustment.findFirst({
      where: { id: adjustmentId, tenantId },
    });
    if (!adj) throw new NotFoundException('Adjustment not found');
    if (adj.status !== 'pending' || !adj.approvalRequestId) {
      throw new BadRequestException('Adjustment is not awaiting approval');
    }

    await this.makerChecker.rejectRequest(
      this.pc,
      adj.approvalRequestId,
      checker.userId,
      reason,
    );

    return this.client.feeAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: 'rejected',
        approvedBy: checker.userId,
        approvedAt: new Date(),
      },
    });
  }

  // ---- Discount policies (maker-checker activation) -------------------

  /** Create a discount policy in `pending` state + raise its activation request. */
  async createPolicy(
    tenantId: string,
    actor: AdjustmentActor,
    dto: CreateDiscountPolicyDto,
  ) {
    if ((dto.amount == null) === (dto.percentBps == null)) {
      throw new BadRequestException(
        'Provide exactly one of amount or percentBps',
      );
    }

    const policy = await this.client.discountPolicy.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type,
        feeItemId: dto.feeItemId ?? null,
        amount: dto.amount ?? null,
        percentBps: dto.percentBps ?? null,
        reason: dto.reason ?? null,
        status: 'pending',
        createdBy: actor.userId,
      },
    });

    const approvalRequestId = await this.makerChecker.createApprovalRequest(
      this.pc,
      OP_POLICY_ACTIVATE,
      actor.userId,
      actor.clearanceLevel,
      { policyId: policy.id, name: dto.name },
      tenantId,
    );

    return this.client.discountPolicy.update({
      where: { id: policy.id },
      data: { approvalRequestId },
    });
  }

  /** Activate a pending policy (checker ≠ creator). It then auto-applies at issue. */
  async activatePolicy(
    tenantId: string,
    checker: AdjustmentActor,
    policyId: string,
    reason?: string,
  ) {
    const policy = await this.client.discountPolicy.findFirst({
      where: { id: policyId, tenantId },
    });
    if (!policy) throw new NotFoundException('Discount policy not found');
    if (policy.status !== 'pending' || !policy.approvalRequestId) {
      throw new BadRequestException('Policy is not awaiting activation');
    }

    const result = await this.makerChecker.approveRequest(
      this.pc,
      policy.approvalRequestId,
      checker.userId,
      checker.clearanceLevel,
      reason,
    );
    if (!result.approved) {
      throw new BadRequestException(result.error ?? 'Activation failed');
    }

    return this.client.discountPolicy.update({
      where: { id: policyId },
      data: {
        status: 'active',
        approvedBy: checker.userId,
        approvedAt: new Date(),
      },
    });
  }

  // ---- Reads (for the UI) --------------------------------------------

  /** Every adjustment on an invoice (pending + applied + rejected), newest first. */
  listAdjustments(tenantId: string, invoiceId: string) {
    return this.client.feeAdjustment.findMany({
      where: { tenantId, invoiceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** The tenant's discount policies (pending awaiting activation first). */
  listPolicies(tenantId: string) {
    return this.client.discountPolicy.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { feeItem: { select: { code: true, name: true } } },
    });
  }

  // ---- Auto-apply active policies to an invoice (at issue) ------------

  /**
   * Create policy-sourced adjustments for every active policy that matches this
   * invoice. Idempotent per (invoice, policy). Amount = a fixed sum, or a
   * percentage of the matching lines' gross (a targeted fee item, else the whole
   * invoice), never exceeding that base.
   */
  async applyPoliciesToInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { lines: true, adjustments: true },
    });
    if (!invoice) return [];

    const policies = await this.client.discountPolicy.findMany({
      where: { tenantId, status: 'active' },
    });

    const created = [];
    for (const policy of policies) {
      const already = invoice.adjustments.some((a) => a.policyId === policy.id);
      if (already) continue;

      const base = policy.feeItemId
        ? invoice.lines
            .filter((l) => l.feeItemId === policy.feeItemId)
            .reduce((sum, l) => sum + l.amount * l.quantity, 0)
        : invoice.lines.reduce((sum, l) => sum + l.amount * l.quantity, 0);
      if (base <= 0) continue;

      const raw =
        policy.amount != null
          ? Math.min(policy.amount, base)
          : policy.percentBps != null
            ? Math.round((base * policy.percentBps) / 10000)
            : 0;
      if (raw <= 0) continue;

      const adjustment = await this.client.feeAdjustment.create({
        data: {
          tenantId,
          invoiceId,
          type: policy.type === 'scholarship' ? 'scholarship' : 'discount',
          source: 'policy',
          amount: raw,
          reason: policy.name,
          policyId: policy.id,
          status: 'applied',
          appliedAt: new Date(),
        },
      });
      await this.postAdjustment(tenantId, adjustment);
      created.push(adjustment);
    }
    return created;
  }
}
