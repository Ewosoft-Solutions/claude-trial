import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
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
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

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
        pricingMode: dto.pricingMode ?? 'fixed',
        // An open-priced item is priced on the line, so it never carries one
        // of its own — a stray amount here would be a number nothing reads.
        defaultAmount:
          dto.pricingMode === 'open' ? null : (dto.defaultAmount ?? null),
        active: true,
      },
    });
  }

  /**
   * Get-or-create a fee item by code (idempotent). Used by the admissions fee
   * coupling (WB3-5) to provision an `admission:<key>` catalogue entry on demand,
   * so admission-fee invoice lines reference a real, reportable {@link FeeItem}
   * without the operator having to pre-create it. Re-activates a disabled match
   * so a later bill against a soft-disabled admission item still works.
   */
  async ensureFeeItem(tenantId: string, input: { code: string; name: string }) {
    const code = input.code.trim();
    const existing = await this.client.feeItem.findFirst({
      where: { tenantId, code },
    });
    if (existing) {
      if (!existing.active) {
        return this.client.feeItem.update({
          where: { id: existing.id },
          data: { active: true },
        });
      }
      return existing;
    }
    return this.client.feeItem.create({
      data: {
        tenantId,
        code,
        name: input.name.trim(),
        defaultAmount: null,
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
        ...(dto.pricingMode !== undefined && { pricingMode: dto.pricingMode }),
        // Switching to open pricing clears the price, so nothing stale is left
        // for a line to be billed at.
        ...(dto.pricingMode === 'open'
          ? { defaultAmount: null }
          : dto.defaultAmount !== undefined && {
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
      select: { id: true, status: true, invoiceNumber: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  /**
   * Lines are the CHARGE. Once an invoice is issued that charge is in the
   * ledger and on a family's statement, so editing a line afterwards would move
   * what is owed with no journal entry behind it and no approval in front of
   * it — the receivable and the books would part company silently. After issue,
   * the way to change what is owed is an adjustment (which is approved, posted
   * and auditable) or a cancellation.
   */
  private async assertDraftInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.assertInvoice(tenantId, invoiceId);
    if (invoice.status !== 'draft') {
      throw new BadRequestException(
        `Invoice ${invoice.invoiceNumber} is ${invoice.status} — its line items are fixed. Raise an adjustment to change what is owed.`,
      );
    }
    return invoice;
  }

  private async assertFeeItem(tenantId: string, feeItemId: string) {
    const item = await this.client.feeItem.findFirst({
      where: { id: feeItemId, tenantId },
      select: { id: true },
    });
    if (!item) throw new BadRequestException('Fee item not found for tenant');
  }

  /**
   * What a line for this item actually costs — decided here, not by the caller.
   *
   * A till does not let the operator type a price for stock: the price lives on
   * the item and is pulled onto the line. So for a FIXED item the catalogue
   * price wins and any amount the client sent is ignored; changing it is a
   * deliberate, audited override through `updateLine`, never a field that
   * happens to be editable while adding.
   *
   * An OPEN item is the retail "open price" key — damages, miscellaneous —
   * where typing the amount is the item's whole purpose, so the caller's value
   * is required and used.
   *
   * A fixed item with no price is a configuration error, not a free bill: it
   * cannot be sold until someone prices it.
   */
  private resolveLineAmount(
    item: { name: string; pricingMode: string; defaultAmount: number | null },
    requested: number | undefined,
  ): number {
    if (item.pricingMode === 'open') {
      if (requested == null) {
        throw new BadRequestException(
          `${item.name} is priced per line — enter an amount for it.`,
        );
      }
      return requested;
    }
    if (item.defaultAmount == null) {
      throw new BadRequestException(
        `${item.name} has no price yet. Set one on the fee items page before billing it.`,
      );
    }
    return item.defaultAmount;
  }

  async addLine(
    tenantId: string,
    invoiceId: string,
    dto: CreateInvoiceLineDto,
  ) {
    await this.assertDraftInvoice(tenantId, invoiceId);
    const item = await this.client.feeItem.findFirst({
      where: { id: dto.feeItemId, tenantId },
      select: { name: true, pricingMode: true, defaultAmount: true },
    });
    if (!item) throw new BadRequestException('Fee item not found for tenant');

    const line = await this.client.feeInvoiceLine.create({
      data: {
        tenantId,
        invoiceId,
        feeItemId: dto.feeItemId,
        description: dto.description ?? null,
        amount: this.resolveLineAmount(item, dto.amount),
        quantity: dto.quantity ?? 1,
      },
    });
    await this.syncAmountDue(tenantId, invoiceId);
    return line;
  }

  /**
   * Add several lines at once, for an invoice composed offline.
   *
   * The compose surface holds a whole bill in the browser and writes it in one
   * request, so the per-line `addLine` would mean N round trips and N partial
   * states. This validates once, inserts once, and totals once — and because
   * the request already runs inside the RLS transaction, either the whole bill
   * lands or none of it does.
   */
  async addLines(
    tenantId: string,
    invoiceId: string,
    lines: CreateInvoiceLineDto[],
  ) {
    if (lines.length === 0) return [];
    await this.assertDraftInvoice(tenantId, invoiceId);

    // One read per distinct fee item, not one per line: a bill with eight
    // lines of the same item should not read the catalogue eight times.
    const feeItemIds = [...new Set(lines.map((line) => line.feeItemId))];
    const found = await this.client.feeItem.findMany({
      where: { tenantId, id: { in: feeItemIds } },
      select: { id: true, name: true, pricingMode: true, defaultAmount: true },
    });
    if (found.length !== feeItemIds.length) {
      throw new BadRequestException('Fee item not found for tenant');
    }
    const byId = new Map(found.map((item) => [item.id, item]));

    await this.client.feeInvoiceLine.createMany({
      data: lines.map((line) => ({
        tenantId,
        invoiceId,
        feeItemId: line.feeItemId,
        description: line.description ?? null,
        // Same rule as addLine: a fixed item is priced by the catalogue, not
        // by whatever the browser sent.
        amount: this.resolveLineAmount(byId.get(line.feeItemId)!, line.amount),
        quantity: line.quantity ?? 1,
      })),
    });
    await this.syncAmountDue(tenantId, invoiceId);

    return this.client.feeInvoiceLine.findMany({
      where: { tenantId, invoiceId },
    });
  }

  /**
   * Edit a line — including the deliberate price override.
   *
   * Adding a line never lets the caller choose the price of a fixed item; this
   * is the one place it can be changed, which is what a till's supervisor
   * price-override is. It is therefore recorded: an amount that no longer
   * matches the catalogue is a decision someone made, and the audit trail
   * should say who, on what, and away from what.
   */
  async updateLine(
    tenantId: string,
    lineId: string,
    dto: UpdateInvoiceLineDto,
    userId?: string,
  ) {
    const line = await this.client.feeInvoiceLine.findFirst({
      where: { id: lineId, tenantId },
    });
    if (!line) throw new NotFoundException('Invoice line not found');
    await this.assertDraftInvoice(tenantId, line.invoiceId);
    if (dto.feeItemId) await this.assertFeeItem(tenantId, dto.feeItemId);

    // An open item has no catalogue price to depart from, so changing its
    // amount is ordinary editing rather than an override.
    if (dto.amount !== undefined && dto.amount !== line.amount) {
      const item = await this.client.feeItem.findFirst({
        where: { id: dto.feeItemId ?? line.feeItemId, tenantId },
        select: { name: true, pricingMode: true, defaultAmount: true },
      });
      if (
        item?.pricingMode === 'fixed' &&
        item.defaultAmount != null &&
        dto.amount !== item.defaultAmount
      ) {
        await this.audit.write({
          tenantId,
          eventType: AUDIT_EVENT.DATA_CHANGE,
          action: 'finance_line_price_overridden',
          resource: 'fee_invoice_line',
          resourceId: lineId,
          actorId: userId ?? null,
          description: `${item.name} billed at a price other than the catalogue's`,
          metadata: {
            invoiceId: line.invoiceId,
            feeItem: item.name,
            catalogueAmount: item.defaultAmount,
            previousAmount: line.amount,
            newAmount: dto.amount,
          },
        });
      }
    }

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
    await this.assertDraftInvoice(tenantId, line.invoiceId);
    await this.client.feeInvoiceLine.delete({ where: { id: lineId } });
    await this.syncAmountDue(tenantId, line.invoiceId);
    return { deleted: true };
  }
}
