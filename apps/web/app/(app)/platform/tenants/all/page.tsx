'use client';

/* ============================================================
   /platform/tenants/all — all schools (Platform console, G3)

   Lists every school with status, lets the architect activate /
   suspend, and invite a school's first owner (interim link sharing).
   ============================================================ */

import Link from 'next/link';
import { Fragment, useState } from 'react';
import useSWR from 'swr';
import { Building2, Plus, UserPlus } from 'lucide-react';
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
import { InviteUser } from '../../../_shared/invite-user';
import { RefreshButton } from '../../../_shared/refresh-button';

interface School {
  id: string;
  name: string;
  slug: string;
  status: string;
  schoolType: string | null;
  emailDomain: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<string, StateTone> = {
  active: 'success',
  pending: 'info',
  suspended: 'warning',
};

export default function AllSchoolsPage() {
  const {
    data,
    error: loadError,
    isLoading: loading,
    isValidating: refreshing,
    mutate,
  } = useSWR<{ data: School[] }>('/api/platform/schools?limit=100');
  const schools = data?.data ?? [];

  // Load failures come from SWR; action failures (activate/suspend) are local.
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteFor, setInviteFor] = useState<string | null>(null);

  const error =
    actionError ??
    (loadError instanceof Error
      ? loadError.message
      : loadError
        ? 'Failed to load schools'
        : null);

  async function setStatus(id: string, status: 'active' | 'suspended') {
    setBusyId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/platform/schools/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to update status');
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
            <Building2 className="size-5" /> Schools
          </h1>
          <p className="text-sm text-muted-foreground">
            {schools.length} school{schools.length === 1 ? '' : 's'} on the
            platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton
            onRefresh={() => void mutate()}
            refreshing={refreshing}
          />
          <Button asChild>
            <Link href="/platform/tenants/onboarding">
              <Plus className="size-4" /> Onboard school
            </Link>
          </Button>
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">All schools</CardTitle>
          <CardDescription>
            Activate a pending school, then invite its owner.
          </CardDescription>
        </CardHeader>
        <CardContent
          className={
            schools.length
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
          ) : schools.length === 0 ? (
            <EmptyState
              compact
              title="No schools yet"
              description="Onboard your first school to get started."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((s) => (
                  <Fragment key={s.id}>
                    <TableRow>
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.slug}
                          {s.emailDomain ? ` · ${s.emailDomain}` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {s.schoolType?.replace('_', ' ') ?? '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={STATUS_TONE[s.status] ?? 'neutral'} dot>
                          {s.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {s.status !== 'active' ? (
                            <Button
                              size="sm"
                              disabled={busyId === s.id}
                              onClick={() => setStatus(s.id, 'active')}
                            >
                              Activate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === s.id}
                              onClick={() => setStatus(s.id, 'suspended')}
                            >
                              Suspend
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setInviteFor(inviteFor === s.id ? null : s.id)
                            }
                          >
                            <UserPlus className="size-4" /> Invite owner
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {inviteFor === s.id ? (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <InviteUser
                            tenantId={s.id}
                            defaultRoleName="Owner"
                            maxClearance={8}
                            onInvited={() => undefined}
                          />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
