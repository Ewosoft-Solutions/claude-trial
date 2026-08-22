import { Download } from 'lucide-react';

import { serverApiGet } from '@/lib/server-api';
import { Button } from '@workspace/ui/components/button';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';

import { GradebookClient, type GradeRow } from './gradebook-client';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

type Paginated<T> = { data?: T[] };

/**
 * `subjectLabel`/`classLabel` are resolved by the API from whichever anchor the
 * assessment carries. Reading `class` directly labelled every structured
 * assessment "Unassigned", since those have no legacy class.
 */
interface ApiAssessment {
  id: string;
  name?: string | null;
  maxPoints?: number | string | null;
  subjectLabel?: string | null;
  classLabel?: string | null;
}

/**
 * The grade's student is resolved by the API from whichever anchor the row
 * carries — `studentId` on a re-keyed grade, its enrolment on a legacy one —
 * so it is a flat object here. It used to be reached through `enrollment`,
 * which is null on every grade of a structured assessment; those rows showed
 * up as "Unknown student".
 */
interface ApiGrade {
  id: string;
  assessmentId?: string | null;
  pointsEarned?: number | string | null;
  percentage?: number | string | null;
  letterGrade?: string | null;
  status?: string | null;
  student?: {
    id?: string | null;
    studentNumber?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
}

function asArray<T>(payload: T[] | Paginated<T> | null): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
}

function numeric(value: number | string | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function studentName(grade: ApiGrade): string {
  const student = grade.student;
  return (
    [student?.firstName, student?.lastName].filter(Boolean).join(' ') ||
    student?.email ||
    'Unknown student'
  );
}

function classLabel(assessment: ApiAssessment | undefined): string {
  return (
    [assessment?.subjectLabel, assessment?.classLabel]
      .filter(Boolean)
      .join(' · ') || 'Unassigned'
  );
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
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
}

export default async function GradebookPage() {
  const assessmentData = await serverApiGet<
    ApiAssessment[] | Paginated<ApiAssessment>
  >('/assessments?limit=100');
  const assessments = asArray(assessmentData);
  const assessmentsById = new Map(
    assessments.map((assessment) => [assessment.id, assessment]),
  );
  const gradeGroups = await Promise.all(
    assessments.slice(0, 20).map(async (assessment) => ({
      assessment,
      grades:
        (await serverApiGet<ApiGrade[]>(
          `/grades/assessment/${assessment.id}`,
        )) ?? [],
    })),
  );

  const rows: GradeRow[] = gradeGroups.flatMap((group) =>
    group.grades.map((grade) => {
      const assessment =
        assessmentsById.get(grade.assessmentId ?? '') ?? group.assessment;
      const percentage = numeric(grade.percentage);
      const letter = letterFor(grade);
      return {
        id: grade.id,
        student: studentName(grade),
        studentNumber: grade.student?.studentNumber ?? 'Unassigned',
        // The model field is `name`; reading `title` was always undefined, so
        // this column showed a raw UUID.
        assessment: assessment.name ?? assessment.id,
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

        {/* Governed table (golden rule 10): search, filters, sort and a
            pager, instead of the hand-rolled <Table> that printed every row
            it had fetched. */}
        <GradebookClient rows={rows} assessmentCount={assessments.length} />
      </div>
    </ShellMain>
  );
}
