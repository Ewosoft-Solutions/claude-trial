import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { resolvePaginationOrderBy, type SortAllowList } from '../../common/dto';
import { FinanceAdjustmentService } from './finance-adjustment.service';
import { FinanceCatalogueService } from './finance-catalogue.service';
import { InvoiceDocumentService } from './invoice-document.service';
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
  UNTERMED,
  ComposeInvoiceDto,
  UpdateInvoiceDto,
  UpdateInvoiceHeaderDto,
} from '../dto/finance.dto';
import type { UpdateDraftContentsDto } from '../dto/catalogue.dto';

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
    private readonly audit: AuditService,
    private readonly adjustments: FinanceAdjustmentService,
    private readonly numbering: FinanceNumberingService,
    private readonly credits: FinanceCreditService,
    private readonly receipts: FinanceReceiptService,
    private readonly ledger: LedgerService,
    private readonly catalogue: FinanceCatalogueService,
    private readonly documents: InvoiceDocumentService,
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
    // A reserved value, because "no term" cannot be expressed as a term name.
    // Drafts are routinely opened before anyone has decided which term they
    // belong to, and they have to be findable on purpose rather than by
    // clearing every filter.
    if (query.termName === UNTERMED) where['termName'] = null;
    else if (query.termName) where['termName'] = query.termName;
    // A one-sided range is normal — "anything due before the holidays" has no
    // start — so each bound is applied independently. `dueTo` covers the whole
    // of its day: a date-only bound parses to midnight, which would otherwise
    // exclude everything due on the very day the bursar asked about.
    if (query.dueFrom || query.dueTo) {
      const dueDate: Record<string, Date> = {};
      if (query.dueFrom) dueDate['gte'] = new Date(query.dueFrom);
      if (query.dueTo) {
        const end = new Date(query.dueTo);
        end.setHours(23, 59, 59, 999);
        dueDate['lte'] = end;
      }
      where['dueDate'] = dueDate;
    }
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
    const { lines, adjustments, allocations, creditApplications, ...rest } =
      inv;
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
        // Who the bill is settled by. Finance stays decoupled from the student
        // schema (studentId/classId are plain columns by design), but the
        // household IS a finance relation, and an invoice without it reads as
        // if nobody is responsible for paying.
        household: {
          select: { id: true, name: true, primaryPayerName: true },
        },
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
        studentNumber: true,
        userTenant: {
          select: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    if (!student) return null;

    const user = student.userTenant?.user;
    const name = [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    // A student with no linked user account still has to be identifiable on
    // the bill. Falling through to null left the list showing a raw UUID where
    // a child's name belongs; the admission number is what a school would use.
    return name || student.studentNumber || null;
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

  /**
   * Correct the details a draft was opened with.
   *
   * These fields — term, year, cycle, due date, notes — used to be writable
   * only at creation, so an invoice opened with the wrong term (or none) stayed
   * wrong for life; a term-less draft is also invisible on the term-scoped
   * invoice list, so it could not even be found again. Composing a draft is not
   * a financial act, so this is guarded like the draft's line items rather than
   * like issuing it, and it refuses anything that has left draft: once issued,
   * what is owed changes through an adjustment.
   */
  async updateInvoiceHeader(
    tenantId: string,
    id: string,
    dto: UpdateInvoiceHeaderDto,
    userId: string,
  ) {
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id, tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status !== 'draft') {
      throw new BadRequestException(
        `Only a draft's details can be corrected — this invoice is ${invoice.status}. Raise an adjustment to change what is owed, or a reversal to withdraw it.`,
      );
    }

    // `undefined` means "not sent, leave it"; an explicitly sent empty value
    // means "clear it". Blank strings arrive from cleared text inputs and are
    // stored as NULL so the term label renders as absent rather than empty.
    const updated = await this.client.feeInvoice.update({
      where: { id },
      data: {
        ...(dto.termName !== undefined && {
          termName: dto.termName?.trim() || null,
        }),
        ...(dto.termYear !== undefined && { termYear: dto.termYear ?? null }),
        ...(dto.termCycle !== undefined && {
          termCycle: dto.termCycle ?? null,
        }),
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
        updatedBy: userId,
      },
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'finance_invoice_header_updated',
      resource: 'fee_invoice',
      resourceId: id,
      actorId: userId,
      description: `Draft invoice ${invoice.invoiceNumber} details updated`,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        fields: Object.keys(dto),
      },
    });

    return updated;
  }

  /**
   * Everything that happens the moment a bill becomes a receivable: the charge
   * posts to the ledger, standing discount policies apply, and any credit the
   * family already holds is drawn down against it.
   *
   * Shared by `updateInvoice` (issuing an existing draft) and `composeInvoice`
   * (creating and issuing in one go). Two copies of this would eventually
   * disagree, and the thing they would disagree about is the ledger.
   *
   * Callers must have run `ledger.ensureOpeningBalance` BEFORE flipping the
   * row to issued, so a school carrying pre-ledger debt opens with that debt
   * rather than with this bill.
   */
  private async applyIssueEffects(
    tenantId: string,
    invoiceId: string,
    invoiceNumber: string,
    userId: string,
  ) {
    await this.postInvoiceIssued(tenantId, invoiceId, userId);
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'finance_invoice_issued',
      resource: 'fee_invoice',
      resourceId: invoiceId,
      actorId: userId,
      description: `Invoice ${invoiceNumber} issued`,
      metadata: { invoiceNumber },
    });
    await this.adjustments.applyPoliciesToInvoice(tenantId, invoiceId, userId);
    await this.credits.autoApplyToInvoice(tenantId, invoiceId, userId);
  }

  /**
   * Write an invoice that was composed in the browser — header, lines, and
   * optionally the issue — as one request.
   *
   * The compose surface creates no row until the bursar commits, so this is
   * the first and only write. It must stay a single call: `StepUpGuard`
   * consumes the challenge it verifies, so splitting create from issue would
   * ask for two confirmations to complete one action. The request already runs
   * inside the RLS transaction, so a failure part-way leaves no half-written
   * invoice behind.
   */
  async composeInvoice(
    tenantId: string,
    dto: ComposeInvoiceDto,
    userId: string,
  ) {
    const invoice = await this.createInvoice(
      tenantId,
      {
        studentId: dto.studentId,
        amountDue: 0,
        termName: dto.termName,
        termYear: dto.termYear,
        termCycle: dto.termCycle,
        dueDate: dto.dueDate,
        notes: dto.notes,
      },
      userId,
    );

    // `addLines` totals the invoice, so amountDue is right before we issue.
    await this.catalogue.addLines(tenantId, invoice.id, dto.lines);

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'finance_invoice_composed',
      resource: 'fee_invoice',
      resourceId: invoice.id,
      actorId: userId,
      description: `Invoice ${invoice.invoiceNumber} composed with ${dto.lines.length} line(s)`,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        lineCount: dto.lines.length,
        issued: dto.issue === true,
      },
    });

    if (dto.issue !== true) {
      return this.client.feeInvoice.findFirst({
        where: { id: invoice.id, tenantId },
      });
    }

    // Open the books before this bill becomes a receivable.
    await this.ledger.ensureOpeningBalance(tenantId, userId);
    await this.client.feeInvoice.update({
      where: { id: invoice.id },
      data: { status: 'issued', updatedBy: userId },
    });
    await this.applyIssueEffects(
      tenantId,
      invoice.id,
      invoice.invoiceNumber,
      userId,
    );

    // Issuing has side effects (policy discounts, credit applied), so report
    // what the invoice actually became, not the row as it looked mid-flight.
    return this.client.feeInvoice.findFirst({
      where: { id: invoice.id, tenantId },
    });
  }

  /**
   * Apply a draft edited in the browser — its details and its whole set of
   * lines — in one request.
   *
   * Guarded like the header edit and the per-line writes it replaces
   * (`finance.manage`, no step-up): composing a draft is not a movement of
   * money. It refuses anything that has left draft, because replacing the
   * lines of an issued invoice would rewrite a receivable behind the ledger's
   * back — that is an adjustment, which is approved and posted.
   */
  async updateDraftContents(
    tenantId: string,
    id: string,
    dto: UpdateDraftContentsDto,
    userId: string,
  ) {
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id, tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'draft') {
      throw new BadRequestException(
        `Only a draft can be edited — this invoice is ${invoice.status}. Raise an adjustment to change what is owed.`,
      );
    }

    const { lines, ...header } = dto;
    // The header first, so a failure in the lines leaves neither applied —
    // the request runs inside the RLS transaction, so both roll back together.
    await this.updateInvoiceHeader(tenantId, id, header, userId);
    await this.catalogue.replaceLines(tenantId, id, lines, userId);

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'finance_invoice_draft_saved',
      resource: 'fee_invoice',
      resourceId: id,
      actorId: userId,
      description: `Draft invoice ${invoice.invoiceNumber} saved with ${lines.length} line(s)`,
      metadata: { invoiceNumber: invoice.invoiceNumber, lineCount: lines.length },
    });

    return this.getInvoice(tenantId, id);
  }

  /**
   * The invoice as a PDF, for download or sharing.
   *
   * Assembled here and rendered by `InvoiceDocumentService` — this method's job
   * is to gather what the page needs from three places finance does not
   * normally join: the tenant (for the letterhead), the student (for the
   * number that identifies the child on a bill), and the household.
   *
   * Reading the student here is a display lookup, not a coupling: the billing
   * model still stores its own snapshot, and this never writes back.
   *
   * Sharing is audited by the caller, not here — the same bytes are produced
   * whether they are previewed on screen or sent to a family, and only the
   * latter is an event worth recording.
   */
  async renderInvoicePdf(tenantId: string, id: string) {
    const invoice = await this.getInvoice(tenantId, id);

    const [tenant, student] = await Promise.all([
      this.client.tenant.findFirst({
        where: { id: tenantId },
        select: { name: true },
      }),
      invoice.studentId
        ? this.client.student.findFirst({
            where: { id: invoice.studentId, tenantId },
            select: { studentNumber: true },
          })
        : Promise.resolve(null),
    ]);

    const termLabel =
      [
        invoice.termName,
        invoice.termYear ? String(invoice.termYear) : null,
        invoice.termCycle ? `cycle ${invoice.termCycle}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || null;

    const buffer = await this.documents.render({
      schoolName: tenant?.name ?? 'School',
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      issuedDate: invoice.issuedDate,
      dueDate: invoice.dueDate,
      termLabel,
      billedTo: {
        name: invoice.studentName,
        studentNumber: student?.studentNumber ?? null,
        householdName: invoice.household?.name ?? null,
        payerName: invoice.household?.primaryPayerName ?? null,
      },
      lines: invoice.lines.map((line) => ({
        name: line.feeItem?.name ?? 'Item',
        description: line.description,
        amount: line.amount,
        quantity: line.quantity,
      })),
      totals: invoice.financials,
      notes: invoice.notes,
      draft: invoice.status === 'draft',
    });

    return {
      buffer,
      filename: `${invoice.invoiceNumber}.pdf`,
      invoiceNumber: invoice.invoiceNumber,
    };
  }

  /**
   * Note that an invoice document left the building.
   *
   * Advisory by nature: the OS share sheet never reports back whether the
   * person actually sent it, so this records the intent. That is still the
   * answer to "who sent this family their bill" — the alternative is no record
   * at all once the file is handed to another app.
   */
  async recordInvoiceShared(
    tenantId: string,
    id: string,
    channel: string,
    userId: string,
  ) {
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id, tenantId },
      select: { id: true, invoiceNumber: true, status: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.USER_ACTION,
      action: 'finance_invoice_document_shared',
      resource: 'fee_invoice',
      resourceId: invoice.id,
      actorId: userId,
      description: `Invoice ${invoice.invoiceNumber} document shared (${channel})`,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        channel,
        // A draft leaving the building is worth being able to find later.
        invoiceStatus: invoice.status,
      },
    });
    return { recorded: true };
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
    const isBeingIssued =
      dto.status === 'issued' && invoice.status !== 'issued';
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
      await this.applyIssueEffects(tenantId, id, invoice.invoiceNumber, userId);
    }

    // Cancelling an issued invoice cannot just delete the receivable — it is
    // withdrawn from the books, so the ledger shows both the charge and its
    // withdrawal.
    if (isBeingCancelled) {
      await this.withdrawCancelledInvoice(tenantId, invoice.id, userId);
      await this.audit.write({
        tenantId,
        eventType: AUDIT_EVENT.DATA_CHANGE,
        action: 'finance_invoice_cancelled',
        resource: 'fee_invoice',
        resourceId: invoice.id,
        actorId: userId,
        description: `Invoice ${invoice.invoiceNumber} cancelled and withdrawn from the ledger`,
        metadata: { invoiceNumber: invoice.invoiceNumber },
      });
    }

    // Issuing has side effects (the charge, policy discounts, credit applied),
    // so return what the invoice actually became rather than the row as it
    // looked mid-flight — a caller that just issued can otherwise be told
    // `issued` when held credit has already settled it.
    if (isBeingIssued || isBeingCancelled) {
      const settled = await this.client.feeInvoice.findFirst({
        where: { id, tenantId },
      });
      return settled ?? updated;
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

    if (charge.length > 0) {
      // The charge was posted through the ledger, so the invoice's whole
      // contribution to receivables is its own entries: the charge, plus any
      // discount that credited receivables against it. Reverse both, and mark
      // the adjustments reversed so the invoice does not go on displaying a
      // waiver the books have already withdrawn.
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
      if (adjustments.length > 0) {
        await this.client.feeAdjustment.updateMany({
          where: { tenantId, id: { in: adjustments.map((a) => a.id) } },
          data: { status: 'reversed' },
        });
      }
      return;
    }

    // No charge entry: this invoice was billed BEFORE the ledger opened, so its
    // receivable arrived inside the opening balance — already net of whatever
    // had been discounted or paid by then — and anything since has posted its
    // own entry. What is left of it in the ledger is therefore exactly its
    // current outstanding balance, and withdrawing that zeroes it.
    //
    // Which is why the adjustments are deliberately NOT reversed here: their
    // entries are part of what reduced this receivable, and undoing them would
    // put the discount back into receivables that the withdrawal below no
    // longer covers.
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

    // The terms invoices are ACTUALLY filed under, so the list can offer a
    // real scope. Read from the invoices themselves rather than the academic
    // calendar: `termName` is a denormalised snapshot, so a bill can carry a
    // term string the calendar no longer has — and offering a term nothing is
    // filed under would be a filter that always returns nothing.
    const termRows = await this.client.feeInvoice.findMany({
      where: { tenantId },
      distinct: ['termName'],
      select: { termName: true },
      orderBy: { termName: 'asc' },
    });

    return {
      totalInvoices: invoices.length,
      totalBilled,
      totalDiscounts,
      totalCollected,
      totalOutstanding,
      statusCounts,
      terms: termRows
        .map((row) => row.termName)
        .filter((name): name is string => Boolean(name)),
      // Invoices filed under no term at all — drafts opened before anyone
      // decided which term they belong to. Without this they are reachable
      // only by clearing every filter, which is not "finding" them.
      untermedCount: termRows.some((row) => !row.termName)
        ? await this.client.feeInvoice.count({
            where: { tenantId, termName: null },
          })
        : 0,
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
