'use client';

/* ============================================================
   /reports/analytics — operational analytics

   A chart-led surface for school-wide trends: an M6 StatGrid
   headline over the shared chart wrappers (TrendChart for the
   enrollment + attendance trends, CategoryBarChart for the stacked
   admissions funnel) plus a shared Meter breakdown of capacity by
   campus. Mock figures + copy live here; the charts, StatGrid and
   Meter stay data-driven. Replaces the `[...slug]` placeholder.
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
import { CategoryBarChart } from '@workspace/ui/custom/charts/category-bar-chart';
import { TrendChart } from '@workspace/ui/custom/charts/trend-chart';
import type { ChartDatum, ChartSeries } from '@workspace/ui/types/chart.types';
import type { StatItem } from '@workspace/ui/types/layout.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

const STATS: StatItem[] = [
  {
    key: 'enrolled',
    label: 'Enrolled',
    value: '1,420',
    delta: { label: '+42 (term)', direction: 'up', intent: 'positive' },
  },
  {
    key: 'attendance',
    label: 'Avg. attendance',
    value: '94%',
    delta: { label: '+1%', direction: 'up', intent: 'positive' },
  },
  {
    key: 'retention',
    label: 'Retention',
    value: '96%',
    delta: { label: '−1%', direction: 'down', intent: 'negative' },
  },
  { key: 'capacity', label: 'Capacity used', value: '89%' },
];

const META: PageHeaderMeta[] = [
  { key: 'range', label: '2024–25 session', emphasis: true },
  { key: 'updated', label: 'updated 20m ago' },
];

/** Enrollment headcount by month (new admissions vs withdrawals). */
const ENROLL_DATA: ChartDatum[] = [
  { month: 'Sep', joined: 64, left: 8 },
  { month: 'Oct', joined: 31, left: 12 },
  { month: 'Nov', joined: 22, left: 9 },
  { month: 'Dec', joined: 14, left: 6 },
  { month: 'Jan', joined: 48, left: 11 },
  { month: 'Feb', joined: 27, left: 7 },
  { month: 'Mar', joined: 19, left: 10 },
];
const ENROLL_SERIES: ChartSeries[] = [
  { key: 'joined', label: 'Joined' },
  { key: 'left', label: 'Withdrew', color: 'var(--chart-4)' },
];

/** Weekly attendance rate (%) across the term. */
const ATTENDANCE_DATA: ChartDatum[] = [
  { week: 'W1', rate: 96 },
  { week: 'W2', rate: 95 },
  { week: 'W3', rate: 93 },
  { week: 'W4', rate: 94 },
  { week: 'W5', rate: 91 },
  { week: 'W6', rate: 94 },
  { week: 'W7', rate: 95 },
  { week: 'W8', rate: 97 },
];
const ATTENDANCE_SERIES: ChartSeries[] = [
  { key: 'rate', label: 'Attendance %', color: 'var(--chart-2)' },
];

/** Admissions funnel by month (stacked stages). */
const FUNNEL_DATA: ChartDatum[] = [
  { month: 'Jan', applied: 88, offered: 61, enrolled: 48 },
  { month: 'Feb', applied: 64, offered: 44, enrolled: 27 },
  { month: 'Mar', applied: 52, offered: 33, enrolled: 19 },
  { month: 'Apr', applied: 71, offered: 49, enrolled: 35 },
];
const FUNNEL_SERIES: ChartSeries[] = [
  { key: 'applied', label: 'Applied' },
  { key: 'offered', label: 'Offered', color: 'var(--chart-3)' },
  { key: 'enrolled', label: 'Enrolled', color: 'var(--chart-2)' },
];

/** Seat utilisation by campus. */
const CAPACITY: { label: string; value: number; tone: MeterTone }[] = [
  { label: 'Main campus', value: 92, tone: 'warning' },
  { label: 'Annex', value: 78, tone: 'info' },
  { label: 'Junior wing', value: 85, tone: 'info' },
  { label: 'Boarding', value: 64, tone: 'success' },
];

export default function AnalyticsReportPage() {
  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Analytics"
          meta={META}
          actions={
            <Button variant="outline" size="sm">
              <Download /> Export data
            </Button>
          }
        />

        <StatGrid items={STATS} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Enrollment movement</CardTitle>
              <CardDescription>Joined vs withdrew · by month</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={ENROLL_DATA}
                xKey="month"
                series={ENROLL_SERIES}
                variant="area"
                height={240}
                aria-label="Enrollment movement by month"
              />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Attendance rate</CardTitle>
              <CardDescription>Weekly average · Spring Term 2025</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={ATTENDANCE_DATA}
                xKey="week"
                series={ATTENDANCE_SERIES}
                variant="line"
                height={240}
                aria-label="Weekly attendance rate"
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Admissions funnel</CardTitle>
              <CardDescription>
                Applied → offered → enrolled · by month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryBarChart
                data={FUNNEL_DATA}
                xKey="month"
                series={FUNNEL_SERIES}
                height={260}
                aria-label="Admissions funnel by month"
              />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Capacity by campus</CardTitle>
              <CardDescription>Seats filled</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              {CAPACITY.map((c) => (
                <Meter key={c.label} label={c.label} value={c.value} tone={c.tone} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </ShellMain>
  );
}
