/* ============================================================
   /finance/ledger — the double-entry general ledger (server component)

   The books behind the bills (ADR-10): a trial balance that must net to zero,
   the journal entries every receivables event posts, and the accounting
   periods that decide what history is still allowed to change.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import {
  LedgerClient,
  type JournalEntry,
  type TrialBalanceRow,
  type Period,
} from './ledger-client';

interface TrialBalance {
  rows?: TrialBalanceRow[];
  totalDebit?: number;
  totalCredit?: number;
  outOfBalance?: number;
}

interface ApiEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  memo?: string | null;
  sourceType: string;
  status: string;
  totalDebit?: number;
  totalCredit?: number;
  lines?: Array<{
    id: string;
    debit: number;
    credit: number;
    description?: string | null;
    account?: { code: string; name: string } | null;
  }>;
}

interface EntriesResponse {
  data?: ApiEntry[];
  total?: number;
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = Number(typeof sp.page === 'string' ? sp.page : '1') || 1;
  const pageSize = 25;
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
  });
  const sourceType = typeof sp.f_source === 'string' ? sp.f_source : undefined;
  if (sourceType) params.set('sourceType', sourceType);

  const [trial, entries, periods, session] = await Promise.all([
    serverApiGet<TrialBalance>('/finance/ledger/trial-balance'),
    serverApiGet<EntriesResponse>(
      `/finance/ledger/entries?${params.toString()}`,
    ),
    serverApiGet<Period[]>('/finance/ledger/periods'),
    getSession(),
  ]);

  const canManage =
    session?.permissions.includes('finance.gl.manage' as never) ?? false;

  const journal: JournalEntry[] = (entries?.data ?? []).map((entry) => ({
    id: entry.id,
    entryNumber: entry.entryNumber,
    entryDate: entry.entryDate,
    memo: entry.memo ?? undefined,
    sourceType: entry.sourceType,
    status: entry.status,
    total: entry.totalDebit ?? 0,
    lines: (entry.lines ?? []).map((line) => ({
      id: line.id,
      accountCode: line.account?.code ?? '—',
      accountName: line.account?.name ?? 'Unknown account',
      debit: line.debit,
      credit: line.credit,
      description: line.description ?? undefined,
    })),
  }));

  return (
    <LedgerClient
      rows={trial?.rows ?? []}
      totals={{
        debit: trial?.totalDebit ?? 0,
        credit: trial?.totalCredit ?? 0,
        outOfBalance: trial?.outOfBalance ?? 0,
      }}
      entries={journal}
      total={entries?.total ?? journal.length}
      page={page}
      pageSize={pageSize}
      periods={periods ?? []}
      canManage={canManage}
    />
  );
}
