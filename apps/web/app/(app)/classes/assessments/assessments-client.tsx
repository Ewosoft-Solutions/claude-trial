'use client';

import * as React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { useViewer } from '@/app/providers/viewer-provider';
import {
  academicsApi,
  ASSESSMENT_STATUS_META,
  formatDate,
  offeringLabel,
  readError,
  type AssessmentSubmission,
  type AssessmentSummary,
  type OfferingSummary,
  type PaperQuestion,
  type QuestionSummary,
} from '@/lib/academics';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { Textarea } from '@workspace/ui/components/textarea';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { ListDetailLayout } from '@workspace/ui/custom/layouts/list-detail-layout';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { NoticeBanner } from '@workspace/ui/custom/states/notice-banner';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { cn } from '@workspace/ui/lib/utils';
import type { StateTone } from '@workspace/ui/types/states.types';
import { Dot } from '@workspace/ui/custom/data-display/dot';

interface AssessmentDraft {
  name: string;
  type: string;
  maxPoints: string;
  dueDate: string;
  durationMinutes: string;
  maxAttempts: string;
  instructions: string;
}

const EMPTY_DRAFT: AssessmentDraft = {
  name: '',
  type: 'quiz',
  maxPoints: '10',
  dueDate: '',
  durationMinutes: '',
  maxAttempts: '1',
  instructions: '',
};

function statusMeta(status: string): { label: string; tone: StateTone } {
  return (
    ASSESSMENT_STATUS_META[status] ?? {
      label: status.replace(/_/g, ' '),
      tone: 'neutral',
    }
  );
}

function studentName(submission: AssessmentSubmission): string {
  const user = submission.enrollment?.student?.userTenant?.user;
  return (
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Student'
  );
}

