import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@workspace/database';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { resolvePaginationOrderBy, type SortAllowList } from '../../common/dto';
import { FinanceAdjustmentService } from './finance-adjustment.service';
import {
  CreateInvoiceDto,
  ListInvoicesDto,
  ListPaymentsDto,
  RecordPaymentDto,
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

/** Line + applied-adjustment data needed to derive an invoice's balance. */
const INVOICE_FINANCIALS_INCLUDE = {
  lines: { select: { amount: true, quantity: true } },
  adjustments: { where: { status: 'applied' }, select: { amount: true } },
} satisfies Prisma.FeeInvoiceInclude;

export interface InvoiceFinancials {
  gross: number; // Σ line.amount × quantity
  discounts: number; // Σ applied adjustments
  net: number; // gross − discounts (never < 0)
  paid: number; // amountPaid (flat in P1; allocations arrive in P3)
  balance: number; // net − paid, floored at 0 (outstanding)
  overpaid: number; // paid − net, floored at 0 (future credit)
}

/**
 * The invoice balance is DERIVED, never stored-and-edited: gross (its lines)
 * minus applied adjustments minus what's been paid. This is what lets partial
 * payments, discounts and waivers reconcile without mutating a running total.
 */
function computeFinancials(inv: {
  amountPaid: number;
  lines: { amount: number; quantity: number }[];
  adjustments: { amount: number }[];
}): InvoiceFinancials {
  const gross = inv.lines.reduce((s, l) => s + l.amount * l.quantity, 0);
  const discounts = inv.adjustments.reduce((s, a) => s + a.amount, 0);
  const net = Math.max(0, gross - discounts);
  const paid = inv.amountPaid;
  return {
    gross,
    discounts,
    net,
    paid,
    balance: Math.max(0, net - paid),
    overpaid: Math.max(0, paid - net),
  };
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
    private readonly adjustments: FinanceAdjustmentService,
  ) {}

  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
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

  /** Attach an invoice's derived financials + drop the raw line/adjustment arrays. */
  private withFinancials<
    T extends {
      amountPaid: number;
      lines: { amount: number; quantity: number }[];
      adjustments: { amount: number }[];
    },
  >(inv: T) {
    const { lines, adjustments, ...rest } = inv;
    return {
      ...rest,
      financials: computeFinancials({
        amountPaid: rest.amountPaid,
        lines,
        adjustments,
      }),
    };
  }

  async getInvoice(tenantId: string, id: string) {
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id, tenantId },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
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
    const invoiceNumber = `INV-${Date.now()}-${randomBytes(2).toString('hex').toUpperCase()}`;
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

    // Auto-apply active discount policies the moment an invoice is issued.
    if (dto.status === 'issued' && invoice.status !== 'issued') {
      await this.adjustments.applyPoliciesToInvoice(tenantId, id);
    }

    return updated;
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
        amountPaid: true,
        status: true,
        lines: { select: { amount: true, quantity: true } },
        adjustments: { where: { status: 'applied' }, select: { amount: true } },
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

  // ---- Payments -------------------------------------------------------

  async listPayments(tenantId: string, query: ListPaymentsDto) {
    const where: Record<string, unknown> = { tenantId };
    if (query.invoiceId) where['invoiceId'] = query.invoiceId;
    if (query.studentId) where['studentId'] = query.studentId;
    if (query.status) where['status'] = query.status;

    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) dateFilter['gte'] = new Date(query.from);
      if (query.to) dateFilter['lte'] = new Date(query.to);
      where['paidAt'] = dateFilter;
    }

    return this.client.payment.findMany({
      where,
      include: {
        invoice: { select: { invoiceNumber: true, studentId: true } },
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async recordPayment(tenantId: string, dto: RecordPaymentDto, userId: string) {
    // Verify invoice belongs to this tenant
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id: dto.invoiceId, tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const receiptNumber = `PMT-${Date.now()}-${randomBytes(2).toString('hex').toUpperCase()}`;

    const payment = await this.client.payment.create({
      data: {
        tenantId,
        receiptNumber,
        invoiceId: dto.invoiceId,
        studentId: dto.studentId,
        method: dto.method,
        paidAt: new Date(dto.paidAt),
        amount: dto.amount,
        reference: dto.reference ?? null,
        status: 'completed',
        notes: dto.notes ?? null,
        recordedBy: userId,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Update invoice paid amount + derive status
    const newAmountPaid = invoice.amountPaid + dto.amount;
    let newStatus: string;
    if (newAmountPaid >= invoice.amountDue) {
      newStatus = 'paid';
    } else if (newAmountPaid > 0) {
      newStatus = 'partial';
    } else {
      newStatus = invoice.status;
    }

    await this.client.feeInvoice.update({
      where: { id: dto.invoiceId },
      data: { amountPaid: newAmountPaid, status: newStatus, updatedBy: userId },
    });

    return payment;
  }
}
