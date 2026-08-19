import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { resolvePaginationOrderBy, type SortAllowList } from '../../common/dto';
import { FinanceAdjustmentService } from './finance-adjustment.service';
import { FinanceCreditService } from './finance-credit.service';
import { FinanceNumberingService } from './finance-numbering.service';
import { FinanceReceiptService } from './finance-receipt.service';
import { LedgerService, SYSTEM_ACCOUNT } from './ledger.service';
import {
  INVOICE_FINANCIALS_INCLUDE,
  computeFinancials,
  type InvoiceFinancials,
} from '../invoice-financials';
import {
  CreateInvoiceDto,
  ListInvoicesDto,
  UpdateInvoiceDto,
} from '../dto/finance.dto';

/** Allow-listed sort columns for the invoices list; default is newest first. */
const INVOICE_LIST_SORT: SortAllowList<Prisma.FeeInvoiceOrderByWithRelationInput> =
  {
    studentName: (dir) => [{ studentName: dir }, { invoiceNumber: 'asc' }],
    invoiceNumber: (dir) => [{ invoiceNumber: dir }],
    dueDate: (dir) => [{ dueDate: dir }],
    issuedDate: (dir) => [{ issuedDate: dir }],
    amountDue: (dir) => [{ amountDue: dir }],
    amountPaid: (dir) => [{ amountPaid: dir }],
    status: (dir) => [{ status: dir }, { invoiceNumber: 'asc' }],
  };

export type { InvoiceFinancials };

