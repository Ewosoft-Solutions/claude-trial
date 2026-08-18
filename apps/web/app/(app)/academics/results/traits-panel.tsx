'use client';

/**
 * WB4-3 · Behaviour tab — author the cycle's affective / psychomotor rubric
 * (draft cycles only, so ratings are never stranded) and rate each student
 * against it while entry is open. A trait left unrated stays blank on the report
 * card; it is never published as the lowest rating.
 */
import * as React from 'react';
import { toast } from 'sonner';
import { Plus, Sparkles, Trash2 } from 'lucide-react';

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
import { EmptyState } from '@workspace/ui/custom/states/page-states';

import { apiGet, apiPost, apiPut } from './results-api';

type Domain = 'affective' | 'psychomotor';

interface Trait {
  id: string;
  domain: string;
  key: string;
  label: string;
  maxRating: number;
  order: number;
}
interface TraitGrid {
  traits: Trait[];
  sections?: { id: string; displayLabel: string }[];
  section?: { id: string; displayLabel: string };
  students?: { id: string; studentNumber: string; name: string }[];
  ratings?: { studentId: string; traitId: string; rating: number | null }[];
  editable: boolean;
}

interface DraftTrait {
  domain: Domain;
  key: string;
  label: string;
  maxRating: number;
}

const DOMAIN_LABEL: Record<string, string> = {
  affective: 'Affective',
  psychomotor: 'Psychomotor',
};

/** The rubric most Nigerian report cards already carry — a one-click start. */
const STARTER_RUBRIC: DraftTrait[] = [
  {
    domain: 'affective',
    key: 'punctuality',
    label: 'Punctuality',
    maxRating: 5,
  },
  { domain: 'affective', key: 'neatness', label: 'Neatness', maxRating: 5 },
  { domain: 'affective', key: 'politeness', label: 'Politeness', maxRating: 5 },
  {
    domain: 'affective',
    key: 'relationship_with_others',
    label: 'Relationship with others',
    maxRating: 5,
  },
  {
    domain: 'psychomotor',
    key: 'handwriting',
    label: 'Handwriting',
    maxRating: 5,
  },
  {
    domain: 'psychomotor',
    key: 'sports',
    label: 'Sports and games',
    maxRating: 5,
  },
  {
    domain: 'psychomotor',
    key: 'handling_of_tools',
    label: 'Handling of tools',
    maxRating: 5,
  },
];

