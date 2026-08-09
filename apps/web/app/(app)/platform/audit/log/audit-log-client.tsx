'use client';

/* ============================================================
   AuditLogClient — cross-tenant audit log (server-driven table)

   Search / event-type filter / sort / paging all live in the URL and run at
   the DB via `useDirectoryState` + `DirectoryTable`. The client never filters
   the fetched page in memory, so it can never hide rows past the current page.
   `router.refresh()` re-runs the server component to pull fresh events.
   ============================================================ */

import * as React from 'react';
import { ScrollText } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { useDirectoryState } from '@workspace/ui/hooks/use-directory-state';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { PageTitle } from '@workspace/ui/custom/shell/page-title';

import { RefreshButton } from '../../../_shared/refresh-button';

export interface AuditRow {
  id: string;
  tenantName: string | null;
  eventType: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  actorId: string | null;
  actorRole: string | null;
  /** Preformatted on the server (stable across SSR + hydration). */
  when: string;
}

// Mirrors the API's AUDIT_EVENT_TYPES; kept as a static list so the filter
// needs no extra fetch.
const EVENT_TYPE_OPTIONS = [
  { value: 'user_action', label: 'User action' },
  { value: 'data_change', label: 'Data change' },
  { value: 'security_event', label: 'Security event' },
  { value: 'system_event', label: 'System event' },
  { value: 'authentication', label: 'Authentication' },
  { value: 'authorization', label: 'Authorization' },
  { value: 'ai_event', label: 'AI event' },
  { value: 'custom', label: 'Custom' },
];

const EVENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EVENT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

interface Props {
  rows: AuditRow[];
  total: number;
  defaultPageSize: number;
}

export function AuditLogClient({ rows, total, defaultPageSize }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRefreshing, startRefresh] = React.useTransition();

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
  const {
    state,
    setPage,
    setPageSize,
    toggleSort,
    setQuery,
    setFilter,
    setFilters,
  } = useDirectoryState({
    searchParams: searchParams.toString(),
    onChange,
    defaults,
  });

  // Debounced search: snappy typing without a request per keystroke.
  const [term, setTerm] = React.useState(state.q);
  React.useEffect(() => setTerm(state.q), [state.q]);
  React.useEffect(() => {
    if (term === state.q) return;
    const id = setTimeout(() => setQuery(term), 300);
    return () => clearTimeout(id);
  }, [term, state.q, setQuery]);

  const eventType = state.filters.eventType;
  const hasFilters = state.q.trim() !== '' || Boolean(eventType);

  const columns: DirectoryColumn<AuditRow>[] = [
    {
      id: 'timestamp',
      header: 'When',
      sortable: true,
      cell: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {r.when}
        </span>
      ),
    },
    {
      id: 'tenant',
      header: 'Tenant',
      cell: (r) =>
        r.tenantName ? (
          <span className="text-sm">{r.tenantName}</span>
        ) : (
          <span className="text-sm text-muted-foreground">platform</span>
        ),
    },
    {
      id: 'action',
      header: 'Action',
      sortable: true,
      cell: (r) => <span className="font-mono text-xs">{r.action}</span>,
    },
    {
      id: 'resource',
      header: 'Resource',
      sortable: true,
      hideable: true,
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.resource ?? '—'}
          {r.resourceId ? ` · ${r.resourceId.slice(0, 8)}` : ''}
        </span>
      ),
    },
    {
      id: 'actor',
      header: 'Actor',
      hideable: true,
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.actorRole ?? (r.actorId ? r.actorId.slice(0, 8) : '—')}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="size-6 text-primary" />
            <PageTitle>Audit log</PageTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} event{total === 1 ? '' : 's'} across all
            tenants
          </p>
        </div>
        <RefreshButton
          onRefresh={() => startRefresh(() => router.refresh())}
          refreshing={isRefreshing}
        />
      </div>

      <DirectoryTable<AuditRow>
        title="Cross-tenant events"
        description="Every action across the platform. Filter by event type, or search action / resource / tenant."
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.action}
        total={total}
        page={state.page}
        pageSize={state.pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sort={state.sort}
        onSortChange={toggleSort}
        caption="Cross-tenant audit log"
        search={{
          value: term,
          onChange: setTerm,
          placeholder: 'Search action, resource, tenant…',
          label: 'Search audit events',
          id: 'audit-search',
        }}
        filters={[
          {
            key: 'eventType',
            label: 'Event type',
            options: EVENT_TYPE_OPTIONS,
          },
        ]}
        filterValues={state.filters}
        onFilterChange={setFilter}
        onClearFilters={() => setFilters({})}
        formatFilterValue={(_key, value) => EVENT_TYPE_LABELS[value] ?? value}
        emptyState={
          <EmptyState
            compact
            title={hasFilters ? 'No events match your filters' : 'No events'}
            description={
              hasFilters
                ? 'Try a different search term, or clear the filters.'
                : 'No audit events have been recorded yet.'
            }
          />
        }
      />
    </div>
  );
}
