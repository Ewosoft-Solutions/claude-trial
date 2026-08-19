import { FinanceService } from './finance.service';

/**
 * `listInvoices` powers BOTH the server-driven invoices list (a page) and the
 * finance-report / student-fees aggregate pages (the whole set). The contract
 * that keeps both working: omit `limit` → every row; pass `limit` → one page;
 * `{ data, pagination }` either way. Search/sort run at the DB.
 */
describe('FinanceService.listInvoices', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const client = { feeInvoice: { findMany, count } };
  const service = new FinanceService(
    { client } as never, // db
    { isScoped: false } as never, // tenantDb (unscoped → uses db.client)
    { applyPoliciesToInvoice: jest.fn() } as never, // adjustments
    { next: jest.fn() } as never, // numbering
    { autoApplyToInvoice: jest.fn() } as never, // credits
    { recordReceipt: jest.fn() } as never, // receipts
    {
      post: jest.fn(),
      reverseSource: jest.fn(),
      ensureOpeningBalance: jest.fn(),
    } as never, // ledger
  );

  beforeEach(() => {
    jest.clearAllMocks();
    // gross 1000 (its one line), a 200 applied discount, 300 settled by an
    // allocation — the receipt side now reaches the invoice through allocations.
    findMany.mockResolvedValue([
      {
        id: 'inv-1',
        amountPaid: 300,
        lines: [{ amount: 1000, quantity: 1 }],
        adjustments: [{ amount: 200 }],
        allocations: [{ amount: 300 }],
        creditApplications: [],
      },
    ]);
    count.mockResolvedValue(1);
  });

  it('returns every row (no skip/take/count) when no limit is given', async () => {
    const result = await service.listInvoices('tenant-1', {});
    const args = findMany.mock.calls[0][0];
    expect(args.skip).toBeUndefined();
    expect(args.take).toBeUndefined();
    expect(count).not.toHaveBeenCalled();
    expect(result.pagination.total).toBe(1);
    // balance is DERIVED: gross(1000) − discounts(200) − paid(300) = 500.
    expect(result.data[0]).toMatchObject({
      id: 'inv-1',
      financials: {
        gross: 1000,
        discounts: 200,
        net: 800,
        paid: 300,
        balance: 500,
        overpaid: 0,
      },
    });
    // raw line/adjustment arrays are dropped from the row.
    expect(result.data[0]).not.toHaveProperty('lines');
    expect(result.data[0]).not.toHaveProperty('adjustments');
    expect(result.data[0]).not.toHaveProperty('allocations');
  });

  it('paginates (skip/take + count) when a limit is given', async () => {
    count.mockResolvedValue(42);
    const result = await service.listInvoices('tenant-1', {
      page: 2,
      limit: 10,
    });
    const args = findMany.mock.calls[0][0];
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(count).toHaveBeenCalledTimes(1);
    expect(result.pagination).toMatchObject({
      page: 2,
      limit: 10,
      total: 42,
      totalPages: 5,
      hasNext: true,
      hasPrev: true,
    });
  });

  it('searches invoice number OR the denormalized student name at the DB', async () => {
    await service.listInvoices('tenant-1', { search: 'Achebe' });
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { invoiceNumber: { contains: 'Achebe', mode: 'insensitive' } },
      { studentName: { contains: 'Achebe', mode: 'insensitive' } },
    ]);
  });

  it('honours an allow-listed sort (studentName) with the requested direction', async () => {
    await service.listInvoices('tenant-1', {
      sortBy: 'studentName',
      sortOrder: 'desc',
    });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([
      { studentName: 'desc' },
      { invoiceNumber: 'asc' },
    ]);
  });

  it('ignores an unknown sort field (falls back to newest-first)', async () => {
    await service.listInvoices('tenant-1', { sortBy: 'notes' });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: 'desc' }]);
  });
});

/**
 * Cancelling an invoice withdraws the charge. Doing that to a bill money has
 * already been applied to would leave the receipt pointing at nothing and the
 * ledger short by what was settled — so it is refused, and the correction is a
 * reversal or an adjustment instead.
 */
describe('FinanceService.updateInvoice — cancelling', () => {
  const feeInvoice = { findFirst: jest.fn(), update: jest.fn() };
  const paymentAllocation = { count: jest.fn() };
  const creditApplication = { count: jest.fn() };
  const client = { feeInvoice, paymentAllocation, creditApplication };
  const ledger = {
    post: jest.fn(),
    reverseSource: jest.fn(),
    ensureOpeningBalance: jest.fn(),
  };

  const service = new FinanceService(
    { client } as never,
    { isScoped: false } as never,
    { applyPoliciesToInvoice: jest.fn() } as never,
    { next: jest.fn() } as never,
    { autoApplyToInvoice: jest.fn() } as never,
    { recordReceipt: jest.fn() } as never,
    ledger as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    feeInvoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'issued' });
    feeInvoice.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      ...data,
    }));
    paymentAllocation.count.mockResolvedValue(0);
    creditApplication.count.mockResolvedValue(0);
  });

  it('reverses the charge when nothing has been settled', async () => {
    await service.updateInvoice(
      't1',
      'inv-1',
      { status: 'cancelled' },
      'user-1',
    );

    expect(feeInvoice.update).toHaveBeenCalled();
    expect(ledger.reverseSource).toHaveBeenCalledWith(
      't1',
      'invoice',
      'inv-1',
      'user-1',
      'Invoice cancelled',
    );
  });

  it('refuses to cancel an invoice a payment has been applied to', async () => {
    paymentAllocation.count.mockResolvedValue(1);

    await expect(
      service.updateInvoice('t1', 'inv-1', { status: 'cancelled' }, 'user-1'),
    ).rejects.toThrow(/already been settled in part/);
    expect(feeInvoice.update).not.toHaveBeenCalled();
    expect(ledger.reverseSource).not.toHaveBeenCalled();
  });

  it('refuses just as firmly when it was settled with held credit', async () => {
    creditApplication.count.mockResolvedValue(1);

    await expect(
      service.updateInvoice('t1', 'inv-1', { status: 'cancelled' }, 'user-1'),
    ).rejects.toThrow(/already been settled in part/);
  });
});
