'use client';

/* ============================================================
   /platform/audit/log — cross-tenant audit log

   Reads GET /platform/audit (@PlatformScoped, permission-gated,
   audited). Shows the audit trail across every tenant, filterable by
   tenant / action / date. This is the sanctioned cross-tenant audit
   path; the old clearance-9 branch on /audit-logs was removed.
   ============================================================ */

import { useState } from 'react';
import useSWR from 'swr';
import { ScrollText } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
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
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { RefreshButton } from '../../../_shared/refresh-button';

interface AuditRow {
  id: string;
  tenantId: string | null;
  eventType: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  actorId: string | null;
  actorRole: string | null;
  description: string | null;
  timestamp: string;
  tenant: { id: string; name: string; slug: string } | null;
}

interface AuditResponse {
  data: AuditRow[];
  pagination: { page: number; total: number; totalPages: number };
}

export default function PlatformAuditLogPage() {
  const [action, setAction] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ limit: '50', page: String(page) });
  if (action) params.set('action', action);
  if (tenantId) params.set('tenantId', tenantId);

  const {
    data,
    error: loadError,
    isLoading: loading,
    isValidating: refreshing,
    mutate,
  } = useSWR<AuditResponse>(`/api/platform/audit?${params.toString()}`);

  const rows = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  const error =
    loadError instanceof Error
      ? loadError.message
      : loadError
        ? 'Failed to load audit log'
        : null;

  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ScrollText className="size-5" /> Audit log
          </h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.pagination.total} events across all tenants` : '—'}
          </p>
        </div>
        <RefreshButton onRefresh={() => void mutate()} refreshing={refreshing} />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Cross-tenant events</CardTitle>
          <CardDescription>
            Every action across the platform. Filter by action or tenant id.
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Input
              placeholder="Filter by action (e.g. login)"
              value={action}
              onChange={(e) => {
                setPage(1);
                setAction(e.target.value);
              }}
              className="max-w-56"
            />
            <Input
              placeholder="Filter by tenant id"
              value={tenantId}
              onChange={(e) => {
                setPage(1);
                setTenantId(e.target.value);
              }}
              className="max-w-72"
            />
          </div>
        </CardHeader>
        <CardContent
          className={
            rows.length
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
          ) : rows.length === 0 ? (
            <EmptyState
              compact
              title="No events"
              description="No audit events match these filters."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Actor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.tenant?.name ?? (
                          <span className="text-muted-foreground">platform</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.action}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.resource ?? '—'}
                        {r.resourceId ? ` · ${r.resourceId.slice(0, 8)}` : ''}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.actorRole ?? (r.actorId ? r.actorId.slice(0, 8) : '—')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between px-6 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
