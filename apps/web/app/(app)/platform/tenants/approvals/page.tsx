'use client';

/* ============================================================
   /platform/tenants/approvals — pending tenant-action queue

   Tenant activate/suspend raised by a SuperAdmin lands here for an
   Architect to approve or reject. An Architect's own actions apply
   directly and never appear in this queue. Approving requires a fresh
   step-up, mirroring the action it confirms.
   ============================================================ */

import { useState } from 'react';
import useSWR from 'swr';
import { ClipboardCheck, Check, X } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { StateTone } from '@workspace/ui/types/states.types';
import { RefreshButton } from '../../../_shared/refresh-button';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { useStepUpAction } from '../../../_shared/use-step-up-action';

interface PendingApproval {
  id: string;
  makerId: string;
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
  const requests = data ?? [];

  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { requestStepUp, stepUpPrompt } = useStepUpAction();

  const error =
    actionError ??
    (loadError instanceof Error
      ? loadError.message
      : loadError
        ? 'Failed to load approvals'
        : null);

  async function approve(id: string, stepUpChallengeId: string) {
    setBusyId(id);
    setActionError(null);
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
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong');
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

  async function reject(id: string) {
    const reason = window.prompt('Reason for rejecting this request?');
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setActionError('A rejection reason is required.');
      return;
    }
    setBusyId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/platform/approvals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || body?.message || 'Failed to reject');
      }
      await mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ClipboardCheck className="size-5" /> Approvals
          </h1>
          <p className="text-sm text-muted-foreground">
            {requests.length} pending tenant action
            {requests.length === 1 ? '' : 's'}
          </p>
        </div>
        <RefreshButton onRefresh={() => void mutate()} refreshing={refreshing} />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Pending tenant actions</CardTitle>
          <CardDescription>
            Raised by a platform admin; confirm or reject each one. Your own
            actions apply directly and never appear here.
          </CardDescription>
        </CardHeader>
        <CardContent
          className={
            requests.length
              ? 'px-0 [&_:is(th,td):first-child]:pl-6 [&_:is(th,td):last-child]:pr-6'
              : undefined
          }
        >
          {error ? (
            <p className="px-6 pb-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
          ) : requests.length === 0 ? (
            <EmptyState
              compact
              title="Nothing to approve"
              description="Tenant actions awaiting confirmation will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <StatusBadge
                        tone={ACTION_TONE[r.status] ?? 'neutral'}
                        dot
                      >
                        {r.status === 'active' ? 'Activate' : 'Suspend'}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.targetTenantId}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.reason ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
                          onClick={() => void reject(r.id)}
                        >
                          <X className="size-4" /> Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {stepUpPrompt}
    </div>
  );
}
