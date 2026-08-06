import { Suspense } from 'react';
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
import { Skeleton } from '@workspace/ui/components/skeleton';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { StatRowSkeleton } from '@workspace/ui/custom/states/page-skeletons';
import { Meter, type MeterTone } from '@workspace/ui/custom/data-display/meter';
import { CategoryBarChart } from '@workspace/ui/custom/charts/category-bar-chart';
import { DonutChart } from '@workspace/ui/custom/charts/donut-chart';
import { TrendChart } from '@workspace/ui/custom/charts/trend-chart';
import type {
  ChartDatum,
  ChartSeries,
  ChartSlice,
} from '@workspace/ui/types/chart.types';
import type { StatItem } from '@workspace/ui/types/layout.types';

type Paginated<T> = { data?: T[]; pagination?: { total?: number } };

interface ApiStudent {
  id: string;
  createdAt?: string | null;
  withdrawalDate?: string | null;
  enrollmentStatus?: string | null;
  gradeLevel?: string | null;
  enrollments?: Array<{
    status?: string | null;
    class?: {
      name?: string | null;
      section?: string | null;
      course?: { name?: string | null; code?: string | null } | null;
    } | null;
  }>;
}

interface ApiAttendanceRecord {
  date?: string | null;
  status?: string | null;
}

interface ApiApplication {
  submittedDate?: string | null;
  createdAt?: string | null;
  stage?: string | null;
  decision?: string | null;
}

interface ApiClass {
  id: string;
  name?: string | null;
  section?: string | null;
  capacity?: number | null;
  currentEnrollment?: number | null;
}

const ENROLL_SERIES: ChartSeries[] = [
  { key: 'joined', label: 'Joined' },
  { key: 'left', label: 'Withdrew', color: 'var(--chart-4)' },
];

const ATTENDANCE_SERIES: ChartSeries[] = [
  { key: 'rate', label: 'Attendance %', color: 'var(--chart-2)' },
];

const FUNNEL_SERIES: ChartSeries[] = [
  { key: 'applied', label: 'Applied' },
  { key: 'offered', label: 'Offered', color: 'var(--chart-3)' },
  { key: 'enrolled', label: 'Enrolled', color: 'var(--chart-2)' },
];

function asArray<T>(payload: T[] | Paginated<T> | null): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
}

function monthLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: '2-digit',
  }).format(date);
}

function dayLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function pctLabel(value: number): string {
  return `${value}%`;
}

function activeEnrollment(student: ApiStudent) {
  return (
    student.enrollments?.find((enrollment) => enrollment.status === 'active') ??
    student.enrollments?.[0]
  );
}

function levelLabel(student: ApiStudent): string {
  const enrollment = activeEnrollment(student);
  return (
    student.gradeLevel ??
    enrollment?.class?.course?.name ??
    enrollment?.class?.name ??
    'Unassigned'
  );
}

function buildEnrollmentTrend(students: ApiStudent[]): ChartDatum[] {
  const buckets = new Map<
    string,
    { month: string; joined: number; left: number }
  >();

  for (const student of students) {
    const joined = monthLabel(student.createdAt);
    if (joined) {
      const bucket = buckets.get(joined) ?? {
        month: joined,
        joined: 0,
        left: 0,
      };
      bucket.joined += 1;
      buckets.set(joined, bucket);
    }

    const left = monthLabel(student.withdrawalDate);
    if (left) {
      const bucket = buckets.get(left) ?? { month: left, joined: 0, left: 0 };
      bucket.left += 1;
      buckets.set(left, bucket);
    }
  }

  return Array.from(buckets.values()).slice(-8);
}

function buildAttendanceTrend(records: ApiAttendanceRecord[]): ChartDatum[] {
  const buckets = new Map<
    string,
    { week: string; present: number; total: number }
  >();

  for (const record of records) {
    const label = dayLabel(record.date);
    if (!label) continue;
    const bucket = buckets.get(label) ?? { week: label, present: 0, total: 0 };
    bucket.total += 1;
    if (record.status === 'present' || record.status === 'late')
      bucket.present += 1;
    buckets.set(label, bucket);
  }

  return Array.from(buckets.values())
    .slice(-8)
    .map((bucket) => ({
      week: bucket.week,
      rate: percent(bucket.present, bucket.total),
    }));
}

