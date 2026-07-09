/* ============================================================
   /classes/tutor-usage — Teacher visibility v1 (server component)

   Lists academic AI tutor usage across the classes the teacher is allocated
   to (sessions, per-student question counts, last activity). The full
   integrity dashboard is a later enhancement (ai-integration-plan Step 5).
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
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
import { EmptyState } from '@workspace/ui/custom/states/page-states';

interface UsageRow {
  sessionId: string;
  lessonId: string | null;
  lessonTitle: string | null;
  className: string | null;
  studentProfileId: string;
  studentName: string;
  questionCount: number;
  startedAt: string;
  lastActivityAt: string;
}

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export default async function TutorUsagePage() {
  const rows = (await serverApiGet<UsageRow[]>('/ai/academic/usage')) ?? [];

  const totalQuestions = rows.reduce((sum, r) => sum + r.questionCount, 0);
  const students = new Set(rows.map((r) => r.studentProfileId)).size;

  return (
    <ShellMain>
      <PageHeader
        title="Tutor usage"
        description="How students are using the AI study tutor across the classes you teach. Answers are grounded in your approved lesson materials and blocked during assessments."
        meta={
          rows.length > 0
            ? [
                { key: 'sessions', label: `${rows.length} sessions` },
                { key: 'students', label: `${students} students` },
                {
                  key: 'questions',
                  label: `${totalQuestions} questions asked`,
                },
              ]
            : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No tutor activity yet"
          description="When students in your classes use the study tutor, their sessions and question counts will appear here."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Lesson</TableHead>
              <TableHead>Class</TableHead>
              <TableHead className="text-right">Questions</TableHead>
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.sessionId}>
                <TableCell className="font-medium">{row.studentName}</TableCell>
                <TableCell>{row.lessonTitle ?? '—'}</TableCell>
                <TableCell>{row.className ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.questionCount}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(row.lastActivityAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ShellMain>
  );
}
