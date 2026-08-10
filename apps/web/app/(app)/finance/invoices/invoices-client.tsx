'use client';

/* ============================================================
   InvoicesClient — fee invoices (server-driven table)

   Search (invoice # / student name) / status filter / sort / paging live in
   the URL and run at the DB via `useDirectoryState` + `DirectoryTable`; the
   client never filters the fetched page. Stat tiles come from the whole-set
   invoice summary passed by the server.
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { Download, Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { useDirectoryState } from '@workspace/ui/hooks/use-directory-state';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { StatItem } from '@workspace/ui/types/layout.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

import { authedFetch } from '@/lib/authed-fetch';
import { formatNaira as nairaFromKobo } from '@/lib/format';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { useStepUpAction } from '../../_shared/use-step-up-action';

export interface StudentOption {
  id: string;
  name: string;
  studentNumber?: string;
}

export type InvoiceStatus =
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'draft'
  | 'issued'
  | 'cancelled';

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  studentId?: string;
  student?: string;
  className?: string;
  issued?: string;
  due?: string;
  /** Amount due in kobo (minor units). */
  amountDue?: number;
  amountPaid?: number;
  /** Derived: gross (Σ lines), applied discounts, and the outstanding balance. */
  gross?: number;
  discounts?: number;
  balance?: number;
  status: InvoiceStatus;
}

export interface InvoiceStats {
  billed: number;
  discounts: number;
  collected: number;
  outstanding: number;
  overdue: number;
}

const STATUS_META: Record<InvoiceStatus, { label: string; tone: StateTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partial: { label: 'Part-paid', tone: 'info' },
  overdue: { label: 'Overdue', tone: 'destructive' },
  draft: { label: 'Draft', tone: 'neutral' },
  issued: { label: 'Issued', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'cycle', label: 'billing cycle 1' },
];

/** Compact Naira formatting from kobo (minor units). */
interface Props {
  invoices: Invoice[];
  total: number;
  defaultPageSize: number;
  stats: InvoiceStats;
  students: StudentOption[];
  canManage: boolean;
}

