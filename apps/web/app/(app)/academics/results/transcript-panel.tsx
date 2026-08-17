'use client';

/**
 * WB4-4 · Transcript — a student's cumulative record, read from published
 * snapshots only. Every term cites the publication version + snapshot checksum
 * it came from, so the document can be defended long after the cycle closed; an
 * absent subject shows as absent and never counts as zero. Issuing stores an
 * immutable transcript artifact (audited).
 */
import * as React from 'react';
import { toast } from 'sonner';
import { FileText, ShieldCheck } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';

import { apiGet, apiPost } from './results-api';

export interface TranscriptStudentOption {
  id: string;
  studentNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
}

interface TranscriptSubject {
  subjectLabel: string;
  percentage: number | null;
  letterGrade: string | null;
  total: number | null;
  maxTotal: number | null;
}
interface TranscriptTerm {
  cycleId: string;
  cycleName: string;
  academicYearName: string;
  termName: string | null;
  version: number;
  checksum: string;
  publishedAt: string;
  average: number | null;
  overallGrade: string | null;
  position: number | null;
  promotionRecommendation: string | null;
  sectionLabel: string | null;
  subjects: TranscriptSubject[];
}
interface Transcript {
  student: {
    id: string;
    studentNumber: string | null;
    studentName: string | null;
  };
  terms: TranscriptTerm[];
  summary: {
    cumulativeAverage: number | null;
    gradedSubjectCount: number;
    termCount: number;
    subjects: {
      subjectLabel: string;
      terms: number;
      average: number | null;
      best: number | null;
      worst: number | null;
    }[];
    years: {
      academicYearId: string;
      academicYearName: string;
      terms: number;
      average: number | null;
    }[];
  };
  visibleToGuardian: boolean;
  transcriptDocumentId: string | null;
  generatedAt: string;
}

export function studentLabel(s: TranscriptStudentOption): string {
  const name =
    s.name ||
    [s.firstName, s.lastName].filter(Boolean).join(' ') ||
    s.studentNumber ||
    s.id;
  return s.studentNumber && name !== s.studentNumber
    ? `${name} · ${s.studentNumber}`
    : name;
}

function pct(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

export function TranscriptPanel({
  students,
  canManage,
}: {
  students: TranscriptStudentOption[];
  canManage: boolean;
}) {
  const [studentId, setStudentId] = React.useState('');
  const [transcript, setTranscript] = React.useState<Transcript | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async (id: string) => {
    setBusy(true);
    try {
      const data = await apiGet<Transcript>(`/students/${id}/transcript`);
      setTranscript(data);
    } catch (e) {
      setTranscript(null);
      toast.error(e instanceof Error ? e.message : 'Could not load transcript');
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (studentId) void load(studentId);
    else setTranscript(null);
  }, [studentId, load]);

  async function issue() {
    setBusy(true);
    try {
      const res = await apiPost<{ documentId: string; termCount: number }>(
        `/students/${studentId}/transcript`,
      );
      toast.success(`Transcript issued (${res.termCount} term(s))`);
      await load(studentId);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not issue the transcript',
      );
    } finally {
      setBusy(false);
    }
  }

  if (students.length === 0) {
    return (
      <EmptyState
        title="No students to show"
        description="Register students in the academics workbench first."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5 sm:min-w-72">
          <Label htmlFor="tx-student">Student</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger id="tx-student">
              <SelectValue placeholder="Choose a student" />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {studentLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && transcript && transcript.terms.length > 0 && (
          <Button onClick={issue} disabled={busy}>
            <FileText className="size-4" aria-hidden /> Issue transcript
          </Button>
        )}
      </div>

      {!studentId && (
        <p className="text-sm text-muted-foreground">
          Pick a student to see every result the school has published for them.
        </p>
      )}

      {transcript?.terms.length === 0 && (
        <EmptyState
          title="No published results yet"
          description="A transcript only ever reads published snapshots, so it stays empty until a result cycle is published for this student."
        />
      )}

      {transcript && transcript.terms.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-sm border p-3 text-sm">
            <div>
              <div className="text-xs uppercase text-muted-foreground">
                Cumulative average
              </div>
              <div className="font-medium">
                {pct(transcript.summary.cumulativeAverage)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">
                Published terms
              </div>
              <div className="font-medium">{transcript.summary.termCount}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">
                Graded subjects
              </div>
              <div className="font-medium">
                {transcript.summary.gradedSubjectCount}
              </div>
            </div>
            {!transcript.visibleToGuardian && (
              <StatusBadge tone="warning">
                Held from the family (financial hold)
              </StatusBadge>
            )}
            {transcript.transcriptDocumentId && (
              <StatusBadge tone="success">Transcript issued</StatusBadge>
            )}
          </div>

          {transcript.terms.map((term) => (
            <section
              key={`${term.cycleId}-${term.version}`}
              className="flex flex-col gap-2"
            >
              <header className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-sm font-medium">
                  {term.academicYearName}
                  {term.termName ? ` · ${term.termName}` : ''}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {term.cycleName}
                  {term.sectionLabel ? ` · ${term.sectionLabel}` : ''} ·
                  published {term.publishedAt} · v{term.version}
                </span>
                <span
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                  title={`Snapshot checksum ${term.checksum}`}
                >
                  <ShieldCheck className="size-3" aria-hidden />
                  {term.checksum.slice(0, 12)}…
                </span>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-2 py-1.5 font-medium">Subject</th>
                      <th className="px-2 py-1.5 font-medium">Score</th>
                      <th className="px-2 py-1.5 font-medium">%</th>
                      <th className="px-2 py-1.5 font-medium">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {term.subjects.map((s) => (
                      <tr
                        key={`${term.cycleId}-${s.subjectLabel}`}
                        className="border-b last:border-0"
                      >
                        <td className="px-2 py-1.5">{s.subjectLabel}</td>
                        <td className="px-2 py-1.5">
                          {s.percentage === null
                            ? 'Absent / exempt'
                            : `${s.total ?? '—'} / ${s.maxTotal ?? '—'}`}
                        </td>
                        <td className="px-2 py-1.5">{pct(s.percentage)}</td>
                        <td className="px-2 py-1.5">{s.letterGrade ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Term average {pct(term.average)} · grade{' '}
                {term.overallGrade ?? '—'}
                {term.position !== null ? ` · position ${term.position}` : ''}
                {term.promotionRecommendation
                  ? ` · ${term.promotionRecommendation}`
                  : ''}
              </p>
            </section>
          ))}

          <section className="flex flex-col gap-2 border-t pt-4">
            <h3 className="text-sm font-medium">Subject summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">Subject</th>
                    <th className="px-2 py-1.5 font-medium">Terms</th>
                    <th className="px-2 py-1.5 font-medium">Average</th>
                    <th className="px-2 py-1.5 font-medium">Best</th>
                    <th className="px-2 py-1.5 font-medium">Worst</th>
                  </tr>
                </thead>
                <tbody>
                  {transcript.summary.subjects.map((s) => (
                    <tr key={s.subjectLabel} className="border-b last:border-0">
                      <td className="px-2 py-1.5">{s.subjectLabel}</td>
                      <td className="px-2 py-1.5">{s.terms}</td>
                      <td className="px-2 py-1.5">{pct(s.average)}</td>
                      <td className="px-2 py-1.5">{pct(s.best)}</td>
                      <td className="px-2 py-1.5">{pct(s.worst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