@Injectable()
export class FinanceService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly adjustments: FinanceAdjustmentService,
    private readonly numbering: FinanceNumberingService,
    private readonly credits: FinanceCreditService,
    private readonly receipts: FinanceReceiptService,
    private readonly ledger: LedgerService,
  ) {}

  // Every collaborator here (ledger, receipts, credit, refreshInvoiceTotals)
  // requires the request's RLS transaction and throws without one, so a
  // privileged fallback would only half-write: the invoice on one connection,
  // the journal entry nowhere. One client, one transaction.
  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  // ---- Invoices -------------------------------------------------------

  async listInvoices(tenantId: string, query: ListInvoicesDto) {
    const where: Record<string, unknown> = { tenantId };
    if (query.studentId) where['studentId'] = query.studentId;
    if (query.classId) where['classId'] = query.classId;
    if (query.status) where['status'] = query.status;
    if (query.termName) where['termName'] = query.termName;
    if (query.search) {
      where['OR'] = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { studentName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy = resolvePaginationOrderBy(
      query.sortBy,
      query.sortOrder,
      INVOICE_LIST_SORT,
      [{ createdAt: 'desc' }],
    );
    const include = INVOICE_FINANCIALS_INCLUDE;

    // No `limit` → the whole (filtered) set, for the aggregate pages. A `limit`
    // → one server-driven page. Each row carries its DERIVED financials.
    if (query.limit == null) {
      const rows = await this.client.feeInvoice.findMany({
        where,
        orderBy,
        include,
      });
      const data = rows.map((r) => this.withFinancials(r));
      return {
        data,
        pagination: {
          page: 1,
          limit: data.length,
          total: data.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.client.feeInvoice.findMany({
        where,
        orderBy,
        include,
        skip,
        take: limit,
      }),
      this.client.feeInvoice.count({ where }),
    ]);
    const data = rows.map((r) => this.withFinancials(r));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /** Attach an invoice's derived financials + drop the raw settlement arrays. */
  private withFinancials<
    T extends {
      lines: { amount: number; quantity: number }[];
      adjustments: { amount: number }[];
      allocations: { amount: number }[];
      creditApplications: { amount: number }[];
    },
  >(inv: T) {
    const { lines, adjustments, allocations, creditApplications, ...rest } = inv;
    return {
      ...rest,
      financials: computeFinancials({
        lines,
        adjustments,
        allocations,
        creditApplications,
      }),
    };
  }

  async getInvoice(tenantId: string, id: string) {
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id, tenantId },
      include: {
        allocations: {
          include: {
            payment: {
              select: {
                id: true,
                receiptNumber: true,
                method: true,
                paidAt: true,
                payerName: true,
                reference: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        creditApplications: { orderBy: { appliedAt: 'desc' } },
        lines: {
          include: { feeItem: { select: { code: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        adjustments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // Derived off the same rows the list uses, so the detail page and the list
    // agree on gross / discounts / what is still owed.
    const financials = computeFinancials({
      lines: invoice.lines,
      adjustments: invoice.adjustments.filter((a) => a.status === 'applied'),
      allocations: invoice.allocations,
      creditApplications: invoice.creditApplications,
    });

    return {
      ...invoice,
      // What settled this invoice, flattened for the detail page.
      payments: invoice.allocations.map((allocation) => ({
        ...allocation.payment,
        allocationId: allocation.id,
        amount: allocation.amount,
      })),
      financials,
    };
  }

  /**
   * Snapshot the billed student's name onto the invoice (finance has no student
   * relation, so the list searches/sorts this instead of a cross-schema join).
   */
  private async resolveStudentName(
    tenantId: string,
    studentId: string,
  ): Promise<string | null> {
    const student = await this.client.student.findFirst({
      where: { id: studentId, tenantId },
      select: {
        userTenant: {
          select: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    const user = student?.userTenant?.user;
    if (!user) return null;
    return (
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null
    );
  }

  async createInvoice(tenantId: string, dto: CreateInvoiceDto, userId: string) {
    const invoiceNumber = await this.numbering.next(tenantId, 'invoice');
    const studentName = await this.resolveStudentName(tenantId, dto.studentId);
    return this.client.feeInvoice.create({
      data: {
        tenantId,
        invoiceNumber,
        studentId: dto.studentId,
        studentName,
        classId: dto.classId ?? null,
        termName: dto.termName ?? null,
        termYear: dto.termYear ?? null,
        termCycle: dto.termCycle ?? null,
        issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        amountDue: dto.amountDue,
        amountPaid: 0,
        status: 'draft',
        notes: dto.notes ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async updateInvoice(
    tenantId: string,
    id: string,
    dto: UpdateInvoiceDto,
    userId: string,
  ) {
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id, tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const isBeingCancelled =
      dto.status === 'cancelled' && invoice.status !== 'cancelled';
    if (isBeingCancelled) {
      // Cancelling withdraws the charge. If money (or credit) has already been
      // applied to it, withdrawing the charge alone would leave the receipt
      // pointing at a bill that no longer exists and the ledger short by what
      // was settled. That correction is a refund/credit note, not a cancel.
      const settled = await this.client.paymentAllocation.count({
        where: { tenantId, invoiceId: id },
      });
      const credited = await this.client.creditApplication.count({
        where: { tenantId, invoiceId: id },
      });
      if (settled > 0 || credited > 0) {
        throw new BadRequestException(
          'This invoice has already been settled in part. Reverse the receipt or raise a correcting adjustment instead of cancelling it.',
        );
      }
    }

    // Issuing is a DRAFT-only transition. Without this, re-issuing an invoice
    // that is already `partial` (a plausible "reset it" click) posts the charge
    // a second time, re-applies every standing discount policy, and draws the
    // family's credit down again — phantom income against a real receivable.
    const isBeingIssued = dto.status === 'issued' && invoice.status !== 'issued';
    if (isBeingIssued && invoice.status !== 'draft') {
      throw new BadRequestException(
        `This invoice is already ${invoice.status} — only a draft can be issued. Correct it with an adjustment or a reversal instead.`,
      );
    }
    // Open the books BEFORE this invoice becomes a receivable, so a school
    // carrying pre-ledger debt opens with that debt and not with this bill.
    if (isBeingIssued) await this.ledger.ensureOpeningBalance(tenantId, userId);

    const updated = await this.client.feeInvoice.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.amountDue !== undefined && { amountDue: dto.amountDue }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        updatedBy: userId,
      },
    });

    // Issuing is the moment a bill becomes a receivable: the charge posts to
    // the ledger, standing discount policies apply, and any credit the family
    // is already holding is drawn down against it.
    if (isBeingIssued) {
      await this.postInvoiceIssued(tenantId, id, userId);
      await this.adjustments.applyPoliciesToInvoice(tenantId, id);
      await this.credits.autoApplyToInvoice(tenantId, id, userId);
    }

    // Cancelling an issued invoice cannot just delete the receivable — it is
    // withdrawn from the books, so the ledger shows both the charge and its
    // withdrawal.
    if (isBeingCancelled) {
      await this.withdrawCancelledInvoice(tenantId, invoice.id, userId);
    }

    // Issuing has side effects (the charge, policy discounts, credit applied),
    // so return what the invoice actually became rather than the row as it
    // looked mid-flight — a caller that just issued can otherwise be told
    // `issued` when held credit has already settled it.
    if (isBeingIssued || isBeingCancelled) {
      return this.client.feeInvoice.findFirst({ where: { id, tenantId } });
    }
    return updated;
  }

  /**
   * Take a cancelled invoice back out of the books. Reversing its charge alone
   * is not enough: any discount posted against it credited receivables too, and
   * an invoice that predates the ledger has no charge entry to reverse at all —
   * its receivable lives inside the opening balance. Both cases would otherwise
   * leave the AR control account permanently disagreeing with the invoices.
   */
  private async withdrawCancelledInvoice(
    tenantId: string,
    invoiceId: string,
    userId: string,
  ) {
    const charge = await this.ledger.reverseSource(
      tenantId,
      'invoice',
      invoiceId,
      userId,
      'Invoice cancelled',
    );

    // Adjustments posted against this invoice are keyed by the ADJUSTMENT id,
    // so they have to be looked up by invoice and reversed one by one.
    const adjustments = await this.client.feeAdjustment.findMany({
      where: { tenantId, invoiceId, status: 'applied' },
      select: { id: true },
    });
    for (const adjustment of adjustments) {
      await this.ledger.reverseSource(
        tenantId,
        'adjustment',
        adjustment.id,
        userId,
        'Invoice cancelled',
      );
    }

    if (charge.length > 0) return;

    // No charge entry: this invoice was billed before the ledger opened, so its
    // receivable arrived as part of the opening balance. Withdraw exactly what
    // is still outstanding on it, against the same opening equity.
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: INVOICE_FINANCIALS_INCLUDE,
    });
    if (!invoice) return;
    const outstanding = computeFinancials(invoice).balance;
    if (outstanding <= 0) return;

    await this.ledger.post(tenantId, {
      entryDate: new Date(),
      memo: `Invoice ${invoice.invoiceNumber} cancelled (billed before the ledger opened)`,
      sourceType: 'invoice_withdrawal',
      sourceId: invoice.id,
      postedBy: userId,
      lines: [
        {
          account: SYSTEM_ACCOUNT.OPENING_EQUITY,
          debit: outstanding,
          description: 'Opening receivable withdrawn',
          invoiceId: invoice.id,
          householdId: invoice.householdId,
          studentId: invoice.studentId,
        },
        {
          account: SYSTEM_ACCOUNT.AR_CONTROL,
          credit: outstanding,
          description: `Invoice ${invoice.invoiceNumber}`,
          invoiceId: invoice.id,
          householdId: invoice.householdId,
          studentId: invoice.studentId,
        },
      ],
    });
  }

  /** DR receivables, CR fee income — the charge itself, at its gross value. */
  private async postInvoiceIssued(
    tenantId: string,
    invoiceId: string,
    userId: string,
  ) {
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: INVOICE_FINANCIALS_INCLUDE,
    });
    if (!invoice) return;
    const gross = computeFinancials(invoice).gross;
    if (gross <= 0) return;

    await this.ledger.post(tenantId, {
      entryDate: invoice.issuedDate ?? new Date(),
      memo: `Invoice ${invoice.invoiceNumber}${invoice.studentName ? ` — ${invoice.studentName}` : ''}`,
      sourceType: 'invoice',
      sourceId: invoice.id,
      postedBy: userId,
      lines: [
        {
          account: SYSTEM_ACCOUNT.AR_CONTROL,
          debit: gross,
          description: `Invoice ${invoice.invoiceNumber}`,
          invoiceId: invoice.id,
          householdId: invoice.householdId,
          studentId: invoice.studentId,
        },
        {
          account: SYSTEM_ACCOUNT.FEE_INCOME,
          credit: gross,
          description: invoice.termName ?? 'Fees billed',
          invoiceId: invoice.id,
          householdId: invoice.householdId,
          studentId: invoice.studentId,
        },
      ],
    });
  }

  async invoiceSummary(tenantId: string, termName?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (termName) where['termName'] = termName;

    // Totals are DERIVED from lines + applied adjustments (not the flat
    // amount_due), so billed/discounts/outstanding stay consistent with each
    // invoice's derived balance.
    const invoices = await this.client.feeInvoice.findMany({
      where,
      select: {
        status: true,
        lines: { select: { amount: true, quantity: true } },
        adjustments: { where: { status: 'applied' }, select: { amount: true } },
        allocations: { select: { amount: true } },
        creditApplications: { select: { amount: true } },
      },
    });

    let totalBilled = 0;
    let totalDiscounts = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    const statusCounts: Record<string, number> = {};
    for (const inv of invoices) {
      const f = computeFinancials(inv);
      totalBilled += f.gross;
      totalDiscounts += f.discounts;
      totalCollected += f.paid;
      totalOutstanding += f.balance;
      statusCounts[inv.status] = (statusCounts[inv.status] ?? 0) + 1;
    }

    return {
      totalInvoices: invoices.length,
      totalBilled,
      totalDiscounts,
      totalCollected,
      totalOutstanding,
      statusCounts,
    };
  }

  // ---- Admissions coupling (WB3-5) ------------------------------------
  //
  // Admission fees (application/acceptance fee) are billed to an APPLICATION
  // before it has a student, then re-keyed to the resulting student on
  // conversion. These three methods keep every admission-fee DB write inside the
  // finance module (one source of truth for invoice/payment/status), so the
  // admissions side only orchestrates + audits. All run on the same request RLS
  // transaction as the caller (shared via AsyncLocalStorage).

  /**
   * Bill an admission fee: a studentless `issued` invoice keyed to the
   * application, with a single line against the given (admission) fee item. The
   * flat `amountDue` equals the line so the derived balance and the compat column
   * agree, matching the catalogue's syncing.
   */
  async createAdmissionInvoice(
    tenantId: string,
    input: {
      applicationId: string;
      applicantName: string | null;
      feeItemId: string;
      amount: number;
      label: string;
      dueDate?: string | null;
    },
    userId: string,
  ) {
    // Before this bill exists: a school carrying pre-ledger debt opens with that
    // debt. Doing it after the row is written counts this invoice twice — once
    // in the opening balance, once in its own charge entry.
    await this.ledger.ensureOpeningBalance(tenantId, userId);

    const invoice = await this.client.feeInvoice.create({
      data: {
        tenantId,
        invoiceNumber: await this.numbering.next(tenantId, 'invoice'),
        studentId: null,
        admissionApplicationId: input.applicationId,
        studentName: input.applicantName,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        amountDue: input.amount,
        amountPaid: 0,
        status: 'issued',
        notes: `Admission fee — ${input.label}`,
        createdBy: userId,
        updatedBy: userId,
      },
    });
    await this.client.feeInvoiceLine.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        feeItemId: input.feeItemId,
        description: input.label,
        amount: input.amount,
        quantity: 1,
      },
    });
    // The invoice is created already `issued`, so the charge posts here rather
    // than through the draft→issued transition.
    await this.postInvoiceIssued(tenantId, invoice.id, userId);
    return this.getInvoice(tenantId, invoice.id);
  }

  /**
   * Settle (fully or partially) an admission-fee invoice through the one
   * receipt writer, so an application fee lands in the same
   * receipt/allocation/ledger shape as school fees. Returns the receipt plus
   * the invoice's derived financials so the caller can flip the requirement to
   * `provided` once the balance hits zero.
   */
  async settleAdmissionInvoice(
    tenantId: string,
    invoiceId: string,
    input: {
      amount: number;
      method: string;
      paidAt: string;
      reference?: string | null;
    },
    userId: string,
  ) {
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { id: true, studentName: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // One writer for money received, admissions included — so an application
    // fee lands in the same receipt/allocation/ledger shape as school fees,
    // and moves with the invoice when the applicant becomes a student.
    const receipt = await this.receipts.recordReceipt(
      tenantId,
      {
        payerName: invoice.studentName ?? undefined,
        method: input.method as never,
        paidAt: input.paidAt,
        amount: input.amount,
        reference: input.reference ?? undefined,
        allocations: [{ invoiceId, amount: input.amount }],
      },
      userId,
    );

    const withFinancials = await this.getInvoice(tenantId, invoiceId);
    return {
      payment: receipt,
      invoice: withFinancials,
      financials: withFinancials.financials,
    };
  }

  /**
   * Re-key every studentless admission invoice (and its payments) of an
   * application to the resulting student on conversion — so the AR history moves
   * cleanly into the student ledger with zero re-billing. Returns the count moved.
   */
  async reassignAdmissionInvoices(
    tenantId: string,
    applicationId: string,
    studentId: string,
    studentName: string | null,
    userId: string,
  ): Promise<{ invoices: number }> {
    const invoices = await this.client.feeInvoice.findMany({
      where: {
        tenantId,
        admissionApplicationId: applicationId,
        studentId: null,
      },
      select: { id: true },
    });
    if (invoices.length === 0) return { invoices: 0 };
    const ids = invoices.map((i) => i.id);

    await this.client.feeInvoice.updateMany({
      where: { tenantId, id: { in: ids } },
      data: { studentId, studentName, updatedBy: userId },
    });
    // Receipts follow their invoices now: a receipt reaches the student through
    // its allocations, so re-keying the invoices moves the payment history too.
    return { invoices: ids.length };
  }
}
