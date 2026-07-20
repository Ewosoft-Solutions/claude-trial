/**
 * CurrentTermService unit tests — the "what term is it now" resolver used by
 * the AI system prompts. DB is stubbed; these prove year/term selection and
 * the never-throw prompt description.
 */
import { CurrentTermService } from './current-term.service';

const YEAR = { id: 'year-1', name: '2024-2025', status: 'active' };

function buildService(options: {
  year?: typeof YEAR | null;
  terms?: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    startDate: Date;
    endDate: Date;
  }>;
  throws?: boolean;
}) {
  const client = {
    academicYear: {
      findFirst: jest.fn(async () => {
        if (options.throws) throw new Error('db down');
        return options.year ?? null;
      }),
    },
    term: {
      findMany: jest.fn(async () => options.terms ?? []),
    },
  };
  const db = { client } as never;
  const tenantDb = { isScoped: false, client } as never;
  return { service: new CurrentTermService(db, tenantDb), client };
}

function term(name: string, start: string, end: string, status = 'planned') {
  return {
    id: `t-${name}`,
    name,
    type: 'term',
    status,
    startDate: new Date(start),
    endDate: new Date(end),
  };
}

describe('CurrentTermService', () => {
  it('returns null when the tenant has no academic year', async () => {
    const { service } = buildService({ year: null });
    expect(await service.getCurrentTerm('tenant-1')).toBeNull();
  });

  it('picks the term whose date range spans today', async () => {
    const now = new Date();
    const spanStart = new Date(now.getTime() - 86_400_000).toISOString();
    const spanEnd = new Date(now.getTime() + 86_400_000).toISOString();
    const { service } = buildService({
      year: YEAR,
      terms: [
        term('Term 1', '2000-01-01', '2000-06-01'),
        term('Term 2', spanStart, spanEnd),
      ],
    });
    const result = await service.getCurrentTerm('tenant-1');
    expect(result?.term?.name).toBe('Term 2');
  });

  it('falls back to the next upcoming term when none spans today', async () => {
    const future1 = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const future1End = new Date(Date.now() + 40 * 86_400_000).toISOString();
    const future2 = new Date(Date.now() + 100 * 86_400_000).toISOString();
    const future2End = new Date(Date.now() + 130 * 86_400_000).toISOString();
    // Returned in `order` (chronological) sequence, as the real query sorts them.
    const { service } = buildService({
      year: YEAR,
      terms: [
        term('Term 2', future1, future1End),
        term('Term 3', future2, future2End),
      ],
    });
    const result = await service.getCurrentTerm('tenant-1');
    expect(result?.term?.name).toBe('Term 2');
  });

  it('describes the current term for a prompt', async () => {
    const { service } = buildService({
      year: YEAR,
      terms: [term('Term 1', '2000-01-01', '2000-06-30', 'active')],
    });
    const line = await service.describeForPrompt('tenant-1');
    expect(line).toBe(
      'Current term: Term 1 of academic year 2024-2025 (2000-01-01 to 2000-06-30).',
    );
  });

  it('describes a year with no terms', async () => {
    const { service } = buildService({ year: YEAR, terms: [] });
    expect(await service.describeForPrompt('tenant-1')).toBe(
      'Academic year: 2024-2025 (no terms defined yet).',
    );
  });

  it('never throws from describeForPrompt — degrades to null', async () => {
    const { service } = buildService({ throws: true });
    expect(await service.describeForPrompt('tenant-1')).toBeNull();
  });
});
