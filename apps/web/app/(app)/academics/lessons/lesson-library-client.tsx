'use client';

/**
 * Lesson library — author once, teach in many classes.
 *
 * Two tabs, mirroring the two halves of the model:
 *   Library   — lessons and chapters for a curriculum subject. Authored once;
 *               every class that teaches the subject can schedule them.
 *   Class plan— one offering's scheduled lessons, where a teacher marks what
 *               has actually been taught.
 *
 * Scheduling a lesson never copies it. The body, materials and their embeddings
 * stay in the library, so four arms share one PDF rather than four.
 *
 * The library switches between list and grid: a grid of tiles is how students
 * recognise a lesson, a list is how a teacher scans one. Tiles fall back to an
 * initial when a lesson has no thumbnail yet, so the grid never reads as broken.
 */
import * as React from 'react';
import { toast } from 'sonner';
import { CalendarPlus, Plus } from 'lucide-react';

import { Sheet, SheetDescription } from '@workspace/ui/components/sheet';
import {
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@workspace/ui/custom/detail/drawer-chrome';
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
import {
  FolderTabs as Tabs,
  FolderTabsContent as TabsContent,
  FolderTabsList as TabsList,
  FolderTabsTrigger as TabsTrigger,
} from '@workspace/ui/custom/detail/folder-tabs';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import {
  PageHeader,
  SegmentedControl,
} from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import type { StateTone } from '@workspace/ui/types/states.types';
import { Dot } from '@workspace/ui/custom/data-display/dot';

export interface SubjectOption {
  id: string;
  name: string;
  versionName?: string | null;
}
export interface OfferingOption {
  id: string;
  subjectLabel: string;
  curriculumSubjectId?: string | null;
  classSectionId?: string | null;
}
export interface SectionOption {
  id: string;
  displayLabel: string;
}
interface Chapter {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  _count?: { lessons: number };
}
interface LibraryLesson {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  reviewStatus: string;
  thumbnailKey?: string | null;
  chapterId?: string | null;
  curriculumSubjectId?: string | null;
  _count?: { materials: number };
}
interface Instance {
  id: string;
  status: string;
  scheduledFor?: string | null;
  taughtAt?: string | null;
  titleOverride?: string | null;
  notes?: string | null;
  lesson?: {
    id: string;
    title: string;
    thumbnailKey?: string | null;
    status: string;
  } | null;
}

const INSTANCE_TONE: Record<string, StateTone> = {
  planned: 'info',
  taught: 'success',
  skipped: 'neutral',
};

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string | string[] };
    const m = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message;
    return m || fallback;
  } catch {
    return fallback;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await readError(res, 'Request failed'));
  return (await res.json()) as T;
}

async function sendJson<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res, 'Action failed'));
  return (await res.json().catch(() => ({}))) as T;
}

function initials(title: string): string {
  return title.trim().slice(0, 2).toUpperCase() || '—';
}

