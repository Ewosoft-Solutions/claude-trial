'use client';

/* ============================================================
   RosterClient — event attendee roster (client-side DirectoryTable)

   The /events/:id/attendees endpoint returns the full roster, so search /
   status + type filters / sort / paging run in-memory. Both filters collapse
   into the Pattern-B Filters button.
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

export interface Attendee {
  id: string;
  attendeeName: string;
  attendeeType: string;
  email: string | null;
  status: string;
}

const STATUS_TONE: Record<string, StateTone> = {
  registered: 'info',
  attended: 'success',
  waitlist: 'warning',
  cancelled: 'neutral',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function RosterClient({ attendees }: { attendees: Attendee[] }) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const types = React.useMemo(
    () => Array.from(new Set(attendees.map((a) => a.attendeeType))).sort(),
    [attendees],
  );

  const columns: DirectoryColumn<Attendee>[] = [
    {
      id: 'attendeeName',
      header: 'Name',
      sortable: true,
      cell: (a) => (
        <span className="font-medium text-foreground">{a.attendeeName}</span>
      ),
    },
    {
      id: 'attendeeType',
      header: 'Type',
      hideable: true,
      cell: (a) => (
        <span className="capitalize text-muted-foreground">
          {a.attendeeType}
        </span>
      ),
    },
    {
      id: 'email',
      header: 'Email',
      hideable: true,
      truncate: true,
      cell: (a) => (
        <span className="text-muted-foreground">{a.email ?? '—'}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (a) => (
        <StatusBadge
          tone={STATUS_TONE[a.status] ?? 'neutral'}
          dot
          className="capitalize"
        >
          {a.status}
        </StatusBadge>
      ),
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const status = filters.status;
    const type = filters.type;
    let out = attendees.filter((a) => {
      const matchesQ =
        !q ||
        a.attendeeName.toLowerCase().includes(q) ||
        (a.email?.toLowerCase().includes(q) ?? false);
      const matchesStatus = !status || a.status === status;
      const matchesType = !type || a.attendeeType === type;
      return matchesQ && matchesStatus && matchesType;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'status'
          ? dir * a.status.localeCompare(b.status)
          : dir * a.attendeeName.localeCompare(b.attendeeName),
      );
    }
    return out;
  }, [attendees, term, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <DirectoryTable<Attendee>
      title="Attendees"
      description={`${filtered.length} ${filtered.length === 1 ? 'attendee' : 'attendees'}`}
      columns={columns}
      rows={pageRows}
      getRowId={(a) => a.id}
      getRowLabel={(a) => a.attendeeName}
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
      caption="Event attendee roster"
      search={{
        value: term,
        onChange: setTerm,
        placeholder: 'Search name or email…',
        label: 'Search attendees',
        id: 'roster-search',
      }}
      filters={[
        {
          key: 'status',
          label: 'Status',
          options: [
            { value: 'registered', label: 'Registered' },
            { value: 'attended', label: 'Attended' },
            { value: 'waitlist', label: 'Waitlist' },
            { value: 'cancelled', label: 'Cancelled' },
          ],
        },
        ...(types.length > 0
          ? [
              {
                key: 'type',
                label: 'Type',
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
            hasQuery ? 'No attendees match your filters' : 'No attendees yet'
          }
          description={
            hasQuery
              ? 'Try a different search term, or clear the filters.'
              : "People added to this event's roster appear here."
          }
        />
      }
    />
  );
}
