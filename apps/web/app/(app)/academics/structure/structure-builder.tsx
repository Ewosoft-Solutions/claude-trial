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
import { BookOpen, Layers, Plus } from 'lucide-react';

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { Checkbox } from '@workspace/ui/components/checkbox';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { Dot } from '@workspace/ui/custom/data-display/dot';

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
export interface BandOption {
  value: string;
  label: string;
}

export interface LevelSpineOption {
  code: string;
  canonicalName: string;
  educationLevel: string;
  aliases: string[];
}

export interface SubjectOffering {
  id: string;
  classSectionId: string;
  academicYearId: string;
  termId: string | null;
  subjectLabel: string;
  isElective: boolean;
  status: string;
}

export interface OfferableSubject {
  id: string;
  code: string;
  name: string;
  versionId: string | null;
  versionName: string | null;
  versionState: string | null;
  isShared: boolean;
}

export interface YearOption {
  id: string;
  name: string;
}

export interface TermOption {
  id: string;
  name: string;
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
  initialOfferings,
  offerableSubjects,
  years,
  termsByYear,
  bands,
  levelSpine,
}: {
  canManage: boolean;
  initialCampuses: Campus[];
  initialStages: Stage[];
  initialYearLevels: YearLevel[];
  initialStreams: Stream[];
  initialSections: ClassSection[];
  initialOfferings: SubjectOffering[];
  offerableSubjects: OfferableSubject[];
  years: YearOption[];
  termsByYear: Record<string, TermOption[]>;
  bands: BandOption[];
  levelSpine: LevelSpineOption[];
}) {
  const router = useRouter();
  const [sectionOpen, setSectionOpen] = React.useState(false);
  const [blocksOpen, setBlocksOpen] = React.useState(false);
  const [offerOpen, setOfferOpen] = React.useState(false);
  const [offerings, setOfferings] =
    React.useState<SubjectOffering[]>(initialOfferings);
  const [offerSection, setOfferSection] = React.useState('');
  const [offerYear, setOfferYear] = React.useState('');
  const [offerTerm, setOfferTerm] = React.useState('');
  const [offerSubject, setOfferSubject] = React.useState('');
  const [offerElective, setOfferElective] = React.useState(false);
  const [offerBusy, setOfferBusy] = React.useState(false);
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

  const offeringsBySection = React.useMemo(() => {
    const map = new Map<string, SubjectOffering[]>();
    for (const o of offerings) {
      const list = map.get(o.classSectionId) ?? [];
      list.push(o);
      map.set(o.classSectionId, list);
    }
    return map;
  }, [offerings]);

  /**
   * Offer a curriculum subject to a section — the section × subject join the
   * whole structured model turns on (WB2 resolves a student's subjects through
   * it, and results are captured per offering). The endpoint existed from WB2-1;
   * until now nothing in the app called it.
   */
  async function submitOffering() {
    setOfferBusy(true);
    try {
      const res = await fetch('/api/academics/structure/offerings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classSectionId: offerSection,
          academicYearId: offerYear,
          termId: offerTerm || undefined,
          curriculumSubjectId: offerSubject,
          isElective: offerElective,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
        };
        const m = Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message;
        throw new Error(m || 'Could not offer that subject');
      }
      const created = (await res.json()) as SubjectOffering;
      setOfferings((prev) => [...prev, created]);
      toast.success('Subject offered to the section');
      setOfferOpen(false);
      setOfferSubject('');
      setOfferElective(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not offer that subject',
      );
    } finally {
      setOfferBusy(false);
    }
  }

  return (
    <ShellMain>
      <PageHeader
        title="Academic structure"
        description="Build classes from dimensions — campus, stage, year level, stream and section — instead of typing a name like “SS1 Science A”. The label is composed for you."
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBlocksOpen(true)}
              >
                <Layers aria-hidden /> Building blocks
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOfferOpen(true)}
              >
                <BookOpen aria-hidden /> Offer a subject
              </Button>
              <Button size="sm" onClick={() => setSectionOpen(true)}>
                <Plus aria-hidden /> New section
              </Button>
            </div>
          ) : undefined
        }
      />

      {canManage && (
        <Dialog open={sectionOpen} onOpenChange={setSectionOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>New class section</DialogTitle>
              <DialogDescription>
                Pick the dimensions — the label is composed for you, never
                typed.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              {initialCampuses.length === 0 ||
              initialYearLevels.length === 0 ? (
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
            </div>
          </DialogContent>
        </Dialog>
      )}

      {canManage && (
        <Dialog open={blocksOpen} onOpenChange={setBlocksOpen}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Building blocks</DialogTitle>
              <DialogDescription>
                Stages, year levels and streams are the structured dimensions
                your sections are built from.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              {/* Stages */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">Stages</h3>
                <SimpleBlockForm
                  variant="stage"
                  bands={bands}
                  disabled={busy}
                  onCreate={(name, code, extra) =>
                    run(
                      () =>
                        postJson('/api/academics/structure/stages', {
                          name,
                          code,
                          ...extra,
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
                  levelSpine={levelSpine}
                  disabled={busy}
                  onCreate={(name, code, stageId, levelCode) =>
                    run(
                      () =>
                        postJson('/api/academics/structure/year-levels', {
                          name,
                          code,
                          stageId,
                          levelCode,
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
                  variant="arm"
                  disabled={busy}
                  onCreate={(name, code, extra) =>
                    run(
                      () =>
                        postJson('/api/academics/structure/streams', {
                          name,
                          code,
                          ...extra,
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
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Sections list */}
      {canManage && (
        <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Offer a subject to a section</DialogTitle>
              <DialogDescription>
                An offering is what the rest of the system reads: a student’s
                subjects resolve through it, and results are captured against
                it. Subjects come from the curriculum, not free text.
              </DialogDescription>
            </DialogHeader>
            {initialSections.length === 0 || offerableSubjects.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                {initialSections.length === 0
                  ? 'Create a class section first.'
                  : 'No curriculum subjects are available yet — adopt or author a curriculum version before offering subjects.'}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
                  <Field label="Section" htmlFor="of-section">
                    <Select
                      value={offerSection}
                      onValueChange={setOfferSection}
                    >
                      <SelectTrigger id="of-section">
                        <SelectValue placeholder="Choose section" />
                      </SelectTrigger>
                      <SelectContent>
                        {initialSections.map((sec) => (
                          <SelectItem key={sec.id} value={sec.id}>
                            {sec.displayLabel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Subject" htmlFor="of-subject">
                    <Select
                      value={offerSubject}
                      onValueChange={setOfferSubject}
                    >
                      <SelectTrigger id="of-subject">
                        <SelectValue placeholder="Choose subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {offerableSubjects.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name}
                            {sub.versionName ? ` · ${sub.versionName}` : ''}
                            {sub.versionState && sub.versionState !== 'active'
                              ? ` (${sub.versionState})`
                              : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Academic year" htmlFor="of-year">
                    <Select
                      value={offerYear}
                      onValueChange={(v) => {
                        setOfferYear(v);
                        setOfferTerm('');
                      }}
                    >
                      <SelectTrigger id="of-year">
                        <SelectValue placeholder="Choose year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y.id} value={y.id}>
                            {y.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Term (optional)" htmlFor="of-term">
                    <Select
                      value={offerTerm}
                      onValueChange={setOfferTerm}
                      disabled={!offerYear}
                    >
                      <SelectTrigger id="of-term">
                        <SelectValue placeholder="Year-long" />
                      </SelectTrigger>
                      <SelectContent>
                        {(termsByYear[offerYear] ?? []).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <Checkbox
                      checked={offerElective}
                      onCheckedChange={(v) => setOfferElective(!!v)}
                    />
                    Elective — students elect it individually rather than taking
                    it as part of the section
                  </label>
                </div>
                <DialogFooter>
                  <Button
                    onClick={submitOffering}
                    disabled={
                      offerBusy || !offerSection || !offerSubject || !offerYear
                    }
                  >
                    Offer subject
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

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
                          <span>
                            {(offeringsBySection.get(s.id) ?? []).length}{' '}
                            subject
                            {(offeringsBySection.get(s.id) ?? []).length === 1
                              ? ''
                              : 's'}
                          </span>
                          <span>Capacity {s.capacity}</span>
                          <StatusBadge
                            tone={s.status === 'active' ? 'success' : 'neutral'}
                          >
                            {s.status}
                          </StatusBadge>
                        </div>
                        {(offeringsBySection.get(s.id) ?? []).length > 0 && (
                          <ul className="flex w-full flex-wrap gap-1.5">
                            {(offeringsBySection.get(s.id) ?? []).map((o) => (
                              <li
                                key={o.id}
                                className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                              >
                                {o.subjectLabel}
                                {o.isElective ? ' · elective' : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </ShellMain>
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
/** Fold a label the same way the server's matcher does. */
function foldLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s_\-./]+/g, '')
    .trim();
}

/**
 * Client-side echo of the server's level matcher, over the alias data the API
 * ships. It only powers the live hint as the user types — the server infers the
 * same code on save, so the two agree and this is never the source of truth.
 */
function matchLevel(levels: LevelSpineOption[], text: string): string | null {
  const folded = foldLabel(text);
  if (!folded) return null;
  for (const level of levels) {
    if (foldLabel(level.code) === folded) return level.code;
    if (foldLabel(level.canonicalName) === folded) return level.code;
    if (level.aliases.some((a) => foldLabel(a) === folded)) return level.code;
  }
  return null;
}

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
  variant,
  bands,
}: {
  disabled?: boolean;
  bands?: BandOption[];
  onCreate: (
    name: string,
    code: string,
    extra?: Record<string, unknown>,
  ) => Promise<boolean>;
  /**
   * 'stage' adds the fixed education band; 'arm' adds the description +
   * alternate names that let a school explain what an arm means here.
   */
  variant?: 'stage' | 'arm';
}) {
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [band, setBand] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [aliases, setAliases] = React.useState('');
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
      {variant === 'stage' && (
        <Select value={band} onValueChange={setBand}>
          <SelectTrigger aria-label="Education level">
            <SelectValue placeholder="Education level (recommended)" />
          </SelectTrigger>
          <SelectContent>
            {(bands ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {variant === 'arm' && (
        <>
          <Input
            aria-label="What this arm means"
            placeholder="What this arm means (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={280}
          />
          <Input
            aria-label="Other names for this arm"
            placeholder="Other names, comma separated (optional)"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
          />
        </>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || !name.trim() || !code.trim()}
        onClick={async () => {
          const extra =
            variant === 'stage'
              ? { educationLevel: band || undefined }
              : variant === 'arm'
                ? {
                    description: description.trim() || undefined,
                    aliases: aliases
                      .split(',')
                      .map((a) => a.trim())
                      .filter(Boolean),
                  }
                : undefined;
          const ok = await onCreate(name.trim(), code.trim(), extra);
          if (ok) {
            setName('');
            setCode('');
            setBand('');
            setDescription('');
            setAliases('');
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
  levelSpine,
  disabled,
  onCreate,
}: {
  stages: Stage[];
  levelSpine: LevelSpineOption[];
  disabled?: boolean;
  onCreate: (
    name: string,
    code: string,
    stageId: string,
    levelCode?: string,
  ) => Promise<boolean>;
}) {
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [stageId, setStageId] = React.useState('');
  // The school types its own name ("Basic 3"); this is the fixed national rung
  // it maps to. Inferred from the name as they type, and overridable — the
  // server does the same inference, so leaving it alone is safe.
  const [levelCode, setLevelCode] = React.useState('');
  const inferred = React.useMemo(
    () => matchLevel(levelSpine, name) ?? matchLevel(levelSpine, code) ?? '',
    [levelSpine, name, code],
  );
  const effectiveLevelCode = levelCode || inferred;
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
      <Select value={effectiveLevelCode} onValueChange={setLevelCode}>
        <SelectTrigger aria-label="National level">
          <SelectValue placeholder="National level (inferred from the name)" />
        </SelectTrigger>
        <SelectContent>
          {levelSpine.map((o) => (
            <SelectItem key={o.code} value={o.code}>
              {o.canonicalName}
              <Dot />
              {o.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {effectiveLevelCode && (
        <p className="text-xs text-muted-foreground">
          Stored as <code>{effectiveLevelCode}</code> so other schools and
          national reports can line this level up. Students only ever see
          &ldquo;{name || 'your name'}&rdquo;.
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || !name.trim() || !code.trim() || !stageId}
        onClick={async () => {
          const ok = await onCreate(
            name.trim(),
            code.trim(),
            stageId,
            effectiveLevelCode || undefined,
          );
          if (ok) {
            setName('');
            setCode('');
            setLevelCode('');
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
