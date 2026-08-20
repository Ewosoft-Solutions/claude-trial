import { FinanceCatalogueService } from './finance-catalogue.service';

/**
 * The fee-item catalogue + invoice line items. The behaviours that matter:
 * codes are unique per tenant, tenant ownership is asserted before any mutation,
 * and every line change re-syncs the flat `amountDue` to Σ(amount × quantity).
 */
describe('FinanceCatalogueService', () => {
  const feeItem = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const feeInvoice = { findFirst: jest.fn(), update: jest.fn() };
  const feeInvoiceLine = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const client = { feeItem, feeInvoice, feeInvoiceLine };
  const audit = { write: jest.fn() };
  const service = new FinanceCatalogueService(
    { client } as never,
    audit as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    feeItem.create.mockImplementation(async ({ data }: any) => ({
      id: 'fi-1',
      ...data,
    }));
    feeItem.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      ...data,
    }));
    feeInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      status: 'draft',
      invoiceNumber: 'INV-2026-000001',
    });
    feeInvoiceLine.create.mockImplementation(async ({ data }: any) => ({
      id: 'line-1',
      ...data,
    }));
    feeInvoiceLine.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      ...data,
    }));
  });

  describe('createFeeItem', () => {
    it('rejects a duplicate code within the tenant', async () => {
      feeItem.findFirst.mockResolvedValue({ id: 'fi-existing' });
      await expect(
        service.createFeeItem('t1', { code: 'boarding', name: 'Boarding' }),
      ).rejects.toThrow(/already exists/);
      expect(feeItem.create).not.toHaveBeenCalled();
    });

    it('creates an active item when the code is free', async () => {
      feeItem.findFirst.mockResolvedValue(null);
      const item = await service.createFeeItem('t1', {
        code: 'pta_levy',
        name: 'PTA levy',
        defaultAmount: 500000,
      });
      expect(item).toMatchObject({
        tenantId: 't1',
        code: 'pta_levy',
        active: true,
        defaultAmount: 500000,
      });
    });
  });

  describe('addLine', () => {
    it('validates invoice + fee item, then re-syncs amountDue', async () => {
      feeInvoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: 'draft',
        invoiceNumber: 'INV-2026-000001',
      });
      feeItem.findFirst.mockResolvedValue({
        id: 'fi-1',
        name: 'Bus',
        pricingMode: 'fixed',
        defaultAmount: 200_000,
      });
      feeInvoiceLine.findMany.mockResolvedValue([
        { amount: 1_000_000, quantity: 1 },
        { amount: 200_000, quantity: 3 },
      ]);

      await service.addLine('t1', 'inv-1', {
        feeItemId: 'fi-1',
        amount: 200_000,
        quantity: 3,
      });

      expect(feeInvoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { amountDue: 1_600_000 },
      });
    });

    it('rejects a fee item from another tenant', async () => {
      feeInvoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: 'draft',
        invoiceNumber: 'INV-2026-000001',
      });
      feeItem.findFirst.mockResolvedValue(null);
      await expect(
        service.addLine('t1', 'inv-1', { feeItemId: 'other', amount: 100 }),
      ).rejects.toThrow(/Fee item not found/);
      expect(feeInvoiceLine.create).not.toHaveBeenCalled();
    });
  });

  describe('removeLine', () => {
    it('deletes the line and re-syncs the invoice total', async () => {
      feeInvoiceLine.findFirst.mockResolvedValue({
        id: 'line-1',
        invoiceId: 'inv-1',
      });
      feeInvoiceLine.findMany.mockResolvedValue([
        { amount: 1_000_000, quantity: 1 },
      ]);

      const result = await service.removeLine('t1', 'line-1');

      expect(feeInvoiceLine.delete).toHaveBeenCalledWith({
        where: { id: 'line-1' },
      });
      expect(feeInvoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { amountDue: 1_000_000 },
      });
      expect(result).toEqual({ deleted: true });
    });
  });

  /**
   * Lines are the charge. After issue it is in the ledger and on a family's
   * statement, so changing it here would move what is owed with no journal
   * entry behind it and no approval in front of it.
   */
  describe('once the invoice is issued', () => {
    beforeEach(() => {
      feeInvoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: 'issued',
        invoiceNumber: 'INV-2026-000001',
      });
    });

    it('refuses to add a line', async () => {
      feeItem.findFirst.mockResolvedValue({ id: 'fi-1' });
      await expect(
        service.addLine('t1', 'inv-1', { feeItemId: 'fi-1', amount: 1_000 }),
      ).rejects.toThrow(/its line items are fixed/);
      expect(feeInvoiceLine.create).not.toHaveBeenCalled();
    });

    it('refuses to edit a line', async () => {
      feeInvoiceLine.findFirst.mockResolvedValue({
        id: 'line-1',
        invoiceId: 'inv-1',
      });
      await expect(
        service.updateLine('t1', 'line-1', { amount: 500_000 }),
      ).rejects.toThrow(/its line items are fixed/);
      expect(feeInvoiceLine.update).not.toHaveBeenCalled();
    });

    it('refuses to remove a line', async () => {
      feeInvoiceLine.findFirst.mockResolvedValue({
        id: 'line-1',
        invoiceId: 'inv-1',
      });
      await expect(service.removeLine('t1', 'line-1')).rejects.toThrow(
        /its line items are fixed/,
      );
      expect(feeInvoiceLine.delete).not.toHaveBeenCalled();
    });
  });
});