export function TraitsPanel({
  cycleId,
  status,
  canManage,
  canEnter,
}: {
  cycleId: string;
  status: string;
  canManage: boolean;
  canEnter: boolean;
}) {
  const [traits, setTraits] = React.useState<Trait[]>([]);
  const [draft, setDraft] = React.useState<DraftTrait[]>([]);
  const [sections, setSections] = React.useState<
    { id: string; displayLabel: string }[]
  >([]);
  const [sectionId, setSectionId] = React.useState('');
  const [grid, setGrid] = React.useState<TraitGrid | null>(null);
  const [ratings, setRatings] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const isDraftCycle = status === 'draft';
  const editable = status === 'entry_open' && canEnter;

  const loadRubric = React.useCallback(async () => {
    try {
      const data = await apiGet<TraitGrid>(`/cycles/${cycleId}/trait-grid`);
      setTraits(data.traits ?? []);
      setSections(data.sections ?? []);
      setDraft(
        (data.traits ?? []).map((t) => ({
          domain: t.domain === 'psychomotor' ? 'psychomotor' : 'affective',
          key: t.key,
          label: t.label,
          maxRating: t.maxRating,
        })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load traits');
    }
  }, [cycleId]);

  React.useEffect(() => {
    void loadRubric();
  }, [loadRubric]);

  const loadSection = React.useCallback(
    async (sid: string) => {
      setBusy(true);
      try {
        const data = await apiGet<TraitGrid>(
          `/cycles/${cycleId}/trait-grid?sectionId=${encodeURIComponent(sid)}`,
        );
        setGrid(data);
        const next: Record<string, string> = {};
        for (const r of data.ratings ?? []) {
          if (r.rating !== null) {
            next[`${r.studentId}::${r.traitId}`] = String(r.rating);
          }
        }
        setRatings(next);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not load section');
      } finally {
        setBusy(false);
      }
    },
    [cycleId],
  );

  React.useEffect(() => {
    if (sectionId) void loadSection(sectionId);
  }, [sectionId, loadSection]);

  async function saveRubric() {
    const unnamed = draft.findIndex((t) => t.label.trim() === '');
    if (unnamed >= 0) {
      toast.error(`Trait ${unnamed + 1} needs a name`);
      return;
    }
    setBusy(true);
    try {
      await apiPut<Trait[]>(`/cycles/${cycleId}/traits`, {
        traits: draft.map((t, i) => ({ ...t, order: i })),
      });
      toast.success('Trait rubric saved');
      await loadRubric();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the rubric');
    } finally {
      setBusy(false);
    }
  }

  async function saveRatings() {
    if (!grid?.students) return;
    setBusy(true);
    try {
      const payload: {
        studentId: string;
        traitKey: string;
        rating: number | null;
      }[] = [];
      for (const student of grid.students) {
        for (const trait of grid.traits) {
          const raw = ratings[`${student.id}::${trait.id}`];
          // Only send cells the user touched or that already exist — an
          // untouched blank stays unrated.
          const existing = (grid.ratings ?? []).find(
            (r) => r.studentId === student.id && r.traitId === trait.id,
          );
          const hasValue = raw !== undefined && raw !== '';
          if (!hasValue && !existing) continue;
          payload.push({
            studentId: student.id,
            traitKey: trait.key,
            rating: hasValue ? Number(raw) : null,
          });
        }
      }
      const res = await apiPost<{ upserted: number }>(
        `/cycles/${cycleId}/trait-ratings`,
        { ratings: payload },
      );
      toast.success(`Saved ${res.upserted} rating(s)`);
      await loadSection(sectionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save ratings');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Rubric</h3>
          <p className="text-sm text-muted-foreground">
            Behavioural domains sit beside the subjects on the report card and
            never enter the academic total. The rubric is fixed once the cycle
            leaves draft, so ratings always have a trait to belong to.
          </p>
        </div>

        {!isDraftCycle && traits.length === 0 ? (
          <EmptyState
            title="No trait rubric on this cycle"
            description="A rubric can only be added while the cycle is a draft."
          />
        ) : null}

        {isDraftCycle && canManage ? (
          <>
            {draft.length === 0 && (
              <div>
                <Button
                  variant="outline"
                  onClick={() => setDraft(STARTER_RUBRIC)}
                  disabled={busy}
                >
                  <Sparkles className="size-4" aria-hidden /> Start from the
                  standard rubric
                </Button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {draft.map((trait, index) => (
                <div
                  key={`${trait.key}-${index}`}
                  className="flex flex-wrap items-end gap-2 rounded-sm border p-2"
                >
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`tr-domain-${index}`}>Domain</Label>
                    <Select
                      value={trait.domain}
                      onValueChange={(v) =>
                        setDraft((prev) =>
                          prev.map((t, i) =>
                            i === index ? { ...t, domain: v as Domain } : t,
                          ),
                        )
                      }
                    >
                      <SelectTrigger id={`tr-domain-${index}`} className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="affective">Affective</SelectItem>
                        <SelectItem value="psychomotor">Psychomotor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`tr-label-${index}`}>Trait</Label>
                    <Input
                      id={`tr-label-${index}`}
                      className="w-56"
                      value={trait.label}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev.map((t, i) =>
                            i === index ? { ...t, label: e.target.value } : t,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`tr-key-${index}`}>Key</Label>
                    <Input
                      id={`tr-key-${index}`}
                      className="w-40"
                      value={trait.key}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev.map((t, i) =>
                            i === index ? { ...t, key: e.target.value } : t,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`tr-max-${index}`}>Scale (max)</Label>
                    <Input
                      id={`tr-max-${index}`}
                      type="number"
                      min={2}
                      max={10}
                      className="w-24"
                      value={trait.maxRating}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev.map((t, i) =>
                            i === index
                              ? { ...t, maxRating: Number(e.target.value) }
                              : t,
                          ),
                        )
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${trait.label || 'trait'}`}
                    onClick={() =>
                      setDraft((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setDraft((prev) => [
                    ...prev,
                    {
                      domain: 'affective',
                      key: `trait_${prev.length + 1}`,
                      label: '',
                      maxRating: 5,
                    },
                  ])
                }
              >
                <Plus className="size-4" aria-hidden /> Add trait
              </Button>
              <Button onClick={saveRubric} disabled={busy}>
                Save rubric
              </Button>
            </div>
          </>
        ) : (
          traits.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {traits.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {DOMAIN_LABEL[t.domain] ?? t.domain}
                  </span>
                  <span className="font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground">
                    / {t.maxRating}
                  </span>
                </li>
              ))}
            </ul>
          )
        )}
      </section>

      {traits.length > 0 && (
        <section className="flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Ratings</h3>
            <p className="text-sm text-muted-foreground">
              Leave a cell blank if the trait was not assessed — a blank stays
              blank on the report card.
            </p>
          </div>
          {sections.length === 0 ? (
            <EmptyState
              title="No sections in scope"
              description="Add class sections to the cycle in the Configure tab first."
            />
          ) : (
            <div className="flex flex-col gap-1.5 sm:max-w-xs">
              <Label htmlFor="tr-section">Section</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger id="tr-section">
                  <SelectValue placeholder="Choose a section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.displayLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {grid?.students && grid.students.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Student</th>
                      {grid.traits.map((t) => (
                        <th key={t.id} className="px-2 py-2 font-medium">
                          {t.label}
                          <span className="text-xs text-muted-foreground">
                            {' '}
                            /{t.maxRating}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.students.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="px-2 py-1.5">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.studentNumber}
                          </div>
                        </td>
                        {grid.traits.map((t) => (
                          <td key={t.id} className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={1}
                              max={t.maxRating}
                              className="h-8 w-16"
                              aria-label={`${t.label} for ${s.name}`}
                              disabled={!editable}
                              value={ratings[`${s.id}::${t.id}`] ?? ''}
                              onChange={(e) =>
                                setRatings((prev) => ({
                                  ...prev,
                                  [`${s.id}::${t.id}`]: e.target.value,
                                }))
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {editable && (
                <div>
                  <Button onClick={saveRatings} disabled={busy}>
                    Save ratings
                  </Button>
                </div>
              )}
              {!editable && (
                <p className="text-sm text-muted-foreground">
                  Ratings can only be changed while the cycle is open for entry.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
