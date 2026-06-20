'use client';

/* ============================================================
   /finance/reports — financial reports

   A light analytics surface: an M6 StatGrid headline + three breakdown
   cards — a shared DonutChart (fee-status split) plus two Meter lists
   (collection rate by class, revenue mix by category). Mock figures +
   copy live here; StatGrid, DonutChart and Meter stay data-driven.
   Replaces the `[...slug]` placeholder.
   ============================================================ */

import { Download } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
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
import type { ChartSlice } from '@workspace/ui/types/chart.types';
import type { StatItem } from '@workspace/ui/types/layout.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

const STATS: StatItem[] = [
  {
    key: 'revenue',
    label: 'Revenue (term)',
    value: '₦12.4M',
    delta: { label: '+9%', direction: 'up', intent: 'positive' },
  },
  {
    key: 'rate',
    label: 'Collection rate',
    value: '87%',
    delta: { label: '+4%', direction: 'up', intent: 'positive' },
  },
  { key: 'outstanding', label: 'Outstanding', value: '₦3.1M' },
  { key: 'avgdays', label: 'Avg. days to pay', value: '11' },
];

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'updated', label: 'updated 1h ago' },
];

/** Collection rate per class. */
const BY_CLASS: { label: string; value: number; tone: MeterTone }[] = [
  { label: 'JSS 1A', value: 92, tone: 'success' },
  { label: 'JSS 2B', value: 74, tone: 'warning' },
  { label: 'JSS 3A', value: 88, tone: 'success' },
  { label: 'SSS 1A', value: 65, tone: 'warning' },
  { label: 'SSS 2B', value: 95, tone: 'success' },
  { label: 'SSS 3A', value: 81, tone: 'info' },
];

/** Fee status split — share of billed fees by settlement state. */
const FEE_STATUS: ChartSlice[] = [
  { key: 'paid', label: 'Paid in full', value: 72, color: 'var(--chart-2)' },
  { key: 'partial', label: 'Partial', value: 13, color: 'var(--chart-3)' },
  { key: 'outstanding', label: 'Outstanding', value: 10, color: 'var(--chart-4)' },
  { key: 'overdue', label: 'Overdue', value: 5, color: 'var(--chart-5)' },
];

/** Revenue mix by category (share of term revenue). */
const BY_CATEGORY: { label: string; value: number; amount: string }[] = [
  { label: 'Tuition', value: 68, amount: '₦8.4M' },
  { label: 'Transport', value: 14, amount: '₦1.7M' },
  { label: 'Meals', value: 9, amount: '₦1.1M' },
  { label: 'Uniforms', value: 5, amount: '₦0.6M' },
  { label: 'Other', value: 4, amount: '₦0.5M' },
];

export default function FinanceReportsPage() {
  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Financial reports"
          meta={META}
          actions={
            <Button variant="outline" size="sm">
              <Download /> Export report
            </Button>
          }
        />

        <StatGrid items={STATS} />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Fee status</CardTitle>
              <CardDescription>Share of billed fees · Spring Term 2025</CardDescription>
            </CardHeader>
            <CardContent>
              <DonutChart
                slices={FEE_STATUS}
                height={240}
                aria-label="Fee status split by share of billed fees"
              />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Collection rate by class</CardTitle>
              <CardDescription>Share of billed fees collected</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              {BY_CLASS.map((c) => (
                <Meter key={c.label} label={c.label} value={c.value} tone={c.tone} />
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Revenue by category</CardTitle>
              <CardDescription>Spring Term 2025 · ₦12.4M total</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              {BY_CATEGORY.map((c) => (
                <Meter
                  key={c.label}
                  label={c.label}
                  value={c.value}
                  valueLabel={`${c.amount} · ${c.value}%`}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </ShellMain>
  );
}
