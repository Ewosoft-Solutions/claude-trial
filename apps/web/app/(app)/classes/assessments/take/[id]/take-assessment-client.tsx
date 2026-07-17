'use client';

import * as React from 'react';
import {
  CheckCircle2,
  Clock,
  Cloud,
  CloudOff,
  LoaderCircle,
  Send,
} from 'lucide-react';

import {
  academicsApi,
  formatDate,
  readError,
  type AssessmentSubmission,
  type StudentPaper,
  type StudentPaperQuestion,
} from '@/lib/academics';
import { Button } from '@workspace/ui/components/button';
import { Textarea } from '@workspace/ui/components/textarea';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { NoticeBanner } from '@workspace/ui/custom/states/notice-banner';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { cn } from '@workspace/ui/lib/utils';
import { authedFetch } from '@/lib/authed-fetch';
import { useSessionActivityMode } from '@/app/providers/session-lifecycle-provider';

type Answers = Record<string, string>;

function scoreText(submission: AssessmentSubmission): string {
  if (submission.pointsEarned == null || submission.maxPoints == null)
    return '-';
  return `${submission.pointsEarned} / ${submission.maxPoints}`;
}

function remainingMs(
  attempt: AssessmentSubmission | null,
  durationMinutes: number | null | undefined,
  now: number,
): number | null {
  if (!attempt || !durationMinutes) return null;
  const deadline =
    new Date(attempt.startedAt).getTime() + durationMinutes * 60 * 1000;
  return Math.max(0, deadline - now);
}

