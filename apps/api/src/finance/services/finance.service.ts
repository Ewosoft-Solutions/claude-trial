import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@workspace/database';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { resolvePaginationOrderBy, type SortAllowList } from '../../common/dto';
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

@Injectable()
export class FinanceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
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

    // No `limit` → the whole (filtered) set, for the aggregate pages. A `limit`
    // → one server-driven page. Response shape is `{ data, pagination }` either
    // way so every caller reads `.data`.
    if (query.limit == null) {
      const data = await this.client.feeInvoice.findMany({ where, orderBy });
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
    const [data, total] = await Promise.all([
      this.client.feeInvoice.findMany({ where, orderBy, skip, take: limit }),
      this.client.feeInvoice.count({ where }),
    ]);

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

    return this.client.feeInvoice.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.amountDue !== undefined && { amountDue: dto.amountDue }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        updatedBy: userId,
      },
    });
  }

  async invoiceSummary(tenantId: string, termName?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (termName) where['termName'] = termName;

    const invoices = await this.client.feeInvoice.findMany({
      where,
      select: { amountDue: true, amountPaid: true, status: true },
    });

    const totalBilled = invoices.reduce((s, i) => s + i.amountDue, 0);
    const totalCollected = invoices.reduce((s, i) => s + i.amountPaid, 0);
    const statusCounts: Record<string, number> = {};
    for (const inv of invoices) {
      statusCounts[inv.status] = (statusCounts[inv.status] ?? 0) + 1;
    }

    return {
      totalInvoices: invoices.length,
      totalBilled,
      totalCollected,
      totalOutstanding: totalBilled - totalCollected,
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
