import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { LedgerService, SYSTEM_ACCOUNT } from './ledger.service';
import {
  INVOICE_FINANCIALS_INCLUDE,
  computeFinancials,
  refreshInvoiceTotals,
} from '../invoice-financials';

/**
 * Unapplied credit — what a family has paid beyond what it owed.
 *
 * ADR-05 is explicit that this is an accounts-receivable CREDIT BALANCE and not
 * a wallet: we hold no money, so credit can only ever be drawn down against a
 * later invoice. Paying it back out in cash is deliberately a separate, later
 * feature with its own payout approval — v1 never moves money outward.
 *
 * Credit arises when a receipt exceeds the invoices it settled, and is applied
 * either automatically (when the family's next invoice is issued) or explicitly
 * by an operator. Both paths write an append-only `CreditApplication` row and
 * post DR unapplied-credit / CR receivables into the ledger, so the liability
 * and the receivable fall together.
 */
@Injectable()
export class FinanceCreditService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  // ---- Reads -----------------------------------------------------------

  listCredits(
    tenantId: string,
    query: { householdId?: string; studentId?: string; status?: string } = {},
  ) {
    return this.client.accountCredit.findMany({
      where: {
        tenantId,
        ...(query.householdId ? { householdId: query.householdId } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        applications: { orderBy: { appliedAt: 'desc' } },
        household: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  /** What a family (or a single student) has left to draw on. */
  async availableCredit(
    tenantId: string,
    owner: { householdId?: string | null; studentId?: string | null },
  ): Promise<number> {
    if (!owner.householdId && !owner.studentId) return 0;
    const sum = await this.client.accountCredit.aggregate({
      where: {
        tenantId,
        status: 'active',
        remaining: { gt: 0 },
        ...this.ownerWhere(owner),
      },
      _sum: { remaining: true },
    });
    return sum._sum.remaining ?? 0;
  }

  private ownerWhere(owner: {
    householdId?: string | null;
    studentId?: string | null;
  }): Prisma.AccountCreditWhereInput {
    const clauses: Prisma.AccountCreditWhereInput[] = [];
    if (owner.householdId) clauses.push({ householdId: owner.householdId });
    if (owner.studentId) clauses.push({ studentId: owner.studentId });
    return clauses.length === 1 ? clauses[0]! : { OR: clauses };
  }

  // ---- Creation --------------------------------------------------------

  /**
   * Park an overpayment as credit. Called by the receipt writer inside the same
   * transaction — the receipt's own journal entry already carries the credit
   * leg, so this records the subledger row only.
   */
  async createFromOverpayment(
    tenantId: string,
    input: {
      amount: number;
      paymentId: string;
      householdId?: string | null;
      studentId?: string | null;
      reason?: string | null;
    },
    userId: string,
  ) {
    if (input.amount <= 0) {
      throw new BadRequestException('A credit must be for a positive amount.');
    }
    if (!input.householdId && !input.studentId) {
      throw new BadRequestException(
        'Overpaid money needs an account to sit on — choose a family or a student for the receipt.',
      );
    }

    const credit = await this.client.accountCredit.create({
      data: {
        tenantId,
        householdId: input.householdId ?? null,
        studentId: input.studentId ?? null,
        source: 'overpayment',
        amount: input.amount,
        remaining: input.amount,
        reason: input.reason ?? 'Received beyond the invoices settled',
        paymentId: input.paymentId,
        status: 'active',
        createdBy: userId,
      },
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'finance_credit_created',
      resource: 'account_credit',
      resourceId: credit.id,
      actorId: userId,
      description: `Overpayment of ${input.amount} kobo held as credit`,
      metadata: {
        paymentId: input.paymentId,
        householdId: input.householdId ?? null,
        studentId: input.studentId ?? null,
      },
    });

    return credit;
  }

  // ---- Application -----------------------------------------------------

  /** Apply a specific credit to a specific invoice. */
  async applyCredit(
    tenantId: string,
    creditId: string,
    invoiceId: string,
    amount: number,
    userId: string,
  ) {
    await this.ledger.ensureOpeningBalance(tenantId, userId);

    const credit = await this.client.accountCredit.findFirst({
      where: { id: creditId, tenantId },
    });
    if (!credit) throw new NotFoundException('Credit not found');
    if (credit.status !== 'active' || credit.remaining <= 0) {
      throw new BadRequestException('That credit has nothing left to draw on.');
    }
    if (amount <= 0) {
      throw new BadRequestException('Apply a positive amount.');
    }
    if (amount > credit.remaining) {
      throw new BadRequestException(
        `Only ${credit.remaining} kobo of that credit is left.`,
      );
    }

    const invoice = await this.client.feeInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: INVOICE_FINANCIALS_INCLUDE,
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'draft' || invoice.status === 'cancelled') {
      throw new BadRequestException(
        'Credit can only be applied to an issued invoice.',
      );
    }

    const financials = computeFinancials(invoice);
    if (amount > financials.balance) {
      throw new BadRequestException(
        `That invoice only has ${financials.balance} kobo outstanding.`,
      );
    }

    const applied = await this.applyOne(
      tenantId,
      { id: credit.id, remaining: credit.remaining },
      invoice.id,
      amount,
      userId,
    );

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'finance_credit_applied',
      resource: 'account_credit',
      resourceId: credit.id,
      actorId: userId,
      description: `Applied ${amount} kobo of credit to invoice ${invoice.invoiceNumber}`,
      metadata: { invoiceId: invoice.id, amount },
    });

    return applied;
  }

  /**
   * Draw the family's available credit down onto a newly issued invoice, oldest
   * credit first. Returns how much was applied — zero when there is none, which
   * is the ordinary case.
   */
  async autoApplyToInvoice(
    tenantId: string,
    invoiceId: string,
    userId: string,
  ): Promise<number> {
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: INVOICE_FINANCIALS_INCLUDE,
    });
    if (!invoice) return 0;
    if (invoice.status === 'draft' || invoice.status === 'cancelled') return 0;

    let outstanding = computeFinancials(invoice).balance;
    if (outstanding <= 0) return 0;

    const owner = {
      householdId: invoice.householdId,
      studentId: invoice.studentId,
    };
    if (!owner.householdId && !owner.studentId) return 0;

    const credits = await this.client.accountCredit.findMany({
      where: {
        tenantId,
        status: 'active',
        remaining: { gt: 0 },
        ...this.ownerWhere(owner),
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    let total = 0;
    for (const credit of credits) {
      if (outstanding <= 0) break;
      const amount = Math.min(credit.remaining, outstanding);
      await this.applyOne(
        tenantId,
        { id: credit.id, remaining: credit.remaining },
        invoice.id,
        amount,
        userId,
      );
      outstanding -= amount;
      total += amount;
    }

    if (total > 0) {
      await this.audit.write({
        tenantId,
        eventType: AUDIT_EVENT.DATA_CHANGE,
        action: 'finance_credit_auto_applied',
        resource: 'fee_invoice',
        resourceId: invoice.id,
        actorId: userId,
        description: `Applied ${total} kobo of held credit to invoice ${invoice.invoiceNumber} on issue`,
        metadata: { invoiceId: invoice.id, amount: total },
      });
    }

    return total;
  }

  /**
   * One draw-down: the append-only application row, the credit's remaining
   * balance, the invoice's cached paid/status, and the journal entry that moves
   * the liability onto the receivable. Callers have already validated the
   * amount against both sides.
   */
  private async applyOne(
    tenantId: string,
    credit: { id: string; remaining: number },
    invoiceId: string,
    amount: number,
    userId: string,
  ) {
    const application = await this.client.creditApplication.create({
      data: {
        tenantId,
        creditId: credit.id,
        invoiceId,
        amount,
        appliedBy: userId,
      },
    });

    const remaining = credit.remaining - amount;
    await this.client.accountCredit.update({
      where: { id: credit.id },
      data: {
        remaining,
        status: remaining === 0 ? 'exhausted' : 'active',
      },
    });

    const { invoice } = await refreshInvoiceTotals(
      this.client,
      tenantId,
      invoiceId,
    );

    await this.ledger.post(tenantId, {
      entryDate: new Date(),
      memo: `Credit applied to invoice ${invoice.invoiceNumber}`,
      sourceType: 'credit_application',
      sourceId: application.id,
      postedBy: userId,
      lines: [
        {
          account: SYSTEM_ACCOUNT.UNAPPLIED_CREDIT,
          debit: amount,
          description: 'Credit drawn down',
          invoiceId,
          householdId: invoice.householdId,
          studentId: invoice.studentId,
        },
        {
          account: SYSTEM_ACCOUNT.AR_CONTROL,
          credit: amount,
          description: `Invoice ${invoice.invoiceNumber}`,
          invoiceId,
          householdId: invoice.householdId,
          studentId: invoice.studentId,
        },
      ],
    });

    return { application, invoice };
  }

}
