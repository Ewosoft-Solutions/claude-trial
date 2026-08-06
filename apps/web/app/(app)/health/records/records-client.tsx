'use client';

/* ============================================================
   RecordsClient — student health records (server-driven table)

   Search (student name) / status filter / sort / paging live in the URL and
   run at the DB via `useDirectoryState` + `DirectoryTable`; no in-memory
   filtering of the fetched page. Stat tiles come from the whole-set triage
   summary from the server.
   ============================================================ */

import * as React from 'react';
import { Search, UserPlus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
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

export type HealthStatus = 'normal' | 'monitoring' | 'urgent';

export interface HealthRecordRow {
  id: string;
  name: string;
  bloodType: string | null;
  allergies: string | null;
  status: HealthStatus;
  lastCheckup: string | null;
}

export interface HealthStats {
  total: number;
  normal: number;
  monitoring: number;
  urgent: number;
}

const STATUS_META: Record<HealthStatus, { label: string; tone: StateTone }> = {
  normal: { label: 'Normal', tone: 'success' },
  monitoring: { label: 'Monitoring', tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'destructive' },
};

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
];

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

interface Props {
  records: HealthRecordRow[];
  total: number;
  defaultPageSize: number;
  stats: HealthStats;
}

export function RecordsClient({
  records,
  total,
  defaultPageSize,
  stats,
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
  const { state, setPage, setPageSize, toggleSort, setQuery, setFilter } =
    useDirectoryState({
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

  const statItems: StatItem[] = [
    { key: 'total', label: 'Records', value: String(stats.total) },
    { key: 'normal', label: 'Normal', value: String(stats.normal) },
    { key: 'monitoring', label: 'Monitoring', value: String(stats.monitoring) },
    { key: 'urgent', label: 'Urgent', value: String(stats.urgent) },
  ];

  const columns: DirectoryColumn<HealthRecordRow>[] = [
    {
      id: 'name',
      header: 'Student',
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-[11px] font-semibold">
              {initials(r.name)}
            </AvatarFallback>
          </Avatar>
          <span className="break-words font-medium text-foreground">
            {r.name}
          </span>
        </div>
      ),
    },
    {
      id: 'bloodType',
      header: 'Blood type',
      hideable: true,
      cell: (r) => (
        <span className="text-muted-foreground">{r.bloodType ?? '—'}</span>
      ),
    },
    {
      id: 'allergies',
      header: 'Allergies',
      hideable: true,
      cell: (r) => (
        <span className="text-muted-foreground">{r.allergies ?? '—'}</span>
      ),
    },
    {
      id: 'lastCheckup',
      header: 'Last checkup',
      align: 'end',
      sortable: true,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {r.lastCheckup ?? '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (r) => {
        const meta = STATUS_META[r.status];
        return (
          <StatusBadge tone={meta.tone} dot>
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
          title="Health"
          meta={META}
          actions={
            <Button size="sm">
              <UserPlus /> New record
            </Button>
          }
        />

        <StatGrid items={statItems} />

        <DirectoryTable<HealthRecordRow>
          columns={columns}
          rows={records}
          getRowId={(r) => r.id}
          getRowLabel={(r) => r.name}
          total={total}
          page={state.page}
          pageSize={state.pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sort={state.sort}
          onSortChange={toggleSort}
          title="Student records"
          description={`${total} ${total === 1 ? 'student' : 'students'}`}
          caption="Student health records"
          toolbar={
            <>
              <div className="relative flex-1 min-w-0 @md/main:w-56 @md/main:flex-none">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Label htmlFor="health-search" className="sr-only">
                  Search students
                </Label>
                <Input
                  id="health-search"
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Search name…"
                  className="pl-8"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setFilter('status', v === 'all' ? null : v)
                }
              >
                <SelectTrigger
                  className="w-[10rem]"
                  aria-label="Filter by status"
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title={
                hasFilters
                  ? 'No records match your filters'
                  : 'No health records yet'
              }
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters.'
                  : 'Run the dev operational seed or create a student health record.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}
