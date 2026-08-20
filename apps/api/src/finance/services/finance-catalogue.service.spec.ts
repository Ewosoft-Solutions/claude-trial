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

/**
 * Saving a draft edited in the browser sends the whole set of lines and the
 * server reconciles. That makes it a REPLACE, and a replace deletes — so these
 * pin what it is allowed to touch, and that a bulk save is not a back door
 * around the pricing rules the per-line path enforces.
 */
describe('FinanceCatalogueService.replaceLines', () => {
  const feeItem = { findMany: jest.fn(), findFirst: jest.fn() };
  const feeInvoice = { findFirst: jest.fn(), update: jest.fn() };
  const feeInvoiceLine = {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  };
  const client = { feeItem, feeInvoice, feeInvoiceLine };
  const audit = { write: jest.fn() };
  const service = new FinanceCatalogueService(
    { client } as never,
    audit as never,
  );

  const TUITION = {
    id: 'fi-1',
    name: 'Tuition',
    pricingMode: 'fixed',
    defaultAmount: 150_000_00,
  };
  const DAMAGE = {
    id: 'fi-2',
    name: 'Damage',
    pricingMode: 'open',
    defaultAmount: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    feeInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      status: 'draft',
      invoiceNumber: 'INV-1',
    });
    // Honour the `id: { in: [...] }` filter — the service compares the row
    // count against the ids it asked for, so a mock that ignores the filter
    // fails every case that references only one item.
    feeItem.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve(
        [TUITION, DAMAGE].filter((item) => where.id.in.includes(item.id)),
      ),
    );
    // Two existing lines, then the re-read that returns the final set.
    feeInvoiceLine.findMany
      .mockResolvedValueOnce([
        {
          id: 'ln-1',
          invoiceId: 'inv-1',
          feeItemId: 'fi-1',
          amount: 150_000_00,
          quantity: 1,
          description: null,
        },
        {
          id: 'ln-2',
          invoiceId: 'inv-1',
          feeItemId: 'fi-2',
          amount: 50_000,
          quantity: 1,
          description: null,
        },
      ])
      .mockResolvedValue([]);
  });

  it('creates lines with no id, updates the ones it recognises', async () => {
    await service.replaceLines(
      't1',
      'inv-1',
      [
        { id: 'ln-1', feeItemId: 'fi-1', quantity: 3 },
        { id: 'ln-2', feeItemId: 'fi-2', amount: 50_000, quantity: 1 },
        { feeItemId: 'fi-1', quantity: 1 },
      ],
      'user-1',
    );
    expect(feeInvoiceLine.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ln-1' } }),
    );
    expect(feeInvoiceLine.create).toHaveBeenCalledTimes(1);
    // ln-2 is unchanged, so it is not rewritten for the sake of it.
    expect(feeInvoiceLine.update).toHaveBeenCalledTimes(1);
  });

  it('deletes what the browser no longer holds', async () => {
    await service.replaceLines(
      't1',
      'inv-1',
      [{ id: 'ln-1', feeItemId: 'fi-1', quantity: 1 }],
      'user-1',
    );
    expect(feeInvoiceLine.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['ln-2'] } }),
      }),
    );
  });

  it('deletes nothing when every line is still present', async () => {
    await service.replaceLines(
      't1',
      'inv-1',
      [
        { id: 'ln-1', feeItemId: 'fi-1', quantity: 1 },
        { id: 'ln-2', feeItemId: 'fi-2', amount: 50_000, quantity: 1 },
      ],
      'user-1',
    );
    expect(feeInvoiceLine.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses an id this invoice does not own rather than duplicating it', async () => {
    await expect(
      service.replaceLines(
        't1',
        'inv-1',
        [{ id: 'ln-somewhere-else', feeItemId: 'fi-1', quantity: 1 }],
        'user-1',
      ),
    ).rejects.toThrow(/changed elsewhere/i);
    expect(feeInvoiceLine.deleteMany).not.toHaveBeenCalled();
    expect(feeInvoiceLine.create).not.toHaveBeenCalled();
  });

  it('still prices a fixed item from the catalogue in a batch', async () => {
    await service.replaceLines(
      't1',
      'inv-1',
      [{ feeItemId: 'fi-1', amount: 1, quantity: 1 }],
      'user-1',
    );
    expect(feeInvoiceLine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 150_000_00 }),
      }),
    );
  });

  it('records an override that arrives in a batch, not just a single edit', async () => {
    await service.replaceLines(
      't1',
      'inv-1',
      [{ id: 'ln-1', feeItemId: 'fi-1', amount: 120_000_00, quantity: 1 }],
      'user-1',
    );
    // A bulk save must not become a quiet way to change a price...
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'finance_line_price_overridden',
        metadata: expect.objectContaining({
          catalogueAmount: 150_000_00,
          newAmount: 120_000_00,
        }),
      }),
    );
  });

  it('refuses to replace the lines of an invoice that has left draft', async () => {
    feeInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      status: 'issued',
      invoiceNumber: 'INV-1',
    });
    await expect(
      service.replaceLines('t1', 'inv-1', [], 'user-1'),
    ).rejects.toThrow(/line items are fixed/i);
  });

  /**
   * The counterpart, and the reason an existing line keeps the amount it is
   * sent: a bursar overrides a price through the edit dialog, then changes
   * something unrelated and saves. Re-resolving from the catalogue on save
   * would revert the override without anyone asking for it.
   */
  it('does not revert an existing override when something else is saved', async () => {
    feeInvoiceLine.findMany.mockReset();
    feeInvoiceLine.findMany
      .mockResolvedValueOnce([
        {
          id: 'ln-1',
          invoiceId: 'inv-1',
          feeItemId: 'fi-1',
          amount: 120_000_00, // an override that was already authorised
          quantity: 1,
          description: null,
        },
      ])
      .mockResolvedValue([]);

    await service.replaceLines(
      't1',
      'inv-1',
      // Only the quantity changed; the amount comes back as it stands.
      [{ id: 'ln-1', feeItemId: 'fi-1', amount: 120_000_00, quantity: 4 }],
      'user-1',
    );

    expect(feeInvoiceLine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 120_000_00, quantity: 4 }),
      }),
    );
    // The price did not move, so nothing new to record.
    expect(audit.write).not.toHaveBeenCalled();
  });
});
