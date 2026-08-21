'use client';

/* ============================================================
   /platform/tenants/approvals — pending tenant-action queue

   Tenant activate/suspend raised by a SuperAdmin lands here for an
   Architect to approve or reject. An Architect's own actions apply
   directly and never appear in this queue. Approving requires a fresh
   step-up, mirroring the action it confirms; rejecting captures a reason
   in a dialog. Built on the reusable DirectoryTable.
   ============================================================ */

import * as React from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { ClipboardCheck, Check, X } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { PageTitle } from '@workspace/ui/custom/shell/page-title';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { RefreshButton } from '../../../_shared/refresh-button';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { useStepUpAction } from '../../../_shared/use-step-up-action';
import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

interface PendingApproval {
  id: string;
  makerId: string;
  /**
   * True when the signed-in operator raised this request. Decided by the API,
   * which owns the same maker-checker rule it enforces. `undefined` reads as
   * "not mine", leaving the API as the backstop.
   */
  isOwnRequest?: boolean;
  makerClearanceLevel: number;
  targetTenantId: string;
  status: 'active' | 'suspended';
  reason: string | null;
  createdAt: string;
  expiresAt: string | null;
}

const ACTION_TONE: Record<string, StateTone> = {
  active: 'success',
  suspended: 'warning',
};

export default function TenantApprovalsPage() {
  const {
    data,
    error: loadError,
    isLoading: loading,
    isValidating: refreshing,
    mutate,
  } = useSWR<PendingApproval[]>('/api/platform/approvals');
  const requests = React.useMemo(() => data ?? [], [data]);

  const [busyId, setBusyId] = React.useState<string | null>(null);
  const { requestStepUp, stepUpPrompt } = useStepUpAction();

  const [rejectFor, setRejectFor] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [rejecting, setRejecting] = React.useState(false);

  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  async function approve(id: string, stepUpChallengeId: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/platform/approvals/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepUpChallengeId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || body?.message || 'Failed to approve');
      }
      await mutate();
      toast.success('Request approved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  }

  function confirmApprove(id: string, action: 'active' | 'suspended') {
    requestStepUp(
      {
        operation: STEP_UP_OPERATION.TENANT_SUSPEND,
        title: `Approve ${action === 'active' ? 'activation' : 'suspension'}?`,
        description:
          'This confirms a change to an entire tenant’s access and requires a fresh identity confirmation.',
      },
      (challengeId) => approve(id, challengeId),
    );
  }

  async function submitReject() {
    if (!rejectFor) return;
    if (rejectReason.trim().length < 3) {
      toast.error('A rejection reason is required.');
      return;
    }
    setRejecting(true);
    setBusyId(rejectFor);
    try {
      const res = await fetch(`/api/platform/approvals/${rejectFor}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || body?.message || 'Failed to reject');
      }
      await mutate();
      toast.success('Request rejected');
      setRejectFor(null);
      setRejectReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setRejecting(false);
      setBusyId(null);
    }
  }

  const columns: DirectoryColumn<PendingApproval>[] = [
    {
      id: 'action',
      header: 'Action',
      sortable: true,
      cell: (r) => (
        <StatusBadge tone={ACTION_TONE[r.status] ?? 'neutral'} dot>
          {r.status === 'active' ? 'Activate' : 'Suspend'}
        </StatusBadge>
      ),
    },
    {
      id: 'tenant',
      header: 'Tenant',
      hideable: true,
      cell: (r) => (
        <span className="font-mono text-xs">{r.targetTenantId}</span>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      hideable: true,
      // Free text with no length bound.
      truncate: true,
      cell: (r) => (
        <span className="text-sm text-muted-foreground">{r.reason ?? '—'}</span>
      ),
    },
    {
      id: 'createdAt',
      header: 'Requested',
      sortable: true,
      hideable: true,
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {new Date(r.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'decision',
      header: 'Decision',
      align: 'end',
      cell: (r) => (
        <div className="flex items-center justify-end gap-2">
          {r.isOwnRequest ? (
            // Maker ≠ checker: no Approve for your own request. Withdrawing
            // it is a cancellation, not a refusal by a second authority.
            <Button
              size="sm"
              variant="outline"
              disabled={busyId === r.id}
              onClick={() => setRejectFor(r.id)}
            >
              <X className="size-4" /> Cancel request
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                disabled={busyId === r.id}
                onClick={() => confirmApprove(r.id, r.status)}
              >
                <Check className="size-4" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === r.id}
                onClick={() => setRejectFor(r.id)}
              >
                <X className="size-4" /> Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const action = filters.action;
    let out = requests.filter((r) => {
      const matchesQ =
        !q ||
        r.targetTenantId.toLowerCase().includes(q) ||
        (r.reason?.toLowerCase().includes(q) ?? false) ||
        r.makerId.toLowerCase().includes(q);
      const matchesAction = !action || r.status === action;
      return matchesQ && matchesAction;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'action'
          ? dir * a.status.localeCompare(b.status)
          : dir * a.createdAt.localeCompare(b.createdAt),
      );
    }
    return out;
  }, [requests, term, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-6 text-primary" />
            <PageTitle>Approvals</PageTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {requests.length} pending tenant action
            {requests.length === 1 ? '' : 's'}
          </p>
        </div>
        <RefreshButton
          onRefresh={() => void mutate()}
          refreshing={refreshing}
        />
      </div>

      <DirectoryTable<PendingApproval>
        title="Pending tenant actions"
        description="Raised by a platform admin; confirm or reject each one. Your own actions apply directly and never appear here."
        columns={columns}
        rows={pageRows}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.targetTenantId}
        total={filtered.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sort={sort}
        onSortChange={(field) =>
          setSort((cur) =>
            cur?.field !== field
              ? { field, dir: 'asc' }
              : cur.dir === 'asc'
                ? { field, dir: 'desc' }
                : null,
          )
        }
        loading={loading}
        error={loadError ? 'Failed to load approvals' : undefined}
        onRetry={() => void mutate()}
        caption="Pending tenant actions"
        search={{
          value: term,
          onChange: setTerm,
          placeholder: 'Search tenant, reason…',
          label: 'Search approvals',
          id: 'approvals-search',
        }}
        filters={[
          {
            key: 'action',
            label: 'Action',
            options: [
              { value: 'active', label: 'Activate' },
              { value: 'suspended', label: 'Suspend' },
            ],
          },
        ]}
        filterValues={filters}
        onFilterChange={(key, value) =>
          setFilters((f) => ({ ...f, [key]: value }))
        }
        onClearFilters={() => setFilters({})}
        emptyState={
          <EmptyState
            compact
            title={
              hasQuery ? 'No requests match your filters' : 'Nothing to approve'
            }
            description={
              hasQuery
                ? 'Try a different search term, or clear the filters.'
                : 'Tenant actions awaiting confirmation will appear here.'
            }
          />
        }
      />

      <Dialog
        open={rejectFor !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectFor(null);
            setRejectReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this request?</DialogTitle>
            <DialogDescription>
              Give the maker a reason. This is recorded on the request.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this being rejected?"
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void submitReject()}
              disabled={rejecting || rejectReason.trim().length < 3}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {stepUpPrompt}
    </div>
  );
}
