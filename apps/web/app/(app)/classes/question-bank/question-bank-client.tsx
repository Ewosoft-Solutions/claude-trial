'use client';

import * as React from 'react';
import { Archive, CheckCircle2, Plus, Search, Trash2 } from 'lucide-react';

import { useViewer } from '@/app/providers/viewer-provider';
import {
  academicsApi,
  courseLabel,
  readError,
  type CourseSummary,
  type QuestionOption,
  type QuestionStyle,
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
import { Textarea } from '@workspace/ui/components/textarea';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { ListDetailLayout } from '@workspace/ui/custom/layouts/list-detail-layout';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { NoticeBanner } from '@workspace/ui/custom/states/notice-banner';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { cn } from '@workspace/ui/lib/utils';

type Difficulty = 'easy' | 'medium' | 'hard';

interface QuestionForm {
  style: QuestionStyle;
  instruction: string;
  text: string;
  options: QuestionOption[];
  correctAnswer: string;
  solution: string;
  difficulty: Difficulty;
}

const STYLE_OPTIONS: Array<{ value: QuestionStyle; label: string }> = [
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'true_false', label: 'True / false' },
  { value: 'short_answer', label: 'Short answer' },
  { value: 'essay', label: 'Essay' },
];

const EMPTY_FORM: QuestionForm = {
  style: 'mcq',
  instruction: '',
  text: '',
  options: [
    { label: 'A', text: '' },
    { label: 'B', text: '' },
    { label: 'C', text: '' },
    { label: 'D', text: '' },
  ],
  correctAnswer: 'A',
  solution: '',
  difficulty: 'medium',
};

function formFromQuestion(question: QuestionSummary | null): QuestionForm {
  if (!question) return EMPTY_FORM;
  return {
    style: question.style,
    instruction: question.instruction ?? '',
    text: question.text,
    options:
      question.options && question.options.length > 0
        ? question.options
        : EMPTY_FORM.options,
    correctAnswer: question.correctAnswer ?? (question.style === 'true_false' ? 'true' : 'A'),
    solution: question.solution ?? '',
    difficulty: (question.difficulty as Difficulty | null) ?? 'medium',
  };
}

function cleanPayload(courseId: string, form: QuestionForm) {
  const base = {
    courseId,
    style: form.style,
    instruction: form.instruction.trim() || undefined,
    text: form.text.trim(),
    solution: form.solution.trim() || undefined,
    difficulty: form.difficulty,
  };

  if (form.style === 'mcq') {
    return {
      ...base,
      options: form.options
        .map((option) => ({
          label: option.label.trim().toUpperCase(),
          text: option.text?.trim(),
        }))
        .filter((option) => option.label && option.text),
      correctAnswer: form.correctAnswer.trim().toUpperCase(),
    };
  }

  if (form.style === 'true_false') {
    return { ...base, correctAnswer: form.correctAnswer.toLowerCase() };
  }

  if (form.style === 'short_answer') {
    return { ...base, correctAnswer: form.correctAnswer.trim() };
  }

  return base;
}