function formatRemaining(ms: number | null): string {
  if (ms == null) return 'Untimed';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function QuestionAnswer({
  row,
  value,
  disabled,
  onChange,
}: {
  row: StudentPaperQuestion;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const question = row.question;

  if (question.style === 'mcq') {
    return (
      <div className="grid gap-2 @xl/main:grid-cols-2">
        {(question.options ?? []).map((option) => (
          <button
            key={option.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.label)}
            className={cn(
              'rounded-md border p-3 text-left text-sm transition-colors',
              value === option.label
                ? 'border-primary bg-primary/8'
                : 'hover:bg-accent',
            )}
          >
            <span className="font-semibold">{option.label}.</span> {option.text}
          </button>
        ))}
      </div>
    );
  }

  if (question.style === 'true_false') {
    return (
      <div className="flex flex-wrap gap-2">
        {['true', 'false'].map((option) => (
          <Button
            key={option}
            type="button"
            variant={value === option ? 'default' : 'outline'}
            onClick={() => onChange(option)}
            disabled={disabled}
          >
            {option === 'true' ? 'True' : 'False'}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <Textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={question.style === 'essay' ? 'min-h-36' : 'min-h-20'}
    />
  );
}

export function TakeAssessmentClient({
  assessmentId,
  initialPaper,
  initialSubmissions,
}: {
  assessmentId: string;
  initialPaper: StudentPaper | null;
  initialSubmissions: AssessmentSubmission[];
}) {
  const [paper, setPaper] = React.useState(initialPaper);
  const [submissions, setSubmissions] = React.useState(initialSubmissions);
  const [attempt, setAttempt] = React.useState<AssessmentSubmission | null>(
    initialSubmissions.find(
      (submission) => submission.status === 'in_progress',
    ) ?? null,
  );
  const [answers, setAnswers] = React.useState<Answers>(() =>
    Object.fromEntries(
      (attempt?.answers ?? []).map((answer) => [
        answer.questionId,
        answer.answer,
      ]),
    ),
  );
  const [now, setNow] = React.useState(Date.now());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState<AssessmentSubmission | null>(
    initialSubmissions.find(
      (submission) => submission.status !== 'in_progress',
    ) ?? null,
  );
  const [saveStatus, setSaveStatus] = React.useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const answersRef = React.useRef(answers);
  const lastSavedRef = React.useRef(JSON.stringify(answers));
  const saveSequenceRef = React.useRef(0);

  answersRef.current = answers;
  useSessionActivityMode({ kind: 'assessment', active: Boolean(attempt) });

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (paper) return;
    async function loadPaper() {
      try {
        const res = await authedFetch(
          academicsApi(`assessments/${assessmentId}/take`),
        );
        if (!res.ok) throw new Error(await readError(res));
        setPaper((await res.json()) as StudentPaper);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Assessment unavailable');
      }
    }
    void loadPaper();
  }, [assessmentId, paper]);

  async function startAttempt() {
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(
        academicsApi(`assessments/${assessmentId}/start`),
        {
          method: 'POST',
        },
      );
      if (!res.ok) throw new Error(await readError(res));
      const nextAttempt = (await res.json()) as AssessmentSubmission;
      setAttempt(nextAttempt);
      const restoredAnswers = Object.fromEntries(
        (nextAttempt.answers ?? []).map((answer) => [
          answer.questionId,
          answer.answer,
        ]),
      );
      setAnswers(restoredAnswers);
      lastSavedRef.current = JSON.stringify(restoredAnswers);
      setSaveStatus('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start attempt');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!paper || !attempt) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        answers: paper.questions.map((row) => ({
          questionId: row.question.id,
          answer: answers[row.question.id] ?? '',
        })),
      };
      const res = await authedFetch(
        academicsApi(`assessments/${assessmentId}/submissions`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) throw new Error(await readError(res));
      const result = (await res.json()) as AssessmentSubmission;
      setSubmitted(result);
      setSubmissions((prev) => [
        ...prev.filter((item) => item.id !== result.id),
        result,
      ]);
      setAttempt(null);
      setSaveStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setBusy(false);
    }
  }

  const buildDraft = React.useCallback(
    (currentAnswers: Answers) =>
      paper
        ? {
            answers: paper.questions.map((row) => ({
              questionId: row.question.id,
              answer: currentAnswers[row.question.id] ?? '',
            })),
          }
        : null,
    [paper],
  );

  const saveDraft = React.useCallback(
    async (currentAnswers: Answers, keepalive = false) => {
      if (!attempt) return;
      const payload = buildDraft(currentAnswers);
      if (!payload) return;
      const serialized = JSON.stringify(currentAnswers);
      if (serialized === lastSavedRef.current) return;
      const sequence = ++saveSequenceRef.current;
      setSaveStatus('saving');
      try {
        const response = await authedFetch(
          academicsApi(`assessments/${assessmentId}/submissions/draft`),
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive,
          },
        );
        if (!response.ok) throw new Error(await readError(response));
        if (sequence === saveSequenceRef.current) {
          lastSavedRef.current = serialized;
          setSaveStatus('saved');
        }
      } catch {
        if (sequence === saveSequenceRef.current) setSaveStatus('error');
      }
    },
    [assessmentId, attempt, buildDraft],
  );

  React.useEffect(() => {
    if (!attempt || !paper) return;
    const serialized = JSON.stringify(answers);
    if (serialized === lastSavedRef.current) return;
    const timer = window.setTimeout(() => {
      void saveDraft(answers);
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [answers, attempt, paper, saveDraft]);

  React.useEffect(() => {
    if (!attempt) return;
    const flush = () => {
      if (document.visibilityState === 'hidden') {
        void saveDraft(answersRef.current, true);
      }
    };
    const pageHide = () => void saveDraft(answersRef.current, true);
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', pageHide);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', pageHide);
    };
  }, [attempt, saveDraft]);

  const remaining = remainingMs(
    attempt,
    paper?.assessment.durationMinutes ?? null,
    now,
  );
  const timeUp = remaining === 0;
  const answeredCount = paper
    ? paper.questions.filter((row) => (answers[row.question.id] ?? '').trim())
        .length
    : 0;

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title={paper?.assessment.name ?? 'Assessment'}
          meta={[
            {
              key: 'due',
              label: `Due ${formatDate(paper?.assessment.dueDate)}`,
              emphasis: true,
            },
            {
              key: 'timer',
              label: formatRemaining(remaining),
            },
            {
              key: 'answered',
              label: paper
                ? `${answeredCount}/${paper.questions.length} answered`
                : '0 answered',
            },
          ]}
          actions={
            attempt ? (
              <Button
                onClick={() => void submit()}
                disabled={busy || timeUp || !paper}
              >
                <Send /> Submit
              </Button>
            ) : (
              <Button
                onClick={() => void startAttempt()}
                disabled={busy || !paper}
              >
                <Clock /> Start
              </Button>
            )
          }
        />

        {error ? (
          <NoticeBanner
            tone="destructive"
            title="Something went wrong"
            description={error}
            onDismiss={() => setError(null)}
          />
        ) : null}
        {submitted ? (
          <NoticeBanner
            tone={submitted.needsManualGrading ? 'warning' : 'success'}
            title="Submitted"
            description={
              submitted.needsManualGrading
                ? 'This attempt is waiting for teacher review.'
                : `Score: ${scoreText(submitted)}`
            }
          />
        ) : null}

        {!paper ? (
          <EmptyState
            compact
            title="Assessment unavailable"
            description="Check the link or ask your teacher for the assessment ID."
          />
        ) : (
          <div className="grid gap-5 @5xl/main:grid-cols-[1fr_18rem]">
            <div className="grid gap-4">
              {paper.assessment.instructions ? (
                <section className="rounded-lg border bg-card p-4">
                  <h2 className="text-sm font-semibold">Instructions</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {paper.assessment.instructions}
                  </p>
                </section>
              ) : null}

              {paper.questions.map((row, index) => (
                <section
                  key={row.question.id}
                  className="rounded-lg border bg-card p-4"
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Question {index + 1} · {row.points} point
                        {Number(row.points) === 1 ? '' : 's'}
                      </p>
                      {row.question.instruction ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.question.instruction}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge tone="info">
                      {row.question.style.replace('_', ' ')}
                    </StatusBadge>
                  </div>
                  <p className="mb-4 whitespace-pre-wrap text-sm font-medium leading-6">
                    {row.question.text}
                  </p>
                  <QuestionAnswer
                    row={row}
                    value={answers[row.question.id] ?? ''}
                    disabled={!attempt || busy || timeUp}
                    onChange={(value) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [row.question.id]: value,
                      }))
                    }
                  />
                </section>
              ))}
            </div>

            <aside className="grid content-start gap-4">
              <section className="rounded-lg border bg-card p-4">
                <h2 className="text-sm font-semibold">Attempt</h2>
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Status</span>
                    <StatusBadge
                      tone={
                        attempt ? 'info' : submitted ? 'success' : 'neutral'
                      }
                    >
                      {attempt
                        ? 'In progress'
                        : submitted
                          ? 'Submitted'
                          : 'Not started'}
                    </StatusBadge>
                  </div>
                  {attempt ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Draft</span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 text-xs font-medium',
                          saveStatus === 'error'
                            ? 'text-destructive'
                            : 'text-muted-foreground',
                        )}
                      >
                        {saveStatus === 'saving' ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : saveStatus === 'error' ? (
                          <CloudOff className="size-3.5" />
                        ) : (
                          <Cloud className="size-3.5" />
                        )}
                        {saveStatus === 'saving'
                          ? 'Saving…'
                          : saveStatus === 'error'
                            ? 'Not saved'
                            : 'Saved'}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium">
                      {formatRemaining(remaining)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Attempts</span>
                    <span className="font-medium">
                      {submissions.length} / {paper.assessment.maxAttempts ?? 1}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border bg-card p-4">
                <h2 className="text-sm font-semibold">History</h2>
                {submissions.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No attempts yet.
                  </p>
                ) : (
                  <ul className="mt-3 grid gap-2">
                    {submissions.map((submission) => (
                      <li
                        key={submission.id}
                        className="rounded-md border bg-muted/30 p-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span>Attempt {submission.attempt}</span>
                          <StatusBadge
                            tone={
                              submission.status === 'graded'
                                ? 'success'
                                : submission.needsManualGrading
                                  ? 'warning'
                                  : 'info'
                            }
                          >
                            {submission.needsManualGrading
                              ? 'Review'
                              : submission.status}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {scoreText(submission)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {submitted && !submitted.needsManualGrading ? (
                <section className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="size-4 text-success" />
                    Score recorded
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {scoreText(submitted)}
                  </p>
                </section>
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </ShellMain>
  );
}
