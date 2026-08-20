'use client';

/* ============================================================
   LedgerClient — the general ledger surface (ADR-10)

   Three things a bookkeeper needs: whether the books balance (the trial
   balance), what each entry was for (the journal, traceable back to the
   receipt or invoice that caused it), and which periods are still open. A
   posted entry is never edited here — the only correction is a reversal.
   ============================================================ */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, Loader2, Lock, LockOpen, Plus, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import { Sheet, SheetDescription } from '@workspace/ui/components/sheet';
import {
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@workspace/ui/custom/detail/drawer-chrome';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import type { StatItem } from '@workspace/ui/types/layout.types';

import { authedFetch } from '@/lib/authed-fetch';
import { formatNaira as nairaFromKobo } from '@/lib/format';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { useStepUpAction } from '../../_shared/use-step-up-action';

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: string;
  systemKey?: string | null;
  normalBalance: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface JournalLine {
  id: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  memo?: string;
  sourceType: string;
  status: string;
  total: number;
  lines: JournalLine[];
}

export interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

/** Mirrors `SUBLEDGER_SOURCES` in the ledger service — see the guard there. */
const SUBLEDGER_SOURCES = [
  'invoice',
  'invoice_withdrawal',
  'adjustment',
  'receipt',
  'credit_application',
  'opening',
  'reversal',
];

const SOURCE_LABEL: Record<string, string> = {
  invoice: 'Invoice issued',
  receipt: 'Payment received',
  adjustment: 'Discount / waiver',
  credit_application: 'Credit applied',
  opening: 'Opening balance',
  reversal: 'Reversal',
  manual: 'Manual entry',
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface Props {
  rows: TrialBalanceRow[];
  totals: { debit: number; credit: number; outOfBalance: number };
  entries: JournalEntry[];
  total: number;
  page: number;
  pageSize: number;
  periods: Period[];
  canManage: boolean;
}

export function LedgerClient({
  rows,
  totals,
  entries,
  total,
  page,
  pageSize,
  periods,
  canManage,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openEntry, setOpenEntry] = React.useState<JournalEntry | null>(null);

  const setParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const setParam = (key: string, value: string | null) =>
    setParams({ [key]: value });

  const sourceFilter = searchParams.get('f_source');
  const exportHref = sourceFilter
    ? `/api/finance/ledger/export?sourceType=${encodeURIComponent(sourceFilter)}`
    : '/api/finance/ledger/export';

  const byKey = new Map(rows.map((row) => [row.systemKey ?? row.code, row]));
  const statItems: StatItem[] = [
    {
      key: 'receivable',
      label: 'Receivables',
      value: nairaFromKobo(byKey.get('ar_control')?.balance ?? 0),
    },
    {
      key: 'cash',
      label: 'Cash & bank',
      value: nairaFromKobo(byKey.get('cash')?.balance ?? 0),
    },
    {
      key: 'credit',
      label: 'Credit held',
      value: nairaFromKobo(byKey.get('unapplied_credit')?.balance ?? 0),
    },
    {
      key: 'balance',
      label: 'Out of balance',
      value: nairaFromKobo(totals.outOfBalance),
      delta:
        totals.outOfBalance === 0
          ? { label: 'balanced', direction: 'up', intent: 'positive' }
          : { label: 'investigate', direction: 'up', intent: 'negative' },
    },
  ];

  const columns: DirectoryColumn<JournalEntry>[] = [
    {
      id: 'entryNumber',
      header: 'Entry',
      cell: (entry) => (
        <div className="flex min-w-0 flex-col">
          <span className="break-words font-medium text-foreground">
            {entry.memo ?? SOURCE_LABEL[entry.sourceType] ?? entry.sourceType}
          </span>
          <span className="break-words text-xs text-muted-foreground">
            {entry.entryNumber}
          </span>
        </div>
      ),
    },
    {
      id: 'entryDate',
      header: 'Date',
      cell: (entry) => (
        <span className="text-muted-foreground">
          {formatDate(entry.entryDate)}
        </span>
      ),
    },
    {
      id: 'sourceType',
      header: 'Caused by',
      hideable: true,
      cell: (entry) => (
        <span className="text-muted-foreground">
          {SOURCE_LABEL[entry.sourceType] ?? entry.sourceType}
        </span>
      ),
    },
    {
      id: 'total',
      header: 'Amount',
      align: 'end',
      cell: (entry) => (
        <span className="tabular-nums font-medium text-foreground">
          {nairaFromKobo(entry.total)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (entry) => (
        <StatusBadge
          tone={entry.status === 'reversed' ? 'neutral' : 'success'}
          dot
        >
          {entry.status === 'reversed' ? 'Reversed' : 'Posted'}
        </StatusBadge>
      ),
    },
  ];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="General ledger"
          actions={
            <>
              {/* The export needs finance.gl.manage; showing it to a viewer
                  just downloads a file containing a 403. It also carries the
                  page's own filter, so "export" means what is on screen. */}
              {canManage ? (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <a href={exportHref} download>
                      <Download /> Export journal
                    </a>
                  </Button>
                  <NewPeriodDialog onSaved={() => router.refresh()} />
                </>
              ) : null}
            </>
          }
        />

        <StatGrid items={statItems} />

        <div className="grid gap-4 @4xl/main:grid-cols-3">
          <Card className="shadow-card @4xl/main:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Trial balance</CardTitle>
              <CardDescription>
                Every account, and whether the debits still equal the credits
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <EmptyState
                  compact
                  title="Nothing posted yet"
                  description="The chart of accounts opens itself the first time an invoice is issued or a payment is recorded."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Account</th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Debit
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Credit
                        </th>
                        <th className="py-2 text-right font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.accountId}
                          className="border-t border-border"
                        >
                          <td className="py-2 pr-3">
                            <span className="text-foreground">{row.name}</span>{' '}
                            <span className="text-xs text-muted-foreground">
                              {row.code}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                            {nairaFromKobo(row.debit)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                            {nairaFromKobo(row.credit)}
                          </td>
                          <td className="py-2 text-right tabular-nums font-medium text-foreground">
                            {nairaFromKobo(row.balance)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border font-medium">
                        <td className="py-2 pr-3">Total</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {nairaFromKobo(totals.debit)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {nairaFromKobo(totals.credit)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {nairaFromKobo(totals.outOfBalance)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <PeriodsCard
            periods={periods}
            canManage={canManage}
            onChanged={() => router.refresh()}
          />
        </div>

        <DirectoryTable<JournalEntry>
          columns={columns}
          rows={entries}
          getRowId={(entry) => entry.id}
          getRowLabel={(entry) => entry.entryNumber}
          onRowClick={(entry) => setOpenEntry(entry)}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={(next) =>
            setParam('page', next > 1 ? String(next) : null)
          }
          // Page size is fixed here (the server page is a constant), so the
          // control is not offered rather than offered and inert.
          pageSizeOptions={[pageSize]}
          onPageSizeChange={() => undefined}
          sort={null}
          onSortChange={() => undefined}
          title="Journal"
          description={`${total} ${total === 1 ? 'entry' : 'entries'}`}
          caption="Journal entries"
          filters={[
            {
              key: 'source',
              label: 'Caused by',
              options: Object.entries(SOURCE_LABEL).map(([value, label]) => ({
                value,
                label,
              })),
            },
          ]}
          filterValues={{
            source: searchParams.get('f_source') ?? undefined,
          }}
          onFilterChange={(key, value) => {
            // Reset to page 1: filtering from page 5 otherwise shows an empty
            // table with no explanation. `useDirectoryState` does this for the
            // screens that use it; this one drives its own URL state.
            setParams({
              [`f_${key}`]: !value || value === 'all' ? null : value,
              page: null,
            });
          }}
          onClearFilters={() => setParams({ f_source: null, page: null })}
          emptyState={
            <EmptyState
              compact
              title="No journal entries"
              description="Issuing an invoice or recording a payment posts the first entry."
            />
          }
        />
      </div>

      <EntryDrawer
        entry={openEntry}
        canManage={canManage}
        onClose={() => setOpenEntry(null)}
        onReversed={() => {
          setOpenEntry(null);
          router.refresh();
        }}
      />
    </ShellMain>
  );
}

/* ---- Entry drawer (with the only correction there is: a reversal) -------- */

function EntryDrawer({
  entry,
  canManage,
  onClose,
  onReversed,
}: {
  entry: JournalEntry | null;
  canManage: boolean;
  onClose: () => void;
  onReversed: () => void;
}) {
  const { requestStepUp, stepUpPrompt } = useStepUpAction();
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => setReason(''), [entry?.id]);

  // The server refuses to reverse anything a subledger event posted — the
  // correction has to go through the record that caused it. Offering the button
  // anyway would walk the operator through an MFA challenge to reach a refusal.
  const canReverse =
    canManage &&
    !!entry &&
    entry.status !== 'reversed' &&
    !SUBLEDGER_SOURCES.includes(entry.sourceType);

  const reverse = () => {
    if (!entry) return;
    requestStepUp(
      {
        operation: STEP_UP_OPERATION.FINANCIAL_JOURNAL_REVERSE,
        title: 'Reverse a journal entry',
        description:
          'Confirm your identity to post a contra entry. The original stays exactly as posted.',
      },
      async (challengeId) => {
        setBusy(true);
        try {
          const res = await authedFetch(
            `/api/finance/ledger/entries/${entry.id}/reverse`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                reason: reason.trim() || undefined,
                stepUpChallengeId: challengeId,
              }),
            },
          );
          if (!res.ok) {
            const detail = (await res.json().catch(() => null)) as {
              message?: string;
            } | null;
            throw new Error(
              detail?.message ?? `Request failed (${res.status})`,
            );
          }
          toast.success('Reversal posted');
          onReversed();
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : 'Could not reverse the entry',
          );
        } finally {
          setBusy(false);
        }
      },
    );
  };

  return (
    <>
      <Sheet open={!!entry} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{entry?.entryNumber ?? 'Journal entry'}</DrawerTitle>
            <SheetDescription>
              {entry?.memo ?? 'The two sides of this entry'}
            </SheetDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Account</th>
                  <th className="py-2 pr-3 text-right font-medium">Debit</th>
                  <th className="py-2 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody>
                {(entry?.lines ?? []).map((line) => (
                  <tr key={line.id} className="border-t border-border">
                    <td className="py-2 pr-3">
                      <span className="text-foreground">
                        {line.accountName}
                      </span>
                      {line.description ? (
                        <span className="block text-xs text-muted-foreground">
                          {line.description}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {line.debit ? nairaFromKobo(line.debit) : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {line.credit ? nairaFromKobo(line.credit) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {canReverse ? (
              <div className="mt-5 flex flex-col gap-1.5">
                <Label htmlFor="rev-reason">Reason for reversing</Label>
                <Input
                  id="rev-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. recorded against the wrong family"
                />
              </div>
            ) : null}
          </div>

          <DrawerFooter className="flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {canReverse ? (
              <Button size="sm" onClick={reverse} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Undo2 />}{' '}
                Reverse
              </Button>
            ) : null}
          </DrawerFooter>
        </DrawerContent>
      </Sheet>
      {stepUpPrompt}
    </>
  );
}

/* ---- Periods ------------------------------------------------------------ */

function PeriodsCard({
  periods,
  canManage,
  onChanged,
}: {
  periods: Period[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const { requestStepUp, stepUpPrompt } = useStepUpAction();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const setStatus = (period: Period, status: 'open' | 'closed') => {
    requestStepUp(
      {
        operation: STEP_UP_OPERATION.FINANCIAL_PERIOD_CLOSE,
        title: status === 'closed' ? 'Close the period' : 'Reopen the period',
        description:
          status === 'closed'
            ? 'Confirm your identity to lock this period. Nothing can post into it afterwards.'
            : 'Confirm your identity to reopen this period for posting.',
      },
      async (challengeId) => {
        setBusyId(period.id);
        try {
          const res = await authedFetch(
            `/api/finance/ledger/periods/${period.id}`,
            {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ status, stepUpChallengeId: challengeId }),
            },
          );
          if (!res.ok) {
            const detail = (await res.json().catch(() => null)) as {
              message?: string;
            } | null;
            throw new Error(
              detail?.message ?? `Request failed (${res.status})`,
            );
          }
          toast.success(
            status === 'closed' ? 'Period closed' : 'Period reopened',
          );
          onChanged();
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : 'Could not change the period',
          );
        } finally {
          setBusyId(null);
        }
      },
    );
  };

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Accounting periods</CardTitle>
          <CardDescription>
            A closed period refuses new postings — corrections have to be dated
            in an open one
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {periods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No periods defined. Entries still post; defining periods is what
              lets you close a term.
            </p>
          ) : (
            periods.map((period) => (
              <div
                key={period.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 p-2.5"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {period.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatDate(period.startDate)} –{' '}
                    {formatDate(period.endDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    tone={period.status === 'closed' ? 'neutral' : 'success'}
                  >
                    {period.status === 'closed' ? 'Closed' : 'Open'}
                  </StatusBadge>
                  {canManage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={
                        period.status === 'closed'
                          ? `Reopen ${period.name}`
                          : `Close ${period.name}`
                      }
                      disabled={busyId === period.id}
                      onClick={() =>
                        setStatus(
                          period,
                          period.status === 'closed' ? 'open' : 'closed',
                        )
                      }
                    >
                      {period.status === 'closed' ? <LockOpen /> : <Lock />}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      {stepUpPrompt}
    </>
  );
}

function NewPeriodDialog({ onSaved }: { onSaved: () => void }) {
  // Defining a period is step-up gated server-side, like closing one. Without
  // the challenge the dialog could never succeed — the guard rejects it before
  // the handler runs, and the operator gets a red toast with no way forward.
  const { requestStepUp, stepUpPrompt } = useStepUpAction();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName('');
    setStartDate('');
    setEndDate('');
  }, [open]);

  const save = () => {
    requestStepUp(
      {
        operation: STEP_UP_OPERATION.FINANCIAL_PERIOD_CLOSE,
        title: 'Define an accounting period',
        description:
          'Confirm your identity to define a period. Closing it later locks everything dated inside it.',
      },
      async (challengeId) => {
        setBusy(true);
        try {
          const res = await authedFetch('/api/finance/ledger/periods', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              name: name.trim(),
              startDate,
              endDate,
              stepUpChallengeId: challengeId,
            }),
          });
          if (!res.ok) {
            const detail = (await res.json().catch(() => null)) as {
              message?: string;
            } | null;
            throw new Error(
              detail?.message ?? `Request failed (${res.status})`,
            );
          }
          toast.success('Period defined');
          setOpen(false);
          onSaved();
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : 'Could not define the period',
          );
        } finally {
          setBusy(false);
        }
      },
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> Define period
        </Button>
        <DrawerContent>
          <DrawerHeader className="gap-1.5">
            <DrawerTitle className="pr-8">
              Define an accounting period
            </DrawerTitle>
            <SheetDescription className="text-[calc(12.5px*var(--font-scale))]">
              Periods are how a term&apos;s books get closed. Entries are
              stamped with the period their date falls in.
            </SheetDescription>
          </DrawerHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="np-name">Name</Label>
                <Input
                  id="np-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="First Term 2026/27"
                />
              </div>
              <div className="grid gap-3 @md/main:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="np-start">Starts</Label>
                  <Input
                    id="np-start"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="np-end">Ends</Label>
                  <Input
                    id="np-end"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <DrawerFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={busy || !name.trim() || !startDate || !endDate}
            >
              {busy ? <Loader2 className="animate-spin" /> : null} Define period
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Sheet>
      {stepUpPrompt}
    </>
  );
}
