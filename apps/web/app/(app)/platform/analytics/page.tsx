'use client';

/* ============================================================
   /platform/analytics — cross-tenant analytics + risk (3.1 + 3.3)

   Aggregate-only (counts/rates/distributions). platform.metrics
   (Architect). Combines GET /platform/analytics and /platform/risk.
   ============================================================ */

import useSWR from 'swr';
import { ChartColumn, ShieldAlert } from 'lucide-react';
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
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';

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
interface RiskFlag { code: string; severity: string; detail: string }
interface TenantRisk {
  tenantId: string;
  tenantName: string;
  status: string;
  severity: string;
  flags: RiskFlag[];
}
interface RiskReport {
  atRisk: TenantRisk[];
  summary: { total: number; high: number; medium: number; low: number; ok: number };
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
  const { data: analytics, error: aErr } = useSWR<Analytics>('/api/platform/analytics');
  const { data: risk, error: rErr } = useSWR<RiskReport>('/api/platform/risk');

  const error =
    (aErr || rErr) instanceof Error
      ? (aErr || rErr).message
      : aErr || rErr
        ? 'Failed to load analytics'
        : null;

  const t = analytics?.totals;

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
        <p className="text-sm text-destructive" role="alert">{error}</p>
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
              <div key={row.schoolType} className="flex items-center justify-between">
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
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="size-4 text-warning" /> At-risk schools
          </CardTitle>
          <CardDescription>
            {risk
              ? `${risk.summary.high} high · ${risk.summary.medium} medium · ${risk.summary.low} low · ${risk.summary.ok} ok`
              : 'Combined risk signals (policy drift, stalled onboarding, dormancy, suspension)'}
          </CardDescription>
        </CardHeader>
        <CardContent
          className={
            risk?.atRisk.length
              ? 'px-0 [&_:is(th,td):first-child]:pl-6 [&_:is(th,td):last-child]:pr-6'
              : undefined
          }
        >
          {!risk ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">Loading…</p>
          ) : risk.atRisk.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              No schools flagged — everything looks healthy.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Reasons</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {risk.atRisk.map((r) => (
                  <TableRow key={r.tenantId}>
                    <TableCell className="font-medium">{r.tenantName}</TableCell>
                    <TableCell>
                      <StatusBadge tone={SEVERITY_TONE[r.severity] ?? 'neutral'} dot>
                        {r.severity}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.flags.map((f) => f.detail).join(' ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
