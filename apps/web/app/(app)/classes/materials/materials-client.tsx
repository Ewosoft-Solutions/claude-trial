'use client';

import * as React from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  FileUp,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';

import { useViewer } from '@/app/providers/viewer-provider';
import {
  academicsApi,
  classLabel,
  EXTRACTION_META,
  formatSize,
  LESSON_STATUS_META,
  readError,
  REVIEW_META,
  type ClassSummary,
  type LessonSummary,
  type MaterialSummary,
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
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { NoticeBanner } from '@workspace/ui/custom/states/notice-banner';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { cn } from '@workspace/ui/lib/utils';
import type { StateTone } from '@workspace/ui/types/states.types';

const ACCEPTED_TYPES = '.pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.mp4,.mp3,.wav';

interface LessonDraft {
  title: string;
  description: string;
  content: string;
}

function meta(
  map: Record<string, { label: string; tone: StateTone }>,
  value: string,
) {
  return map[value] ?? { label: value.replace(/_/g, ' '), tone: 'neutral' as StateTone };
}

export function MaterialsClient({
  live,
  initialClasses,
  initialLessons,
}: {
  live: boolean;
  initialClasses: ClassSummary[];
  initialLessons: LessonSummary[];
}) {
  const { viewer } = useViewer();
  const canCreate = viewer.permissions.has('lessons.create');
  const canEdit = viewer.permissions.has('lessons.edit');
  const canUpload = viewer.permissions.has('lessons.materials.upload');
  const canDeleteMaterials = viewer.permissions.has('lessons.materials.delete');
  const hasClasses = initialClasses.length > 0;

  const firstClassId = initialClasses[0]?.id ?? '';
  const firstLessonId =
    initialLessons.find((lesson) => lesson.classId === firstClassId)?.id ?? null;

  const [lessons, setLessons] = React.useState(initialLessons);
  const [classId, setClassId] = React.useState(firstClassId);
  const [selectedLessonId, setSelectedLessonId] = React.useState<string | null>(
    firstLessonId,
  );
  const [materials, setMaterials] = React.useState<MaterialSummary[]>([]);
  const [materialsLoading, setMaterialsLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newLessonTitle, setNewLessonTitle] = React.useState('');
  const [uploadTitle, setUploadTitle] = React.useState('');
  const [draft, setDraft] = React.useState<LessonDraft>({
    title: '',
    description: '',
    content: '',
  });
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const classLessons = React.useMemo(
    () => lessons.filter((lesson) => lesson.classId === classId),
    [classId, lessons],
  );
  const selectedLesson =
    classLessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

  React.useEffect(() => {
    if (!selectedLesson) {
      setDraft({ title: '', description: '', content: '' });
      return;
    }
    setDraft({
      title: selectedLesson.title,
      description: selectedLesson.description ?? '',
      content: selectedLesson.content ?? '',
    });
  }, [selectedLesson]);

  const refreshMaterials = React.useCallback(
    async (lessonId: string, showSpinner: boolean) => {
      if (!live) return;
      if (showSpinner) setMaterialsLoading(true);
      try {
        const res = await fetch(
          `/api/learning/lessons/${encodeURIComponent(lessonId)}/materials`,
        );
        if (!res.ok) throw new Error(await readError(res));
        setMaterials(((await res.json()) as MaterialSummary[] | null) ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load materials');
      } finally {
        if (showSpinner) setMaterialsLoading(false);
      }
    },
    [live],
  );

  React.useEffect(() => {
    setMaterials([]);
    if (selectedLessonId) void refreshMaterials(selectedLessonId, true);
  }, [selectedLessonId, refreshMaterials]);

  const hasInFlight = materials.some(
    (material) =>
      material.extractionStatus === 'pending' ||
      material.extractionStatus === 'processing',
  );

  React.useEffect(() => {
    if (!hasInFlight || !selectedLessonId) return;
    const timer = setInterval(() => {
      void refreshMaterials(selectedLessonId, false);
    }, 2500);
    return () => clearInterval(timer);
  }, [hasInFlight, selectedLessonId, refreshMaterials]);

  async function createLesson() {
    const title = newLessonTitle.trim();
    if (!title || !classId || !live || !canCreate) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/learning/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, title }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const lesson = (await res.json()) as LessonSummary;
      setLessons((prev) => [...prev, { ...lesson, _count: { materials: 0 } }]);
      setNewLessonTitle('');
      setSelectedLessonId(lesson.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lesson');
    } finally {
      setCreating(false);
    }
  }

  function patchLesson(id: string, patch: Partial<LessonSummary>) {
    setLessons((prev) =>
      prev.map((lesson) => (lesson.id === id ? { ...lesson, ...patch } : lesson)),
    );
  }

  async function saveLesson() {
    if (!selectedLesson || !live || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        academicsApi(`learning/lessons/${selectedLesson.id}`),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: draft.title.trim(),
            description: draft.description.trim() || null,
            content: draft.content.trim() || null,
          }),
        },
      );
      if (!res.ok) throw new Error(await readError(res));
      patchLesson(selectedLesson.id, (await res.json()) as LessonSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lesson');
    } finally {
      setSaving(false);
    }
  }

  async function submitLesson() {
    if (!selectedLesson || !live || !canEdit) return;
    setError(null);
    try {
      const res = await fetch(
        academicsApi(`learning/lessons/${selectedLesson.id}/submit-review`),
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(await readError(res));
      patchLesson(selectedLesson.id, (await res.json()) as LessonSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit lesson');
    }
  }

  async function setLessonStatus(status: 'draft' | 'published') {
    if (!selectedLesson || !live || !canEdit) return;
    setError(null);
    try {
      const res = await fetch(
        academicsApi(`learning/lessons/${selectedLesson.id}`),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) throw new Error(await readError(res));
      patchLesson(selectedLesson.id, (await res.json()) as LessonSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function uploadFile(file: File) {
    if (!selectedLessonId || !live || !canUpload) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (uploadTitle.trim()) formData.append('title', uploadTitle.trim());
      const res = await fetch(
        `/api/learning/lessons/${encodeURIComponent(selectedLessonId)}/materials`,
        { method: 'POST', body: formData },
      );
      if (!res.ok) throw new Error(await readError(res));
      const material = (await res.json()) as MaterialSummary;
      setMaterials((prev) => [...prev, material]);
      setLessons((prev) =>
        prev.map((lesson) =>
          lesson.id === selectedLessonId
            ? {
                ...lesson,
                _count: {
                  materials: (lesson._count?.materials ?? 0) + 1,
                },
              }
            : lesson,
        ),
      );
      setUploadTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function reprocessMaterial(id: string) {
    if (!selectedLessonId || !live || !canUpload) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/learning/materials/${encodeURIComponent(id)}/reprocess`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(await readError(res));
      await refreshMaterials(selectedLessonId, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reprocess failed');
    }
  }

  async function deleteMaterial(id: string) {
    if (!selectedLessonId || !live || !canDeleteMaterials) return;
    setError(null);
    try {
      const res = await fetch(`/api/learning/materials/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await readError(res));
      setMaterials((prev) => prev.filter((material) => material.id !== id));
      setLessons((prev) =>
        prev.map((lesson) =>
          lesson.id === selectedLessonId
            ? {
                ...lesson,
                _count: {
                  materials: Math.max(0, (lesson._count?.materials ?? 0) - 1),
                },
              }
            : lesson,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const selectedReview = selectedLesson
    ? meta(REVIEW_META, selectedLesson.reviewStatus)
    : null;
  const selectedStatus = selectedLesson
    ? meta(LESSON_STATUS_META, selectedLesson.status)
    : null;
  const canPublish =
    canEdit &&
    selectedLesson?.reviewStatus === 'approved' &&
    selectedLesson.status !== 'published';

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Lesson materials"
          meta={[
            { key: 'scope', label: 'Lessons, notes and media', emphasis: true },
            { key: 'count', label: `${lessons.length} lessons` },
          ]}
        />

        {live && !hasClasses ? (
          <NoticeBanner
            tone="info"
            title="No assigned classes"
            description="Only classes from your active teaching assignments are available here."
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

        <div className="flex flex-col gap-2 sm:max-w-md">
          <Label htmlFor="class-picker">Class</Label>
          <Select
            value={classId}
            onValueChange={(value) => {
              setClassId(value);
              setSelectedLessonId(
                lessons.find((lesson) => lesson.classId === value)?.id ?? null,
              );
            }}
            disabled={!hasClasses}
          >
            <SelectTrigger id="class-picker" aria-label="Select class">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {initialClasses.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {classLabel(cls)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-h-0 gap-5 @5xl/main:min-h-[38rem] @5xl/main:grid-cols-[minmax(17rem,23rem)_1fr]">
          <section
            aria-label="Lessons"
            className="flex min-h-0 flex-col gap-3 rounded-lg border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Lessons</h2>
              <span className="text-xs text-muted-foreground">
                {classLessons.length} in class
              </span>
            </div>

            {canCreate ? (
              <div className="flex gap-2">
                <Label htmlFor="new-lesson" className="sr-only">
                  New lesson title
                </Label>
                <Input
                  id="new-lesson"
                  value={newLessonTitle}
                  onChange={(event) => setNewLessonTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void createLesson();
                  }}
                  placeholder="New lesson title"
                  disabled={!live || creating || !classId}
                />
                <Button
                  size="sm"
                  onClick={() => void createLesson()}
                  disabled={!live || creating || !classId || !newLessonTitle.trim()}
                >
                  <Plus /> Add
                </Button>
              </div>
            ) : null}

            {classLessons.length === 0 ? (
              <EmptyState
                compact
                title={hasClasses ? 'No lessons' : 'No assigned classes'}
                description={
                  !hasClasses
                    ? 'Lessons appear after a class is assigned to you.'
                    : canCreate
                    ? 'Create the first lesson for this class.'
                    : 'No published lessons are available for this class.'
                }
              />
            ) : (
              <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto" role="list">
                {classLessons.map((lesson) => {
                  const status = meta(LESSON_STATUS_META, lesson.status);
                  const review = meta(REVIEW_META, lesson.reviewStatus);
                  const materialCount = lesson._count?.materials ?? 0;
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedLessonId(lesson.id)}
                        className={cn(
                          'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
                          lesson.id === selectedLessonId
                            ? 'border-primary bg-primary/5'
                            : 'border-transparent hover:bg-muted',
                        )}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block break-words font-medium">
                              {lesson.title}
                            </span>
                            <span className="mt-1 flex flex-wrap gap-1">
                              <StatusBadge tone={status.tone}>
                                {status.label}
                              </StatusBadge>
                              <StatusBadge tone={review.tone}>
                                {review.label}
                              </StatusBadge>
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {materialCount}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            aria-label="Lesson detail"
            className="flex min-h-0 flex-col gap-4 rounded-lg border bg-card p-4"
          >
            {!selectedLesson ? (
              <EmptyState
                compact
                title="Select a lesson"
                description="Choose a lesson to view its note and materials."
              />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-semibold">
                      {selectedLesson.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedStatus ? (
                        <StatusBadge tone={selectedStatus.tone}>
                          {selectedStatus.label}
                        </StatusBadge>
                      ) : null}
                      {selectedReview ? (
                        <StatusBadge tone={selectedReview.tone}>
                          {selectedReview.label}
                        </StatusBadge>
                      ) : null}
                    </div>
                  </div>
                  {canEdit ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void submitLesson()}
                        disabled={
                          !live ||
                          selectedLesson.reviewStatus === 'pending_review' ||
                          selectedLesson.reviewStatus === 'approved'
                        }
                      >
                        <Send /> Submit
                      </Button>
                      {canPublish ? (
                        <Button
                          size="sm"
                          onClick={() => void setLessonStatus('published')}
                          disabled={!live}
                        >
                          <CheckCircle2 /> Publish
                        </Button>
                      ) : selectedLesson.status === 'published' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void setLessonStatus('draft')}
                          disabled={!live}
                        >
                          <Pencil /> Unpublish
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {selectedLesson.reviewNote ? (
                  <NoticeBanner
                    tone={selectedLesson.reviewStatus === 'rejected' ? 'destructive' : 'info'}
                    title="Review note"
                    description={selectedLesson.reviewNote}
                  />
                ) : null}

                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="lesson-title">Title</Label>
                    <Input
                      id="lesson-title"
                      value={draft.title}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, title: event.target.value }))
                      }
                      readOnly={!canEdit}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lesson-description">Summary</Label>
                    <Textarea
                      id="lesson-description"
                      value={draft.description}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      readOnly={!canEdit}
                      className="min-h-20"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lesson-content">Lesson note</Label>
                    <Textarea
                      id="lesson-content"
                      value={draft.content}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, content: event.target.value }))
                      }
                      readOnly={!canEdit}
                      className="min-h-48"
                    />
                  </div>
                  {canEdit ? (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => void saveLesson()}
                        disabled={!live || saving || !draft.title.trim()}
                      >
                        <CheckCircle2 /> {saving ? 'Saving' : 'Save lesson'}
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 border-t pt-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Materials</h3>
                      <p className="text-xs text-muted-foreground">
                        {materials.length} files
                      </p>
                    </div>
                    {canUpload ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="grid gap-1.5">
                          <Label htmlFor="material-title" className="text-xs">
                            Display title
                          </Label>
                          <Input
                            id="material-title"
                            value={uploadTitle}
                            onChange={(event) => setUploadTitle(event.target.value)}
                            className="h-8 w-48"
                            placeholder="Optional"
                            disabled={!live || uploading}
                          />
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={ACCEPTED_TYPES}
                          className="sr-only"
                          aria-label="Choose a material file"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void uploadFile(file);
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!live || uploading}
                        >
                          <FileUp /> {uploading ? 'Uploading' : 'Upload'}
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {materialsLoading ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Loading materials...
                    </p>
                  ) : materials.length === 0 ? (
                    <EmptyState
                      compact
                      title="No materials"
                      description={
                        canUpload
                          ? 'Upload a file for this lesson.'
                          : 'No approved materials are available.'
                      }
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Review</TableHead>
                          <TableHead>Processing</TableHead>
                          <TableHead className="text-right">
                            Chunks
                          </TableHead>
                          <TableHead className="sr-only">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materials.map((material) => {
                          const review = meta(REVIEW_META, material.reviewStatus);
                          const extraction = meta(
                            EXTRACTION_META,
                            material.extractionStatus,
                          );
                          return (
                            <TableRow key={material.id}>
                              <TableCell>
                                <div className="flex min-w-0 items-center gap-2">
                                  <FileText
                                    className="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden
                                  />
                                  <div className="flex min-w-0 flex-col">
                                    <span className="break-words font-medium">
                                      {material.title}
                                    </span>
                                    <span className="break-words text-xs text-muted-foreground">
                                      {material.fileName} · {formatSize(material.sizeBytes)}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="capitalize text-muted-foreground">
                                {material.category}
                              </TableCell>
                              <TableCell>
                                <StatusBadge tone={review.tone}>
                                  {review.label}
                                </StatusBadge>
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  tone={extraction.tone}
                                  dot={material.extractionStatus === 'processing'}
                                >
                                  {extraction.label}
                                </StatusBadge>
                                {material.extractionStatus === 'failed' &&
                                material.extractionError ? (
                                  <span className="mt-0.5 block max-w-52 break-words text-xs text-destructive">
                                    {material.extractionError}
                                  </span>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {material.chunkCount}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    asChild
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Download ${material.title}`}
                                  >
                                    <a
                                      href={academicsApi(
                                        `learning/materials/${material.id}/download`,
                                      )}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <Download />
                                    </a>
                                  </Button>
                                  {canUpload && material.extractionStatus === 'failed' ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Retry processing ${material.title}`}
                                      onClick={() => void reprocessMaterial(material.id)}
                                    >
                                      <RefreshCw />
                                    </Button>
                                  ) : null}
                                  {canDeleteMaterials ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Delete ${material.title}`}
                                      onClick={() => void deleteMaterial(material.id)}
                                    >
                                      <Trash2 />
                                    </Button>
                                  ) : null}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </ShellMain>
  );
}
