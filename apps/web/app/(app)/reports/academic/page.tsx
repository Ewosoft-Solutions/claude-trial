'use client';

/* ============================================================
   /reports/academic — academic performance report

   The analytics-flavoured surface for teaching outcomes: an M6
   StatGrid headline over the shared chart wrappers (CategoryBarChart
   for grade distribution + subject pass rates, TrendChart for the
   term-average trend). Mock figures + copy live here; the charts and
   StatGrid stay data-driven. Replaces the `[...slug]` placeholder.
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
import { CategoryBarChart } from '@workspace/ui/custom/charts/category-bar-chart';
import { TrendChart } from '@workspace/ui/custom/charts/trend-chart';
import type { ChartDatum, ChartSeries } from '@workspace/ui/types/chart.types';
import type { StatItem } from '@workspace/ui/types/layout.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

const STATS: StatItem[] = [
  {
    key: 'avg',
    label: 'Average score',
    value: '72%',
    delta: { label: '+3 pts', direction: 'up', intent: 'positive' },
  },
  {
    key: 'pass',
    label: 'Pass rate',
    value: '86%',
    delta: { label: '+2%', direction: 'up', intent: 'positive' },
  },
  { key: 'assessed', label: 'Students assessed', value: '1,318' },
  {
    key: 'atrisk',
    label: 'At-risk students',
    value: '47',
    delta: { label: '9 fewer', direction: 'down', intent: 'positive' },
  },
];

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'exam', label: 'Mid-term assessment' },
  { key: 'updated', label: 'updated 1h ago' },
];

/** Grade distribution across all assessed students. */
const GRADE_DATA: ChartDatum[] = [
  { grade: 'A', students: 214 },
  { grade: 'B', students: 392 },
  { grade: 'C', students: 388 },
  { grade: 'D', students: 201 },
  { grade: 'E', students: 76 },
  { grade: 'F', students: 47 },
];
const GRADE_SERIES: ChartSeries[] = [{ key: 'students', label: 'Students' }];

/** Average score by term (this cohort vs the school-wide mean). */
const TREND_DATA: ChartDatum[] = [
  { term: 'Term 1 ’23', cohort: 64, school: 61 },
  { term: 'Term 2 ’23', cohort: 66, school: 63 },
  { term: 'Term 3 ’23', cohort: 65, school: 64 },
  { term: 'Term 1 ’24', cohort: 69, school: 66 },
  { term: 'Term 2 ’24', cohort: 71, school: 68 },
  { term: 'Term 1 ’25', cohort: 72, school: 69 },
];
const TREND_SERIES: ChartSeries[] = [
  { key: 'cohort', label: 'This cohort' },
  { key: 'school', label: 'School avg' },
];

/** Pass rate (%) by subject, lowest first. */
const SUBJECT_DATA: ChartDatum[] = [
  { subject: 'Further Maths', pass: 61 },
  { subject: 'Physics', pass: 68 },
  { subject: 'Chemistry', pass: 74 },
  { subject: 'English', pass: 83 },
  { subject: 'Biology', pass: 88 },
  { subject: 'Mathematics', pass: 91 },
];
const SUBJECT_SERIES: ChartSeries[] = [
  { key: 'pass', label: 'Pass rate %', color: 'var(--chart-2)' },
];

export default function AcademicReportPage() {
  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Academic report"
          meta={META}
          actions={
            <Button variant="outline" size="sm">
              <Download /> Export report
            </Button>
          }
        />

        <StatGrid items={STATS} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Grade distribution</CardTitle>
              <CardDescription>1,318 students · mid-term grades</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryBarChart
                data={GRADE_DATA}
                xKey="grade"
                series={GRADE_SERIES}
                height={240}
                aria-label="Grade distribution across assessed students"
              />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Average score trend</CardTitle>
              <CardDescription>This cohort vs school-wide mean</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={TREND_DATA}
                xKey="term"
                series={TREND_SERIES}
                variant="area"
                height={240}
                aria-label="Average score trend over the last six terms"
              />
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Pass rate by subject</CardTitle>
            <CardDescription>
              Share of students at or above the pass mark · lowest first
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={SUBJECT_DATA}
              xKey="subject"
              series={SUBJECT_SERIES}
              orientation="bar"
              height={260}
              aria-label="Pass rate by subject"
            />
          </CardContent>
        </Card>
      </div>
    </ShellMain>
  );
}
