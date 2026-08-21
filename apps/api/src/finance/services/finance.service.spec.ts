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
    { client } as never, // tenantDb (its `client` is the request transaction)
    { write: jest.fn() } as never, // audit
    { applyPoliciesToInvoice: jest.fn() } as never, // adjustments
    { next: jest.fn() } as never, // numbering
    { autoApplyToInvoice: jest.fn() } as never, // credits
    { recordReceipt: jest.fn() } as never, // receipts
    {
      post: jest.fn(),
      reverseSource: jest.fn(),
      ensureOpeningBalance: jest.fn(),
    } as never, // ledger
    {} as never, // catalogue
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
  const feeAdjustment = { findMany: jest.fn() };
  const paymentAllocation = { count: jest.fn() };
  const creditApplication = { count: jest.fn() };
  const client = {
    feeInvoice,
    feeAdjustment,
    paymentAllocation,
    creditApplication,
  };
  const ledger = {
    post: jest.fn(),
    // A reversal returns the contra entries it posted; an invoice billed before
    // the ledger opened has none, which is the branch that matters below.
    reverseSource: jest.fn(),
    ensureOpeningBalance: jest.fn(),
  };

  const audit = { write: jest.fn() };
  const service = new FinanceService(
    { client } as never,
    audit as never,
    { applyPoliciesToInvoice: jest.fn() } as never,
    { next: jest.fn() } as never,
    { autoApplyToInvoice: jest.fn() } as never,
    { recordReceipt: jest.fn() } as never,
    ledger as never,
    {} as never, // catalogue
  );

  beforeEach(() => {
    jest.clearAllMocks();
    ledger.reverseSource.mockResolvedValue([{ id: 'je-rev' }]);
    feeAdjustment.findMany.mockResolvedValue([]);
    feeInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      status: 'issued',
      invoiceNumber: 'INV-2026-000001',
    });
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
    // Withdrawing a receivable is a decision someone made; it leaves a trace.
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'finance_invoice_cancelled' }),
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

/**
 * A draft's own details — term, year, cycle, due date, notes — were writable
 * only at creation, so an invoice opened with the wrong term stayed wrong for
 * life, and a term-less draft never appeared on the term-scoped list at all.
 * These pin the two rules that make correcting it safe: only a draft, and an
 * emptied field clears the column rather than storing "".
 */
describe('FinanceService.updateInvoiceHeader', () => {
  const findFirst = jest.fn();
  const update = jest.fn();
  const write = jest.fn();
  const client = { feeInvoice: { findFirst, update } };
  const service = new FinanceService(
    { client } as never,
    { write } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findFirst.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'INV-2026-000001',
      status: 'draft',
    });
    update.mockImplementation(({ data }: { data: unknown }) => ({
      id: 'inv-1',
      ...(data as object),
    }));
  });

  it('writes only the fields that were sent', async () => {
    await service.updateInvoiceHeader(
      'tenant-1',
      'inv-1',
      { termName: 'Spring Term' },
      'user-1',
    );
    const { data } = update.mock.calls[0][0];
    expect(data).toMatchObject({
      termName: 'Spring Term',
      updatedBy: 'user-1',
    });
    // Absent keys must not be written, or editing one field would blank another.
    expect(data).not.toHaveProperty('dueDate');
    expect(data).not.toHaveProperty('termYear');
    expect(data).not.toHaveProperty('notes');
  });

  it('clears a column when the field is emptied rather than storing ""', async () => {
    await service.updateInvoiceHeader(
      'tenant-1',
      'inv-1',
      { termName: '   ', dueDate: null },
      'user-1',
    );
    const { data } = update.mock.calls[0][0];
    expect(data.termName).toBeNull();
    expect(data.dueDate).toBeNull();
  });

  it('refuses anything that has left draft', async () => {
    findFirst.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'INV-2026-000001',
      status: 'issued',
    });
    await expect(
      service.updateInvoiceHeader(
        'tenant-1',
        'inv-1',
        { termName: 'Spring Term' },
        'user-1',
      ),
    ).rejects.toThrow(/only a draft's details can be corrected/i);
    expect(update).not.toHaveBeenCalled();
  });

  it('404s an invoice this tenant cannot see', async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      service.updateInvoiceHeader('tenant-1', 'nope', {}, 'user-1'),
    ).rejects.toThrow(/not found/i);
    expect(update).not.toHaveBeenCalled();
  });

  it('audits the correction', async () => {
    await service.updateInvoiceHeader(
      'tenant-1',
      'inv-1',
      { termName: 'Spring Term' },
      'user-1',
    );
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'finance_invoice_header_updated',
        resource: 'fee_invoice',
        resourceId: 'inv-1',
        actorId: 'user-1',
      }),
    );
  });
});

/**
 * Composing writes a whole invoice in one request because `StepUpGuard`
 * consumes the challenge it verifies — "create then issue" as two guarded
 * calls would ask the bursar to confirm twice for one action. These pin the
 * order that keeps the books honest when the second half runs.
 */
