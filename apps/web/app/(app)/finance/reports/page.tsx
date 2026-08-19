/* ============================================================
   /finance/reports — collections, aging, reconciliation (server component)

   The three questions a bursar is asked every week: what came in, what is
   still owed and how old it is, and whether the books agree with the bills.
   All three are computed by the API over the whole set — this page renders,
   it does not re-derive money in the browser.
   ============================================================ */

import { Suspense } from 'react';

import { serverApiGet } from '@/lib/server-api';
import { formatNaira as nairaFromKobo } from '@/lib/format';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { Meter, type MeterTone } from '@workspace/ui/custom/data-display/meter';
import { DonutChart } from '@workspace/ui/custom/charts/donut-chart';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatRowSkeleton } from '@workspace/ui/custom/states/page-skeletons';
import { Skeleton } from '@workspace/ui/components/skeleton';
import type { ChartSlice } from '@workspace/ui/types/chart.types';
import type { StatItem } from '@workspace/ui/types/layout.types';

interface InvoiceSummary {
  totalBilled?: number;
  totalDiscounts?: number;
  totalCollected?: number;
  totalOutstanding?: number;
  statusCounts?: Record<string, number>;
}

interface CollectionsReport {
  groupBy?: string;
  groups?: Array<{ key: string; total: number; receipts: number }>;
  totals?: {
    receipts?: number;
    total?: number;
    allocated?: number;
    unallocated?: number;
  };
}

interface AgingReport {
  asOf?: string;
  buckets?: Array<{
    key: string;
    label: string;
    total: number;
    invoices: number;
  }>;
  rows?: Array<{ key: string; label: string; total: number }>;
  total?: number;
}

interface ReconciliationReport {
  controls?: Array<{
    key: string;
    label: string;
    subledger: number;
    ledger: number;
    difference: number;
    explanation?: string;
  }>;
  trialBalance?: {
    totalDebit?: number;
    totalCredit?: number;
    outOfBalance?: number;
  };
  balanced?: boolean;
}

const METHOD_COLORS: Record<string, string> = {
  transfer: 'var(--chart-1)',
  cash: 'var(--chart-2)',
  card: 'var(--chart-3)',
  cheque: 'var(--chart-4)',
};

const METHOD_LABEL: Record<string, string> = {
  transfer: 'Bank transfer',
  cash: 'Cash',
  card: 'Card',
  cheque: 'Cheque',
};

function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function toneForAge(key: string): MeterTone {
  if (key === 'current') return 'success';
  if (key === 'd1_30') return 'info';
  if (key === 'd31_60') return 'warning';
  return 'destructive';
}

function formatDay(key: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(key));
  } catch {
    return key;
  }
}

/** The trailing 30 days, which is what "recent collections" means here. */
function lastThirtyDays(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - 29 * 86_400_000);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(now) };
}

async function KpiSection() {
  const window = lastThirtyDays();
  const [summary, collections] = await Promise.all([
    serverApiGet<InvoiceSummary>('/finance/invoices/summary'),
    serverApiGet<CollectionsReport>(
      `/finance/reports/collections?from=${window.from}&to=${window.to}`,
    ),
  ]);

  const billed = summary?.totalBilled ?? 0;
  const collected = summary?.totalCollected ?? 0;
  const stats: StatItem[] = [
    { key: 'billed', label: 'Total billed', value: nairaFromKobo(billed) },
    {
      key: 'collected',
      label: 'Collected',
      value: nairaFromKobo(collected),
      delta:
        billed > 0
          ? {
              label: `${percent(collected, billed)}%`,
              direction: 'up',
              intent: 'positive',
            }
          : undefined,
    },
    {
      key: 'outstanding',
      label: 'Outstanding',
      value: nairaFromKobo(summary?.totalOutstanding ?? 0),
    },
    {
      key: 'recent',
      label: 'Received (30 days)',
      value: nairaFromKobo(collections?.totals?.total ?? 0),
    },
    {
      key: 'unallocated',
      label: 'Received unallocated',
      value: nairaFromKobo(collections?.totals?.unallocated ?? 0),
    },
  ];

  return <StatGrid items={stats} />;
}