/**
 * How a line gets its price, the way a till prices stock: the price lives on
 * the item, not on the transaction. A cashier never types a price for stock —
 * scanning pulls it — and the two exceptions are named things rather than
 * loopholes: an open-price key, and a supervisor override that gets recorded.
 */
describe('FinanceCatalogueService — line pricing', () => {
  const feeItem = { findFirst: jest.fn(), findMany: jest.fn() };
  const feeInvoice = { findFirst: jest.fn(), update: jest.fn() };
  const feeInvoiceLine = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
  };
  const client = { feeItem, feeInvoice, feeInvoiceLine };
  const audit = { write: jest.fn() };
  const service = new FinanceCatalogueService(
    { client } as never,
    audit as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    feeInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      status: 'draft',
      invoiceNumber: 'INV-2026-000001',
    });
    feeInvoiceLine.findMany.mockResolvedValue([]);
    feeInvoiceLine.create.mockImplementation(({ data }: any) => ({
      id: 'ln-1',
      ...data,
    }));
    feeInvoiceLine.update.mockImplementation(({ data }: any) => ({
      id: 'ln-1',
      ...data,
    }));
  });

  it('prices a fixed item from the catalogue, ignoring what the caller sent', async () => {
    feeItem.findFirst.mockResolvedValue({
      id: 'fi-1',
      name: 'Tuition',
      pricingMode: 'fixed',
      defaultAmount: 150_000_00,
    });

    await service.addLine('t1', 'inv-1', {
      feeItemId: 'fi-1',
      amount: 1, // a browser cannot discount tuition by sending a smaller number
      quantity: 1,
    });

    expect(feeInvoiceLine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 150_000_00 }),
      }),
    );
  });

  it('refuses to bill a fixed item that has no price', async () => {
    feeItem.findFirst.mockResolvedValue({
      id: 'fi-2',
      name: 'Excursion',
      pricingMode: 'fixed',
      defaultAmount: null,
    });

    await expect(
      service.addLine('t1', 'inv-1', { feeItemId: 'fi-2', amount: 5000 }),
    ).rejects.toThrow(/has no price yet/i);
    expect(feeInvoiceLine.create).not.toHaveBeenCalled();
  });

  it('takes the amount from the line for an open-price item', async () => {
    feeItem.findFirst.mockResolvedValue({
      id: 'fi-3',
      name: 'Damage / replacement',
      pricingMode: 'open',
      defaultAmount: null,
    });

    await service.addLine('t1', 'inv-1', {
      feeItemId: 'fi-3',
      amount: 750_000,
      quantity: 1,
    });

    expect(feeInvoiceLine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 750_000 }),
      }),
    );
  });

  it('will not let an open-price item through with no amount', async () => {
    feeItem.findFirst.mockResolvedValue({
      id: 'fi-3',
      name: 'Damage / replacement',
      pricingMode: 'open',
      defaultAmount: null,
    });

    await expect(
      service.addLine('t1', 'inv-1', {
        feeItemId: 'fi-3',
        amount: undefined as never,
      }),
    ).rejects.toThrow(/priced per line/i);
  });

  it('applies the same rule to a batch, per distinct item', async () => {
    feeItem.findMany.mockResolvedValue([
      {
        id: 'fi-1',
        name: 'Tuition',
        pricingMode: 'fixed',
        defaultAmount: 150_000_00,
      },
      {
        id: 'fi-3',
        name: 'Damage',
        pricingMode: 'open',
        defaultAmount: null,
      },
    ]);

    await service.addLines('t1', 'inv-1', [
      { feeItemId: 'fi-1', amount: 9, quantity: 1 },
      { feeItemId: 'fi-3', amount: 750_000, quantity: 1 },
    ]);

    const { data } = feeInvoiceLine.createMany.mock.calls[0][0];
    expect(data[0].amount).toBe(150_000_00); // catalogue wins
    expect(data[1].amount).toBe(750_000); // open item keeps the typed amount
  });

  it('records an override when a fixed item is billed off-catalogue', async () => {
    feeInvoiceLine.findFirst.mockResolvedValue({
      id: 'ln-1',
      invoiceId: 'inv-1',
      feeItemId: 'fi-1',
      amount: 150_000_00,
    });
    feeItem.findFirst.mockResolvedValue({
      name: 'Tuition',
      pricingMode: 'fixed',
      defaultAmount: 150_000_00,
    });

    await service.updateLine('t1', 'ln-1', { amount: 120_000_00 }, 'user-1');

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'finance_line_price_overridden',
        actorId: 'user-1',
        metadata: expect.objectContaining({
          catalogueAmount: 150_000_00,
          newAmount: 120_000_00,
        }),
      }),
    );
  });

  it('does not call an open item’s price an override', async () => {
    feeInvoiceLine.findFirst.mockResolvedValue({
      id: 'ln-2',
      invoiceId: 'inv-1',
      feeItemId: 'fi-3',
      amount: 750_000,
    });
    feeItem.findFirst.mockResolvedValue({
      name: 'Damage',
      pricingMode: 'open',
      defaultAmount: null,
    });

    await service.updateLine('t1', 'ln-2', { amount: 800_000 }, 'user-1');

    // There is no catalogue price to depart from, so this is ordinary editing.
    expect(audit.write).not.toHaveBeenCalled();
  });
});