function buildFunnel(applications: ApiApplication[]): ChartDatum[] {
  const buckets = new Map<
    string,
    { month: string; applied: number; offered: number; enrolled: number }
  >();

  for (const application of applications) {
    const label = monthLabel(
      application.submittedDate ?? application.createdAt,
    );
    if (!label) continue;
    const bucket = buckets.get(label) ?? {
      month: label,
      applied: 0,
      offered: 0,
      enrolled: 0,
    };
    const stage = application.stage ?? '';
    const decision = application.decision ?? '';
    bucket.applied += 1;
    if (
      ['offer', 'enrolment', 'enrollment'].includes(stage) ||
      ['accepted', 'waitlisted'].includes(decision)
    ) {
      bucket.offered += 1;
    }
    if (stage === 'enrolled' || decision === 'accepted') {
      bucket.enrolled += 1;
    }
    buckets.set(label, bucket);
  }

  return Array.from(buckets.values()).slice(-8);
}

function buildLevelSlices(students: ApiStudent[]): ChartSlice[] {
  const counts = new Map<string, number>();
  for (const student of students) {
    counts.set(levelLabel(student), (counts.get(levelLabel(student)) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([key, value]) => ({
    key: key.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label: key,
    value,
  }));
}

function classLabel(cls: ApiClass): string {
  return [cls.name, cls.section].filter(Boolean).join(' ') || cls.id;
}

function meterTone(value: number): MeterTone {
  if (value >= 90) return 'warning';
  if (value >= 75) return 'info';
  return 'success';
}

function buildCapacity(
  classes: ApiClass[],
): { label: string; value: number; tone: MeterTone }[] {
  return classes
    .filter((cls) => Number(cls.capacity) > 0)
    .map((cls) => {
      const value = percent(
        Number(cls.currentEnrollment ?? 0),
        Number(cls.capacity),
      );
      return { label: classLabel(cls), value, tone: meterTone(value) };
    })
    .slice(0, 6);
}

/** Attendance window shared by the KPI and movement sections. Computed the
 *  same way in each so the underlying `/attendance` fetch memoizes to one
 *  request per render pass. */
function attendanceFrom(): string {
  const from = new Date();
  from.setDate(from.getDate() - 60);
  return from.toISOString().slice(0, 10);
}

/* ── Streaming sections ──────────────────────────────────────────────────
   Each section fetches only the datasets it needs and renders as soon as
   that data resolves, so the heavy `/students/roster` read never blocks
   the whole page. Identical `serverApiGet` URLs across sections are
   deduplicated by Next's per-render request memoization, so the fan-out
   below still makes just one network call per distinct endpoint. */

async function KpiStatsSection() {
  const [studentData, attendanceData, classData] = await Promise.all([
    serverApiGet<ApiStudent[] | Paginated<ApiStudent>>('/students/roster'),
    serverApiGet<ApiAttendanceRecord[]>(`/attendance?from=${attendanceFrom()}`),
    serverApiGet<Paginated<ApiClass>>('/classes?limit=200'),
  ]);

  const students = asArray(studentData);
  const attendance = attendanceData ?? [];
  const classes = asArray(classData);

  const activeStudents = students.filter(
    (student) => student.enrollmentStatus !== 'withdrawn',
  );
  const attendanceRate = percent(
    attendance.filter(
      (record) => record.status === 'present' || record.status === 'late',
    ).length,
    attendance.length,
  );
  const retentionRate = percent(activeStudents.length, students.length);
  const capacityRows = buildCapacity(classes);
  const capacityRate = capacityRows.length
    ? Math.round(
        capacityRows.reduce((sum, row) => sum + row.value, 0) /
          capacityRows.length,
      )
    : 0;

  const stats: StatItem[] = [
    {
      key: 'enrolled',
      label: 'Enrolled',
      value: activeStudents.length.toLocaleString(),
    },
    {
      key: 'attendance',
      label: 'Avg. attendance',
      value: pctLabel(attendanceRate),
    },
    { key: 'retention', label: 'Retention', value: pctLabel(retentionRate) },
    { key: 'capacity', label: 'Capacity used', value: pctLabel(capacityRate) },
  ];

  return <StatGrid items={stats} />;
}

async function MovementChartsSection() {
  const [studentData, attendanceData] = await Promise.all([
    serverApiGet<ApiStudent[] | Paginated<ApiStudent>>('/students/roster'),
    serverApiGet<ApiAttendanceRecord[]>(`/attendance?from=${attendanceFrom()}`),
  ]);

  const enrollmentTrend = buildEnrollmentTrend(asArray(studentData));
  const attendanceTrend = buildAttendanceTrend(attendanceData ?? []);

  return (
    <div className="grid gap-4 @4xl/main:grid-cols-2">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Enrollment movement</CardTitle>
          <CardDescription>
            Joined vs withdrew from student records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={enrollmentTrend}
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
          <CardDescription>
            Daily average from recent attendance records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={attendanceTrend}
            xKey="week"
            series={ATTENDANCE_SERIES}
            variant="line"
            height={240}
            aria-label="Recent attendance rate"
          />
        </CardContent>
      </Card>
    </div>
  );
}

async function AdmissionsFunnelSection() {
  const applicationData = await serverApiGet<ApiApplication[]>(
    '/admissions/applications',
  );
  const funnel = buildFunnel(applicationData ?? []);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Admissions funnel</CardTitle>
        <CardDescription>
          Application stages grouped by submitted month
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CategoryBarChart
          data={funnel}
          xKey="month"
          series={FUNNEL_SERIES}
          height={260}
          aria-label="Admissions funnel by month"
        />
      </CardContent>
    </Card>
  );
}

async function DistributionSection() {
  const [studentData, classData] = await Promise.all([
    serverApiGet<ApiStudent[] | Paginated<ApiStudent>>('/students/roster'),
    serverApiGet<Paginated<ApiClass>>('/classes?limit=200'),
  ]);

  const students = asArray(studentData);
  const activeStudents = students.filter(
    (student) => student.enrollmentStatus !== 'withdrawn',
  );
  const byLevel = buildLevelSlices(activeStudents);
  const capacityRows = buildCapacity(asArray(classData));

  return (
    <div className="grid gap-4 @4xl/main:grid-cols-2">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Enrolment by level</CardTitle>
          <CardDescription>
            Active students grouped by grade or class
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DonutChart
            slices={byLevel}
            height={240}
            aria-label="Enrolment share by level"
          />
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Capacity by class</CardTitle>
          <CardDescription>
            Seats filled from class capacity records
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3.5">
          {capacityRows.map((row) => (
            <Meter
              key={row.label}
              label={row.label}
              value={row.value}
              tone={row.tone}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** Chart-card placeholder used as a per-section Suspense fallback. */
function ChartCardFallback({
  height = 240,
  wide = false,
}: {
  height?: number;
  wide?: boolean;
}) {
  const card = (
    <Card className="shadow-card">
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </CardHeader>
      <CardContent>
        <Skeleton
          className="w-full rounded-[var(--radius-sm)]"
          style={{ height }}
        />
      </CardContent>
    </Card>
  );
  if (wide) return card;
  return (
    <div className="grid gap-4 @4xl/main:grid-cols-2">
      {card}
      {card}
    </div>
  );
}

export default function AnalyticsReportPage() {
  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Analytics"
          meta={[{ key: 'source', label: 'live data', emphasis: true }]}
          actions={
            <Button variant="outline" size="sm">
              <Download /> Export data
            </Button>
          }
        />

        <Suspense fallback={<StatRowSkeleton count={4} />}>
          <KpiStatsSection />
        </Suspense>

        <Suspense fallback={<ChartCardFallback />}>
          <MovementChartsSection />
        </Suspense>

        <Suspense fallback={<ChartCardFallback height={260} wide />}>
          <AdmissionsFunnelSection />
        </Suspense>

        <Suspense fallback={<ChartCardFallback />}>
          <DistributionSection />
        </Suspense>
      </div>
    </ShellMain>
  );
}