async function CollectionsSection() {
  const window = lastThirtyDays();
  const [byDay, byMethod] = await Promise.all([
    serverApiGet<CollectionsReport>(
      `/finance/reports/collections?from=${window.from}&to=${window.to}`,
    ),
    serverApiGet<CollectionsReport>(
      `/finance/reports/collections?from=${window.from}&to=${window.to}&groupBy=method`,
    ),
  ]);

  const days = (byDay?.groups ?? []).slice(-14);
  const peak = days.reduce((max, day) => Math.max(max, day.total), 0);
  const methods: ChartSlice[] = (byMethod?.groups ?? []).map((group) => ({
    key: group.key,
    label: METHOD_LABEL[group.key] ?? group.key,
    value: group.total,
    color: METHOD_COLORS[group.key],
  }));

  return (
    <div className="grid gap-4 @4xl/main:grid-cols-3">
      <Card className="shadow-card @4xl/main:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Daily collection</CardTitle>
          <CardDescription>
            What was received each day over the last fortnight
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          {days.length === 0 ? (
            <EmptyState
              compact
              title="Nothing received yet"
              description="Receipts recorded in the last 30 days show up here."
            />
          ) : (
            days.map((day) => (
              <Meter
                key={day.key}
                label={formatDay(day.key)}
                value={percent(day.total, peak)}
                valueLabel={nairaFromKobo(day.total)}
                tone="info"
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">How families paid</CardTitle>
          <CardDescription>Share of receipts by method</CardDescription>
        </CardHeader>
        <CardContent>
          {methods.length === 0 ? (
            <EmptyState compact title="No receipts in this window" />
          ) : (
            <DonutChart slices={methods} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function AgingSection() {
  const aging = await serverApiGet<AgingReport>('/finance/reports/aging');
  const buckets = aging?.buckets ?? [];
  const total = aging?.total ?? 0;
  const worst = (aging?.rows ?? []).slice(0, 8);

  return (
    <div className="grid gap-4 @4xl/main:grid-cols-3">
      <Card className="shadow-card @4xl/main:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Outstanding by age</CardTitle>
          <CardDescription>
            {nairaFromKobo(total)} still owed, by how long it has been owed
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          {total === 0 ? (
            <EmptyState
              compact
              title="Nothing outstanding"
              description="Every issued invoice is settled."
            />
          ) : (
            buckets.map((bucket) => (
              <Meter
                key={bucket.key}
                label={`${bucket.label} · ${bucket.invoices} ${
                  bucket.invoices === 1 ? 'invoice' : 'invoices'
                }`}
                value={percent(bucket.total, total)}
                valueLabel={nairaFromKobo(bucket.total)}
                tone={toneForAge(bucket.key)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Owing the most</CardTitle>
          <CardDescription>Where the outstanding debt sits</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {worst.length === 0 ? (
            <EmptyState compact title="Nothing outstanding" />
          ) : (
            worst.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate text-muted-foreground">
                  {row.label}
                </span>
                <span className="tabular-nums text-foreground">
                  {nairaFromKobo(row.total)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function ReconciliationSection() {
  const report = await serverApiGet<ReconciliationReport>(
    '/finance/reports/reconciliation',
  );

  // Reconciliation reads the ledger, which needs `finance.gl.view`; a bursar
  // without it still gets the rest of this page.
  if (!report) return null;

  const controls = report.controls ?? [];
  const outOfBalance = report.trialBalance?.outOfBalance ?? 0;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base">
          Reconciliation{' '}
          <StatusBadge tone={report.balanced ? 'success' : 'warning'} dot>
            {report.balanced ? 'Agrees' : 'Needs a look'}
          </StatusBadge>
        </CardTitle>
        <CardDescription>
          Each control total as the bills say it, and as the ledger says it
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Control</th>
                <th className="py-2 pr-3 text-right font-medium">Subledger</th>
                <th className="py-2 pr-3 text-right font-medium">Ledger</th>
                <th className="py-2 text-right font-medium">Difference</th>
              </tr>
            </thead>
            <tbody>
              {controls.map((control) => (
                <tr key={control.key} className="border-t border-border">
                  <td className="py-2 pr-3">
                    <span className="text-foreground">{control.label}</span>
                    {control.explanation ? (
                      <span className="block text-xs text-muted-foreground">
                        {control.explanation}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                    {nairaFromKobo(control.subledger)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                    {nairaFromKobo(control.ledger)}
                  </td>
                  <td className="py-2 text-right tabular-nums font-medium text-foreground">
                    {nairaFromKobo(control.difference)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border">
                <td className="py-2 pr-3 font-medium">Trial balance</td>
                <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                  {nairaFromKobo(report.trialBalance?.totalDebit ?? 0)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                  {nairaFromKobo(report.trialBalance?.totalCredit ?? 0)}
                </td>
                <td className="py-2 text-right tabular-nums font-medium text-foreground">
                  {nairaFromKobo(outOfBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CardSkeleton() {
  return <Skeleton className="h-64 w-full rounded-xl" />;
}

export default function FinanceReportsPage() {
  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader title="Finance reports" />

        <Suspense fallback={<StatRowSkeleton count={5} />}>
          <KpiSection />
        </Suspense>

        <Suspense fallback={<CardSkeleton />}>
          <CollectionsSection />
        </Suspense>

        <Suspense fallback={<CardSkeleton />}>
          <AgingSection />
        </Suspense>

        <Suspense fallback={<CardSkeleton />}>
          <ReconciliationSection />
        </Suspense>
      </div>
    </ShellMain>
  );
}