export function InvoicesClient({
  invoices,
  total,
  defaultPageSize,
  stats,
  students,
  canManage,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = React.useCallback(
    (qs: string) => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const defaults = React.useMemo(
    () => ({ pageSize: defaultPageSize }),
    [defaultPageSize],
  );
  const {
    state,
    setPage,
    setPageSize,
    toggleSort,
    setQuery,
    setFilter,
    setFilters,
  } = useDirectoryState({
    searchParams: searchParams.toString(),
    onChange,
    defaults,
  });

  const [term, setTerm] = React.useState(state.q);
  React.useEffect(() => setTerm(state.q), [state.q]);
  React.useEffect(() => {
    if (term === state.q) return;
    const id = setTimeout(() => setQuery(term), 300);
    return () => clearTimeout(id);
  }, [term, state.q, setQuery]);

  const statusFilter = state.filters.status ?? 'all';
  const hasFilters = state.q.trim() !== '' || statusFilter !== 'all';

  const collectionRate =
    stats.billed > 0 ? Math.round((stats.collected / stats.billed) * 100) : 0;
  const statItems: StatItem[] = [
    {
      key: 'billed',
      label: 'Total billed',
      value: nairaFromKobo(stats.billed),
    },
    {
      key: 'discounts',
      label: 'Discounts',
      value: nairaFromKobo(stats.discounts),
    },
    {
      key: 'collected',
      label: 'Collected',
      value: nairaFromKobo(stats.collected),
      delta:
        stats.billed > 0
          ? { label: `${collectionRate}%`, direction: 'up', intent: 'positive' }
          : undefined,
    },
    {
      key: 'outstanding',
      label: 'Outstanding',
      value: nairaFromKobo(stats.outstanding),
    },
    {
      key: 'overdue',
      label: 'Overdue invoices',
      value: String(stats.overdue),
      delta:
        stats.overdue > 0
          ? { label: 'past due', direction: 'up', intent: 'negative' }
          : undefined,
    },
  ];

  const columns: DirectoryColumn<Invoice>[] = [
    {
      id: 'studentName',
      header: 'Invoice',
      sortable: true,
      cell: (inv) => (
        <Link
          href={`/finance/invoices/${inv.id}`}
          className="flex min-w-0 flex-col hover:underline"
        >
          <span className="break-words font-medium text-foreground">
            {inv.student ?? inv.studentId ?? '—'}
          </span>
          <span className="break-words text-xs text-muted-foreground">
            {inv.invoiceNumber ?? inv.id}
          </span>
        </Link>
      ),
    },
    {
      id: 'className',
      header: 'Class',
      hideable: true,
      cell: (inv) => (
        <span className="text-muted-foreground">{inv.className ?? '—'}</span>
      ),
    },
    {
      id: 'dueDate',
      header: 'Due',
      sortable: true,
      cell: (inv) => (
        <span className="text-muted-foreground">{inv.due ?? '—'}</span>
      ),
    },
    {
      id: 'amountDue',
      header: 'Billed',
      align: 'end',
      sortable: true,
      cell: (inv) => (
        <div className="flex flex-col items-end">
          <span className="tabular-nums text-foreground">
            {inv.gross ? nairaFromKobo(inv.gross) : '—'}
          </span>
          {inv.discounts ? (
            <span className="tabular-nums text-xs text-muted-foreground">
              −{nairaFromKobo(inv.discounts)} disc
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'amountPaid',
      header: 'Paid',
      align: 'end',
      sortable: true,
      cell: (inv) => (
        <span className="tabular-nums text-muted-foreground">
          {inv.gross ? nairaFromKobo(inv.amountPaid ?? 0) : '—'}
        </span>
      ),
    },
    {
      id: 'balance',
      header: 'Balance',
      align: 'end',
      cell: (inv) => (
        <span className="tabular-nums font-medium text-foreground">
          {inv.balance != null ? nairaFromKobo(inv.balance) : '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (inv) => {
        const meta = STATUS_META[inv.status] ?? STATUS_META.draft;
        return (
          <StatusBadge
            tone={meta.tone}
            dot={inv.status !== 'draft' && inv.status !== 'cancelled'}
          >
            {meta.label}
          </StatusBadge>
        );
      },
    },
  ];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Invoices"
          meta={META}
          actions={
            <>
              <Button variant="outline" size="sm">
                <Download /> Export
              </Button>
              {canManage ? <NewInvoiceDialog students={students} /> : null}
            </>
          }
        />

        <StatGrid items={statItems} />

        <DirectoryTable<Invoice>
          columns={columns}
          rows={invoices}
          getRowId={(inv) => inv.id}
          getRowLabel={(inv) => inv.invoiceNumber ?? inv.id}
          total={total}
          page={state.page}
          pageSize={state.pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sort={state.sort}
          onSortChange={toggleSort}
          title="Fee invoices"
          description={`${total} ${total === 1 ? 'invoice' : 'invoices'}`}
          caption="Fee invoices"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search invoice # or student…',
            label: 'Search invoices',
            id: 'invoice-search',
          }}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'paid', label: 'Paid' },
                { value: 'partial', label: 'Part-paid' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'issued', label: 'Issued' },
                { value: 'draft', label: 'Draft' },
              ],
            },
          ]}
          filterValues={state.filters}
          onFilterChange={setFilter}
          onClearFilters={() => setFilters({})}
          emptyState={
            <EmptyState
              compact
              title={
                hasFilters
                  ? 'No invoices match your filters'
                  : 'No invoices yet'
              }
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters to see every invoice.'
                  : 'Run the dev operational seed or create an invoice.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}

/* ---- New invoice (step-up-gated create) --------------------------------- */

function NewInvoiceDialog({ students }: { students: StudentOption[] }) {
  const router = useRouter();
  const { requestStepUp, stepUpPrompt } = useStepUpAction();
  const [open, setOpen] = React.useState(false);
  const [studentId, setStudentId] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [termName, setTermName] = React.useState('');
  const [termYear, setTermYear] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setStudentId('');
      setQuery('');
      setTermName('');
      setTermYear('');
      setDueDate('');
    }
  }, [open]);

  const selected = students.find((s) => s.id === studentId);
  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool =
      q === ''
        ? students
        : students.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              (s.studentNumber ?? '').toLowerCase().includes(q),
          );
    return pool.slice(0, 8);
  }, [students, query]);

  const create = () => {
    if (!studentId) return;
    const yearNum = Number(termYear.trim());
    requestStepUp(
      {
        operation: STEP_UP_OPERATION.FINANCIAL_FEE_STRUCTURE_UPDATE,
        title: 'Create a fee invoice',
        description:
          'Confirm your identity to create the invoice. You will add line items next.',
      },
      async (challengeId) => {
        setBusy(true);
        try {
          const res = await authedFetch('/api/finance/invoices', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              studentId,
              amountDue: 0,
              termName: termName.trim() || undefined,
              termYear:
                Number.isInteger(yearNum) && yearNum > 0 ? yearNum : undefined,
              dueDate: dueDate || undefined,
              stepUpChallengeId: challengeId,
            }),
          });
          if (!res.ok) {
            const d = (await res.json().catch(() => null)) as {
              message?: string;
            } | null;
            throw new Error(d?.message ?? `Request failed (${res.status})`);
          }
          const created = (await res.json()) as { id: string };
          toast.success('Draft invoice created — add line items');
          setOpen(false);
          router.push(`/finance/invoices/${created.id}`);
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : 'Could not create invoice',
          );
        } finally {
          setBusy(false);
        }
      },
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> New invoice
        </Button>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create a fee invoice</DialogTitle>
            <DialogDescription>
              Pick the student and term. The invoice starts as a draft with no
              amount — you compose its line items next, then issue it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ni-student">Student</Label>
              {selected ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 p-2.5">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {selected.name}
                    </span>
                    {selected.studentNumber ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {selected.studentNumber}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto shrink-0 p-0 font-medium"
                    onClick={() => setStudentId('')}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    id="ni-student"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name or number…"
                    autoComplete="off"
                  />
                  <div className="max-h-44 overflow-y-auto">
                    {matches.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-muted-foreground">
                        No matching students.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {matches.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              onClick={() => setStudentId(s.id)}
                              className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-left text-sm hover:border-ring/60 hover:bg-accent/40"
                            >
                              <span className="truncate">{s.name}</span>
                              {s.studentNumber ? (
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {s.studentNumber}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ni-term">
                  Term <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="ni-term"
                  value={termName}
                  onChange={(e) => setTermName(e.target.value)}
                  placeholder="Spring Term"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ni-year">
                  Year <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="ni-year"
                  inputMode="numeric"
                  value={termYear}
                  onChange={(e) => setTermYear(e.target.value)}
                  placeholder="2025"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ni-due">
                Due date{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="ni-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button size="sm" disabled={!studentId || busy} onClick={create}>
              Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {stepUpPrompt}
    </>
  );
}
