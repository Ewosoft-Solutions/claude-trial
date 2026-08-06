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
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([{ id: 'inv-1' }]);
    count.mockResolvedValue(1);
  });

  it('returns every row (no skip/take/count) when no limit is given', async () => {
    const result = await service.listInvoices('tenant-1', {});
    const args = findMany.mock.calls[0][0];
    expect(args.skip).toBeUndefined();
    expect(args.take).toBeUndefined();
    expect(count).not.toHaveBeenCalled();
    expect(result.data).toEqual([{ id: 'inv-1' }]);
    expect(result.pagination.total).toBe(1);
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