describe('FinanceService.composeInvoice', () => {
  const create = jest.fn();
  const update = jest.fn();
  const findFirst = jest.fn();
  const studentFindFirst = jest.fn();
  const write = jest.fn();
  const addLines = jest.fn();
  const ledger = {
    post: jest.fn(),
    reverseSource: jest.fn(),
    ensureOpeningBalance: jest.fn(),
  };
  const adjustments = { applyPoliciesToInvoice: jest.fn() };
  const credits = { autoApplyToInvoice: jest.fn() };

  const client = {
    feeInvoice: { create, update, findFirst },
    student: { findFirst: studentFindFirst },
  };
  const service = new FinanceService(
    { client } as never,
    { write } as never,
    adjustments as never,
    { next: jest.fn().mockResolvedValue('INV-2026-000009') } as never,
    credits as never,
    {} as never,
    ledger as never,
    { addLines } as never,
  );

  const LINES = [{ feeItemId: 'fee-1', amount: 15000000, quantity: 1 }];

  beforeEach(() => {
    jest.clearAllMocks();
    studentFindFirst.mockResolvedValue(null);
    create.mockResolvedValue({
      id: 'inv-9',
      invoiceNumber: 'INV-2026-000009',
      status: 'draft',
    });
    // postInvoiceIssued re-reads the invoice; nothing gross means no ledger post,
    // which keeps these tests about sequencing rather than double-entry.
    findFirst.mockResolvedValue({
      id: 'inv-9',
      invoiceNumber: 'INV-2026-000009',
      status: 'issued',
      lines: [],
      adjustments: [],
      allocations: [],
      creditApplications: [],
    });
  });

  it('creates the invoice, writes its lines, and leaves it a draft', async () => {
    await service.composeInvoice(
      'tenant-1',
      { studentId: 'stu-1', lines: LINES },
      'user-1',
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(addLines).toHaveBeenCalledWith('tenant-1', 'inv-9', LINES);
    // Not issued: no status flip, no ledger, no policies, no credit drawdown.
    expect(update).not.toHaveBeenCalled();
    expect(ledger.ensureOpeningBalance).not.toHaveBeenCalled();
    expect(adjustments.applyPoliciesToInvoice).not.toHaveBeenCalled();
    expect(credits.autoApplyToInvoice).not.toHaveBeenCalled();
  });

  it('issues in the same request when asked', async () => {
    await service.composeInvoice(
      'tenant-1',
      { studentId: 'stu-1', lines: LINES, issue: true },
      'user-1',
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'issued' }),
      }),
    );
    expect(adjustments.applyPoliciesToInvoice).toHaveBeenCalledWith(
      'tenant-1',
      'inv-9',
      'user-1',
    );
    expect(credits.autoApplyToInvoice).toHaveBeenCalledWith(
      'tenant-1',
      'inv-9',
      'user-1',
    );
  });

  it('opens the books BEFORE the bill becomes a receivable', async () => {
    const order: string[] = [];
    ledger.ensureOpeningBalance.mockImplementation(() => {
      order.push('opening-balance');
      return Promise.resolve();
    });
    update.mockImplementation(() => {
      order.push('status-issued');
      return Promise.resolve({});
    });

    await service.composeInvoice(
      'tenant-1',
      { studentId: 'stu-1', lines: LINES, issue: true },
      'user-1',
    );

    // A school carrying pre-ledger debt must open with THAT debt, not with
    // this bill. Reverse these two and the opening balance swallows it.
    expect(order).toEqual(['opening-balance', 'status-issued']);
  });

  it('totals the lines before issuing, never after', async () => {
    const order: string[] = [];
    addLines.mockImplementation(() => {
      order.push('lines');
      return Promise.resolve([]);
    });
    update.mockImplementation(() => {
      order.push('issued');
      return Promise.resolve({});
    });
    await service.composeInvoice(
      'tenant-1',
      { studentId: 'stu-1', lines: LINES, issue: true },
      'user-1',
    );
    // addLines syncs amountDue; issuing before it would post a zero receivable.
    expect(order).toEqual(['lines', 'issued']);
  });

  it('audits the composition either way', async () => {
    await service.composeInvoice(
      'tenant-1',
      { studentId: 'stu-1', lines: LINES },
      'user-1',
    );
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'finance_invoice_composed',
        resourceId: 'inv-9',
        metadata: expect.objectContaining({ lineCount: 1, issued: false }),
      }),
    );
  });
});

describe('FinanceService.getInvoice — separation of duties on adjustments', () => {
  const READER = 'user-reader';

  function makeService(adjustments: Record<string, unknown>[]) {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'inv-1',
      dueDate: null,
      status: 'issued',
      lines: [],
      allocations: [],
      creditApplications: [],
      adjustments,
    });
    const client = { feeInvoice: { findFirst } };
    return new FinanceService(
      { client } as never,
      { write: jest.fn() } as never,
      { applyPoliciesToInvoice: jest.fn() } as never,
      { next: jest.fn() } as never,
      { autoApplyToInvoice: jest.fn() } as never,
      { recordReceipt: jest.fn() } as never,
      {
        post: jest.fn(),
        reverseSource: jest.fn(),
        ensureOpeningBalance: jest.fn(),
      } as never,
      {} as never,
    );
  }

  it('tells the page which pending adjustments the reader raised', async () => {
    // The approve route already refuses a self-approval; this is what stops the
    // page OFFERING the button. See docs/self-approval-audit.md.
    const service = makeService([
      { id: 'mine', status: 'pending', requestedBy: READER, amount: 1 },
      {
        id: 'theirs',
        status: 'pending',
        requestedBy: 'someone-else',
        amount: 1,
      },
      { id: 'unknown', status: 'pending', requestedBy: null, amount: 1 },
    ]);
    const invoice = await service.getInvoice('tenant-1', 'inv-1', READER);
    expect(invoice.adjustments.map((a) => [a.id, a.isOwnRequest])).toEqual([
      ['mine', true],
      ['theirs', false],
      // a null requester is unknown authorship, not own work
      ['unknown', false],
    ]);
  });

  it('flags nothing when the caller is anonymous', async () => {
    const service = makeService([
      { id: 'a', status: 'pending', requestedBy: READER, amount: 1 },
    ]);
    const invoice = await service.getInvoice('tenant-1', 'inv-1');
    expect(invoice.adjustments[0].isOwnRequest).toBe(false);
  });
});