export function AssessmentsClient({
  live,
  initialOfferings,
  initialAssessments,
  initialQuestions,
}: {
  live: boolean;
  initialOfferings: OfferingSummary[];
  initialAssessments: AssessmentSummary[];
  initialQuestions: QuestionSummary[];
}) {
  const { viewer } = useViewer();
  const canCreate = viewer.permissions.has('assessments.create');
  const canEdit = viewer.permissions.has('assessments.edit');
  const canGrade = viewer.permissions.has('grades.edit');
  const hasOfferings = initialOfferings.length > 0;

  const [offeringId, setOfferingId] = React.useState(
    initialOfferings[0]?.id ?? '',
  );
  const [assessments, setAssessments] = React.useState(initialAssessments);
  const [selectedId, setSelectedId] = React.useState(
    initialAssessments[0]?.id ?? '',
  );
  const [mobileDetailOpen, setMobileDetailOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(EMPTY_DRAFT);
  const [query, setQuery] = React.useState('');
  const [paper, setPaper] = React.useState<PaperQuestion[]>([]);
  const [bank, setBank] = React.useState(initialQuestions);
  const [questionId, setQuestionId] = React.useState(
    initialQuestions[0]?.id ?? '',
  );
  const [questionPoints, setQuestionPoints] = React.useState('1');
  const [submissions, setSubmissions] = React.useState<AssessmentSubmission[]>(
    [],
  );
  const [gradePoints, setGradePoints] = React.useState<Record<string, string>>(
    {},
  );
  const [gradeFeedback, setGradeFeedback] = React.useState<
    Record<string, string>
  >({});
  const [busy, setBusy] = React.useState(false);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selected =
    assessments.find((assessment) => assessment.id === selectedId) ?? null;
  const selectedOffering =
    initialOfferings.find((offering) => offering.id === offeringId) ?? null;
  // Read inside the detail loader without making the offerings a dependency of
  // it — the list is stable for the life of the page.
  const offeringsRef = React.useRef(initialOfferings);
  offeringsRef.current = initialOfferings;
  const visibleAssessments = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assessments.filter((assessment) => {
      // The server already scoped the list to the selected offering; this only
      // narrows further when a legacy row for another anchor is still in state.
      const matchesOffering =
        !offeringId ||
        !assessment.subjectOfferingId ||
        assessment.subjectOfferingId === offeringId;
      const matchesQuery =
        !needle || assessment.name.toLowerCase().includes(needle);
      return matchesOffering && matchesQuery;
    });
  }, [assessments, offeringId, query]);

  const loadAssessmentDetail = React.useCallback(
    async (assessment: AssessmentSummary | null) => {
      if (!assessment || !live) {
        setPaper([]);
        setSubmissions([]);
        return;
      }
      setLoadingDetail(true);
      setError(null);
      try {
        // The bank follows the assessment's own anchor: a structured one draws
        // from its offering's SUBJECT bank, a legacy one from its course's.
        const curriculumSubjectId = assessment.subjectOfferingId
          ? (offeringsRef.current.find(
              (offering) => offering.id === assessment.subjectOfferingId,
            )?.curriculumSubjectId ?? null)
          : null;
        const bankQuery = curriculumSubjectId
          ? new URLSearchParams({ curriculumSubjectId, limit: '100' })
          : !assessment.subjectOfferingId && assessment.class?.course?.id
            ? new URLSearchParams({
                courseId: assessment.class.course.id,
                limit: '100',
              })
            : null;
        const [paperRes, submissionsRes, bankRes] = await Promise.all([
          fetch(academicsApi(`assessments/${assessment.id}/questions`)),
          fetch(academicsApi(`assessments/${assessment.id}/submissions`)),
          bankQuery
            ? fetch(academicsApi(`questions?${bankQuery}`))
            : Promise.resolve(null),
        ]);
        if (!paperRes.ok) throw new Error(await readError(paperRes));
        if (!submissionsRes.ok)
          throw new Error(await readError(submissionsRes));
        setPaper(((await paperRes.json()) as PaperQuestion[] | null) ?? []);
        setSubmissions(
          ((await submissionsRes.json()) as AssessmentSubmission[] | null) ??
            [],
        );
        if (bankRes?.ok) {
          const nextBank =
            ((await bankRes.json()) as QuestionSummary[] | null) ?? [];
          setBank(nextBank);
          setQuestionId(nextBank[0]?.id ?? '');
        } else if (!bankQuery) {
          setBank([]);
          setQuestionId('');
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load assessment',
        );
      } finally {
        setLoadingDetail(false);
      }
    },
    [live],
  );

  React.useEffect(() => {
    void loadAssessmentDetail(selected);
  }, [selected, loadAssessmentDetail]);

  // Live mode: the assessment list is the selected offering's COMPLETE set,
  // refetched from the server whenever the offering changes — so it can never
  // hide a subject's assessments the way a client-side filter over one capped
  // page of ALL offerings would once the tenant has more than a page of them.
  const didMountRef = React.useRef(false);
  React.useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (!live || !offeringId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          academicsApi(
            `assessments?${new URLSearchParams({
              subjectOfferingId: offeringId,
              limit: '100',
            })}`,
          ),
        );
        if (!res.ok) throw new Error(await readError(res));
        const body = (await res.json()) as
          | { data?: AssessmentSummary[] }
          | AssessmentSummary[]
          | null;
        const next = Array.isArray(body) ? body : (body?.data ?? []);
        if (cancelled) return;
        setAssessments(next);
        setSelectedId(next[0]?.id ?? '');
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load assessments',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offeringId, live]);

  function newAssessment() {
    setSelectedId('');
    setDraft(EMPTY_DRAFT);
    setMobileDetailOpen(true);
  }

  async function createAssessment() {
    if (!offeringId || !draft.name.trim() || !live || !canCreate) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(academicsApi('assessments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // New assessments key on the offering; the API copies the year and
          // term off it, so neither is sent here.
          subjectOfferingId: offeringId,
          name: draft.name.trim(),
          type: draft.type,
          maxPoints: Number(draft.maxPoints || 0),
          dueDate: draft.dueDate || undefined,
          instructions: draft.instructions.trim() || undefined,
          durationMinutes: draft.durationMinutes
            ? Number(draft.durationMinutes)
            : undefined,
          maxAttempts: Number(draft.maxAttempts || 1),
          status: 'draft',
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const created = (await res.json()) as AssessmentSummary;
      setAssessments((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function publishAssessment() {
    if (!selected || !live || !canEdit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(academicsApi(`assessments/${selected.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const updated = (await res.json()) as AssessmentSummary;
      setAssessments((prev) =>
        prev.map((assessment) =>
          assessment.id === updated.id
            ? { ...assessment, ...updated }
            : assessment,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  }

  async function attachQuestion() {
    if (!selected || !questionId || !live || !canEdit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        academicsApi(`assessments/${selected.id}/questions`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questions: [{ questionId, points: Number(questionPoints || 1) }],
          }),
        },
      );
      if (!res.ok) throw new Error(await readError(res));
      setPaper(((await res.json()) as PaperQuestion[] | null) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attach failed');
    } finally {
      setBusy(false);
    }
  }

  async function detachQuestion(id: string) {
    if (!selected || !live || !canEdit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        academicsApi(`assessments/${selected.id}/questions/${id}`),
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error(await readError(res));
      setPaper((prev) => prev.filter((row) => row.questionId !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detach failed');
    } finally {
      setBusy(false);
    }
  }

  async function gradeSubmission(submission: AssessmentSubmission) {
    if (!live || !canGrade) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        academicsApi(`assessments/submissions/${submission.id}/grade`),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pointsEarned: Number(
              gradePoints[submission.id] ?? submission.pointsEarned ?? 0,
            ),
            feedback: gradeFeedback[submission.id]?.trim() || undefined,
          }),
        },
      );
      if (!res.ok) throw new Error(await readError(res));
      const updated = (await res.json()) as AssessmentSubmission;
      setSubmissions((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grade failed');
    } finally {
      setBusy(false);
    }
  }

  const pendingManual = submissions.filter(
    (submission) => submission.needsManualGrading,
  ).length;

  return (
    <ShellMain className="gap-0 pb-0">
      <PageHeader
        padded={false}
        className="pb-3"
        title="Assessments"
        meta={[
          {
            key: 'offering',
            label: selectedOffering
              ? offeringLabel(selectedOffering)
              : hasOfferings
                ? 'All subjects'
                : 'No assigned subjects',
            emphasis: true,
          },
          { key: 'count', label: `${visibleAssessments.length} assessments` },
          { key: 'manual', label: `${pendingManual} manual reviews` },
        ]}
        actions={
          canCreate && hasOfferings ? (
            <Button size="sm" onClick={newAssessment}>
              <Plus /> New assessment
            </Button>
          ) : null
        }
      />

      {live && !hasOfferings ? (
        <NoticeBanner
          tone="info"
          title="No assigned subjects"
          description="Only subjects from your active teaching assignments are available here."
        />
      ) : null}
      {error ? (
        <NoticeBanner
          tone="destructive"
          title="Something went wrong"
          description={error}
          onDismiss={() => setError(null)}
        />
      ) : null}

      <div className="mb-4 mt-4 flex flex-wrap gap-3">
        <div className="grid min-w-0 basis-64 flex-1 gap-2">
          <Label htmlFor="assessment-offering">Subject</Label>
          <Select
            value={offeringId}
            onValueChange={(value) => {
              setOfferingId(value);
              setSelectedId(
                assessments.find(
                  (assessment) => assessment.subjectOfferingId === value,
                )?.id ?? '',
              );
            }}
            disabled={!hasOfferings}
          >
            <SelectTrigger id="assessment-offering" aria-label="Select subject">
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {initialOfferings.map((offering) => (
                <SelectItem key={offering.id} value={offering.id}>
                  {offeringLabel(offering)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-0 basis-56 flex-1 gap-2">
          <Label htmlFor="assessment-search">Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="assessment-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search assessments"
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <ListDetailLayout
        className="mb-[var(--content-padding)] flex-1"
        listWidth={340}
        showDetail={mobileDetailOpen}
        list={
          <nav aria-label="Assessments" className="flex flex-col gap-1 p-2">
            {visibleAssessments.length === 0 ? (
              <EmptyState
                compact
                title={hasOfferings ? 'No assessments' : 'No assigned subjects'}
                description={
                  hasOfferings
                    ? 'Create an assessment for the selected subject.'
                    : 'Assessments appear after a subject is assigned to you.'
                }
              />
            ) : (
              visibleAssessments.map((assessment) => {
                const status = statusMeta(assessment.status);
                return (
                  <button
                    key={assessment.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(assessment.id);
                      setMobileDetailOpen(true);
                    }}
                    className={cn(
                      'rounded-md px-3 py-2 text-left transition-colors hover:bg-accent',
                      assessment.id === selectedId && 'bg-accent',
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-medium">
                          {assessment.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Due {formatDate(assessment.dueDate)}
                        </span>
                      </span>
                      <StatusBadge tone={status.tone}>
                        {status.label}
                      </StatusBadge>
                    </span>
                  </button>
                );
              })
            )}
          </nav>
        }
        detail={
          <div className="grid gap-4 p-4">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 w-fit @3xl/main:hidden"
              onClick={() => setMobileDetailOpen(false)}
            >
              <ArrowLeft /> All assessments
            </Button>
            {!selected ? (
              <div className="grid gap-4">
                <div className="grid gap-3 @3xl/main:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="new-assessment-name">Name</Label>
                    <Input
                      id="new-assessment-name"
                      value={draft.name}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-assessment-type">Type</Label>
                    <Select
                      value={draft.type}
                      onValueChange={(value) =>
                        setDraft((prev) => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger id="new-assessment-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="test">Test</SelectItem>
                        <SelectItem value="exam">Exam</SelectItem>
                        <SelectItem value="assignment">Assignment</SelectItem>
                        <SelectItem value="homework">Homework</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-assessment-points">Max points</Label>
                    <Input
                      id="new-assessment-points"
                      type="number"
                      min="1"
                      value={draft.maxPoints}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          maxPoints: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-assessment-due">Due date</Label>
                    <Input
                      id="new-assessment-due"
                      type="date"
                      value={draft.dueDate}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          dueDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-assessment-duration">Minutes</Label>
                    <Input
                      id="new-assessment-duration"
                      type="number"
                      min="1"
                      value={draft.durationMinutes}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          durationMinutes: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-assessment-attempts">Attempts</Label>
                    <Input
                      id="new-assessment-attempts"
                      type="number"
                      min="1"
                      value={draft.maxAttempts}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          maxAttempts: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-assessment-instructions">
                    Instructions
                  </Label>
                  <Textarea
                    id="new-assessment-instructions"
                    value={draft.instructions}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        instructions: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => void createAssessment()}
                    disabled={
                      !live || busy || !offeringId || !draft.name.trim()
                    }
                  >
                    <FilePlus2 /> Create assessment
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selected.type}
                      <Dot />
                      {selected.maxPoints} points
                      <Dot />
                      Due {formatDate(selected.dueDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={statusMeta(selected.status).tone}>
                      {statusMeta(selected.status).label}
                    </StatusBadge>
                    {canEdit && selected.status !== 'published' ? (
                      <Button
                        size="sm"
                        onClick={() => void publishAssessment()}
                        disabled={!live || busy || paper.length === 0}
                      >
                        <CheckCircle2 /> Publish
                      </Button>
                    ) : null}
                  </div>
                </div>

                <section className="grid gap-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Paper</h3>
                      <p className="text-xs text-muted-foreground">
                        {paper.length} questions attached
                      </p>
                    </div>
                    {canEdit ? (
                      <div className="grid gap-2 @3xl/main:grid-cols-[minmax(14rem,1fr)_6rem_auto] @3xl/main:items-end">
                        <div className="grid gap-1.5">
                          <Label htmlFor="bank-question">Question</Label>
                          <Select
                            value={questionId}
                            onValueChange={setQuestionId}
                          >
                            <SelectTrigger id="bank-question">
                              <SelectValue placeholder="Select question" />
                            </SelectTrigger>
                            <SelectContent>
                              {bank.map((question) => (
                                <SelectItem
                                  key={question.id}
                                  value={question.id}
                                >
                                  {question.text.slice(0, 80)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="question-points">Points</Label>
                          <Input
                            id="question-points"
                            type="number"
                            min="0"
                            value={questionPoints}
                            onChange={(event) =>
                              setQuestionPoints(event.target.value)
                            }
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => void attachQuestion()}
                          disabled={!live || busy || !questionId}
                        >
                          <Plus /> Attach
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {loadingDetail ? (
                    <p className="py-4 text-sm text-muted-foreground">
                      Loading assessment...
                    </p>
                  ) : paper.length === 0 ? (
                    <EmptyState
                      compact
                      icon={<ClipboardList aria-hidden />}
                      title="No questions"
                      description="Attach bank questions before publishing."
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Question</TableHead>
                          <TableHead>Style</TableHead>
                          <TableHead className="text-right">Points</TableHead>
                          <TableHead className="sr-only">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paper.map((row) => (
                          <TableRow key={row.questionId}>
                            <TableCell className="max-w-xl whitespace-normal">
                              <span className="break-words">
                                {row.question.text}
                              </span>
                            </TableCell>
                            <TableCell className="capitalize text-muted-foreground">
                              {row.question.style.replace('_', ' ')}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.points}
                            </TableCell>
                            <TableCell className="text-right">
                              {canEdit ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Detach question"
                                  onClick={() =>
                                    void detachQuestion(row.questionId)
                                  }
                                  disabled={!live || busy}
                                >
                                  <Trash2 />
                                </Button>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </section>

                <section className="grid gap-3 border-t pt-4">
                  <div>
                    <h3 className="text-sm font-semibold">Submissions</h3>
                    <p className="text-xs text-muted-foreground">
                      {submissions.length} attempts
                    </p>
                  </div>
                  {submissions.length === 0 ? (
                    <EmptyState
                      compact
                      title="No submissions"
                      description="Student attempts will appear here."
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                          <TableHead className="min-w-44">
                            Manual grade
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submissions.map((submission) => (
                          <TableRow key={submission.id}>
                            <TableCell>{studentName(submission)}</TableCell>
                            <TableCell>
                              <StatusBadge
                                tone={
                                  submission.needsManualGrading
                                    ? 'warning'
                                    : submission.status === 'graded'
                                      ? 'success'
                                      : 'info'
                                }
                              >
                                {submission.needsManualGrading
                                  ? 'Manual review'
                                  : submission.status}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {submission.pointsEarned ?? '-'} /{' '}
                              {submission.maxPoints ?? '-'}
                            </TableCell>
                            <TableCell>
                              {submission.needsManualGrading && canGrade ? (
                                <div className="flex items-center justify-end gap-2">
                                  <Input
                                    aria-label="Points earned"
                                    className="h-8 w-20"
                                    type="number"
                                    min="0"
                                    value={gradePoints[submission.id] ?? ''}
                                    onChange={(event) =>
                                      setGradePoints((prev) => ({
                                        ...prev,
                                        [submission.id]: event.target.value,
                                      }))
                                    }
                                  />
                                  <Input
                                    aria-label="Feedback"
                                    className="h-8 w-36"
                                    value={gradeFeedback[submission.id] ?? ''}
                                    onChange={(event) =>
                                      setGradeFeedback((prev) => ({
                                        ...prev,
                                        [submission.id]: event.target.value,
                                      }))
                                    }
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      void gradeSubmission(submission)
                                    }
                                    disabled={!live || busy}
                                  >
                                    Save
                                  </Button>
                                </div>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </section>
              </>
            )}
          </div>
        }
      />
    </ShellMain>
  );
}
