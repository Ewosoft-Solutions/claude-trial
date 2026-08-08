'use client';

/* ============================================================
   /platform/analytics — cross-tenant analytics + risk (3.1 + 3.3)

   Aggregate-only (counts/rates/distributions). platform.metrics
   (Architect). Combines GET /platform/analytics and /platform/risk.
   ============================================================ */

import * as React from 'react';
import useSWR from 'swr';
import { ChartColumn, ShieldAlert } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

interface Analytics {
  totals: {
    tenants: number;
    activeTenants: number;
    students: number;
    activeStudents: number;
    profiles: number;
  };
  byType: { schoolType: string; tenants: number; students: number }[];
}
interface RiskFlag {
  code: string;
  severity: string;
  detail: string;
}
interface TenantRisk {
  tenantId: string;
  tenantName: string;
  status: string;
  severity: string;
  flags: RiskFlag[];
}
interface RiskReport {
  atRisk: TenantRisk[];
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
    ok: number;
  };
}

const SEVERITY_TONE: Record<string, StateTone> = {
  high: 'destructive',
  medium: 'warning',
  low: 'info',
};

function fmt(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export default function PlatformAnalyticsPage() {
  const { data: analytics, error: aErr } = useSWR<Analytics>(
    '/api/platform/analytics',
  );
  const { data: risk, error: rErr } = useSWR<RiskReport>('/api/platform/risk');

  const error =
    (aErr || rErr) instanceof Error
      ? (aErr || rErr).message
      : aErr || rErr
        ? 'Failed to load analytics'
        : null;

  const t = analytics?.totals;

  const atRisk = React.useMemo(() => risk?.atRisk ?? [], [risk]);
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize, risk]);

  const severities = React.useMemo(
    () => Array.from(new Set(atRisk.map((r) => r.severity))),
    [atRisk],
  );

  const riskColumns: DirectoryColumn<TenantRisk>[] = [
    {
      id: 'school',
      header: 'School',
      sortable: true,
      cell: (r) => <span className="font-medium">{r.tenantName}</span>,
    },
    {
      id: 'severity',
      header: 'Severity',
      sortable: true,
      cell: (r) => (
        <StatusBadge
          tone={SEVERITY_TONE[r.severity] ?? 'neutral'}
          dot
          className="capitalize"
        >
          {r.severity}
        </StatusBadge>
      ),
    },
    {
      id: 'reasons',
      header: 'Reasons',
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.flags.map((f) => f.detail).join(' ')}
        </span>
      ),
    },
  ];

  const filteredRisk = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const severity = filters.severity;
    let out = atRisk.filter(
      (r) =>
        (!q || r.tenantName.toLowerCase().includes(q)) &&
        (!severity || r.severity === severity),
    );
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'severity'
          ? dir * a.severity.localeCompare(b.severity)
          : dir * a.tenantName.localeCompare(b.tenantName),
      );
    }
    return out;
  }, [atRisk, term, filters, sort]);

  const riskRows = filteredRisk.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <ChartColumn className="size-5" /> Analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          Aggregate metrics across every school
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Schools" value={t ? fmt(t.tenants) : '—'} />
        <Stat label="Active schools" value={t ? fmt(t.activeTenants) : '—'} />
        <Stat label="Students" value={t ? fmt(t.students) : '—'} />
        <Stat label="Active students" value={t ? fmt(t.activeStudents) : '—'} />
        <Stat label="User profiles" value={t ? fmt(t.profiles) : '—'} />
      </div>

      {/* By type */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">By institution type</CardTitle>
          <CardDescription>Schools and students per type</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {!analytics ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            analytics.byType.map((row) => (
              <div
                key={row.schoolType}
                className="flex items-center justify-between"
              >
                <span className="capitalize text-muted-foreground">
                  {row.schoolType.replace(/_/g, ' ')}
                </span>
                <span className="font-medium">
                  {fmt(row.tenants)} schools · {fmt(row.students)} students
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* At-risk */}
      <DirectoryTable<TenantRisk>
        title={
          <span className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-warning" /> At-risk schools
          </span>
        }
        description={
          risk
            ? `${risk.summary.high} high · ${risk.summary.medium} medium · ${risk.summary.low} low · ${risk.summary.ok} ok`
            : 'Combined risk signals (policy drift, stalled onboarding, dormancy, suspension)'
        }
        columns={riskColumns}
        rows={riskRows}
        getRowId={(r) => r.tenantId}
        getRowLabel={(r) => r.tenantName}
        total={filteredRisk.length}
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
        loading={!risk}
        error={rErr ? 'Failed to load risk' : undefined}
        caption="At-risk schools"
        search={{
          value: term,
          onChange: setTerm,
          placeholder: 'Search school…',
          label: 'Search schools',
          id: 'risk-search',
        }}
        filters={
          severities.length > 1
            ? [
                {
                  key: 'severity',
                  label: 'Severity',
                  options: severities.map((s) => ({
                    value: s,
                    label: s.charAt(0).toUpperCase() + s.slice(1),
                  })),
                },
              ]
            : []
        }
        filterValues={filters}
        onFilterChange={(key, value) =>
          setFilters((f) => ({ ...f, [key]: value }))
        }
        onClearFilters={() => setFilters({})}
        emptyState={
          <EmptyState
            compact
            title="No schools flagged"
            description="Everything looks healthy."
          />
        }
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-card">
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  );
}
