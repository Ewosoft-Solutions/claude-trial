import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import {
  CreateInvoiceDto,
  ListInvoicesDto,
  ListPaymentsDto,
  RecordPaymentDto,
  UpdateInvoiceDto,
} from '../dto/finance.dto';

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

    return this.client.feeInvoice.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getInvoice(tenantId: string, id: string) {
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id, tenantId },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async createInvoice(tenantId: string, dto: CreateInvoiceDto, userId: string) {
    const invoiceNumber = `INV-${Date.now()}-${randomBytes(2).toString('hex').toUpperCase()}`;
    return this.client.feeInvoice.create({
      data: {
        tenantId,
        invoiceNumber,
        studentId: dto.studentId,
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

  async updateInvoice(tenantId: string, id: string, dto: UpdateInvoiceDto, userId: string) {
    const invoice = await this.client.feeInvoice.findFirst({ where: { id, tenantId } });
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
