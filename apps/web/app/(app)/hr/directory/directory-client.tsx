'use client';

/* ============================================================
   StaffDirectoryClient — staff on the payroll roster (client-side DirectoryTable)

   /hr/directory returns the full roster, so search / status + role filters /
   sort / paging run in-memory. Both filters collapse into the Pattern-B
   Filters button.
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

export interface StaffMember {
  staffUserTenantId: string;
  staffName: string;
  role: string | null;
  latestPayPeriod: string;
  latestStatus: string;
  recordCount: number;
}

const STATUS_TONE: Record<string, StateTone> = {
  paid: 'success',
  approved: 'info',
  draft: 'neutral',
};

export function StaffDirectoryClient({ staff }: { staff: StaffMember[] }) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const roles = React.useMemo(
    () =>
      Array.from(
        new Set(staff.map((s) => s.role).filter(Boolean) as string[]),
      ).sort(),
    [staff],
  );

  const columns: DirectoryColumn<StaffMember>[] = [
    {
      id: 'staffName',
      header: 'Name',
      sortable: true,
      cell: (s) => (
        <span className="font-medium text-foreground">{s.staffName}</span>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      hideable: true,
      cell: (s) => (
        <span className="text-muted-foreground">{s.role ?? '—'}</span>
      ),
    },
    {
      id: 'latestPayPeriod',
      header: 'Latest period',
      hideable: true,
      cell: (s) => (
        <span className="tabular-nums text-muted-foreground">
          {s.latestPayPeriod}
        </span>
      ),
    },
    {
      id: 'recordCount',
      header: 'Records',
      align: 'end',
      sortable: true,
      cell: (s) => (
        <span className="tabular-nums text-muted-foreground">
          {s.recordCount}
        </span>
      ),
    },
    {
      id: 'latestStatus',
      header: 'Latest status',
      sortable: true,
      cell: (s) => (
        <StatusBadge
          tone={STATUS_TONE[s.latestStatus] ?? 'neutral'}
          dot
          className="capitalize"
        >
          {s.latestStatus}
        </StatusBadge>
      ),
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const status = filters.status;
    const role = filters.role;
    let out = staff.filter((s) => {
      const matchesQ =
        !q ||
        s.staffName.toLowerCase().includes(q) ||
        (s.role?.toLowerCase().includes(q) ?? false);
      const matchesStatus = !status || s.latestStatus === status;
      const matchesRole = !role || s.role === role;
      return matchesQ && matchesStatus && matchesRole;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'recordCount'
          ? dir * (a.recordCount - b.recordCount)
          : sort.field === 'latestStatus'
            ? dir * a.latestStatus.localeCompare(b.latestStatus)
            : dir * a.staffName.localeCompare(b.staffName),
      );
    }
    return out;
  }, [staff, term, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <DirectoryTable<StaffMember>
      title="Staff"
      description={`${filtered.length} ${filtered.length === 1 ? 'staff member' : 'staff members'}`}
      columns={columns}
      rows={pageRows}
      getRowId={(s) => s.staffUserTenantId}
      getRowLabel={(s) => s.staffName}
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
      caption="Staff payroll roster"
      search={{
        value: term,
        onChange: setTerm,
        placeholder: 'Search name or role…',
        label: 'Search staff',
        id: 'staff-search',
      }}
      filters={[
        {
          key: 'status',
          label: 'Latest status',
          options: [
            { value: 'paid', label: 'Paid' },
            { value: 'approved', label: 'Approved' },
            { value: 'draft', label: 'Draft' },
          ],
        },
        ...(roles.length > 0
          ? [
              {
                key: 'role',
                label: 'Role',
                options: roles.map((r) => ({ value: r, label: r })),
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
            hasQuery ? 'No staff match your filters' : 'No staff on record'
          }
          description={
            hasQuery
              ? 'Try a different search term, or clear the filters.'
              : 'Staff appear here once payroll records exist for them.'
          }
        />
      }
    />
  );
}
