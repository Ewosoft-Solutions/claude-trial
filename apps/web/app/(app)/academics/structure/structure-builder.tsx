'use client';

/**
 * WB2-1 · Guided class-builder (client).
 *
 * The structured replacement for typing a class name like "SS1 Science A". The
 * user picks dimensions — campus → year level → (optional) stream → section
 * name — and the display label is COMPOSED live for preview (the server
 * recomputes + stores it authoritatively). No field ever asks for, or parses, a
 * free-text label. Building blocks (stages, year levels, streams) are created in
 * place so the picker always has real options. All writes go through
 * /api/academics/structure/* (permissions enforced server-side).
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Layers, Plus } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';

export interface Campus {
  id: string;
  name: string;
  code: string;
}
export interface Stage {
  id: string;
  name: string;
  code: string;
  order?: number;
  status?: string;
}
export interface YearLevel {
  id: string;
  stageId: string;
  name: string;
  code: string;
  order?: number;
  status?: string;
}
export interface Stream {
  id: string;
  name: string;
  code: string;
  order?: number;
  status?: string;
}
export interface ClassSection {
  id: string;
  campusId: string;
  yearLevelId: string;
  streamId: string | null;
  name: string;
  displayLabel: string;
  capacity: number;
  status: string;
  yearLevel?: { id: string; name: string; code: string } | null;
  stream?: { id: string; name: string; code: string } | null;
}

/**
 * Compose a preview label from the dimensions — the inverse of parsing. Mirrors
 * the server's `composeSectionLabel`; the server value is authoritative.
 */
function composePreview(
  yearName: string | undefined,
  streamName: string | null | undefined,
  sectionName: string,
): string {
  return [yearName, streamName, sectionName]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .join(' ');
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as {
      message?: string | string[];
      error?: string;
    };
    const m = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message;
    return m || data.error || fallback;
  } catch {
    return fallback;
  }
}

