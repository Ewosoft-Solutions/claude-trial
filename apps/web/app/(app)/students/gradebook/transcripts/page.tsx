/**
 * Gradebook standing — a live, at-a-glance cohort view computed from the CURRENT
 * `Grade` rows, so it moves as teachers mark.
 *
 * It is deliberately NOT the transcript of record: an official transcript is
 * assembled from published, checksum-addressed result snapshots and lives in the
 * results workbench (WB4-4, `/academics/results` → Transcripts). Keeping the two
 * apart is the "one fact, one owner" rule — this page explains where a class
 * stands today; that one is the document a family can hold the school to.
 */
import { Download, ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { serverApiGet } from '@/lib/server-api';
import { Button } from '@workspace/ui/components/button';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

import {
  TranscriptsClient,
  type Standing,
  type TranscriptRow,
} from './transcripts-client';

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

function asArray<T>(payload: T[] | Paginated<T> | null): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
}

function numeric(value: number | string | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function average(values: number[]): number {
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
}

function standingFor(averageScore: number): Standing {
  if (averageScore >= 70) return 'honors';
  if (averageScore >= 50) return 'good';
  return 'watch';
}

function studentName(grade: ApiGrade): string {
  const user = grade.enrollment?.student?.userTenant?.user;
  return (
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email ||
    'Unknown student'
  );
}

function classLabel(assessment: ApiAssessment): string {
  const cls = assessment.class;
  return [cls?.name, cls?.section].filter(Boolean).join(' ') || 'Unassigned';
}

export default async function TranscriptsPage() {
  const assessmentData = await serverApiGet<
    ApiAssessment[] | Paginated<ApiAssessment>
  >('/assessments?limit=100');
  const assessments = asArray(assessmentData);
  const gradeGroups = await Promise.all(
    assessments.slice(0, 20).map(async (assessment) => ({
      assessment,
      grades:
        (await serverApiGet<ApiGrade[]>(
          `/grades/assessment/${assessment.id}`,
        )) ?? [],
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
      const key =
        item.enrollmentId ??
        item.enrollment?.student?.studentNumber ??
        studentName(item);
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

  const rows: TranscriptRow[] = Array.from(grouped.entries()).map(
    ([key, item]) => {
      const avg = average(item.scores);
      return {
        key,
        id: item.id,
        name: item.name,
        className: item.className,
        average: avg,
        gpa: Math.round((avg / 100) * 400) / 100,
        records: item.scores.length,
        standing: standingFor(avg),
      };
    },
  );

  const meta: PageHeaderMeta[] = [
    { key: 'source', label: 'live, computed from grades', emphasis: true },
    { key: 'scope', label: `${rows.length} students` },
  ];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Gradebook standing"
          meta={meta}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/academics/results">
                  <ExternalLink /> Official transcripts
                </Link>
              </Button>
              <Button variant="outline" size="sm">
                <Download /> Export
              </Button>
            </div>
          }
        />

        <p className="text-sm text-muted-foreground">
          Averages here are computed from the live gradebook and move as
          teachers mark. An <strong>official transcript</strong> is assembled
          from published result snapshots — issue one from the results
          workbench.
        </p>

        <TranscriptsClient rows={rows} />
      </div>
    </ShellMain>
  );
}