export function QuestionBankClient({
  live,
  initialCourses,
  initialQuestions,
}: {
  live: boolean;
  initialCourses: CourseSummary[];
  initialQuestions: QuestionSummary[];
}) {
  const { viewer } = useViewer();
  const canCreate = viewer.permissions.has('questions.create');
  const canEdit = viewer.permissions.has('questions.edit');
  const canDelete = viewer.permissions.has('questions.delete');
  const hasCourses = initialCourses.length > 0;

  const [courseId, setCourseId] = React.useState(initialCourses[0]?.id ?? '');
  const [questions, setQuestions] = React.useState(initialQuestions);
  const [selectedId, setSelectedId] = React.useState(initialQuestions[0]?.id ?? '');
  const [form, setForm] = React.useState<QuestionForm>(() =>
    formFromQuestion(initialQuestions[0] ?? null),
  );
  const [query, setQuery] = React.useState('');
  const [styleFilter, setStyleFilter] = React.useState<QuestionStyle | 'all'>('all');
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selected = questions.find((question) => question.id === selectedId) ?? null;

  React.useEffect(() => {
    setForm(formFromQuestion(selected));
  }, [selected]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return questions.filter((question) => {
      const matchesStyle = styleFilter === 'all' || question.style === styleFilter;
      const matchesQuery =
        !needle ||
        question.text.toLowerCase().includes(needle) ||
        (question.instruction ?? '').toLowerCase().includes(needle);
      return matchesStyle && matchesQuery;
    });
  }, [questions, query, styleFilter]);

  async function loadQuestions(nextCourseId: string) {
    setCourseId(nextCourseId);
    setLoading(true);
    setError(null);
    try {
      if (!live) {
        setQuestions([]);
        setSelectedId('');
        return;
      }
      const params = new URLSearchParams({ courseId: nextCourseId, limit: '50' });
      const res = await fetch(academicsApi(`questions?${params}`));
      if (!res.ok) throw new Error(await readError(res));
      const list = (await res.json()) as QuestionSummary[];
      setQuestions(list);
      setSelectedId(list[0]?.id ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }

  function newQuestion() {
    setSelectedId('');
    setForm(EMPTY_FORM);
  }

  function updateOption(index: number, text: string) {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((option, i) =>
        i === index ? { ...option, text } : option,
      ),
    }));
  }

  async function saveQuestion() {
    if (!courseId || !form.text.trim() || !live) return;
    const editing = Boolean(selected);
    if ((editing && !canEdit) || (!editing && !canCreate)) return;
    setBusy(true);
    setError(null);
    try {
      const payload = cleanPayload(courseId, form);
      const res = await fetch(
        academicsApi(editing ? `questions/${selected!.id}` : 'questions'),
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing ? { ...payload, courseId: undefined } : payload),
        },
      );
      if (!res.ok) throw new Error(await readError(res));
      const saved = (await res.json()) as QuestionSummary;
      setQuestions((prev) =>
        editing
          ? prev.map((question) => (question.id === saved.id ? saved : question))
          : [saved, ...prev],
      );
      setSelectedId(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion() {
    if (!selected || !live || !canDelete) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(academicsApi(`questions/${selected.id}`), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await readError(res));
      setQuestions((prev) => prev.filter((question) => question.id !== selected.id));
      setSelectedId('');
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShellMain className="gap-0 pb-0">
      <PageHeader
        padded={false}
        className="pb-3"
        title="Question bank"
        meta={[
          { key: 'course', label: `${initialCourses.length} courses`, emphasis: true },
          { key: 'questions', label: `${questions.length} questions` },
        ]}
        actions={
          canCreate && hasCourses ? (
            <Button size="sm" onClick={newQuestion}>
              <Plus /> New question
            </Button>
          ) : null
        }
      />

      {live && !hasCourses ? (
        <NoticeBanner
          tone="info"
          title="No assigned courses"
          description="Only courses from your active teaching assignments are available here."
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
        <div className="grid min-w-64 gap-2">
          <Label htmlFor="question-course">Course</Label>
          <Select
            value={courseId}
            onValueChange={(value) => void loadQuestions(value)}
            disabled={!hasCourses}
          >
            <SelectTrigger id="question-course" aria-label="Select course">
              <SelectValue placeholder="Select course" />
            </SelectTrigger>
            <SelectContent>
              {initialCourses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {courseLabel(course)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="question-style-filter">Style</Label>
          <Select
            value={styleFilter}
            onValueChange={(value) => setStyleFilter(value as QuestionStyle | 'all')}
          >
            <SelectTrigger id="question-style-filter" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All styles</SelectItem>
              {STYLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-56 flex-1 gap-2">
          <Label htmlFor="question-search">Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="question-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search question text"
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <ListDetailLayout
        className="mb-[var(--content-padding)] flex-1"
        listWidth={360}
        showDetail={Boolean(selectedId) || !selected}
        list={
          <nav aria-label="Questions" className="flex flex-col gap-1 p-2">
            {loading ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Loading questions...
              </p>
            ) : filtered.length === 0 ? (
              <EmptyState
                compact
                title={hasCourses ? 'No questions' : 'No assigned courses'}
                description={
                  hasCourses
                    ? 'Create a question or adjust the filters.'
                    : 'Question banks appear after a course is assigned to you.'
                }
              />
            ) : (
              filtered.map((question) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setSelectedId(question.id)}
                  className={cn(
                    'rounded-md px-3 py-2 text-left transition-colors hover:bg-accent',
                    question.id === selectedId && 'bg-accent',
                  )}
                >
                  <span className="line-clamp-2 text-sm font-medium">
                    {question.text}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1">
                    <StatusBadge tone="info">
                      {question.style.replace('_', ' ')}
                    </StatusBadge>
                    {question.difficulty ? (
                      <StatusBadge tone="neutral">{question.difficulty}</StatusBadge>
                    ) : null}
                  </span>
                </button>
              ))
            )}
          </nav>
        }
        detail={
          <div className="grid gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div>
                <h2 className="text-base font-semibold">
                  {selected ? 'Edit question' : 'New question'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selected ? 'Saved bank entry' : 'Draft bank entry'}
                </p>
              </div>
              <div className="flex gap-2">
                {selected && canDelete ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void removeQuestion()}
                    disabled={!live || busy}
                  >
                    {selected.isActive ? <Trash2 /> : <Archive />} Remove
                  </Button>
                ) : null}
                {(selected ? canEdit : canCreate) ? (
                  <Button
                    size="sm"
                    onClick={() => void saveQuestion()}
                    disabled={!live || busy || !courseId || !form.text.trim()}
                  >
                    <CheckCircle2 /> {busy ? 'Saving' : 'Save'}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
              <div className="grid content-start gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="question-style">Style</Label>
                  <Select
                    value={form.style}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        style: value as QuestionStyle,
                        correctAnswer:
                          value === 'true_false'
                            ? 'true'
                            : value === 'mcq'
                              ? 'A'
                              : '',
                      }))
                    }
                    disabled={selected ? !canEdit : !canCreate}
                  >
                    <SelectTrigger id="question-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="question-difficulty">Difficulty</Label>
                  <Select
                    value={form.difficulty}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, difficulty: value as Difficulty }))
                    }
                    disabled={selected ? !canEdit : !canCreate}
                  >
                    <SelectTrigger id="question-difficulty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="question-instruction">Instruction</Label>
                  <Textarea
                    id="question-instruction"
                    value={form.instruction}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        instruction: event.target.value,
                      }))
                    }
                    readOnly={selected ? !canEdit : !canCreate}
                    className="min-h-16"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="question-text">Question</Label>
                  <Textarea
                    id="question-text"
                    value={form.text}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, text: event.target.value }))
                    }
                    readOnly={selected ? !canEdit : !canCreate}
                    className="min-h-32"
                  />
                </div>

                {form.style === 'mcq' ? (
                  <div className="grid gap-2">
                    <Label>Options</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {form.options.map((option, index) => (
                        <div key={option.label} className="flex items-center gap-2">
                          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-sm font-semibold">
                            {option.label}
                          </span>
                          <Input
                            value={option.text ?? ''}
                            onChange={(event) =>
                              updateOption(index, event.target.value)
                            }
                            readOnly={selected ? !canEdit : !canCreate}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="grid max-w-40 gap-2">
                      <Label htmlFor="mcq-answer">Correct option</Label>
                      <Select
                        value={form.correctAnswer}
                        onValueChange={(value) =>
                          setForm((prev) => ({ ...prev, correctAnswer: value }))
                        }
                        disabled={selected ? !canEdit : !canCreate}
                      >
                        <SelectTrigger id="mcq-answer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {form.options.map((option) => (
                            <SelectItem key={option.label} value={option.label}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : form.style === 'true_false' ? (
                  <div className="grid max-w-48 gap-2">
                    <Label htmlFor="tf-answer">Correct answer</Label>
                    <Select
                      value={form.correctAnswer}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, correctAnswer: value }))
                      }
                      disabled={selected ? !canEdit : !canCreate}
                    >
                      <SelectTrigger id="tf-answer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : form.style === 'short_answer' ? (
                  <div className="grid gap-2">
                    <Label htmlFor="short-answer">Model answer</Label>
                    <Input
                      id="short-answer"
                      value={form.correctAnswer}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          correctAnswer: event.target.value,
                        }))
                      }
                      readOnly={selected ? !canEdit : !canCreate}
                    />
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label htmlFor="question-solution">Solution</Label>
                  <Textarea
                    id="question-solution"
                    value={form.solution}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, solution: event.target.value }))
                    }
                    readOnly={selected ? !canEdit : !canCreate}
                    className="min-h-24"
                  />
                </div>
              </div>
            </div>
          </div>
        }
      />
    </ShellMain>
  );
}