export function StructureBuilder({
  canManage,
  initialCampuses,
  initialStages,
  initialYearLevels,
  initialStreams,
  initialSections,
}: {
  canManage: boolean;
  initialCampuses: Campus[];
  initialStages: Stage[];
  initialYearLevels: YearLevel[];
  initialStreams: Stream[];
  initialSections: ClassSection[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  // Guided section-builder form state.
  const [campusId, setCampusId] = React.useState('');
  const [yearLevelId, setYearLevelId] = React.useState('');
  const [streamId, setStreamId] = React.useState('none');
  const [sectionName, setSectionName] = React.useState('');

  const yearName = initialYearLevels.find((y) => y.id === yearLevelId)?.name;
  const streamName =
    streamId === 'none'
      ? null
      : initialStreams.find((s) => s.id === streamId)?.name;
  const previewLabel = composePreview(yearName, streamName, sectionName);

  const canCreateSection =
    canManage && campusId && yearLevelId && sectionName.trim().length > 0;

  async function run(action: () => Promise<Response>, successMsg: string) {
    setBusy(true);
    try {
      const res = await action();
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Something went wrong'));
        return false;
      }
      toast.success(successMsg);
      router.refresh();
      return true;
    } catch {
      toast.error('Network error — please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createSection() {
    const ok = await run(
      () =>
        postJson('/api/academics/structure/sections', {
          campusId,
          yearLevelId,
          streamId: streamId === 'none' ? undefined : streamId,
          name: sectionName.trim(),
        }),
      `Created ${previewLabel}`,
    );
    if (ok) setSectionName('');
  }

  // Group sections by campus for the list.
  const campusName = (id: string) =>
    initialCampuses.find((c) => c.id === id)?.name ?? 'Unknown campus';
  const sectionsByCampus = new Map<string, ClassSection[]>();
  for (const s of initialSections) {
    const arr = sectionsByCampus.get(s.campusId) ?? [];
    arr.push(s);
    sectionsByCampus.set(s.campusId, arr);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Guided section builder */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-4" aria-hidden /> New class section
            </CardTitle>
            <CardDescription>
              Pick the dimensions — the label is composed for you, never typed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {initialCampuses.length === 0 || initialYearLevels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add at least one campus and one year level (below) before you
                can build a class section.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Campus" htmlFor="sb-campus">
                  <Select value={campusId} onValueChange={setCampusId}>
                    <SelectTrigger id="sb-campus">
                      <SelectValue placeholder="Choose campus" />
                    </SelectTrigger>
                    <SelectContent>
                      {initialCampuses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Year level" htmlFor="sb-year">
                  <Select value={yearLevelId} onValueChange={setYearLevelId}>
                    <SelectTrigger id="sb-year">
                      <SelectValue placeholder="Choose year" />
                    </SelectTrigger>
                    <SelectContent>
                      {initialYearLevels.map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Stream (optional)" htmlFor="sb-stream">
                  <Select value={streamId} onValueChange={setStreamId}>
                    <SelectTrigger id="sb-stream">
                      <SelectValue placeholder="No stream" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No stream</SelectItem>
                      {initialStreams.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Section / arm" htmlFor="sb-name">
                  <Input
                    id="sb-name"
                    placeholder="e.g. A"
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    maxLength={60}
                  />
                </Field>

                <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-4">
                  <div
                    className="text-sm"
                    aria-live="polite"
                    data-testid="section-preview"
                  >
                    <span className="text-muted-foreground">
                      Preview label:{' '}
                    </span>
                    <span className="font-medium">{previewLabel || '—'}</span>
                  </div>
                  <div>
                    <Button
                      onClick={createSection}
                      disabled={!canCreateSection || busy}
                    >
                      Create class section
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sections list */}
      <Card>
        <CardHeader>
          <CardTitle>Class sections</CardTitle>
          <CardDescription>
            {initialSections.length} section
            {initialSections.length === 1 ? '' : 's'} across{' '}
            {sectionsByCampus.size} campus
            {sectionsByCampus.size === 1 ? '' : 'es'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initialSections.length === 0 ? (
            <EmptyState
              icon={<Layers aria-hidden />}
              title="No class sections yet"
              description={
                canManage
                  ? 'Use the builder above to create your first section.'
                  : 'No sections have been created yet.'
              }
            />
          ) : (
            <div className="flex flex-col gap-6">
              {[...sectionsByCampus.entries()].map(([cId, list]) => (
                <div key={cId} className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {campusName(cId)}
                  </h3>
                  <ul className="flex flex-col divide-y rounded-md border">
                    {list.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.displayLabel}</span>
                          {s.stream?.name && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              {s.stream.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Capacity {s.capacity}</span>
                          <StatusBadge
                            tone={s.status === 'active' ? 'success' : 'neutral'}
                          >
                            {s.status}
                          </StatusBadge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Building blocks */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Building blocks</CardTitle>
            <CardDescription>
              Stages, year levels and streams are the structured dimensions your
              sections are built from.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Stages */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Stages</h3>
              <SimpleBlockForm
                disabled={busy}
                onCreate={(name, code) =>
                  run(
                    () =>
                      postJson('/api/academics/structure/stages', {
                        name,
                        code,
                      }),
                    `Added stage ${name}`,
                  )
                }
              />
              <DimensionList
                items={initialStages.map((s) => ({
                  id: s.id,
                  label: `${s.name} (${s.code})`,
                }))}
              />
            </div>

            {/* Year levels */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Year levels</h3>
              <YearLevelForm
                stages={initialStages}
                disabled={busy}
                onCreate={(name, code, stageId) =>
                  run(
                    () =>
                      postJson('/api/academics/structure/year-levels', {
                        name,
                        code,
                        stageId,
                      }),
                    `Added year level ${name}`,
                  )
                }
              />
              <DimensionList
                items={initialYearLevels.map((y) => ({
                  id: y.id,
                  label: `${y.name} (${y.code})`,
                }))}
              />
            </div>

            {/* Streams */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Streams</h3>
              <SimpleBlockForm
                disabled={busy}
                onCreate={(name, code) =>
                  run(
                    () =>
                      postJson('/api/academics/structure/streams', {
                        name,
                        code,
                      }),
                    `Added stream ${name}`,
                  )
                }
              />
              <DimensionList
                items={initialStreams.map((s) => ({
                  id: s.id,
                  label: `${s.name} (${s.code})`,
                }))}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

/** The current list of a dimension (stages / year levels / streams). */
function DimensionList({ items }: { items: { id: string; label: string }[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">None yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {items.map((i) => (
        <li key={i.id} className="rounded bg-muted/50 px-2 py-1">
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function SimpleBlockForm({
  disabled,
  onCreate,
}: {
  disabled?: boolean;
  onCreate: (name: string, code: string) => Promise<boolean>;
}) {
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          aria-label="Name"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
        />
        <Input
          aria-label="Code"
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-24"
          maxLength={24}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || !name.trim() || !code.trim()}
        onClick={async () => {
          const ok = await onCreate(name.trim(), code.trim());
          if (ok) {
            setName('');
            setCode('');
          }
        }}
      >
        Add
      </Button>
    </div>
  );
}

function YearLevelForm({
  stages,
  disabled,
  onCreate,
}: {
  stages: Stage[];
  disabled?: boolean;
  onCreate: (name: string, code: string, stageId: string) => Promise<boolean>;
}) {
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [stageId, setStageId] = React.useState('');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          aria-label="Year level name"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
        />
        <Input
          aria-label="Year level code"
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-24"
          maxLength={24}
        />
      </div>
      <Select value={stageId} onValueChange={setStageId}>
        <SelectTrigger aria-label="Stage">
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          {stages.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || !name.trim() || !code.trim() || !stageId}
        onClick={async () => {
          const ok = await onCreate(name.trim(), code.trim(), stageId);
          if (ok) {
            setName('');
            setCode('');
          }
        }}
      >
        Add
      </Button>
      {stages.length === 0 && (
        <p className="text-xs text-muted-foreground">Add a stage first</p>
      )}
    </div>
  );
}
