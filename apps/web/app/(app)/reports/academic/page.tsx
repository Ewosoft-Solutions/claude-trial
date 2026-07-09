import { Download } from 'lucide-react';

import { serverApiGet } from '@/lib/server-api';
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

type Paginated<T> = { data?: T[] };

interface ApiAssessment {
  id: string;
  title?: string | null;
  dueDate?: string | null;
  createdAt?: string | null;
  class?: { name?: string | null; section?: string | null } | null;
}

interface ApiGrade {
  enrollmentId?: string | null;
  percentage?: number | string | null;
  letterGrade?: string | null;
}

const GRADE_SERIES: ChartSeries[] = [{ key: 'students', label: 'Students' }];
const TREND_SERIES: ChartSeries[] = [{ key: 'average', label: 'Average score' }];
const PASS_SERIES: ChartSeries[] = [
  { key: 'pass', label: 'Pass rate %', color: 'var(--chart-2)' },
];

function asArray<T>(payload: T[] | Paginated<T> | null): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
}

function percentageOf(grade: ApiGrade): number | null {
  const value = Number(grade.percentage);
  return Number.isFinite(value) ? value : null;
}

function letterFor(grade: ApiGrade): string {
  if (grade.letterGrade) return grade.letterGrade.slice(0, 1).toUpperCase();
  const percentage = percentageOf(grade);
  if (percentage === null) return 'Ungraded';
  if (percentage >= 70) return 'A';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 45) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
}

function assessmentLabel(assessment: ApiAssessment): string {
  return assessment.title ?? assessment.class?.name ?? assessment.id;
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return 'Unscheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unscheduled';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date);
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

export default async function AcademicReportPage() {
  const assessmentData = await serverApiGet<ApiAssessment[] | Paginated<ApiAssessment>>(
    '/assessments?limit=100',
  );
  const assessments = asArray(assessmentData);

  const gradeGroups = await Promise.all(
    assessments
      .slice(0, 20)
      .map(async (assessment) => ({
        assessment,
        grades: (await serverApiGet<ApiGrade[]>(`/grades/assessment/${assessment.id}`)) ?? [],
      })),
  );

  const grades = gradeGroups.flatMap((group) => group.grades);
  const scored = grades.map(percentageOf).filter((value): value is number => value !== null);
  const passCount = scored.filter((value) => value >= 50).length;
  const atRisk = scored.filter((value) => value < 50).length;
  const assessedStudents = new Set(grades.map((grade) => grade.enrollmentId).filter(Boolean)).size;

  const stats: StatItem[] = [
    { key: 'avg', label: 'Average score', value: `${average(scored)}%` },
    { key: 'pass', label: 'Pass rate', value: `${percent(passCount, scored.length)}%` },
    { key: 'assessed', label: 'Students assessed', value: assessedStudents.toLocaleString() },
    { key: 'atrisk', label: 'At-risk students', value: atRisk.toLocaleString() },
  ];

  const meta: PageHeaderMeta[] = [
    { key: 'source', label: 'live grades', emphasis: true },
    { key: 'assessments', label: `${assessments.length} assessments` },
  ];

  const distribution = ['A', 'B', 'C', 'D', 'E', 'F', 'Ungraded'].map((grade) => ({
    grade,
    students: grades.filter((item) => letterFor(item) === grade).length,
  }));

  const trend: ChartDatum[] = gradeGroups
    .map((group) => {
      const values = group.grades.map(percentageOf).filter((value): value is number => value !== null);
      return {
        term: dateLabel(group.assessment.dueDate ?? group.assessment.createdAt),
        average: average(values),
      };
    })
    .filter((row) => row.average > 0)
    .slice(-8);

  const passByAssessment: ChartDatum[] = gradeGroups
    .map((group) => {
      const values = group.grades.map(percentageOf).filter((value): value is number => value !== null);
      return {
        assessment: assessmentLabel(group.assessment),
        pass: percent(values.filter((value) => value >= 50).length, values.length),
      };
    })
    .filter((row) => row.pass > 0)
    .slice(0, 8);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Academic report"
          meta={meta}
          actions={
            <Button variant="outline" size="sm">
              <Download /> Export report
            </Button>
          }
        />

        <StatGrid items={stats} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Grade distribution</CardTitle>
              <CardDescription>Grouped from recorded assessment grades</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryBarChart
                data={distribution}
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
              <CardDescription>Average by assessment due date</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={trend}
                xKey="term"
                series={TREND_SERIES}
                variant="area"
                height={240}
                aria-label="Average score trend across assessments"
              />
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Pass rate by assessment</CardTitle>
            <CardDescription>Share of recorded grades at or above the pass mark</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={passByAssessment}
              xKey="assessment"
              series={PASS_SERIES}
              orientation="bar"
              height={260}
              aria-label="Pass rate by assessment"
            />
          </CardContent>
        </Card>
      </div>
    </ShellMain>
  );
}
