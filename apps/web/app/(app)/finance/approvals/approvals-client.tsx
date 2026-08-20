'use client';

/* ============================================================
   ApprovalsClient — the discount queue

   Oldest first, because this is a queue and not a feed: the request that has
   been waiting longest is the one someone is chasing.

   Approving is deliberately NOT one click from the row. A discount reduces
   what a family owes, and maker ≠ checker is enforced by the API — so the
   decision opens a modal that states the amount, what it is being taken off,
   and why it was asked for. A row-level "approve" button invites approving a
   list rather than a request.
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

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
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { useDirectoryState } from '@workspace/ui/hooks/use-directory-state';
import type { StateTone } from '@workspace/ui/types/states.types';

import { apiErrorMessage } from '@/lib/api-client';
import { authedFetch } from '@/lib/authed-fetch';
import { formatNaira as naira } from '@/lib/format';

export interface ApprovalRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  student: string | null;
  termName: string | null;
  type: string;
  status: string;
  amount: number;
  reason: string | null;
  outstanding: number;
  requestedAt: string;
}

const STATUS_TONE: Record<string, StateTone> = {
  pending: 'warning',
  approved: 'success',
  applied: 'success',
  rejected: 'neutral',
};

/** How long it has been waiting — the thing a queue is judged on. */
function waitingFor(iso: string): string {
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86_400_000,
  );
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

export function ApprovalsClient({
  rows,
  total,
  defaultPageSize,
  canManage,
  currentStatus,
}: {
  rows: ApprovalRow[];
  total: number;
  defaultPageSize: number;
  canManage: boolean;
  currentStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = React.useCallback(
    (qs: string) => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const {
    state,
    setFilter,
    setFilters,
    setPage,
    setPageSize,
    toggleSort,
  } = useDirectoryState({
    searchParams,
    onChange,
    defaults: { pageSize: defaultPageSize },
  });

  const columns: DirectoryColumn<ApprovalRow>[] = [
    {
      id: 'invoice',
      header: 'Request',
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-medium text-foreground">
            {row.student ?? 'Unnamed'}
          </span>
          <Link
            href={`/finance/invoices/${row.invoiceId}`}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            {row.invoiceNumber}
          </Link>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => <span className="capitalize">{row.type}</span>,
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: (row) => (
        <span className="text-muted-foreground">{row.reason ?? '—'}</span>
      ),
    },
    {
      id: 'amount',
      header: 'Discount',
      align: 'end',
      cell: (row) => (
        <span className="tabular-nums font-medium">{naira(row.amount)}</span>
      ),
    },
    {
      id: 'outstanding',
      header: 'Of outstanding',
      align: 'end',
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {naira(row.outstanding)}
        </span>
      ),
    },
    {
      id: 'waiting',
      header: 'Waiting',
      cell: (row) => (
        <span className="text-muted-foreground">
          {waitingFor(row.requestedAt)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusBadge tone={STATUS_TONE[row.status] ?? 'neutral'}>
          {row.status}
        </StatusBadge>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'decide',
            header: '',
            align: 'end' as const,
            cell: (row: ApprovalRow) =>
              row.status === 'pending' ? <DecideButtons row={row} /> : null,
          },
        ]
      : []),
  ];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Approvals"
          meta={[
            {
              key: 'what',
              label: 'Discounts awaiting a second authority',
            },
          ]}
        />

        <DirectoryTable<ApprovalRow>
          title="Discount requests"
          description="A discretionary discount needs someone other than the person who asked for it. Standing policies apply themselves on issue and never appear here."
          caption="Discount requests awaiting a decision"
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `${row.invoiceNumber} — ${naira(row.amount)}`}
          total={total}
          page={state.page}
          pageSize={state.pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sort={state.sort}
          onSortChange={toggleSort}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'pending', label: 'Waiting' },
                { value: 'approved', label: 'Approved' },
                { value: 'applied', label: 'Applied' },
                { value: 'rejected', label: 'Rejected' },
              ],
            },
          ]}
          filterValues={{ ...state.filters, status: currentStatus }}
          onFilterChange={setFilter}
          onClearFilters={() => setFilters({})}
          emptyState={
            <EmptyState
              compact
              title={
                currentStatus === 'pending'
                  ? 'Nothing waiting'
                  : 'No requests match this filter'
              }
              description={
                currentStatus === 'pending'
                  ? 'Discretionary discounts appear here as soon as someone asks for one.'
                  : 'Try a different status.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}

/**
 * The decision, and what it is being made about.
 *
 * One decision with fewer than five fields, and it must not scroll — a modal
 * by §3. Rejecting asks for a reason because the person who requested it will
 * want to know why; approving does not, because the amount IS the answer.
 */
function DecideButtons({ row }: { row: ApprovalRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState<null | 'approve' | 'reject'>(null);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const decide = async () => {
    if (!open) return;
    setBusy(true);
    try {
      const res = await authedFetch(
        `/api/finance/adjustments/${row.id}/${open}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            open === 'reject' ? { reason: reason.trim() || undefined } : {},
          ),
        },
      );
      // The API refuses when the approver is the person who asked (maker ≠
      // checker). Saying exactly that beats a bare status code.
      if (!res.ok) {
        throw new Error(await apiErrorMessage(res, 'Could not record decision'));
      }
      toast.success(open === 'approve' ? 'Discount approved' : 'Request rejected');
      setOpen(null);
      setReason('');
      router.refresh();
    } catch (e) {
      // The maker ≠ checker rule surfaces here: the API refuses when the
      // approver is the person who asked, and saying so plainly beats a
      // generic failure.
      toast.error(e instanceof Error ? e.message : 'Could not record decision');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen('reject')}>
          <X aria-hidden /> Reject
        </Button>
        <Button size="sm" onClick={() => setOpen('approve')}>
          <Check aria-hidden /> Approve
        </Button>
      </div>

      <Dialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open === 'approve' ? 'Approve this discount?' : 'Reject this request?'}
            </DialogTitle>
            <DialogDescription>
              {naira(row.amount)} off {row.invoiceNumber}
              {row.student ? ` for ${row.student}` : ''}, which currently owes{' '}
              {naira(row.outstanding)}.
              {row.reason ? ` Asked for: “${row.reason}”.` : ''}
            </DialogDescription>
          </DialogHeader>
          {open === 'reject' ? (
            <div className="flex flex-col gap-1.5 py-2">
              <Label htmlFor="reject-reason">
                Reason{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why this was not approved"
                autoComplete="off"
              />
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              size="sm"
              variant={open === 'reject' ? 'destructive' : 'default'}
              disabled={busy}
              onClick={() => void decide()}
            >
              {open === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
