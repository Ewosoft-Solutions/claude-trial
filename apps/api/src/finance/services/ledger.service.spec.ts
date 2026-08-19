import { LedgerService, SYSTEM_ACCOUNT } from './ledger.service';

/**
 * The ledger's whole job is to refuse anything that would leave the books
 * wrong, so these tests are mostly about what it will NOT do: post an
 * unbalanced entry, accept a negative amount, write into a closed period, or
 * let a mistake be edited instead of reversed.
 */
describe('LedgerService', () => {
  const chartOfAccount = { findMany: jest.fn(), create: jest.fn() };
  const accountingPeriod = { findFirst: jest.fn(), findMany: jest.fn() };
  const journalEntry = {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  };
  const client = { chartOfAccount, accountingPeriod, journalEntry };
  const numbering = { next: jest.fn() };
  const audit = { write: jest.fn() };

  const service = new LedgerService(
    { client } as never,
    numbering as never,
    audit as never,
  );

  const ACCOUNTS = [
    { id: 'a-cash', systemKey: 'cash', normalBalance: 'debit' },
    { id: 'a-ar', systemKey: 'ar_control', normalBalance: 'debit' },
    { id: 'a-credit', systemKey: 'unapplied_credit', normalBalance: 'credit' },
    {
      id: 'a-equity',
      systemKey: 'opening_balance_equity',
      normalBalance: 'credit',
    },
    { id: 'a-income', systemKey: 'fee_income', normalBalance: 'credit' },
    { id: 'a-disc', systemKey: 'discounts_allowed', normalBalance: 'debit' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    chartOfAccount.findMany.mockResolvedValue(ACCOUNTS);
    accountingPeriod.findFirst.mockResolvedValue(null);
    numbering.next.mockResolvedValue('JE-2026-000001');
    journalEntry.create.mockImplementation(async ({ data }: any) => ({
      id: 'je-1',
      ...data,
    }));
  });

  const receipt = () => ({
    entryDate: new Date('2026-08-19'),
    memo: 'Receipt RCT-2026-000001',
    sourceType: 'receipt',
    lines: [
      { account: SYSTEM_ACCOUNT.CASH, debit: 100_000 },
      { account: SYSTEM_ACCOUNT.AR_CONTROL, credit: 100_000 },
    ],
  });

  it('posts a balanced entry and resolves accounts by their role, not their number', async () => {
    await service.post('t1', receipt());

    const data = journalEntry.create.mock.calls[0][0].data;
    expect(data.entryNumber).toBe('JE-2026-000001');
    expect(data.lines.create).toEqual([
      expect.objectContaining({
        accountId: 'a-cash',
        debit: 100_000,
        credit: 0,
      }),
      expect.objectContaining({ accountId: 'a-ar', debit: 0, credit: 100_000 }),
    ]);
  });

  it('refuses an entry whose debits and credits differ', async () => {
    await expect(
      service.post('t1', {
        ...receipt(),
        lines: [
          { account: SYSTEM_ACCOUNT.CASH, debit: 100_000 },
          { account: SYSTEM_ACCOUNT.AR_CONTROL, credit: 90_000 },
        ],
      }),
    ).rejects.toThrow(/does not balance/);
    expect(journalEntry.create).not.toHaveBeenCalled();
  });

  it('refuses a negative amount — the legacy reversal pattern (#95)', async () => {
    await expect(
      service.post('t1', {
        ...receipt(),
        lines: [
          { account: SYSTEM_ACCOUNT.CASH, debit: -100_000 },
          { account: SYSTEM_ACCOUNT.AR_CONTROL, credit: -100_000 },
        ],
      }),
    ).rejects.toThrow(/never negative/);
  });

  it('refuses a line that is both a debit and a credit', async () => {
    await expect(
      service.post('t1', {
        ...receipt(),
        lines: [
          { account: SYSTEM_ACCOUNT.CASH, debit: 100_000, credit: 100_000 },
          { account: SYSTEM_ACCOUNT.AR_CONTROL, credit: 100_000 },
        ],
      }),
    ).rejects.toThrow(/either a debit or a credit/);
  });

  it('refuses to post into a closed period', async () => {
    accountingPeriod.findFirst.mockResolvedValue({
      id: 'p-1',
      name: 'First Term 2026/27',
      status: 'closed',
    });

    await expect(service.post('t1', receipt())).rejects.toThrow(
      /is closed. Date the correction in an open period/,
    );
  });

  it('stamps the entry with the open period its date falls in', async () => {
    accountingPeriod.findFirst.mockResolvedValue({
      id: 'p-1',
      name: 'First Term 2026/27',
      status: 'open',
    });

    await service.post('t1', receipt());

    expect(journalEntry.create.mock.calls[0][0].data.periodId).toBe('p-1');
  });

  it('reverses by swapping the sides and marks the original reversed', async () => {
    journalEntry.findFirst.mockResolvedValue({
      id: 'je-1',
      entryNumber: 'JE-2026-000001',
      status: 'posted',
      lines: [
        {
          accountId: 'a-cash',
          debit: 100_000,
          credit: 0,
          description: 'cash in',
          invoiceId: null,
          householdId: null,
          studentId: null,
        },
        {
          accountId: 'a-ar',
          debit: 0,
          credit: 100_000,
          description: 'invoice',
          invoiceId: 'inv-1',
          householdId: null,
          studentId: 'stu-1',
        },
      ],
    });

    await service.reverse(
      't1',
      'je-1',
      'user-1',
      'Recorded against the wrong family',
    );

    const data = journalEntry.create.mock.calls[0][0].data;
    expect(data.reversalOfId).toBe('je-1');
    expect(data.lines.create).toEqual([
      expect.objectContaining({
        accountId: 'a-cash',
        debit: 0,
        credit: 100_000,
      }),
      expect.objectContaining({ accountId: 'a-ar', debit: 100_000, credit: 0 }),
    ]);
    expect(journalEntry.update).toHaveBeenCalledWith({
      where: { id: 'je-1' },
      data: { status: 'reversed' },
    });
    expect(audit.write).toHaveBeenCalled();
  });

  it('will not reverse the same entry twice', async () => {
    journalEntry.findFirst.mockResolvedValue({
      id: 'je-1',
      status: 'reversed',
      lines: [],
    });

    await expect(service.reverse('t1', 'je-1', 'user-1')).rejects.toThrow(
      /already been reversed/,
    );
  });
});
