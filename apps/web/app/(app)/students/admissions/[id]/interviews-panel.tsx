'use client';

/**
 * WB3-4 · interviews / exams / screenings on an application. Schedule a
 * touchpoint, record a structured outcome, or (for an exam carrying a question
 * paper) enter the applicant's answers and have the objective questions
 * auto-marked. All writes hit /api/admissions/{applications/:id/interviews |
 * interviews/:iid/*} and are permission-gated server-side.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarPlus, Plus, Trash2 } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';

import {
  INTERVIEW_KINDS,
  INTERVIEW_MODES,
  INTERVIEW_OUTCOME_TONE,
  INTERVIEW_STATUS_TONE,
  MODE_LABEL,
  QUIZ_STYLES,
  errorMessage,
  fmtDateTime,
  type Interview,
  type InterviewKind,
  type QuizQuestion,
  type QuizStyle,
} from '../admissions-types';

const OUTCOMES = ['pass', 'fail', 'hold'] as const;
const OBJECTIVE_STYLES: QuizStyle[] = ['mcq', 'true_false', 'short_answer'];

export function InterviewsPanel({
  applicationId,
  interviews,
  canManage,
}: {
  applicationId: string;
  interviews: Interview[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [scheduling, setScheduling] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      {interviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No interviews or exams scheduled yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {interviews.map((iv) => (
            <InterviewRow
              key={iv.id}
              interview={iv}
              canManage={canManage}
              onChange={() => router.refresh()}
            />
          ))}
        </ul>
      )}

      {canManage &&
        (scheduling ? (
          <ScheduleForm
            applicationId={applicationId}
            onDone={() => {
              setScheduling(false);
              router.refresh();
            }}
            onCancel={() => setScheduling(false)}
          />
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-fit"
            onClick={() => setScheduling(true)}
          >
            <CalendarPlus className="mr-1 size-4" aria-hidden />
            Schedule interview / exam
          </Button>
        ))}
    </div>
  );
}

function InterviewRow({
  interview: iv,
  canManage,
  onChange,
}: {
  interview: Interview;
  canManage: boolean;
  onChange: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [panel, setPanel] = React.useState<null | 'outcome' | 'quiz'>(null);

  const closed = iv.status === 'cancelled' || iv.status === 'no_show';
  const hasPaper = iv.kind === 'exam' && (iv.questions?.length ?? 0) > 0;

  async function send(path: string, body: unknown, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admissions/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Action failed'));
        return;
      }
      toast.success(okMsg);
      setPanel(null);
      onChange();
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {iv.title || defaultTitle(iv.kind)}
          </span>
          <span className="text-xs capitalize text-muted-foreground">
            {iv.kind} · {MODE_LABEL[iv.mode] ?? iv.mode}
            {iv.scheduledFor ? ` · ${fmtDateTime(iv.scheduledFor)}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {iv.outcome && (
            <StatusBadge tone={INTERVIEW_OUTCOME_TONE[iv.outcome] ?? 'neutral'}>
              {iv.outcome}
            </StatusBadge>
          )}
          {iv.score != null && (
            <StatusBadge tone="info">
              {iv.score}
              {iv.maxScore != null ? `/${iv.maxScore}` : ''}
            </StatusBadge>
          )}
          <StatusBadge tone={INTERVIEW_STATUS_TONE[iv.status] ?? 'neutral'}>
            {iv.status.replace('_', ' ')}
          </StatusBadge>
        </div>
      </div>

      {iv.needsManualGrading && (
        <p className="text-xs text-warning">
          Auto-marked objective questions — an essay still needs manual grading.
        </p>
      )}
      {iv.notes && <p className="text-xs text-muted-foreground">{iv.notes}</p>}

      {canManage && !closed && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setPanel(panel === 'outcome' ? null : 'outcome')}
          >
            Record outcome
          </Button>
          {hasPaper && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setPanel(panel === 'quiz' ? null : 'quiz')}
            >
              Enter quiz answers
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void send(
                `interviews/${iv.id}/cancel`,
                { status: 'cancelled' },
                'Cancelled',
              )
            }
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void send(
                `interviews/${iv.id}/cancel`,
                { status: 'no_show' },
                'Marked no-show',
              )
            }
          >
            No-show
          </Button>
        </div>
      )}

      {panel === 'outcome' && (
        <OutcomeForm
          busy={busy}
          onSubmit={(body) =>
            void send(`interviews/${iv.id}/outcome`, body, 'Outcome recorded')
          }
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === 'quiz' && hasPaper && (
        <QuizForm
          questions={iv.questions ?? []}
          busy={busy}
          onSubmit={(answers) =>
            void send(`interviews/${iv.id}/quiz`, { answers }, 'Quiz marked')
          }
          onCancel={() => setPanel(null)}
        />
      )}
    </li>
  );
}

function OutcomeForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [outcome, setOutcome] = React.useState<string>('');
  const [score, setScore] = React.useState('');
  const [maxScore, setMaxScore] = React.useState('');
  const [notes, setNotes] = React.useState('');

  return (
    <div className="flex flex-col gap-3 rounded-md bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Outcome</Label>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {OUTCOMES.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Score</Label>
          <Input
            className="h-9 w-20"
            inputMode="numeric"
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Out of</Label>
          <Input
            className="h-9 w-20"
            inputMode="numeric"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            onSubmit({
              outcome: outcome || undefined,
              score: score === '' ? undefined : Number(score),
              maxScore: maxScore === '' ? undefined : Number(maxScore),
              notes: notes.trim() || undefined,
            })
          }
        >
          Save outcome
        </Button>
      </div>
    </div>
  );
}

function QuizForm({
  questions,
  busy,
  onSubmit,
  onCancel,
}: {
  questions: QuizQuestion[];
  busy: boolean;
  onSubmit: (answers: { questionId: string; answer: string }[]) => void;
  onCancel: () => void;
}) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));

  return (
    <div className="flex flex-col gap-3 rounded-md bg-muted/40 p-3">
      {questions.map((q, i) => (
        <div key={q.id} className="flex flex-col gap-1.5">
          <Label className="text-xs">
            {i + 1}. {q.text}{' '}
            <span className="text-muted-foreground">({q.points} pt)</span>
          </Label>
          {(q.style === 'mcq' || q.style === 'true_false') &&
          (q.options?.length ?? 0) > 0 ? (
            <Select
              value={answers[q.id] ?? ''}
              onValueChange={(v) => set(q.id, v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {(q.options ?? []).map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : q.style === 'essay' ? (
            <Textarea
              value={answers[q.id] ?? ''}
              onChange={(e) => set(q.id, e.target.value)}
              rows={2}
            />
          ) : (
            <Input
              value={answers[q.id] ?? ''}
              onChange={(e) => set(q.id, e.target.value)}
            />
          )}
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            onSubmit(
              Object.entries(answers)
                .filter(([, v]) => v.trim() !== '')
                .map(([questionId, answer]) => ({ questionId, answer })),
            )
          }
        >
          Submit &amp; mark
        </Button>
      </div>
    </div>
  );
}

function ScheduleForm({
  applicationId,
  onDone,
  onCancel,
}: {
  applicationId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [kind, setKind] = React.useState<InterviewKind>('interview');
  const [title, setTitle] = React.useState('');
  const [mode, setMode] = React.useState<string>('in_person');
  const [scheduledFor, setScheduledFor] = React.useState('');
  const [questions, setQuestions] = React.useState<QuizQuestion[]>([]);

  function addQuestion() {
    setQuestions((qs) => [
      ...qs,
      {
        id: `q${qs.length + 1}-${Date.now()}`,
        style: 'mcq',
        text: '',
        options: ['', ''],
        correctAnswer: '',
        points: 1,
      },
    ]);
  }

  async function submit() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        kind,
        title: title.trim() || undefined,
        mode,
        scheduledFor: scheduledFor
          ? new Date(scheduledFor).toISOString()
          : undefined,
      };
      if (kind === 'exam' && questions.length > 0) {
        body.questions = questions.map((q) => ({
          id: q.id,
          style: q.style,
          text: q.text.trim(),
          options: q.options?.map((o) => o.trim()).filter(Boolean),
          correctAnswer: q.correctAnswer?.trim() || undefined,
          points: q.points,
        }));
      }
      const res = await fetch(
        `/api/admissions/applications/${applicationId}/interviews`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not schedule'));
        return;
      }
      toast.success('Scheduled');
      onDone();
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Kind</Label>
          <Select
            value={kind}
            onValueChange={(v) => setKind(v as InterviewKind)}
          >
            <SelectTrigger className="w-36 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVIEW_KINDS.map((k) => (
                <SelectItem key={k} value={k} className="capitalize">
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Mode</Label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVIEW_MODES.map((m) => (
                <SelectItem key={m} value={m}>
                  {MODE_LABEL[m] ?? m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">When</Label>
          <Input
            type="datetime-local"
            className="h-9"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Head-teacher interview"
          className="h-9"
        />
      </div>

      {kind === 'exam' && (
        <div className="flex flex-col gap-3 rounded-md bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quiz questions
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addQuestion}
            >
              <Plus className="mr-1 size-3.5" aria-hidden /> Add
            </Button>
          </div>
          {questions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add questions to make this an auto-marked quiz (optional).
            </p>
          )}
          {questions.map((q, i) => (
            <QuestionEditor
              key={q.id}
              index={i}
              question={q}
              onChange={(next) =>
                setQuestions((qs) => qs.map((x) => (x.id === q.id ? next : x)))
              }
              onRemove={() =>
                setQuestions((qs) => qs.filter((x) => x.id !== q.id))
              }
            />
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void submit()}>
          Schedule
        </Button>
      </div>
    </div>
  );
}

function QuestionEditor({
  index,
  question: q,
  onChange,
  onRemove,
}: {
  index: number;
  question: QuizQuestion;
  onChange: (next: QuizQuestion) => void;
  onRemove: () => void;
}) {
  const objective = OBJECTIVE_STYLES.includes(q.style);
  const showOptions = q.style === 'mcq' || q.style === 'true_false';

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-2">
      <div className="flex items-start gap-2">
        <span className="pt-2 text-xs text-muted-foreground">{index + 1}.</span>
        <Input
          value={q.text}
          onChange={(e) => onChange({ ...q, text: e.target.value })}
          placeholder="Question text"
          className="h-9 flex-1"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-9 shrink-0"
          onClick={onRemove}
          aria-label="Remove question"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2 pl-5">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Style</Label>
          <Select
            value={q.style}
            onValueChange={(v) => onChange({ ...q, style: v as QuizStyle })}
          >
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUIZ_STYLES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Points</Label>
          <Input
            className="h-9 w-16"
            inputMode="numeric"
            value={String(q.points)}
            onChange={(e) =>
              onChange({ ...q, points: Number(e.target.value) || 0 })
            }
          />
        </div>
      </div>
      {showOptions && (
        <div className="flex flex-col gap-1 pl-5">
          <Label className="text-xs">Options (comma-separated)</Label>
          <Input
            className="h-9"
            value={(q.options ?? []).join(', ')}
            onChange={(e) =>
              onChange({ ...q, options: e.target.value.split(',') })
            }
            placeholder="e.g. A, B, C"
          />
        </div>
      )}
      {objective && (
        <div className="flex flex-col gap-1 pl-5">
          <Label className="text-xs">Answer key</Label>
          <Input
            className="h-9"
            value={q.correctAnswer ?? ''}
            onChange={(e) => onChange({ ...q, correctAnswer: e.target.value })}
            placeholder={showOptions ? 'Matching option' : 'Correct answer'}
          />
        </div>
      )}
    </div>
  );
}

function defaultTitle(kind: InterviewKind): string {
  return kind === 'exam'
    ? 'Entrance exam'
    : kind === 'screening'
      ? 'Screening'
      : 'Interview';
}
