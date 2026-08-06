import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantDbService } from '../../common/database/tenant-db.service';
import {
  CreateFeeItemDto,
  CreateInvoiceLineDto,
  UpdateFeeItemDto,
  UpdateInvoiceLineDto,
} from '../dto/catalogue.dto';

/**
 * The tenant's fee-item catalogue and the line items that make up an invoice.
 * Invoice gross = Σ line (amount × quantity); mutating lines keeps the flat
 * `amountDue` in sync (parallel/compat) while the derived balance reads the
 * lines directly.
 *
 * Tenant-scoped only: every route is `@TenantScoped()`, so reads/writes go
 * through the RLS-scoped `TenantDbService.client` — never the privileged client.
 */
@Injectable()
export class FinanceCatalogueService {
  constructor(private readonly tenantDb: TenantDbService) {}

  private get client() {
    return this.tenantDb.client;
  }

  // ---- Fee items ------------------------------------------------------

  listFeeItems(tenantId: string) {
    return this.client.feeItem.findMany({
      where: { tenantId },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async createFeeItem(tenantId: string, dto: CreateFeeItemDto) {
    const existing = await this.client.feeItem.findFirst({
      where: { tenantId, code: dto.code },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        `A fee item with code "${dto.code}" already exists`,
      );
    }
    return this.client.feeItem.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        defaultAmount: dto.defaultAmount ?? null,
        active: true,
      },
    });
  }

  async updateFeeItem(tenantId: string, id: string, dto: UpdateFeeItemDto) {
    const item = await this.client.feeItem.findFirst({
      where: { id, tenantId },
    });
    if (!item) throw new NotFoundException('Fee item not found');
    return this.client.feeItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.defaultAmount !== undefined && {
          defaultAmount: dto.defaultAmount,
        }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }

  // ---- Invoice lines --------------------------------------------------

  listLines(tenantId: string, invoiceId: string) {
    return this.client.feeInvoiceLine.findMany({
      where: { tenantId, invoiceId },
      include: { feeItem: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Sum the invoice's lines into the flat `amount_due` (compat with the derived gross). */
  private async syncAmountDue(tenantId: string, invoiceId: string) {
    const lines = await this.client.feeInvoiceLine.findMany({
      where: { tenantId, invoiceId },
      select: { amount: true, quantity: true },
    });
    const gross = lines.reduce((s, l) => s + l.amount * l.quantity, 0);
    await this.client.feeInvoice.update({
      where: { id: invoiceId },
      data: { amountDue: gross },
    });
  }

  private async assertInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.client.feeInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { id: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
  }

  private async assertFeeItem(tenantId: string, feeItemId: string) {
    const item = await this.client.feeItem.findFirst({
      where: { id: feeItemId, tenantId },
      select: { id: true },
    });
    if (!item) throw new BadRequestException('Fee item not found for tenant');
  }

  async addLine(
    tenantId: string,
    invoiceId: string,
    dto: CreateInvoiceLineDto,
  ) {
    await this.assertInvoice(tenantId, invoiceId);
    await this.assertFeeItem(tenantId, dto.feeItemId);
    const line = await this.client.feeInvoiceLine.create({
      data: {
        tenantId,
        invoiceId,
        feeItemId: dto.feeItemId,
        description: dto.description ?? null,
        amount: dto.amount,
        quantity: dto.quantity ?? 1,
      },
    });
    await this.syncAmountDue(tenantId, invoiceId);
    return line;
  }

  async updateLine(
    tenantId: string,
    lineId: string,
    dto: UpdateInvoiceLineDto,
  ) {
    const line = await this.client.feeInvoiceLine.findFirst({
      where: { id: lineId, tenantId },
    });
    if (!line) throw new NotFoundException('Invoice line not found');
    if (dto.feeItemId) await this.assertFeeItem(tenantId, dto.feeItemId);

    const updated = await this.client.feeInvoiceLine.update({
      where: { id: lineId },
      data: {
        ...(dto.feeItemId !== undefined && { feeItemId: dto.feeItemId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
      },
    });
    await this.syncAmountDue(tenantId, line.invoiceId);
    return updated;
  }

  async removeLine(tenantId: string, lineId: string) {
    const line = await this.client.feeInvoiceLine.findFirst({
      where: { id: lineId, tenantId },
    });
    if (!line) throw new NotFoundException('Invoice line not found');
    await this.client.feeInvoiceLine.delete({ where: { id: lineId } });
    await this.syncAmountDue(tenantId, line.invoiceId);
    return { deleted: true };
  }
}
