import { FinanceNumberingService } from './finance-numbering.service';

/**
 * Receipt numbers an auditor can read: one run per year, zero-padded, taken by
 * a single atomic increment so two concurrent receipts can never share one.
 */
describe('FinanceNumberingService', () => {
  const financeNumberSequence = { upsert: jest.fn() };
  const $queryRaw = jest.fn();
  const client = { financeNumberSequence, $queryRaw };
  const service = new FinanceNumberingService({ client } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    $queryRaw.mockResolvedValue([{ next_value: 42 }]);
  });

  it('formats as PREFIX-YEAR-NNNNNN, scoped to the date’s year', async () => {
    const number = await service.next('t1', 'receipt', new Date('2026-08-19'));

    expect(number).toBe('RCT-2026-000042');
    expect(financeNumberSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_kind_scopeKey: {
            tenantId: 't1',
            kind: 'receipt',
            scopeKey: '2026',
          },
        },
      }),
    );
  });

  it('takes the number with one atomic increment, not a read-then-write', async () => {
    await service.next('t1', 'invoice', new Date('2026-08-19'));

    const [sql] = $queryRaw.mock.calls[0];
    expect(sql.join('')).toMatch(/UPDATE[\s\S]*SET "next_value" = "next_value" \+ 1/);
    expect(sql.join('')).toMatch(/RETURNING/);
  });

  it('gives each kind its own run', async () => {
    expect(await service.next('t1', 'journal', new Date('2026-01-05'))).toBe(
      'JE-2026-000042',
    );
  });
});
