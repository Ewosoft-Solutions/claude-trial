import { Download } from 'lucide-react';

import { serverApiGet } from '@/lib/server-api';
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

type Paginated<T> = { data?: T[] };

interface ApiAssessment {
  id: string;
  title?: string | null;
  maxPoints?: number | string | null;
  class?: { name?: string | null; section?: string | null } | null;
}

interface ApiGrade {
  id: string;
  assessmentId?: string | null;
  pointsEarned?: number | string | null;
  percentage?: number | string | null;
  letterGrade?: string | null;
  status?: string | null;
  enrollment?: {
    student?: {
      studentNumber?: string | null;
      userTenant?: {
        user?: {
          firstName?: string | null;
          lastName?: string | null;
          email?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
}

interface GradeRow {
  id: string;
  student: string;
  studentNumber: string;
  assessment: string;
  className: string;
  points: number | null;
  maxPoints: number | null;
  percentage: number | null;
  letter: string;
  tone: StateTone;
}

function asArray<T>(payload: T[] | Paginated<T> | null): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
}

function numeric(value: number | string | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function studentName(grade: ApiGrade): string {
  const user = grade.enrollment?.student?.userTenant?.user;
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Unknown student';
}

function classLabel(assessment: ApiAssessment | undefined): string {
  const cls = assessment?.class;
  return [cls?.name, cls?.section].filter(Boolean).join(' ') || 'Unassigned';
}

function gradeTone(letter: string, percentage: number | null): StateTone {
  const value = percentage ?? 0;
  if (letter === 'A' || letter === 'B' || value >= 60) return 'success';
  if (letter === 'C' || value >= 50) return 'info';
  if (letter === 'D' || letter === 'E' || value >= 40) return 'warning';
  return 'destructive';
}

function letterFor(grade: ApiGrade): string {
  if (grade.letterGrade) return grade.letterGrade.slice(0, 1).toUpperCase();
  const percentage = numeric(grade.percentage);
  if (percentage === null) return 'Pending';
  if (percentage >= 70) return 'A';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 45) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export default async function GradebookPage() {
  const assessmentData = await serverApiGet<ApiAssessment[] | Paginated<ApiAssessment>>(
    '/assessments?limit=100',
  );
  const assessments = asArray(assessmentData);
  const assessmentsById = new Map(assessments.map((assessment) => [assessment.id, assessment]));
  const gradeGroups = await Promise.all(
    assessments
      .slice(0, 20)
      .map(async (assessment) => ({
        assessment,
        grades: (await serverApiGet<ApiGrade[]>(`/grades/assessment/${assessment.id}`)) ?? [],
      })),
  );

  const rows: GradeRow[] = gradeGroups.flatMap((group) =>
    group.grades.map((grade) => {
      const assessment = assessmentsById.get(grade.assessmentId ?? '') ?? group.assessment;
      const percentage = numeric(grade.percentage);
      const letter = letterFor(grade);
      return {
        id: grade.id,
        student: studentName(grade),
        studentNumber: grade.enrollment?.student?.studentNumber ?? 'Unassigned',
        assessment: assessment.title ?? assessment.id,
        className: classLabel(assessment),
        points: numeric(grade.pointsEarned),
        maxPoints: numeric(assessment.maxPoints),
        percentage,
        letter,
        tone: gradeTone(letter, percentage),
      };
    }),
  );

  const percentages = rows
    .map((row) => row.percentage)
    .filter((value): value is number => value !== null);
  const meta: PageHeaderMeta[] = [
    { key: 'source', label: 'live grades', emphasis: true },
    { key: 'average', label: `${average(percentages)}% average` },
  ];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Gradebook"
          meta={meta}
          actions={
            <Button variant="outline" size="sm">
              <Download /> Export results
            </Button>
          }
        />

        <DataTableLayout
          title="Recorded grades"
          description={`${rows.length} grades across ${assessments.length} assessments`}
          empty={rows.length === 0}
          skeletonColumns={6}
          emptyState={
            <EmptyState
              compact
              title="No grades recorded yet"
              description="Grades entered for assessments will appear here."
            />
          }
          footer={
            <span>
              <strong className="text-foreground">{rows.length}</strong> grades ·{' '}
              {assessments.length} assessments
            </span>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Percent</TableHead>
                <TableHead className="text-right">Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-[11px] font-semibold">
                          {initials(row.student)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <span className="break-words font-medium text-foreground">
                          {row.student}
                        </span>
                        <span className="break-words text-xs text-muted-foreground">
                          {row.studentNumber}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.assessment}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.className}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.points !== null && row.maxPoints !== null
                      ? `${row.points}/${row.maxPoints}`
                      : 'Pending'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.percentage !== null ? `${Math.round(row.percentage)}%` : 'Pending'}
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge tone={row.tone}>{row.letter}</StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableLayout>
      </div>
    </ShellMain>
  );
}
