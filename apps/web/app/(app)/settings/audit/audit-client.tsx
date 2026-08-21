'use client';

/* ============================================================
   AuditClient — school-wide audit log (server-driven table)

   Search / event + status filters / paging all live in the URL and run at the
   DB via `useDirectoryState` + `DirectoryTable`. Export (CSV / XLSX / PDF) runs
   server-side over the SAME filters. Clicking a row opens a drawer that fetches
   the full record and lays it out as Who / What / When / Origin / Outcome /
   Changes / Context, with everything humanized.
   ============================================================ */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import {
  ExportMenu,
  type ExportFormat,
} from '@workspace/ui/custom/tables/export-menu';
import { useDirectoryState } from '@workspace/ui/hooks/use-directory-state';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { Sheet, SheetDescription } from '@workspace/ui/components/sheet';
import type { StateTone } from '@workspace/ui/types/states.types';
import { SkeletonText } from '@workspace/ui/custom/states/skeletons';
import {
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@workspace/ui/custom/detail/drawer-chrome';

import {
  humanizeAuditAction,
  humanizeAuditEvent,
  humanizeToken,
  humanizeValue,
} from '@/lib/humanize';

export interface AuditRow {
  id: string;
  when: string;
  actor: string;
  actorRole: string | null;
  eventType: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  status: string;
}

/** Full record fetched for the drawer. */
interface AuditDetail extends AuditRow {
  actorId: string | null;
  actorProfileId: string | null;
  actorEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  requestId: string | null;
  description: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  timestamp: string;
}

const EVENT_TYPE_OPTIONS = [
  { value: 'user_action', label: 'User action' },
  { value: 'data_change', label: 'Data change' },
  { value: 'security_event', label: 'Security event' },
  { value: 'system_event', label: 'System event' },
  { value: 'authentication', label: 'Authentication' },
  { value: 'authorization', label: 'Authorization' },
  { value: 'sensitive_operation', label: 'Sensitive operation' },
];

const STATUS_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A role name reads nicely humanized, but some auth events store an id in
 *  `actorRole`; don't render an id-shaped value as a "role". */
function displayRole(role: string | null | undefined): string | null {
  if (!role || UUID_RE.test(role)) return null;
  return humanizeToken(role);
}

function statusTone(status: string | null | undefined): StateTone {
  const value = String(status ?? '').toLowerCase();
  if (
    value.includes('fail') ||
    value.includes('error') ||
    value.includes('denied')
  )
    return 'destructive';
  if (value.includes('warn')) return 'warning';
  if (value.includes('success') || value.includes('complete')) return 'success';
  return 'info';
}

interface Props {
  rows: AuditRow[];
  total: number;
  defaultPageSize: number;
}

export function AuditClient({ rows, total, defaultPageSize }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = React.useState<AuditRow | null>(null);

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

  // Debounced search.
  const [term, setTerm] = React.useState(state.q);
  React.useEffect(() => setTerm(state.q), [state.q]);
  React.useEffect(() => {
    if (term === state.q) return;
    const id = setTimeout(() => setQuery(term), 300);
    return () => clearTimeout(id);
  }, [term, state.q, setQuery]);

  const hasFilters =
    state.q.trim() !== '' || Object.values(state.filters).some(Boolean);

  const download = React.useCallback(
    async (format: ExportFormat) => {
      const params = new URLSearchParams();
      if (state.q) params.set('search', state.q);
      for (const [key, value] of Object.entries(state.filters)) {
        if (value) params.set(key, value);
      }
      params.set('format', format);
      try {
        const res = await fetch(`/api/audit-logs/export?${params.toString()}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(body?.message ?? `Export failed (${res.status})`);
        }
        const blob = await res.blob();
        const disposition = res.headers.get('content-disposition') ?? '';
        const filename =
          /filename="?([^";]+)"?/.exec(disposition)?.[1] ??
          `audit-log.${format}`;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Export failed');
      }
    },
    [state.q, state.filters],
  );

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
      id: 'actor',
      header: 'Actor',
      cell: (r) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-foreground">{r.actor}</span>
          {displayRole(r.actorRole) ? (
            <span className="text-xs text-muted-foreground">
              {displayRole(r.actorRole)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'event',
      header: 'Event',
      hideable: true,
      cell: (r) => (
        <StatusBadge tone="info">{humanizeAuditEvent(r.eventType)}</StatusBadge>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      cell: (r) => (
        <span className="text-sm text-foreground">
          {humanizeAuditAction(r.action)}
        </span>
      ),
    },
    {
      id: 'resource',
      header: 'Resource',
      hideable: true,
      cell: (r) =>
        r.resource ? (
          <span className="text-xs text-muted-foreground">
            {humanizeToken(r.resource)}
            {r.resourceId ? ` · ${r.resourceId.slice(0, 8)}` : ''}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'end',
      cell: (r) => (
        <StatusBadge tone={statusTone(r.status)} dot>
          {humanizeToken(r.status)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <>
      <DirectoryTable<AuditRow>
        description={`${total.toLocaleString()} ${total === 1 ? 'event' : 'events'}`}
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        getRowLabel={(r) => `${r.actor} · ${r.action}`}
        total={total}
        page={state.page}
        pageSize={state.pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sort={state.sort}
        onSortChange={toggleSort}
        onRowClick={(r) => setSelected(r)}
        caption="Audit log"
        headerActions={<ExportMenu onExport={download} />}
        search={{
          value: term,
          onChange: setTerm,
          placeholder: 'Search actor, action, resource…',
          label: 'Search audit events',
          id: 'audit-search',
        }}
        filters={[
          { key: 'eventType', label: 'Event', options: EVENT_TYPE_OPTIONS },
          { key: 'status', label: 'Status', options: STATUS_OPTIONS },
        ]}
        filterValues={state.filters}
        onFilterChange={setFilter}
        onClearFilters={() => setFilters({})}
        emptyState={
          <EmptyState
            compact
            title={
              hasFilters ? 'No events match your filters' : 'No audit events'
            }
            description={
              hasFilters
                ? 'Try a different search term, or clear the filters.'
                : 'Significant actions taken across this school will appear here.'
            }
          />
        }
      />

      <AuditDetailDrawer row={selected} onClose={() => setSelected(null)} />
    </>
  );
}

/* ---- Detail drawer ------------------------------------------------------- */

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[calc(11px*var(--font-scale))] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={mono ? 'break-all font-mono text-xs' : 'text-sm'}>
        {value}
      </dd>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const hasContent = React.Children.toArray(children).some(Boolean);
  if (!hasContent) return null;
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <dl className="grid gap-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

/** A before/after or metadata object, with humanized keys. */
function KeyValues({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5 sm:col-span-2">
      {entries.map(([key, value]) => (
        <li key={key} className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium text-foreground">
            {humanizeToken(key)}
          </span>
          <span className="break-all text-muted-foreground">
            {typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : humanizeValue(value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AuditDetailDrawer({
  row,
  onClose,
}: {
  row: AuditRow | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = React.useState<AuditDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!row) return;
    setDetail(null);
    setLoading(true);
    const controller = new AbortController();
    void fetch(`/api/audit-logs/${row.id}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<AuditDetail>) : null))
      .then((data) => setDetail(data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [row]);

  const record = detail;

  return (
    <Sheet open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            {row ? humanizeAuditAction(row.action) : 'Event'}
            {row ? (
              <StatusBadge tone={statusTone(row.status)} dot>
                {humanizeToken(row.status)}
              </StatusBadge>
            ) : null}
          </DrawerTitle>
          <SheetDescription>
            {row ? humanizeAuditEvent(row.eventType) : ''}
            {row ? ` · ${row.when}` : ''}
          </SheetDescription>
        </DrawerHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          {loading && !record ? (
            <SkeletonText lines={6} />
          ) : !record ? (
            <p className="pt-4 text-sm text-muted-foreground">
              Could not load this event.
            </p>
          ) : (
            <>
              <Group title="Who">
                <Field
                  label="Actor"
                  value={record.actorEmail ?? record.actor}
                />
                <Field label="Role" value={displayRole(record.actorRole)} />
                <Field label="User ID" value={record.actorId} mono />
                <Field label="Profile ID" value={record.actorProfileId} mono />
              </Group>

              <Group title="What">
                <Field
                  label="Event"
                  value={humanizeAuditEvent(record.eventType)}
                />
                <Field
                  label="Action"
                  value={humanizeAuditAction(record.action)}
                />
                <Field
                  label="Resource"
                  value={
                    record.resource ? humanizeToken(record.resource) : null
                  }
                />
                <Field label="Resource ID" value={record.resourceId} mono />
                <Field label="Description" value={record.description} />
              </Group>

              <Group title="Origin">
                <Field label="IP address" value={record.ipAddress} mono />
                <Field label="Device" value={record.userAgent} />
                <Field label="Session" value={record.sessionId} mono />
                <Field label="Request ID" value={record.requestId} mono />
              </Group>

              {record.status !== 'success' ? (
                <Group title="Outcome">
                  <Field label="Status" value={humanizeToken(record.status)} />
                  <Field label="Error code" value={record.errorCode} mono />
                  <Field label="Error" value={record.errorMessage} />
                </Group>
              ) : null}

              {record.changes && Object.keys(record.changes).length > 0 ? (
                <Group title="Changes">
                  <KeyValues data={record.changes} />
                </Group>
              ) : null}

              {record.metadata && Object.keys(record.metadata).length > 0 ? (
                <Group title="Context">
                  <KeyValues data={record.metadata} />
                </Group>
              ) : null}
            </>
          )}
        </div>
      </DrawerContent>
    </Sheet>
  );
}
