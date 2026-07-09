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
  class?: { name?: string | null; section?: string | null } | null;
}

interface ApiGrade {
  enrollmentId?: string | null;
  percentage?: number | string | null;
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

interface ReportRow {
  key: string;
  id: string;
  name: string;
  className: string;
  average: number;
  grade: string;
  tone: StateTone;
  records: number;
}

function asArray<T>(payload: T[] | Paginated<T> | null): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
}

function numeric(value: number | string | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function grade(avg: number): { letter: string; tone: StateTone } {
  if (avg >= 70) return { letter: 'A', tone: 'success' };
  if (avg >= 60) return { letter: 'B', tone: 'success' };
  if (avg >= 50) return { letter: 'C', tone: 'info' };
  if (avg >= 40) return { letter: 'D', tone: 'warning' };
  return { letter: 'F', tone: 'destructive' };
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

function classLabel(assessment: ApiAssessment): string {
  const cls = assessment.class;
  return [cls?.name, cls?.section].filter(Boolean).join(' ') || 'Unassigned';
}

export default async function ReportCardsPage() {
  const assessmentData = await serverApiGet<ApiAssessment[] | Paginated<ApiAssessment>>(
    '/assessments?limit=100',
  );
  const assessments = asArray(assessmentData);
  const gradeGroups = await Promise.all(
    assessments.slice(0, 20).map(async (assessment) => ({
      assessment,
      grades: (await serverApiGet<ApiGrade[]>(`/grades/assessment/${assessment.id}`)) ?? [],
    })),
  );

  const grouped = new Map<
    string,
    { id: string; name: string; className: string; scores: number[] }
  >();
  for (const group of gradeGroups) {
    for (const item of group.grades) {
      const score = numeric(item.percentage);
      if (score === null) continue;
      const key = item.enrollmentId ?? item.enrollment?.student?.studentNumber ?? studentName(item);
      const current = grouped.get(key) ?? {
        id: item.enrollment?.student?.studentNumber ?? key,
        name: studentName(item),
        className: classLabel(group.assessment),
        scores: [],
      };
      current.scores.push(score);
      grouped.set(key, current);
    }
  }

  const rows: ReportRow[] = Array.from(grouped.entries()).map(([key, item]) => {
    const avg = average(item.scores);
    const computed = grade(avg);
    return {
      key,
      id: item.id,
      name: item.name,
      className: item.className,
      average: avg,
      grade: computed.letter,
      tone: computed.tone,
      records: item.scores.length,
    };
  });

  const meta: PageHeaderMeta[] = [
    { key: 'source', label: 'computed from grades', emphasis: true },
    { key: 'cards', label: `${rows.length} students` },
  ];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Report cards"
          meta={meta}
          actions={
            <Button variant="outline" size="sm">
              <Download /> Export
            </Button>
          }
        />

        <DataTableLayout
          title="Term report summaries"
          description={`${rows.length} students with recorded grades`}
          empty={rows.length === 0}
          skeletonColumns={5}
          emptyState={
            <EmptyState
              compact
              title="No report card summaries yet"
              description="Recorded grades are required before report summaries can be computed."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="max-md:hidden">Class</TableHead>
                <TableHead className="text-right">Average</TableHead>
                <TableHead className="text-right">Grade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-[11px] font-semibold">
                          {initials(row.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">
                          {row.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {row.id}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-md:hidden">
                    {row.className}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {row.average}%
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge tone={row.tone}>{row.grade}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone="info" dot>
                      {row.records} grades
                    </StatusBadge>
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
