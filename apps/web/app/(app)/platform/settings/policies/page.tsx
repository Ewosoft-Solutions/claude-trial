'use client';

/* ============================================================
   /platform/settings/policies — cross-tenant policy posture + drift

   Reads GET /platform/policies (@PlatformScoped, platform.security —
   Architect only). Shows each tenant's security posture and where it
   drifts from the platform baseline (weaker than expected). 2.2 + 2.3.
   ============================================================ */

import useSWR from 'swr';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
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
import { EmptyState } from '@workspace/ui/custom/states/page-states';

interface DriftViolation {
  field: string;
  label: string;
  rationale: string;
  baseline: number | boolean | string;
  actual: number | boolean | string | null;
}
interface BaselineRule {
  field: string;
  label: string;
  rationale: string;
  baseline: number | boolean | string;
}
interface TenantPolicyRow {
  tenantId: string;
  tenantName: string;
  status: string;
  policyTier: string | null;
  requireMFA: boolean | null;
  sessionTimeout: number | null;
  auditLevel: string | null;
  drift: DriftViolation[];
  hasPolicy: boolean;
}
interface PolicyOverview {
  baseline: BaselineRule[];
  tenants: TenantPolicyRow[];
  summary: { total: number; compliant: number; drifting: number };
}

function fmt(v: number | boolean | string | null): string {
  if (v === null) return '—';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  return String(v);
}

export default function PlatformPoliciesPage() {
  const {
    data,
    error: loadError,
    isLoading: loading,
  } = useSWR<PolicyOverview>('/api/platform/policies');

  const error =
    loadError instanceof Error
      ? loadError.message
      : loadError
        ? 'Failed to load policy posture'
        : null;

  const tenants = data?.tenants ?? [];

  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <ShieldCheck className="size-5" /> Policy posture
        </h1>
        <p className="text-sm text-muted-foreground">
          {data
            ? `${data.summary.drifting} of ${data.summary.total} schools drift from the platform baseline`
            : '—'}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : loading || !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Platform baseline</CardTitle>
              <CardDescription>
                The minimum posture expected of every school. A school may be
                stricter; being weaker is drift.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {data.baseline.map((rule) => (
                <div key={rule.field} className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{rule.label}</span>
                  <span className="font-medium">{fmt(rule.baseline)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Schools</CardTitle>
              <CardDescription>
                Posture and baseline drift per school.
              </CardDescription>
            </CardHeader>
            <CardContent
              className={
                tenants.length
                  ? 'px-0 [&_:is(th,td):first-child]:pl-6 [&_:is(th,td):last-child]:pr-6'
                  : undefined
              }
            >
              {tenants.length === 0 ? (
                <EmptyState compact title="No schools" description="Nothing to show." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>School</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>MFA</TableHead>
                      <TableHead>Idle</TableHead>
                      <TableHead>Audit</TableHead>
                      <TableHead>Compliance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((t) => (
                      <TableRow key={t.tenantId}>
                        <TableCell className="font-medium">{t.tenantName}</TableCell>
                        <TableCell className="text-sm">
                          {t.hasPolicy ? (t.policyTier ?? '—') : (
                            <span className="text-muted-foreground">no policy</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{fmt(t.requireMFA)}</TableCell>
                        <TableCell className="text-sm">
                          {t.sessionTimeout == null ? '—' : `${t.sessionTimeout}m`}
                        </TableCell>
                        <TableCell className="text-sm">{fmt(t.auditLevel)}</TableCell>
                        <TableCell>
                          {t.drift.length === 0 ? (
                            <StatusBadge tone="success" dot>
                              Compliant
                            </StatusBadge>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 text-sm text-warning"
                              title={t.drift
                                .map((d) => `${d.label}: ${d.rationale}`)
                                .join('\n')}
                            >
                              <ShieldAlert className="size-4" />
                              {t.drift.length} issue{t.drift.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Drift detail: what each drifting school is missing */}
          {tenants.some((t) => t.drift.length > 0) ? (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="size-4 text-warning" /> Drift detail
                </CardTitle>
                <CardDescription>
                  Where schools fall short of the baseline.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {tenants
                  .filter((t) => t.drift.length > 0)
                  .map((t) => (
                    <div key={t.tenantId} className="flex flex-col gap-1">
                      <span className="font-medium">{t.tenantName}</span>
                      <ul className="ml-4 list-disc text-muted-foreground">
                        {t.drift.map((d) => (
                          <li key={d.field}>
                            {d.label}: expected {fmt(d.baseline)}, got {fmt(d.actual)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
