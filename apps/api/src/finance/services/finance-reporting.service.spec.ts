import { FinanceReportingService } from './finance-reporting.service';

/** Aging buckets, collections grouping, and the CSV a school's accountant gets. */
describe('FinanceReportingService', () => {
  const feeInvoice = { findMany: jest.fn() };
  const payment = { findMany: jest.fn(), aggregate: jest.fn() };
  const accountCredit = { aggregate: jest.fn() };
  const journalEntry = { findMany: jest.fn() };
  const client = { feeInvoice, payment, accountCredit, journalEntry };
  const ledger = {
    ensureChart: jest.fn(),
    ensureOpeningBalance: jest.fn(),
    trialBalance: jest.fn(),
    systemAccountBalance: jest.fn(),
  };

  const audit = { write: jest.fn() };
  const service = new FinanceReportingService(
    { client } as never,
    ledger as never,
    audit as never,
  );

  const owing = (id: string, balance: number, dueDate: string | null) => ({
    id,
    invoiceNumber: `INV-${id}`,
    status: 'issued',
    dueDate: dueDate ? new Date(dueDate) : null,
    householdId: 'hh-1',
    studentId: `stu-${id}`,
    studentName: `Student ${id}`,
    household: { name: 'Okonkwo' },
    lines: [{ amount: balance, quantity: 1 }],
    adjustments: [],
    allocations: [],
    creditApplications: [],
  });

  beforeEach(() => jest.clearAllMocks());

  it('ages debt by days past due, and treats an undated invoice as current', async () => {
    feeInvoice.findMany.mockResolvedValue([
      owing('a', 100_000, '2026-08-25'), // not yet due
      owing('b', 200_000, '2026-08-01'), // 18 days
      owing('c', 300_000, '2026-06-01'), // 79 days
      owing('d', 400_000, '2026-01-01'), // over 90
      owing('e', 500_000, null), // never dated
    ]);

    const report = await service.aging('t1', { asOf: '2026-08-19' });

    const byKey = Object.fromEntries(report.buckets.map((b) => [b.key, b.total]));
    expect(byKey).toEqual({
      current: 600_000, // the not-yet-due one plus the undated one
      d1_30: 200_000,
      d31_60: 0,
      d61_90: 300_000,
      d90_plus: 400_000,
    });
    expect(report.total).toBe(1_500_000);
  });

  it('groups collections by day and separates what was held as credit', async () => {
    payment.findMany.mockResolvedValue([
      {
        id: 'r1',
        amount: 300_000,
        method: 'transfer',
        paidAt: new Date('2026-08-18'),
        allocations: [{ amount: 300_000 }],
      },
      {
        id: 'r2',
        amount: 250_000,
        method: 'cash',
        paidAt: new Date('2026-08-19'),
        allocations: [{ amount: 200_000 }],
      },
    ]);

    const report = await service.collections('t1', {});

    expect(report.groups.map((g) => [g.key, g.total])).toEqual([
      ['2026-08-18', 300_000],
      ['2026-08-19', 250_000],
    ]);
    expect(report.totals).toEqual({
      receipts: 2,
      total: 550_000,
      allocated: 500_000,
      unallocated: 50_000,
    });
  });

  it('counts only the receipts the ledger has posted on the cash control', async () => {
    feeInvoice.findMany.mockResolvedValue([]);
    accountCredit.aggregate.mockResolvedValue({ _sum: { remaining: 0 } });
    journalEntry.findMany.mockResolvedValue([]);
    ledger.trialBalance.mockResolvedValue({
      totalDebit: 0,
      totalCredit: 0,
      outOfBalance: 0,
    });
    ledger.systemAccountBalance.mockResolvedValue(0);

    const report = await service.reconciliation('t1');

    // A school with a payment history but no posted receipts (everything
    // predates the ledger) still reconciles — that cash lives in the opening
    // balance, not in a difference.
    expect(payment.aggregate).not.toHaveBeenCalled();
    expect(report.controls.find((c) => c.key === 'cash')?.difference).toBe(0);
  });

  it('reports the subledger against the ledger, control by control', async () => {
    feeInvoice.findMany.mockResolvedValue([owing('a', 100_000, '2026-08-25')]);
    accountCredit.aggregate.mockResolvedValue({ _sum: { remaining: 50_000 } });
    payment.aggregate.mockResolvedValue({ _sum: { amount: 400_000 } });
    journalEntry.findMany.mockResolvedValue([{ sourceId: 'rct-1' }]);
    ledger.trialBalance.mockResolvedValue({
      totalDebit: 500_000,
      totalCredit: 500_000,
      outOfBalance: 0,
    });
    ledger.systemAccountBalance
      .mockResolvedValueOnce(100_000) // receivable
      .mockResolvedValueOnce(50_000) // credit held
      .mockResolvedValueOnce(400_000); // cash

    const report = await service.reconciliation('t1');

    expect(report.balanced).toBe(true);
    expect(report.controls.map((c) => c.difference)).toEqual([0, 0, 0]);
  });

  it('flags a control that no longer agrees', async () => {
    feeInvoice.findMany.mockResolvedValue([owing('a', 100_000, '2026-08-25')]);
    accountCredit.aggregate.mockResolvedValue({ _sum: { remaining: 0 } });
    payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    journalEntry.findMany.mockResolvedValue([]);
    ledger.trialBalance.mockResolvedValue({
      totalDebit: 90_000,
      totalCredit: 90_000,
      outOfBalance: 0,
    });
    ledger.systemAccountBalance
      .mockResolvedValueOnce(90_000)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const report = await service.reconciliation('t1');

    expect(report.balanced).toBe(false);
    expect(report.controls[0]).toMatchObject({
      key: 'receivable',
      subledger: 100_000,
      ledger: 90_000,
      difference: 10_000,
    });
  });

  it('exports the journal as CSV and defangs a formula-looking cell', async () => {
    journalEntry.findMany.mockResolvedValue([
      {
        entryNumber: 'JE-2026-000001',
        entryDate: new Date('2026-08-19'),
        status: 'posted',
        sourceType: 'receipt',
        sourceId: 'rct-1',
        memo: '=cmd|calc',
        lines: [
          {
            account: { code: '1000', name: 'Cash & bank' },
            debit: 100_000,
            credit: 0,
            description: 'transfer',
            invoiceId: null,
            studentId: null,
          },
        ],
      },
    ]);

    const csv = await service.exportJournalCsv('t1', {});
    const [header, row] = csv.split('\n');

    expect(header?.startsWith('entry_number,entry_date')).toBe(true);
    expect(row).toContain("'=cmd|calc");
    expect(row).toContain('1000,Cash & bank,100000,0');
    // The journal is financial data leaving the building, so it is audited.
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'finance_journal_exported' }),
    );
  });
});
