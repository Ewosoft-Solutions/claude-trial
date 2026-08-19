import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { FinanceNumberingService } from './finance-numbering.service';
import { FinanceCreditService } from './finance-credit.service';
import { LedgerService, SYSTEM_ACCOUNT } from './ledger.service';
import {
  INVOICE_FINANCIALS_INCLUDE,
  computeFinancials,
  refreshInvoiceTotals,
} from '../invoice-financials';
import type { ListReceiptsDto, RecordReceiptDto } from '../dto/receipt.dto';

/**
 * Receipts — money received, and what it settled.
 *
 * The shape the school actually needs (ADR-05 Q21): a parent pays once, and
 * that one receipt settles a bill for each of their children. So a receipt
 * records the money and its payer, and separate allocation rows record what
 * each naira went to. An invoice can therefore collect installments over a
 * term, and a receipt can spread across a family — neither of which the old
 * one-payment-one-invoice column could express.
 *
 * Everything happens in the request's single transaction: the receipt, its
 * allocations, each invoice's re-derived totals, any overpayment held as
 * credit, and the balanced journal entry behind all of it.
 */
@Injectable()
export class FinanceReceiptService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly numbering: FinanceNumberingService,
    private readonly credits: FinanceCreditService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  // ---- Reads -----------------------------------------------------------

  async listReceipts(tenantId: string, query: ListReceiptsDto) {
    const where: Prisma.PaymentWhereInput = { tenantId };
    if (query.householdId) where.householdId = query.householdId;
    if (query.status) where.status = query.status;
    if (query.method) where.method = query.method;
    if (query.invoiceId) {
      where.allocations = { some: { invoiceId: query.invoiceId } };
    }
    if (query.studentId) {
      where.allocations = {
        some: { invoice: { studentId: query.studentId } },
      };
    }
    if (query.from || query.to) {
      where.paidAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { receiptNumber: { contains: query.search, mode: 'insensitive' } },
        { payerName: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const include = {
      household: { select: { id: true, name: true } },
      allocations: {
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              studentId: true,
              studentName: true,
            },
          },
        },
      },
      credits: { select: { id: true, amount: true, remaining: true } },
    } satisfies Prisma.PaymentInclude;

    const orderBy: Prisma.PaymentOrderByWithRelationInput[] = [
      { paidAt: 'desc' },
      { createdAt: 'desc' },
    ];

    // No `limit` → the whole filtered set, for the aggregate pages; a `limit` →
    // one server-driven page. Same contract as the invoices list.
    if (query.limit == null) {
      const rows = await this.client.payment.findMany({
        where,
        include,
        orderBy,
      });
      return { data: rows.map((r) => this.shape(r)), total: rows.length };
    }

    const take = Math.min(Math.max(query.limit, 1), 200);
    const skip = Math.max(query.offset ?? 0, 0);
    const [rows, total] = await Promise.all([
      this.client.payment.findMany({ where, include, orderBy, take, skip }),
      this.client.payment.count({ where }),
    ]);
    return {
      data: rows.map((r) => this.shape(r)),
      total,
      limit: take,
      offset: skip,
    };
  }

  async getReceipt(tenantId: string, id: string) {
    const receipt = await this.client.payment.findFirst({
      where: { id, tenantId },
      include: {
        household: { select: { id: true, name: true } },
        allocations: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                studentId: true,
                studentName: true,
                termName: true,
              },
            },
          },
        },
        credits: true,
      },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return this.shape(receipt);
  }

  /** Flatten the covered students onto the receipt — what a printout shows. */
  private shape<
    T extends {
      amount: number;
      allocations: {
        amount: number;
        invoice?: { studentName?: string | null } | null;
      }[];
      credits?: { amount: number }[];
    },
  >(receipt: T) {
    const allocated = receipt.allocations.reduce((s, a) => s + a.amount, 0);
    const students = Array.from(
      new Set(
        receipt.allocations
          .map((a) => a.invoice?.studentName)
          .filter((n): n is string => !!n),
      ),
    );
    return {
      ...receipt,
      allocatedAmount: allocated,
      unallocatedAmount: Math.max(0, receipt.amount - allocated),
      coveredStudents: students,
    };
  }

  // ---- The one writer --------------------------------------------------

  /**
   * Record money received and allocate it. Refuses to over-allocate a receipt
   * or to settle more than an invoice actually owes — both would silently
   * corrupt the receivable rather than fail loudly.
   */
  async recordReceipt(tenantId: string, dto: RecordReceiptDto, userId: string) {
    // Before anything is settled: if this school carried debt from before the
    // ledger existed, open the books with it, so this receipt reduces a
    // receivable that was actually there.
    await this.ledger.ensureOpeningBalance(tenantId, userId);

    if (dto.amount <= 0) {
      throw new BadRequestException('A receipt must be for a positive amount.');
    }

    const requested = dto.allocations ?? [];
    const requestedTotal = requested.reduce((s, a) => s + a.amount, 0);
    if (requestedTotal > dto.amount) {
      throw new BadRequestException(
        'The allocations add up to more than the money received.',
      );
    }
    const seen = new Set<string>();
    for (const allocation of requested) {
      if (allocation.amount <= 0) {
        throw new BadRequestException(
          'Every allocation must be for a positive amount.',
        );
      }
      if (seen.has(allocation.invoiceId)) {
        throw new BadRequestException(
          'The same invoice appears twice — combine those into one allocation.',
        );
      }
      seen.add(allocation.invoiceId);
    }

    let household: { id: string; name: string } | null = null;
    if (dto.householdId) {
      household = await this.client.billingHousehold.findFirst({
        where: { id: dto.householdId, tenantId },
        select: { id: true, name: true },
      });
      if (!household) throw new NotFoundException('Household not found');
    }

    // Validate every target before writing anything.
    const targets: {
      id: string;
      invoiceNumber: string;
      studentId: string | null;
      householdId: string | null;
      amount: number;
    }[] = [];
    for (const allocation of requested) {
      const invoice = await this.client.feeInvoice.findFirst({
        where: { id: allocation.invoiceId, tenantId },
        include: INVOICE_FINANCIALS_INCLUDE,
      });
      if (!invoice) {
        throw new NotFoundException(
          `Invoice ${allocation.invoiceId} was not found`,
        );
      }
      if (invoice.status === 'draft' || invoice.status === 'cancelled') {
        throw new BadRequestException(
          `Invoice ${invoice.invoiceNumber} is ${invoice.status} — issue it before taking payment against it.`,
        );
      }
      const balance = computeFinancials(invoice).balance;
      if (allocation.amount > balance) {
        throw new BadRequestException(
          `Invoice ${invoice.invoiceNumber} only has ${balance} kobo outstanding; ${allocation.amount} was allocated to it.`,
        );
      }
      targets.push({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        studentId: invoice.studentId,
        householdId: invoice.householdId,
        amount: allocation.amount,
      });
    }

    const paidAt = new Date(dto.paidAt);
    const receiptNumber = await this.numbering.next(tenantId, 'receipt', paidAt);

    const payerName =
      dto.payerName ?? (await this.resolvePayerName(tenantId, dto.householdId));

    const receipt = await this.client.payment.create({
      data: {
        tenantId,
        receiptNumber,
        householdId: dto.householdId ?? null,
        payerName,
        method: dto.method,
        paidAt,
        amount: dto.amount,
        reference: dto.reference ?? null,
        status: 'completed',
        notes: dto.notes ?? null,
        recordedBy: userId,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    for (const target of targets) {
      await this.client.paymentAllocation.create({
        data: {
          tenantId,
          paymentId: receipt.id,
          invoiceId: target.id,
          amount: target.amount,
          createdBy: userId,
        },
      });
      await refreshInvoiceTotals(this.client, tenantId, target.id);
    }

    // Anything not allocated is money we hold against future invoices, not
    // income. It has to belong to someone, so it needs a household or a
    // student — the receipt's own, or the one its invoices point at.
    const unallocated = dto.amount - requestedTotal;
    let credit = null;
    if (unallocated > 0) {
      const studentId =
        dto.studentId ?? targets.find((t) => t.studentId)?.studentId ?? null;
      const householdId =
        dto.householdId ?? targets.find((t) => t.householdId)?.householdId ?? null;
      credit = await this.credits.createFromOverpayment(
        tenantId,
        {
          amount: unallocated,
          paymentId: receipt.id,
          householdId,
          studentId,
          reason: 'Received beyond the invoices settled on this receipt',
        },
        userId,
      );
    }

    await this.ledger.post(tenantId, {
      entryDate: paidAt,
      memo: `Receipt ${receiptNumber}${payerName ? ` from ${payerName}` : ''}`,
      sourceType: 'receipt',
      sourceId: receipt.id,
      postedBy: userId,
      lines: [
        {
          account: SYSTEM_ACCOUNT.CASH,
          debit: dto.amount,
          description: `${dto.method} — ${receiptNumber}`,
          householdId: dto.householdId ?? null,
        },
        ...targets.map((target) => ({
          account: SYSTEM_ACCOUNT.AR_CONTROL,
          credit: target.amount,
          description: `Invoice ${target.invoiceNumber}`,
          invoiceId: target.id,
          householdId: target.householdId,
          studentId: target.studentId,
        })),
        ...(unallocated > 0
          ? [
              {
                account: SYSTEM_ACCOUNT.UNAPPLIED_CREDIT,
                credit: unallocated,
                description: 'Held as credit for future invoices',
                householdId: dto.householdId ?? null,
              },
            ]
          : []),
      ],
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'finance_receipt_recorded',
      resource: 'payment',
      resourceId: receipt.id,
      actorId: userId,
      description: `Receipt ${receiptNumber} for ${dto.amount} kobo across ${targets.length} invoice(s)`,
      metadata: {
        receiptNumber,
        amount: dto.amount,
        method: dto.method,
        householdId: dto.householdId ?? null,
        allocations: targets.map((t) => ({
          invoiceId: t.id,
          invoiceNumber: t.invoiceNumber,
          amount: t.amount,
        })),
        creditCreated: credit?.amount ?? 0,
      },
    });

    return this.getReceipt(tenantId, receipt.id);
  }

  /**
   * Reprint: not blocked (families lose receipts), but counted and audited —
   * a receipt quietly printed forty times is a different story.
   */
  async recordReprint(tenantId: string, id: string, userId: string) {
    const receipt = await this.client.payment.findFirst({
      where: { id, tenantId },
      select: { id: true, receiptNumber: true },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');

    await this.client.payment.update({
      where: { id: receipt.id },
      data: { reprintCount: { increment: 1 }, lastReprintedAt: new Date() },
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.USER_ACTION,
      action: 'finance_receipt_reprinted',
      resource: 'payment',
      resourceId: receipt.id,
      actorId: userId,
      description: `Receipt ${receipt.receiptNumber} reprinted`,
    });

    return this.getReceipt(tenantId, receipt.id);
  }

  /**
   * What a family currently owes, per member — the list the checkout screen
   * opens with, so an operator never has to hunt for a child's invoice.
   */
  async householdOutstanding(tenantId: string, householdId: string) {
    const household = await this.client.billingHousehold.findFirst({
      where: { id: householdId, tenantId },
      include: {
        members: { where: { effectiveTo: null } },
        payers: { where: { effectiveTo: null }, orderBy: { role: 'asc' } },
      },
    });
    if (!household) throw new NotFoundException('Household not found');

    const studentIds = household.members.map((m) => m.studentId);
    const invoices = await this.client.feeInvoice.findMany({
      where: {
        tenantId,
        status: { notIn: ['draft', 'cancelled', 'paid'] },
        OR: [
          { householdId },
          ...(studentIds.length ? [{ studentId: { in: studentIds } }] : []),
        ],
      },
      include: INVOICE_FINANCIALS_INCLUDE,
      orderBy: [{ dueDate: 'asc' }, { invoiceNumber: 'asc' }],
    });

    const open = invoices
      .map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        studentId: invoice.studentId,
        studentName: invoice.studentName,
        termName: invoice.termName,
        dueDate: invoice.dueDate,
        status: invoice.status,
        financials: computeFinancials(invoice),
      }))
      .filter((invoice) => invoice.financials.balance > 0);

    return {
      household: {
        id: household.id,
        name: household.name,
        primaryPayerName:
          household.payers[0]?.payerName ?? household.primaryPayerName,
        members: household.members,
      },
      invoices: open,
      totalOutstanding: open.reduce((s, i) => s + i.financials.balance, 0),
      availableCredit: await this.credits.availableCredit(tenantId, {
        householdId,
      }),
    };
  }

  private async resolvePayerName(
    tenantId: string,
    householdId?: string | null,
  ): Promise<string | null> {
    if (!householdId) return null;
    const payer = await this.client.householdPayer.findFirst({
      where: { tenantId, householdId, effectiveTo: null },
      orderBy: [{ role: 'asc' }, { effectiveFrom: 'asc' }],
      select: { payerName: true },
    });
    return payer?.payerName ?? null;
  }
}
