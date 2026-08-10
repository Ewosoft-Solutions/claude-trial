'use client';

/**
 * WB3-3 · build + version the school's application form. A draft is edited
 * freely; publishing supersedes the current form (the prior published version is
 * archived) and a published version is immutable — editing it forks a new draft.
 * Writes hit /api/admissions/forms/* (gated `admissions.criteria`).
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import { Checkbox } from '@workspace/ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { PageTitle } from '@workspace/ui/custom/shell/page-title';

import {
  FORM_FIELD_TYPES,
  FORM_FIELD_TYPE_LABEL,
  FORM_STATUS_TONE,
  errorMessage,
  fmtDate,
  type FormFieldDef,
  type FormFieldType,
  type FormVersion,
} from '../admissions-types';

const OPTION_TYPES: FormFieldType[] = ['select', 'multiselect'];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

interface DraftState {
  id?: string; // set when editing an existing draft
  title: string;
  description: string;
  fields: FormFieldDef[];
}

export function FormsBuilder({
  versions,
  canManage,
}: {
  versions: FormVersion[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftState | null>(null);

  const current = versions.find((v) => v.status === 'published') ?? null;

  async function action(
    path: string,
    method: 'POST' | 'PATCH',
    body: unknown,
    okMsg: string,
  ): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/admissions/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
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

  function newDraft() {
    setDraft({
      title: `Application form v${(versions[0]?.version ?? 0) + 1}`,
      description: '',
      fields: [],
    });
  }

  function editDraft(v: FormVersion) {
    setDraft({
      id: v.id,
      title: v.title,
      description: v.description ?? '',
      fields: v.fields,
    });
  }

  async function saveDraft() {
    if (!draft) return;
    const fields = draft.fields.map((f) => ({
      ...f,
      key: f.key.trim() || slugify(f.label),
      label: f.label.trim(),
      options: OPTION_TYPES.includes(f.type)
        ? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
        : undefined,
    }));
    const body = {
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      fields,
    };
    const ok = draft.id
      ? await action(`forms/${draft.id}`, 'PATCH', body, 'Draft saved')
      : await action('forms', 'POST', body, 'Draft created');
    if (ok) setDraft(null);
  }

  if (draft) {
    return (
      <DraftEditor
        draft={draft}
        busy={busy}
        onChange={setDraft}
        onCancel={() => setDraft(null)}
        onSave={() => void saveDraft()}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/admissions">
            <ArrowLeft className="mr-1 size-4" aria-hidden /> Admissions
          </Link>
        </Button>
        <PageTitle>Application form</PageTitle>
        <p className="text-sm text-muted-foreground">
          The school&rsquo;s own questionnaire, versioned. Publishing a new
          version supersedes the current one without touching answers already
          captured.
        </p>
      </div>

      {canManage && (
        <div>
          <Button size="sm" onClick={newDraft} disabled={busy}>
            <Plus className="mr-1 size-4" aria-hidden /> New version
          </Button>
        </div>
      )}

      {versions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No application form yet.
            {canManage ? ' Create the first version to get started.' : ''}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {versions.map((v) => (
            <Card key={v.id}>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="flex flex-col gap-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    v{v.version} · {v.title}
                    <StatusBadge tone={FORM_STATUS_TONE[v.status] ?? 'neutral'}>
                      {v.status}
                    </StatusBadge>
                    {current?.id === v.id && (
                      <span className="text-xs text-muted-foreground">
                        (current)
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {v.fields.length} field{v.fields.length === 1 ? '' : 's'}
                    {v.publishedAt
                      ? ` · published ${fmtDate(v.publishedAt)}`
                      : ''}
                  </CardDescription>
                </div>
                {canManage && (
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {v.status === 'draft' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => editDraft(v)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void action(
                              `forms/${v.id}/publish`,
                              'POST',
                              {},
                              `Published v${v.version}`,
                            )
                          }
                        >
                          Publish
                        </Button>
                      </>
                    )}
                    {v.status !== 'archived' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void action(
                            `forms/${v.id}/archive`,
                            'POST',
                            {},
                            `Archived v${v.version}`,
                          )
                        }
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                )}
              </CardHeader>
              {v.fields.length > 0 && (
                <CardContent>
                  <ul className="flex flex-wrap gap-2">
                    {v.fields.map((f) => (
                      <li
                        key={f.key}
                        className="rounded-md border border-border px-2 py-1 text-xs"
                      >
                        <span className="font-medium">{f.label}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          · {FORM_FIELD_TYPE_LABEL[f.type] ?? f.type}
                          {f.required ? ' · required' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DraftEditor({
  draft,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  draft: DraftState;
  busy: boolean;
  onChange: (draft: DraftState) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  function addField() {
    onChange({
      ...draft,
      fields: [
        ...draft.fields,
        { key: '', label: '', type: 'text', required: false },
      ],
    });
  }
  function updateField(index: number, next: FormFieldDef) {
    onChange({
      ...draft,
      fields: draft.fields.map((f, i) => (i === index ? next : f)),
    });
  }
  function removeField(index: number) {
    onChange({
      ...draft,
      fields: draft.fields.filter((_, i) => i !== index),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          onClick={onCancel}
        >
          <ArrowLeft className="mr-1 size-4" aria-hidden /> Back
        </Button>
        <PageTitle>{draft.id ? 'Edit draft' : 'New form version'}</PageTitle>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="form-title">Title</Label>
            <Input
              id="form-title"
              value={draft.title}
              onChange={(e) => onChange({ ...draft, title: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="form-desc">Description</Label>
            <Textarea
              id="form-desc"
              value={draft.description}
              rows={2}
              onChange={(e) =>
                onChange({ ...draft, description: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Fields</h3>
        <Button size="sm" variant="outline" onClick={addField}>
          <Plus className="mr-1 size-3.5" aria-hidden /> Add field
        </Button>
      </div>

      {draft.fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No fields yet — add at least one before publishing.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {draft.fields.map((field, i) => (
            <FieldEditor
              key={i}
              field={field}
              onChange={(next) => updateField(i, next)}
              onRemove={() => removeField(i)}
            />
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={busy || !draft.title.trim()} onClick={onSave}>
          Save draft
        </Button>
      </div>
    </div>
  );
}

function FieldEditor({
  field,
  onChange,
  onRemove,
}: {
  field: FormFieldDef;
  onChange: (next: FormFieldDef) => void;
  onRemove: () => void;
}) {
  const showOptions = OPTION_TYPES.includes(field.type);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-start gap-2">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Label</Label>
              <Input
                value={field.label}
                placeholder="Previous school"
                onChange={(e) => onChange({ ...field, label: e.target.value })}
                onBlur={() => {
                  if (!field.key.trim() && field.label.trim()) {
                    onChange({ ...field, key: slugify(field.label) });
                  }
                }}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Key</Label>
              <Input
                value={field.key}
                placeholder="previous_school"
                onChange={(e) =>
                  onChange({ ...field, key: slugify(e.target.value) })
                }
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-9 shrink-0"
            onClick={onRemove}
            aria-label="Remove field"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Type</Label>
            <Select
              value={field.type}
              onValueChange={(v) =>
                onChange({ ...field, type: v as FormFieldType })
              }
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORM_FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FORM_FIELD_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox
              checked={field.required === true}
              onCheckedChange={(c) =>
                onChange({ ...field, required: c === true })
              }
            />
            Required
          </label>
        </div>

        {showOptions && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Options (comma-separated)</Label>
            <Input
              value={(field.options ?? []).join(', ')}
              onChange={(e) =>
                onChange({ ...field, options: e.target.value.split(',') })
              }
              placeholder="e.g. Science, Arts, Commercial"
              className="h-9"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
