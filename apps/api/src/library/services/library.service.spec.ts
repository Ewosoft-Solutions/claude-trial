/**
 * LibraryService unit tests — the loans view (slice 3 sub-surface) and the
 * catalog summary. Prisma is stubbed via a fake client.
 */
import { LibraryService } from './library.service';

function build(rows: unknown[]) {
  const client = {
    libraryBook: { findMany: jest.fn().mockResolvedValue(rows) },
  };
  const db = { client };
  const tenantDb = { isScoped: false, client };
  return new LibraryService(db as never, tenantDb as never);
}

const student = (first: string, last: string, number: string) => ({
  studentNumber: number,
  userTenant: { user: { firstName: first, lastName: last } },
});

describe('LibraryService', () => {
  it('flags overdue loans and maps the borrower', async () => {
    const past = new Date(Date.now() - 86_400_000);
    const future = new Date(Date.now() + 86_400_000);
    const service = build([
      { id: 'b1', title: 'A', author: 'X', category: 'Fiction', copyLabel: 'c1', dueDate: past, student: student('Ada', 'N', 'S-1') },
      { id: 'b2', title: 'B', author: 'Y', category: null, copyLabel: null, dueDate: future, student: student('Ben', 'O', 'S-2') },
    ]);
    const loans = await service.loans('t1');

    expect(loans[0]).toMatchObject({
      id: 'b1',
      overdue: true,
      borrower: { name: 'Ada N', studentNumber: 'S-1' },
    });
    expect(loans[0].dueDate).toBe(past.toISOString());
    expect(loans[1]).toMatchObject({ id: 'b2', overdue: false });
  });

  it('handles a loan with no borrower', async () => {
    const service = build([
      { id: 'b3', title: 'C', author: 'Z', category: null, copyLabel: null, dueDate: null, student: null },
    ]);
    const loans = await service.loans('t1');
    expect(loans[0]).toMatchObject({ borrower: null, dueDate: null, overdue: false });
  });

  it('summarizes status and category counts', async () => {
    const service = build([
      { status: 'available', category: 'Fiction' },
      { status: 'on_loan', category: 'Fiction' },
      { status: 'available', category: null },
    ]);
    const summary = await service.catalogSummary('t1');
    expect(summary.totalBooks).toBe(3);
    expect(summary.statusCounts).toEqual({ available: 2, on_loan: 1 });
    expect(summary.categoryCounts).toEqual({ Fiction: 2, Uncategorized: 1 });
  });
});
