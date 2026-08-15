'use client';

/**
 * WB3-3 · the application-form authoring surface — a master–detail view (inspired
 * by the lesson-materials page): a version list on the left, and a detail pane on
 * the right that PREVIEWS a version's questions read-only, or edits a draft inline
 * via the reusable <FormBuilder>. Publishing supersedes the current form (the
 * prior published version is archived); a published version is immutable, so it is
 * "Duplicated to a draft" to change it. Writes hit /api/admissions/forms/*.
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Eye,
  Plus,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { PageTitle } from '@workspace/ui/custom/shell/page-title';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { FormBuilder } from '@workspace/ui/custom/forms/form-builder';
import { cn } from '@workspace/ui/lib/utils';
import {
  DISPLAY_ITEM_TYPES,
  type FormDefinition,
  type FormItem,
} from '@workspace/forms';

import {
  FORM_STATUS_TONE,
  errorMessage,
  fmtDate,
  type FormVersion,
} from '../admissions-types';

const ITEM_TYPE_LABEL: Record<string, string> = {
  short_text: 'Short text',
  paragraph: 'Paragraph',
  number: 'Number',
  date: 'Date',
  time: 'Time',
  phone: 'Phone',
  address: 'Address',
  radio: 'Choice',
  dropdown: 'Dropdown',
  checkboxes: 'Checkboxes',
  linear_scale: 'Scale',
  file: 'File upload',
  grid_radio: 'Grid',
  grid_checkbox: 'Grid',
  cascade: 'Class picker',
  heading: 'Heading',
  description: 'Description',
};

function emptyDefinition(): FormDefinition {
  return {
    title: 'Application form',
    sections: [{ id: `s_${Date.now().toString(36)}`, title: '', items: [] }],
  };
}
const clone = (def: FormDefinition): FormDefinition =>
  JSON.parse(JSON.stringify(def)) as FormDefinition;
const sectionCount = (def: FormDefinition) => def.sections.length;
const questionCount = (def: FormDefinition) =>
  def.sections.reduce(
    (n, s) =>
      n + s.items.filter((i) => !DISPLAY_ITEM_TYPES.includes(i.type)).length,
    0,
  );

type EditState = { id: string; version: number; definition: FormDefinition };

export function FormsBuilder({
  versions,
  canManage,
  campusId,
  embedded,
}: {
  versions: FormVersion[];
  canManage: boolean;
  /** Author a per-campus variant; omitted / '' = the school default. */
  campusId?: string;
  /** Rendered inside the unified authoring shell — skip the page chrome. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [edit, setEdit] = React.useState<EditState | null>(null);
  const q = campusId ? `?campusId=${encodeURIComponent(campusId)}` : '';

  const current = versions.find((v) => v.status === 'published') ?? null;
  const [selectedId, setSelectedId] = React.useState<string | null>(
    () => current?.id ?? versions[0]?.id ?? null,
  );
  const selected = versions.find((v) => v.id === selectedId) ?? null;

  // Enter/leave inline draft-editing as the selection changes. Guarded by a ref
  // so it runs once per selected version (not on every keystroke / refresh), and
  // it never clears `edit` while a just-created draft is still absent from the
  // (about-to-refresh) list.
  const syncedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!selected) return;
    if (syncedRef.current === selected.id) return;
    syncedRef.current = selected.id;
    if (canManage && selected.status === 'draft') {
      setEdit({
        id: selected.id,
        version: selected.version,
        definition: clone(selected.definition),
      });
    } else {
      setEdit(null);
    }
    setDirty(false);
  }, [selected, canManage]);

  function selectVersion(id: string) {
    if (id === selectedId) return;
    if (dirty && !window.confirm('Discard unsaved changes to this draft?')) {
      return;
    }
    setSelectedId(id);
  }

  async function send(
    path: string,
    body: unknown,
    okMsg: string,
  ): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/admissions/${path}${q}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Action failed'));
        return false;
      }
      toast.success(okMsg);
      router.refresh();
      return true;
    } catch {
      toast.error('Network error — please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Create a draft (optionally seeded from an existing definition) + select it. */
  async function createDraft(definition: FormDefinition) {
    if (dirty && !window.confirm('Discard unsaved changes to this draft?')) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admissions/forms${q}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ definition }),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not create the draft'));
        return;
      }
      const created = (await res.json()) as FormVersion;
      syncedRef.current = created.id;
      setEdit({
        id: created.id,
        version: created.version,
        definition: clone(created.definition ?? definition),
      });
      setDirty(false);
      setSelectedId(created.id);
      toast.success('Draft created');
      router.refresh();
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!edit) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admissions/forms/${edit.id}${q}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ definition: edit.definition }),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not save the draft'));
        return;
      }
      toast.success('Draft saved');
      setDirty(false);
      router.refresh();
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <>
      {!embedded && (
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/students/admissions">
              <ArrowLeft className="mr-1 size-4" aria-hidden /> Admissions
            </Link>
          </Button>
          <PageTitle>Application form</PageTitle>
          <p className="text-sm text-muted-foreground">
            The school&rsquo;s own questionnaire — sections, question types and
            branching. Publishing a new version supersedes the current one
            without touching answers already captured.
          </p>
        </div>
      )}

      <div className="grid min-h-0 gap-4 @4xl/main:min-h-[34rem] @4xl/main:grid-cols-[minmax(15rem,20rem)_1fr]">
        {/* ---- version list ---- */}
        <section
          aria-label="Form versions"
          className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Versions</h3>
            <span className="text-xs text-muted-foreground">
              {versions.length}
            </span>
          </div>

          {canManage && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() =>
                void createDraft(
                  clone(current?.definition ?? emptyDefinition()),
                )
              }
            >
              <Plus className="mr-1 size-4" aria-hidden /> New version
            </Button>
          )}

          {versions.length === 0 ? (
            <EmptyState
              compact
              title="No versions yet"
              description={
                canManage
                  ? 'Create the first version to start authoring.'
                  : 'No application form has been published yet.'
              }
            />
          ) : (
            <ul
              className="flex min-h-0 flex-col gap-1 overflow-y-auto"
              role="list"
            >
              {versions.map((v) => {
                const active = v.id === selected?.id;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => selectVersion(v.id)}
                      className={cn(
                        'w-full rounded-md border px-3 py-2 text-left transition-colors',
                        active
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-muted',
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        v{v.version}
                        <span className="min-w-0 truncate font-normal text-muted-foreground">
                          {v.definition.title}
                        </span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusBadge
                          tone={FORM_STATUS_TONE[v.status] ?? 'neutral'}
                        >
                          {v.status}
                        </StatusBadge>
                        {current?.id === v.id && (
                          <span className="text-[11px] text-muted-foreground">
                            current
                          </span>
                        )}
                      </span>
                      <span className="mt-1.5 block text-[11px] text-muted-foreground">
                        {sectionCount(v.definition)} section
                        {sectionCount(v.definition) === 1 ? '' : 's'} ·{' '}
                        {questionCount(v.definition)} question
                        {questionCount(v.definition) === 1 ? '' : 's'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ---- detail / editor ---- */}
        <section
          aria-label="Version detail"
          className="flex min-h-0 flex-col gap-4 rounded-xl border border-border bg-card p-4"
        >
          {edit ? (
            <DraftEditor
              edit={edit}
              busy={busy}
              onChange={(definition) => {
                setEdit({ ...edit, definition });
                setDirty(true);
              }}
              dirty={dirty}
              onSave={() => void saveDraft()}
              onPublish={() =>
                void send(
                  `forms/${edit.id}/publish`,
                  {},
                  `Published v${edit.version}`,
                )
              }
              onArchive={() =>
                void send(
                  `forms/${edit.id}/archive`,
                  {},
                  `Discarded draft v${edit.version}`,
                )
              }
            />
          ) : selected ? (
            <VersionPreview
              version={selected}
              isCurrent={current?.id === selected.id}
              canManage={canManage}
              busy={busy}
              onDuplicate={() => void createDraft(clone(selected.definition))}
              onArchive={() =>
                void send(
                  `forms/${selected.id}/archive`,
                  {},
                  `Archived v${selected.version}`,
                )
              }
            />
          ) : (
            <EmptyState
              compact
              title="Select a version"
              description="Choose a version to preview its questions."
            />
          )}
        </section>
      </div>
    </>
  );

  return embedded ? (
    <div className="flex flex-col gap-6">{body}</div>
  ) : (
    <ShellMain className="gap-6">{body}</ShellMain>
  );
}

// -------------------------------------------------------------- draft editor

function DraftEditor({
  edit,
  busy,
  dirty,
  onChange,
  onSave,
  onPublish,
  onArchive,
}: {
  edit: EditState;
  busy: boolean;
  dirty: boolean;
  onChange: (def: FormDefinition) => void;
  onSave: () => void;
  onPublish: () => void;
  onArchive: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            v{edit.version}
            <StatusBadge tone={FORM_STATUS_TONE.draft ?? 'neutral'}>
              draft
            </StatusBadge>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Editing — save your changes, then publish to make this the live
            form.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" disabled={busy} onClick={onArchive}>
            <Archive className="mr-1 size-4" aria-hidden /> Discard
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !dirty || !edit.definition.title.trim()}
            onClick={onSave}
          >
            <CheckCircle2 className="mr-1 size-4" aria-hidden />{' '}
            {dirty ? 'Save' : 'Saved'}
          </Button>
          <Button
            size="sm"
            disabled={busy || dirty}
            title={dirty ? 'Save your changes first' : undefined}
            onClick={onPublish}
          >
            Publish
          </Button>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto border-t border-border pt-4">
        <FormBuilder value={edit.definition} onChange={onChange} />
      </div>
    </>
  );
}

// ------------------------------------------------------------ version preview

function VersionPreview({
  version,
  isCurrent,
  canManage,
  busy,
  onDuplicate,
  onArchive,
}: {
  version: FormVersion;
  isCurrent: boolean;
  canManage: boolean;
  busy: boolean;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  const def = version.definition;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            v{version.version}
            <span className="min-w-0 truncate font-normal text-muted-foreground">
              {def.title}
            </span>
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge tone={FORM_STATUS_TONE[version.status] ?? 'neutral'}>
              {version.status}
            </StatusBadge>
            <span className="text-xs text-muted-foreground">
              {isCurrent ? 'current · ' : ''}
              {questionCount(def)} question{questionCount(def) === 1 ? '' : 's'}
              {version.publishedAt
                ? ` · published ${fmtDate(version.publishedAt)}`
                : ''}
            </span>
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onDuplicate}
            >
              <Copy className="mr-1 size-4" aria-hidden /> Duplicate to draft
            </Button>
            {version.status !== 'archived' && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={onArchive}
              >
                <Archive className="mr-1 size-4" aria-hidden /> Archive
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-md bg-info/10 px-3 py-2 text-xs text-info">
        <Eye className="size-4 shrink-0" aria-hidden />
        {version.status === 'archived'
          ? 'This version is archived. Duplicate it to a draft to reuse it.'
          : 'A published version is read-only. Duplicate it to a draft to make changes.'}
      </div>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto border-t border-border pt-4">
        {def.sections.map((section) => {
          const visibleItems = section.items;
          return (
            <div key={section.id} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {section.title || 'Untitled section'}
                </span>
                <StatusBadge tone={section.system ? 'neutral' : 'blue'}>
                  {section.system ? 'Standard' : 'Custom'}
                </StatusBadge>
                {section.repeatable && (
                  <span className="text-[11px] text-muted-foreground">
                    repeats
                  </span>
                )}
                {section.hidden && (
                  <span className="text-[11px] text-muted-foreground">
                    hidden
                  </span>
                )}
              </div>
              {visibleItems.length === 0 ? (
                <p className="px-2 text-xs text-muted-foreground">
                  No questions in this section.
                </p>
              ) : (
                <ul className="flex flex-col" role="list">
                  {visibleItems.map((item) => (
                    <PreviewItem key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function PreviewItem({ item }: { item: FormItem }) {
  const isDisplay = DISPLAY_ITEM_TYPES.includes(item.type);
  return (
    <li className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
      <span className="min-w-0 truncate">
        {isDisplay ? (
          <span className="text-muted-foreground">{item.label}</span>
        ) : (
          <>
            {item.label || (
              <span className="text-muted-foreground">Untitled</span>
            )}
            {item.required && (
              <span className="ml-0.5 text-destructive">*</span>
            )}
          </>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
        {item.hidden && <span>hidden</span>}
        <span>{ITEM_TYPE_LABEL[item.type] ?? item.type}</span>
      </span>
    </li>
  );
}
