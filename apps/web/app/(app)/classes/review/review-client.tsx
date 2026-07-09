'use client';

import * as React from 'react';
import { CheckCircle2, Download, Eye, Rocket, XCircle } from 'lucide-react';

import {
  academicsApi,
  classLabel,
  EXTRACTION_META,
  formatDateTime,
  formatSize,
  LESSON_STATUS_META,
  readError,
  REVIEW_META,
  type LessonSummary,
  type MaterialSummary,
} from '@/lib/academics';
import { Button } from '@workspace/ui/components/button';
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
import type { StateTone } from '@workspace/ui/types/states.types';

type ReviewType = 'lesson' | 'material';
type ReviewFilter = 'pending_review' | 'rejected' | 'approved' | 'all';

export interface ReviewItem {
  key: string;
  type: ReviewType;
  lesson: LessonSummary;
  material?: MaterialSummary;
}

function itemStatus(item: ReviewItem): string {
  return item.type === 'lesson'
    ? item.lesson.reviewStatus
    : (item.material?.reviewStatus ?? 'draft');
}

function meta(
  map: Record<string, { label: string; tone: StateTone }>,
  value: string,
) {
  return map[value] ?? { label: value.replace(/_/g, ' '), tone: 'neutral' as StateTone };
}

export function AcademicReviewClient({
  live,
  initialItems,
}: {
  live: boolean;
  initialItems: ReviewItem[];
}) {
  const [items, setItems] = React.useState(initialItems);
  const [filter, setFilter] = React.useState<ReviewFilter>('pending_review');
  const [selectedKey, setSelectedKey] = React.useState(initialItems[0]?.key ?? '');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(
    () =>
      items.filter((item) =>
        filter === 'all' ? true : itemStatus(item) === filter,
      ),
    [filter, items],
  );

  React.useEffect(() => {
    if (filtered.length === 0) {
      setSelectedKey('');
      return;
    }
    if (!filtered.some((item) => item.key === selectedKey)) {
      setSelectedKey(filtered[0]!.key);
    }
  }, [filtered, selectedKey]);

  const selected = filtered.find((item) => item.key === selectedKey) ?? null;

  function replaceItem(key: string, patch: Partial<ReviewItem>) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  async function decide(decision: 'approve' | 'reject') {
    if (!selected || !live) return;
    if (decision === 'reject' && !note.trim()) {
      setError('A note is required when rejecting.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const path =
        selected.type === 'lesson'
          ? `learning/lessons/${selected.lesson.id}/${decision}`
          : `learning/materials/${selected.material!.id}/${decision}`;
      const res = await fetch(academicsApi(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const updated = await res.json();
      replaceItem(
        selected.key,
        selected.type === 'lesson'
          ? { lesson: updated as LessonSummary }
          : { material: updated as MaterialSummary },
      );
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setBusy(false);
    }
  }

  async function publishLesson() {
    if (!selected || selected.type !== 'lesson' || !live) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(academicsApi(`learning/lessons/${selected.lesson.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      if (!res.ok) throw new Error(await readError(res));
      replaceItem(selected.key, { lesson: (await res.json()) as LessonSummary });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = items.filter((item) => itemStatus(item) === 'pending_review').length;
  const approvedCount = items.filter((item) => itemStatus(item) === 'approved').length;
  const rejectedCount = items.filter((item) => itemStatus(item) === 'rejected').length;

  return (
    <ShellMain className="gap-0 pb-0">
      <PageHeader
        padded={false}
        className="pb-3"
        title="Academic review"
        meta={[
          { key: 'pending', label: `${pendingCount} pending`, emphasis: true },
          { key: 'approved', label: `${approvedCount} approved` },
          { key: 'rejected', label: `${rejectedCount} rejected` },
        ]}
        actions={
          <Select value={filter} onValueChange={(value) => setFilter(value as ReviewFilter)}>
            <SelectTrigger className="w-40" aria-label="Filter review queue">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_review">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="all">All items</SelectItem>
            </SelectContent>
          </Select>
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

      <ListDetailLayout
        className="mb-[var(--content-padding)] mt-4 flex-1"
        listWidth={360}
        showDetail={Boolean(selected)}
        list={
          <nav aria-label="Review queue" className="flex flex-col gap-1 p-2">
            {filtered.length === 0 ? (
              <EmptyState
                compact
                title="Nothing here"
                description="Choose another status to see more review items."
              />
            ) : (
              filtered.map((item) => {
                const status = meta(REVIEW_META, itemStatus(item));
                const title =
                  item.type === 'lesson'
                    ? item.lesson.title
                    : (item.material?.title ?? 'Material');
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedKey(item.key)}
                    className={cn(
                      'rounded-md px-3 py-2 text-left transition-colors hover:bg-accent',
                      selectedKey === item.key && 'bg-accent',
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {item.type === 'lesson'
                            ? classLabel(item.lesson.class)
                            : item.material?.fileName}
                        </span>
                      </span>
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </span>
                  </button>
                );
              })
            )}
          </nav>
        }
        detail={
          <div className="flex min-h-full flex-col gap-4 p-4">
            {!selected ? (
              <EmptyState
                compact
                title="Select an item"
                description="Pick a lesson or material from the queue."
              />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      {selected.type === 'lesson' ? 'Lesson' : 'Material'}
                    </p>
                    <h2 className="mt-1 truncate text-lg font-semibold">
                      {selected.type === 'lesson'
                        ? selected.lesson.title
                        : selected.material?.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {classLabel(selected.lesson.class)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge tone={meta(REVIEW_META, itemStatus(selected)).tone}>
                      {meta(REVIEW_META, itemStatus(selected)).label}
                    </StatusBadge>
                    {selected.type === 'lesson' ? (
                      <StatusBadge
                        tone={meta(LESSON_STATUS_META, selected.lesson.status).tone}
                      >
                        {meta(LESSON_STATUS_META, selected.lesson.status).label}
                      </StatusBadge>
                    ) : selected.material ? (
                      <StatusBadge
                        tone={
                          meta(EXTRACTION_META, selected.material.extractionStatus).tone
                        }
                      >
                        {meta(EXTRACTION_META, selected.material.extractionStatus).label}
                      </StatusBadge>
                    ) : null}
                  </div>
                </div>

                {selected.type === 'lesson' ? (
                  <div className="grid gap-4">
                    <section className="grid gap-1.5">
                      <h3 className="text-sm font-semibold">Summary</h3>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {selected.lesson.description || 'No summary.'}
                      </p>
                    </section>
                    <section className="grid gap-1.5">
                      <h3 className="text-sm font-semibold">Lesson note</h3>
                      <div className="max-h-72 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm leading-6">
                        {selected.lesson.content || 'No lesson note.'}
                      </div>
                    </section>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDateTime(selected.lesson.submittedForReviewAt)}
                    </p>
                  </div>
                ) : selected.material ? (
                  <div className="grid gap-4">
                    <section className="grid gap-2">
                      <h3 className="text-sm font-semibold">File</h3>
                      <div className="rounded-md border bg-muted/30 p-3 text-sm">
                        <p className="font-medium">{selected.material.fileName}</p>
                        <p className="mt-1 text-muted-foreground">
                          {selected.material.category} · {formatSize(selected.material.sizeBytes)}
                        </p>
                      </div>
                    </section>
                    <Button asChild variant="outline" size="sm" className="w-fit">
                      <a
                        href={academicsApi(
                          `learning/materials/${selected.material.id}/download`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download /> Open file
                      </a>
                    </Button>
                  </div>
                ) : null}

                {selected.type === 'lesson' && selected.lesson.reviewNote ? (
                  <NoticeBanner
                    tone={
                      selected.lesson.reviewStatus === 'rejected'
                        ? 'destructive'
                        : 'info'
                    }
                    title="Previous note"
                    description={selected.lesson.reviewNote}
                  />
                ) : selected.material?.reviewNote ? (
                  <NoticeBanner
                    tone={
                      selected.material.reviewStatus === 'rejected'
                        ? 'destructive'
                        : 'info'
                    }
                    title="Previous note"
                    description={selected.material.reviewNote}
                  />
                ) : null}

                <div className="mt-auto grid gap-3 border-t pt-4">
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Decision note"
                    className="min-h-24"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(
                        selected.type === 'lesson'
                          ? `/classes/materials`
                          : academicsApi(
                              `learning/materials/${selected.material!.id}/download`,
                            ),
                        '_blank',
                      )}
                    >
                      <Eye /> Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void decide('reject')}
                      disabled={!live || busy || !note.trim()}
                    >
                      <XCircle /> Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void decide('approve')}
                      disabled={!live || busy || itemStatus(selected) === 'approved'}
                    >
                      <CheckCircle2 /> Approve
                    </Button>
                    {selected.type === 'lesson' &&
                    selected.lesson.reviewStatus === 'approved' &&
                    selected.lesson.status !== 'published' ? (
                      <Button
                        size="sm"
                        onClick={() => void publishLesson()}
                        disabled={!live || busy}
                      >
                        <Rocket /> Publish
                      </Button>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        }
      />
    </ShellMain>
  );
}
