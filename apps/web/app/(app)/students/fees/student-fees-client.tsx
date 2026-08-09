'use client';

/* ============================================================
   StudentFeesClient — per-student fee balances (client-side DirectoryTable)

   Receives the full billed-students list, so search / status + class filters /
   sort / paging run in-memory. Both filters collapse into the Pattern-B Filters
   button.
   ============================================================ */

import * as React from 'react';
import { Bell } from 'lucide-react';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { StatItem } from '@workspace/ui/types/layout.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

export type FeeStatus = 'paid' | 'partial' | 'owing';

export interface FeeRow {
  id: string;
  name: string;
  className: string;
  billed: number;
  paid: number;
  status: FeeStatus;
}

interface Props {
  rows: FeeRow[];
}

const STATUS_META: Record<FeeStatus, { label: string; tone: StateTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partial: { label: 'Part-paid', tone: 'info' },
  owing: { label: 'Owing', tone: 'destructive' },
};

function nairaFromKobo(kobo: number): string {
  const naira = kobo / 100;
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`;
  if (naira >= 1_000) return `₦${Math.round(naira / 1_000)}k`;
  return `₦${naira}`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function StudentFeesClient({ rows }: Props) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const classes = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.className))).sort(),
    [rows],
  );

  const columns: DirectoryColumn<FeeRow>[] = [
    {
      id: 'name',
      header: 'Student',
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-[calc(11px*var(--font-scale))] font-semibold">
              {initials(r.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="break-words font-medium text-foreground">
              {r.name}
            </span>
            <span className="break-words text-xs text-muted-foreground">
              {r.id}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'className',
      header: 'Class',
      hideable: true,
      cell: (r) => <span className="text-muted-foreground">{r.className}</span>,
    },
    {
      id: 'billed',
      header: 'Billed',
      align: 'end',
      sortable: true,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {nairaFromKobo(r.billed)}
        </span>
      ),
    },
    {
      id: 'paid',
      header: 'Paid',
      align: 'end',
      sortable: true,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {nairaFromKobo(r.paid)}
        </span>
      ),
    },
    {
      id: 'balance',
      header: 'Balance',
      align: 'end',
      sortable: true,
      cell: (r) => {
        const balance = r.billed - r.paid;
        return (
          <span className="font-semibold tabular-nums text-foreground">
            {balance > 0 ? nairaFromKobo(balance) : '—'}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (r) => {
        const status = STATUS_META[r.status];
        return (
          <StatusBadge tone={status.tone} dot>
            {status.label}
          </StatusBadge>
        );
      },
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const status = filters.status;
    const className = filters.class;
    let out = rows.filter((r) => {
      const matchesQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q);
      const matchesStatus = !status || r.status === status;
      const matchesClass = !className || r.className === className;
      return matchesQ && matchesStatus && matchesClass;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      const num = (r: FeeRow) =>
        sort.field === 'billed'
          ? r.billed
          : sort.field === 'paid'
            ? r.paid
            : r.billed - r.paid;
      out = [...out].sort((a, b) =>
        sort.field === 'status'
          ? dir * a.status.localeCompare(b.status)
          : sort.field === 'billed' ||
              sort.field === 'paid' ||
              sort.field === 'balance'
            ? dir * (num(a) - num(b))
            : dir * a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [rows, term, filters, sort]);

  const stats: StatItem[] = React.useMemo(() => {
    const billed = rows.reduce((sum, row) => sum + row.billed, 0);
    const collected = rows.reduce((sum, row) => sum + row.paid, 0);
    const owing = rows.filter((row) => row.status !== 'paid').length;
    return [
      { key: 'billed', label: 'Total billed', value: nairaFromKobo(billed) },
      { key: 'collected', label: 'Collected', value: nairaFromKobo(collected) },
      {
        key: 'outstanding',
        label: 'Outstanding',
        value: nairaFromKobo(billed - collected),
      },
      { key: 'owing', label: 'Students owing', value: String(owing) },
    ];
  }, [rows]);

  const meta: PageHeaderMeta[] = [
    { key: 'source', label: 'live invoices', emphasis: true },
    { key: 'students', label: `${rows.length} billed students` },
  ];

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Fees & billing"
          meta={meta}
          actions={
            <Button size="sm">
              <Bell /> Send reminders
            </Button>
          }
        />

        <StatGrid items={stats} />

        <DirectoryTable<FeeRow>
          title="Student balances"
          description={`${filtered.length} of ${rows.length} students`}
          columns={columns}
          rows={pageRows}
          getRowId={(r) => r.id}
          getRowLabel={(r) => r.name}
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
          caption="Student fee balances"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search name or ID',
            label: 'Search students',
            id: 'fees-search',
          }}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: (Object.keys(STATUS_META) as FeeStatus[]).map((k) => ({
                value: k,
                label: STATUS_META[k].label,
              })),
            },
            ...(classes.length > 0
              ? [
                  {
                    key: 'class',
                    label: 'Class',
                    options: classes.map((c) => ({ value: c, label: c })),
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
                hasQuery
                  ? 'No students match your filters'
                  : 'No student balances yet'
              }
              description={
                hasQuery
                  ? 'Try a different search term, or clear the filters.'
                  : 'Invoices created for students will appear here.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}
