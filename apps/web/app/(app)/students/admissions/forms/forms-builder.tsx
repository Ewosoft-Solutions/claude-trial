'use client';

/**
 * WB3-3 · the application-form builder — now the reusable Form engine's
 * <FormBuilder> (sections, question types, validation, branching). A draft is
 * edited freely; publishing supersedes the current form (the prior published
 * version is archived) and a published version is immutable. Writes hit
 * /api/admissions/forms/* (backed by the generic FormsService).
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Plus } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { PageTitle } from '@workspace/ui/custom/shell/page-title';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { FormBuilder } from '@workspace/ui/custom/forms/form-builder';
import type { FormDefinition } from '@workspace/forms';

import {
  FORM_STATUS_TONE,
  errorMessage,
  fmtDate,
  type FormVersion,
} from '../admissions-types';

function emptyDefinition(): FormDefinition {
  return {
    title: 'Application form',
    sections: [{ id: `s_${Date.now().toString(36)}`, title: '', items: [] }],
  };
}
const itemCount = (def: FormDefinition) =>
  def.sections.reduce((n, s) => n + s.items.length, 0);

type Draft = { id: string | null; definition: FormDefinition };

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
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const current = versions.find((v) => v.status === 'published');
  const q = campusId ? `?campusId=${encodeURIComponent(campusId)}` : '';

  async function send(
    path: string,
    method: 'POST' | 'PATCH',
    body: unknown,
    okMsg: string,
  ): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/admissions/${path}${q}`, {
        method,
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

  async function saveDraft() {
    if (!draft) return;
    const ok = draft.id
      ? await send(
          `forms/${draft.id}`,
          'PATCH',
          { definition: draft.definition },
          'Draft saved',
        )
      : await send(
          'forms',
          'POST',
          { definition: draft.definition },
          'Draft created',
        );
    if (ok) setDraft(null);
  }

  if (draft) {
    const draftBody = (
      <>
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            onClick={() => setDraft(null)}
          >
            <ArrowLeft className="mr-1 size-4" aria-hidden /> Back
          </Button>
          <PageTitle>{draft.id ? 'Edit draft' : 'New form version'}</PageTitle>
        </div>
        <FormBuilder
          value={draft.definition}
          onChange={(definition) => setDraft({ ...draft, definition })}
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setDraft(null)}
          >
            Cancel
          </Button>
          <Button
            disabled={busy || !draft.definition.title.trim()}
            onClick={() => void saveDraft()}
          >
            Save draft
          </Button>
        </div>
      </>
    );
    return embedded ? (
      <div className="flex flex-col gap-6">{draftBody}</div>
    ) : (
      <ShellMain className="gap-6">{draftBody}</ShellMain>
    );
  }

  const listBody = (
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

      {canManage && (
        <div>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              setDraft({ id: null, definition: emptyDefinition() })
            }
          >
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
          {versions.map((v) => {
            const count = itemCount(v.definition);
            return (
              <Card key={v.id}>
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      v{v.version} · {v.definition.title}
                      <StatusBadge
                        tone={FORM_STATUS_TONE[v.status] ?? 'neutral'}
                      >
                        {v.status}
                      </StatusBadge>
                      {current?.id === v.id && (
                        <span className="text-xs text-muted-foreground">
                          (current)
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {count} question{count === 1 ? '' : 's'} ·{' '}
                      {v.definition.sections.length} section
                      {v.definition.sections.length === 1 ? '' : 's'}
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
                            onClick={() =>
                              setDraft({ id: v.id, definition: v.definition })
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void send(
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
                            void send(
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
              </Card>
            );
          })}
        </div>
      )}
    </>
  );

  return embedded ? (
    <div className="flex flex-col gap-6">{listBody}</div>
  ) : (
    <ShellMain className="gap-6">{listBody}</ShellMain>
  );
}