export function LessonLibraryClient({
  subjects,
  offerings,
  sections,
  canCreate,
}: {
  subjects: SubjectOption[];
  offerings: OfferingOption[];
  sections: SectionOption[];
  canCreate: boolean;
}) {
  const [subjectId, setSubjectId] = React.useState('');
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [chapters, setChapters] = React.useState<Chapter[]>([]);
  const [lessons, setLessons] = React.useState<LibraryLesson[]>([]);
  const [busy, setBusy] = React.useState(false);

  // chapter dialog
  const [chapterOpen, setChapterOpen] = React.useState(false);
  const [chapterTitle, setChapterTitle] = React.useState('');
  const [chapterDesc, setChapterDesc] = React.useState('');

  // schedule dialog
  const [scheduleFor, setScheduleFor] = React.useState<LibraryLesson | null>(
    null,
  );
  const [scheduleOffering, setScheduleOffering] = React.useState('');
  const [scheduleDate, setScheduleDate] = React.useState('');

  // class plan
  const [planOffering, setPlanOffering] = React.useState('');
  const [instances, setInstances] = React.useState<Instance[]>([]);

  const loadLibrary = React.useCallback(async (id: string) => {
    if (!id) {
      setChapters([]);
      setLessons([]);
      return;
    }
    setBusy(true);
    try {
      const [c, l] = await Promise.all([
        getJson<Chapter[]>(
          `/api/learning/chapters?curriculumSubjectId=${encodeURIComponent(id)}`,
        ),
        getJson<LibraryLesson[]>(
          `/api/learning/lessons?curriculumSubjectId=${encodeURIComponent(id)}`,
        ),
      ]);
      setChapters(Array.isArray(c) ? c : []);
      setLessons(Array.isArray(l) ? l : []);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not load the library',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    void loadLibrary(subjectId);
  }, [subjectId, loadLibrary]);

  const loadPlan = React.useCallback(async (offeringId: string) => {
    if (!offeringId) {
      setInstances([]);
      return;
    }
    setBusy(true);
    try {
      const rows = await getJson<Instance[]>(
        `/api/learning/offerings/${encodeURIComponent(offeringId)}/lessons`,
      );
      setInstances(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load the plan');
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPlan(planOffering);
  }, [planOffering, loadPlan]);

  async function createChapter() {
    setBusy(true);
    try {
      await sendJson('POST', '/api/learning/chapters', {
        curriculumSubjectId: subjectId,
        title: chapterTitle,
        description: chapterDesc || undefined,
      });
      toast.success('Chapter added');
      setChapterOpen(false);
      setChapterTitle('');
      setChapterDesc('');
      await loadLibrary(subjectId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add the chapter');
    } finally {
      setBusy(false);
    }
  }

  async function schedule() {
    if (!scheduleFor) return;
    setBusy(true);
    try {
      await sendJson('POST', '/api/learning/lesson-instances', {
        lessonId: scheduleFor.id,
        subjectOfferingId: scheduleOffering,
        scheduledFor: scheduleDate
          ? new Date(scheduleDate).toISOString()
          : undefined,
      });
      toast.success('Scheduled for the class');
      setScheduleFor(null);
      setScheduleOffering('');
      setScheduleDate('');
      if (planOffering) await loadPlan(planOffering);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not schedule it');
    } finally {
      setBusy(false);
    }
  }

  async function markInstance(id: string, status: string) {
    setBusy(true);
    try {
      await sendJson('PATCH', `/api/learning/lesson-instances/${id}`, {
        status,
      });
      await loadPlan(planOffering);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update it');
    } finally {
      setBusy(false);
    }
  }

  async function unschedule(id: string) {
    setBusy(true);
    try {
      await sendJson('DELETE', `/api/learning/lesson-instances/${id}`);
      toast.success(
        'Removed from this class — the library lesson is untouched',
      );
      await loadPlan(planOffering);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove it');
    } finally {
      setBusy(false);
    }
  }

  // Only offerings of the chosen subject can take one of its lessons — the
  // server enforces this too, so the picker just avoids an obvious dead end.
  const eligibleOfferings = React.useMemo(
    () =>
      scheduleFor
        ? offerings.filter(
            (o) => o.curriculumSubjectId === scheduleFor.curriculumSubjectId,
          )
        : [],
    [offerings, scheduleFor],
  );

  const sectionLabel = React.useCallback(
    (o: OfferingOption) =>
      `${sections.find((s) => s.id === o.classSectionId)?.displayLabel ?? 'Class'} · ${o.subjectLabel}`,
    [sections],
  );

  const chapterName = React.useCallback(
    (id?: string | null) =>
      id ? (chapters.find((c) => c.id === id)?.title ?? null) : null,
    [chapters],
  );

  return (
    <ShellMain>
      <PageHeader
        title="Lesson library"
        description="Author a lesson once for a subject, then schedule it for any class that teaches it. Scheduling never copies the lesson — the notes, materials and everything built on them stay shared."
        actions={
          canCreate && subjectId ? (
            <Button size="sm" onClick={() => setChapterOpen(true)}>
              <Plus aria-hidden /> New chapter
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-1.5 sm:max-w-md">
        <Label htmlFor="ll-subject">Subject</Label>
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger id="ll-subject">
            <SelectValue placeholder="Choose a curriculum subject" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
                {s.versionName ? ` · ${s.versionName}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {subjects.length === 0 && (
        <EmptyState
          title="No curriculum subjects yet"
          description="Adopt or author a curriculum version first — the library is organised by subject, not by class."
        />
      )}

      <Tabs defaultValue="library">
        <TabsList className="mb-4">
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="plan">Class plan</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------- library */}
        <TabsContent value="library" className="flex flex-col gap-4">
          {!subjectId ? (
            <p className="text-sm text-muted-foreground">
              Choose a subject to see the lessons authored for it.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {lessons.length} lesson{lessons.length === 1 ? '' : 's'}
                  <Dot />
                  {chapters.length} chapter{chapters.length === 1 ? '' : 's'}
                </p>
                <SegmentedControl
                  options={[
                    { key: 'grid', label: 'Grid' },
                    { key: 'list', label: 'List' },
                  ]}
                  value={view}
                  onValueChange={(k) => setView(k as 'grid' | 'list')}
                />
              </div>

              {lessons.length === 0 ? (
                <EmptyState
                  title="No lessons for this subject yet"
                  description="Lessons authored here are available to every class that teaches this subject."
                />
              ) : view === 'grid' ? (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {lessons.map((lesson) => (
                    <li
                      key={lesson.id}
                      className="flex flex-col overflow-hidden rounded-sm border"
                    >
                      <div className="flex aspect-video items-center justify-center bg-muted text-2xl font-semibold text-muted-foreground">
                        {/* No thumbnail yet → an initial, so the grid still reads
                            as a grid instead of a row of broken frames. */}
                        {initials(lesson.title)}
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{lesson.title}</span>
                          {chapterName(lesson.chapterId) && (
                            <span className="text-xs text-muted-foreground">
                              {chapterName(lesson.chapterId)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <StatusBadge
                            tone={
                              lesson.status === 'published'
                                ? 'success'
                                : 'neutral'
                            }
                          >
                            {lesson.status}
                          </StatusBadge>
                          <span className="text-muted-foreground">
                            {lesson._count?.materials ?? 0} material
                            {(lesson._count?.materials ?? 0) === 1 ? '' : 's'}
                          </span>
                        </div>
                        {canCreate && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-auto"
                            onClick={() => setScheduleFor(lesson)}
                          >
                            <CalendarPlus aria-hidden /> Schedule
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-2 py-2 font-medium">Lesson</th>
                        <th className="px-2 py-2 font-medium">Chapter</th>
                        <th className="px-2 py-2 font-medium">Status</th>
                        <th className="px-2 py-2 font-medium">Materials</th>
                        {canCreate && <th className="px-2 py-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {lessons.map((lesson) => (
                        <tr key={lesson.id} className="border-b last:border-0">
                          <td className="px-2 py-1.5 font-medium">
                            {lesson.title}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {chapterName(lesson.chapterId) ?? '—'}
                          </td>
                          <td className="px-2 py-1.5">
                            <StatusBadge
                              tone={
                                lesson.status === 'published'
                                  ? 'success'
                                  : 'neutral'
                              }
                            >
                              {lesson.status}
                            </StatusBadge>
                          </td>
                          <td className="px-2 py-1.5 tabular-nums">
                            {lesson._count?.materials ?? 0}
                          </td>
                          {canCreate && (
                            <td className="px-2 py-1.5 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setScheduleFor(lesson)}
                              >
                                <CalendarPlus aria-hidden /> Schedule
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ------------------------------------------------- class plan */}
        <TabsContent value="plan" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 sm:max-w-md">
            <Label htmlFor="ll-offering">Class</Label>
            <Select value={planOffering} onValueChange={setPlanOffering}>
              <SelectTrigger id="ll-offering">
                <SelectValue placeholder="Choose a class + subject" />
              </SelectTrigger>
              <SelectContent>
                {offerings.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {sectionLabel(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!planOffering ? (
            <p className="text-sm text-muted-foreground">
              Choose a class to see what it is scheduled to be taught.
            </p>
          ) : instances.length === 0 ? (
            <EmptyState
              title="Nothing scheduled for this class yet"
              description="Schedule lessons from the Library tab — the content stays shared, only the plan is per class."
            />
          ) : (
            <ul className="flex flex-col divide-y rounded-sm border">
              {instances.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {i.titleOverride ?? i.lesson?.title ?? 'Lesson'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {i.scheduledFor
                        ? new Date(i.scheduledFor).toLocaleDateString()
                        : 'Not dated'}
                      {i.taughtAt
                        ? ` · taught ${new Date(i.taughtAt).toLocaleDateString()}`
                        : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={INSTANCE_TONE[i.status] ?? 'neutral'}>
                      {i.status}
                    </StatusBadge>
                    {canCreate && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy || i.status === 'taught'}
                          onClick={() => markInstance(i.id, 'taught')}
                        >
                          Mark taught
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => unschedule(i.id)}
                        >
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------ chapter dialog */}
      <Sheet open={chapterOpen} onOpenChange={setChapterOpen}>
        <DrawerContent>
          <DrawerHeader className="gap-1.5">
            <DrawerTitle className="pr-8">New chapter</DrawerTitle>
            <SheetDescription className="text-[calc(12.5px*var(--font-scale))]">
              Chapters group this subject’s lessons — the unit a teacher and a
              student both think in.
            </SheetDescription>
          </DrawerHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ch-title">Title</Label>
                <Input
                  id="ch-title"
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  placeholder="Chapter 3 — Fractions"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ch-desc">Description (optional)</Label>
                <Textarea
                  id="ch-desc"
                  value={chapterDesc}
                  onChange={(e) => setChapterDesc(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DrawerFooter className="flex-row justify-end gap-2">
            <Button
              onClick={createChapter}
              disabled={busy || !chapterTitle.trim()}
            >
              Add chapter
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Sheet>

      {/* ----------------------------------------------- schedule dialog */}
      <Sheet
        open={scheduleFor !== null}
        onOpenChange={(open) => !open && setScheduleFor(null)}
      >
        <DrawerContent>
          <DrawerHeader className="gap-1.5">
            <DrawerTitle className="pr-8">
              Schedule “{scheduleFor?.title}”
            </DrawerTitle>
            <SheetDescription className="text-[calc(12.5px*var(--font-scale))]">
              The class gets its own plan entry. The lesson itself stays in the
              library, so every other class keeps the same content — and its
              materials are never processed twice.
            </SheetDescription>
          </DrawerHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sch-offering">Class</Label>
                <Select
                  value={scheduleOffering}
                  onValueChange={setScheduleOffering}
                >
                  <SelectTrigger id="sch-offering">
                    <SelectValue placeholder="Choose a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleOfferings.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {sectionLabel(o)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {eligibleOfferings.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No class is offering this subject yet — add an offering in
                    Academic structure first.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sch-date">Date (optional)</Label>
                <Input
                  id="sch-date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DrawerFooter className="flex-row justify-end gap-2">
            <Button onClick={schedule} disabled={busy || !scheduleOffering}>
              Schedule
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Sheet>
    </ShellMain>
  );
}
