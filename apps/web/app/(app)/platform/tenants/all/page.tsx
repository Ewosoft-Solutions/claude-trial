'use client';

/* ============================================================
   /platform/tenants/all — all schools (Platform console, G3)

   Lists every school with status, lets the architect activate /
   suspend (step-up gated), and invite a school's first owner via a
   dialog. Built on the reusable DirectoryTable (search + Status/Type
   filters collapse into the Filters button); the schools list comes
   from SWR in full, so filtering/sorting/paging run in-memory.
   ============================================================ */

import Link from 'next/link';
import * as React from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Building2, Plus, UserPlus } from 'lucide-react';

import { Sheet, SheetDescription } from '@workspace/ui/components/sheet';
import {
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@workspace/ui/custom/detail/drawer-chrome';
import { Button } from '@workspace/ui/components/button';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { PageTitle } from '@workspace/ui/custom/shell/page-title';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { InviteUser } from '../../../_shared/invite-user';
import { RefreshButton } from '../../../_shared/refresh-button';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { useStepUpAction } from '../../../_shared/use-step-up-action';
import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function AllSchoolsPage() {
  const {
    data,
    error: loadError,
    isLoading: loading,
    isValidating: refreshing,
    mutate,
  } = useSWR<{ data: School[] }>('/api/platform/schools?limit=100');
  const schools = React.useMemo(() => data?.data ?? [], [data]);

  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [inviteFor, setInviteFor] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const { requestStepUp, stepUpPrompt } = useStepUpAction();

  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  async function setStatus(
    id: string,
    status: 'active' | 'suspended',
    stepUpChallengeId: string,
  ) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/platform/schools/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, stepUpChallengeId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to update status');
      }
      await mutate();
      toast.success(
        `School ${status === 'active' ? 'activated' : 'suspended'}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  }

  function confirmStatus(id: string, status: 'active' | 'suspended') {
    requestStepUp(
      {
        operation: STEP_UP_OPERATION.TENANT_SUSPEND,
        title: `${status === 'active' ? 'Activate' : 'Suspend'} this school?`,
        description:
          'This changes access for an entire tenant and requires a fresh identity confirmation.',
      },
      (challengeId) => setStatus(id, status, challengeId),
    );
  }

  const types = React.useMemo(
    () =>
      Array.from(
        new Set(schools.map((s) => s.schoolType).filter(Boolean) as string[]),
      ).sort(),
    [schools],
  );

  const columns: DirectoryColumn<School>[] = [
    {
      id: 'name',
      header: 'School',
      sortable: true,
      cell: (s) => (
        <div className="flex min-w-0 flex-col">
          <Link
            href={`/platform/tenants/${s.id}`}
            className="break-words font-medium text-foreground underline-offset-4 hover:underline"
          >
            {s.name}
          </Link>
          <span className="break-words text-xs text-muted-foreground">
            {s.slug}
            {s.emailDomain ? ` · ${s.emailDomain}` : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'schoolType',
      header: 'Type',
      hideable: true,
      cell: (s) => (
        <span className="capitalize text-muted-foreground">
          {s.schoolType?.replace('_', ' ') ?? '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (s) => (
        <StatusBadge
          tone={STATUS_TONE[s.status] ?? 'neutral'}
          dot
          className="capitalize"
        >
          {s.status}
        </StatusBadge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'end',
      cell: (s) => (
        <div className="flex justify-end gap-2">
          {s.status !== 'active' ? (
            <Button
              size="sm"
              disabled={busyId === s.id}
              onClick={() => confirmStatus(s.id, 'active')}
            >
              Activate
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busyId === s.id}
              onClick={() => confirmStatus(s.id, 'suspended')}
            >
              Suspend
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setInviteFor({ id: s.id, name: s.name })}
          >
            <UserPlus className="size-4" /> Invite owner
          </Button>
        </div>
      ),
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const status = filters.status;
    const type = filters.type;
    let out = schools.filter((s) => {
      const matchesQ =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.emailDomain?.toLowerCase().includes(q) ?? false);
      const matchesStatus = !status || s.status === status;
      const matchesType = !type || s.schoolType === type;
      return matchesQ && matchesStatus && matchesType;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'status'
          ? dir * a.status.localeCompare(b.status)
          : dir * a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [schools, term, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="size-6 text-primary" />
            <PageTitle>Schools</PageTitle>
          </div>
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

      <DirectoryTable<School>
        title="All schools"
        description="Activate a pending school, then invite its owner."
        columns={columns}
        rows={pageRows}
        getRowId={(s) => s.id}
        getRowLabel={(s) => s.name}
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
        error={loadError ? 'Failed to load schools' : undefined}
        onRetry={() => void mutate()}
        caption="All schools on the platform"
        search={{
          value: term,
          onChange: setTerm,
          placeholder: 'Search name, slug, domain…',
          label: 'Search schools',
          id: 'schools-search',
        }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'pending', label: 'Pending' },
              { value: 'suspended', label: 'Suspended' },
            ],
          },
          ...(types.length > 0
            ? [
                {
                  key: 'type',
                  label: 'Type',
                  options: types.map((t) => ({
                    value: t,
                    label: cap(t.replace('_', ' ')),
                  })),
                },
              ]
            : []),
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
              hasQuery ? 'No schools match your filters' : 'No schools yet'
            }
            description={
              hasQuery
                ? 'Try a different search term, or clear the filters.'
                : 'Onboard your first school to get started.'
            }
          />
        }
      />

      <Sheet
        open={inviteFor !== null}
        onOpenChange={(open) => {
          if (!open) setInviteFor(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader className="gap-1.5">
            <DrawerTitle className="pr-8">
              Invite owner{inviteFor ? ` — ${inviteFor.name}` : ''}
            </DrawerTitle>
            <SheetDescription className="text-[calc(12.5px*var(--font-scale))]">
              Create an invitation for this school&rsquo;s first owner and share
              the accept link.
            </SheetDescription>
          </DrawerHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            {inviteFor ? (
              <InviteUser
                tenantId={inviteFor.id}
                defaultRoleName="Owner"
                maxClearance={8}
                onInvited={() => void mutate()}
              />
            ) : null}
          </div>
        </DrawerContent>
      </Sheet>

      {stepUpPrompt}
    </div>
  );
}
