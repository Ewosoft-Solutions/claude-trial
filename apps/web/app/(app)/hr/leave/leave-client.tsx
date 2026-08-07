'use client';

/* ============================================================
   LeaveClient — staff leave requests (client-side DirectoryTable)

   /hr/leave returns the full request list, so search / status + type
   filters / sort / paging run in-memory. Both filters collapse into the
   Pattern-B Filters button.
   ============================================================ */

import * as React from 'react';

import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

export interface LeaveRequest {
  id: string;
  staffName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason: string | null;
}

const STATUS_TONE: Record<string, StateTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  cancelled: 'neutral',
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function LeaveClient({ leave }: { leave: LeaveRequest[] }) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const types = React.useMemo(
    () => Array.from(new Set(leave.map((l) => l.leaveType))).sort(),
    [leave],
  );

  const columns: DirectoryColumn<LeaveRequest>[] = [
    {
      id: 'staffName',
      header: 'Staff',
      sortable: true,
      cell: (l) => (
        <span className="font-medium text-foreground">{l.staffName}</span>
      ),
    },
    {
      id: 'leaveType',
      header: 'Type',
      hideable: true,
      cell: (l) => (
        <span className="capitalize text-muted-foreground">{l.leaveType}</span>
      ),
    },
    {
      id: 'startDate',
      header: 'Dates',
      sortable: true,
      hideable: true,
      cell: (l) => (
        <span className="tabular-nums text-muted-foreground">
          {formatDate(l.startDate)} – {formatDate(l.endDate)}
        </span>
      ),
    },
    {
      id: 'days',
      header: 'Days',
      align: 'end',
      sortable: true,
      cell: (l) => (
        <span className="tabular-nums text-muted-foreground">{l.days}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (l) => (
        <StatusBadge
          tone={STATUS_TONE[l.status] ?? 'neutral'}
          dot
          className="capitalize"
        >
          {l.status}
        </StatusBadge>
      ),
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const status = filters.status;
    const type = filters.type;
    let out = leave.filter((l) => {
      const matchesQ = !q || l.staffName.toLowerCase().includes(q);
      const matchesStatus = !status || l.status === status;
      const matchesType = !type || l.leaveType === type;
      return matchesQ && matchesStatus && matchesType;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'days'
          ? dir * (a.days - b.days)
          : sort.field === 'startDate'
            ? dir * a.startDate.localeCompare(b.startDate)
            : dir * a.staffName.localeCompare(b.staffName),
      );
    }
    return out;
  }, [leave, term, filters, sort]);

  const pending = leave.filter((l) => l.status === 'pending').length;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <DirectoryTable<LeaveRequest>
      title="Leave requests"
      description={`${filtered.length} ${filtered.length === 1 ? 'request' : 'requests'} · ${pending} pending`}
      columns={columns}
      rows={pageRows}
      getRowId={(l) => l.id}
      getRowLabel={(l) => l.staffName}
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
      caption="Staff leave requests"
      search={{
        value: term,
        onChange: setTerm,
        placeholder: 'Search staff…',
        label: 'Search leave requests',
        id: 'leave-search',
      }}
      filters={[
        {
          key: 'status',
          label: 'Status',
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'cancelled', label: 'Cancelled' },
          ],
        },
        ...(types.length > 0
          ? [
              {
                key: 'type',
                label: 'Leave type',
                options: types.map((t) => ({ value: t, label: cap(t) })),
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
            hasQuery ? 'No requests match your filters' : 'No leave requests'
          }
          description={
            hasQuery
              ? 'Try a different search term, or clear the filters.'
              : 'Staff leave requests appear here for review and approval.'
          }
        />
      }
    />
  );
}
