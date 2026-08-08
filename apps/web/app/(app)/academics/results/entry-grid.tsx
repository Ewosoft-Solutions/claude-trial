'use client';

/**
 * WB4 · Entry grid — pick a class section + subject, then key in each student's
 * component scores (or mark them Absent / Exempt for the subject). Absent ≠ zero:
 * an absent/exempt student stores no score. Entry is only allowed while the cycle
 * is open. A best-effort "seed from gradebook" fills empty cells.
 */
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Checkbox } from '@workspace/ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { EmptyState } from '@workspace/ui/custom/states/page-states';

import { apiGet, apiPost } from './results-api';

interface Component {
  id: string;
  key: string;
  label: string;
  maxScore: number | string;
}
interface GridSection {
  id: string;
  displayLabel: string;
}
interface GridDetail {
  components: Component[];
  section?: GridSection;
  students?: { id: string; studentNumber: string; name: string }[];
  offerings?: { id: string; subjectLabel: string }[];
  sections?: GridSection[];
  editable: boolean;
  entries?: {
    studentId: string;
    subjectOfferingId: string;
    componentId: string;
    score: number | null;
    isAbsent: boolean;
    isExempt: boolean;
  }[];
}

interface CellState {
  scores: Record<string, string>; // componentId → value
  isAbsent: boolean;
  isExempt: boolean;
}

export function EntryGrid({
  cycleId,
  editable,
  canEnter,
}: {
  cycleId: string;
  editable: boolean;
  canEnter: boolean;
}) {
  const [sections, setSections] = React.useState<GridSection[]>([]);
  const [components, setComponents] = React.useState<Component[]>([]);
  const [sectionId, setSectionId] = React.useState('');
  const [offeringId, setOfferingId] = React.useState('');
  const [detail, setDetail] = React.useState<GridDetail | null>(null);
  const [rows, setRows] = React.useState<Record<string, CellState>>({});
  const [busy, setBusy] = React.useState(false);

  // Load the section list once.
  React.useEffect(() => {
    void (async () => {
      try {
        const data = await apiGet<GridDetail>(`/cycles/${cycleId}/grid`);
        setSections(data.sections ?? []);
        setComponents(data.components ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not load grid');
      }
    })();
  }, [cycleId]);

  const loadSection = React.useCallback(
    async (sid: string) => {
      setBusy(true);
      try {
        const data = await apiGet<GridDetail>(
          `/cycles/${cycleId}/grid?sectionId=${encodeURIComponent(sid)}`,
        );
        setDetail(data);
        setComponents(data.components ?? []);
        setOfferingId(data.offerings?.[0]?.id ?? '');
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

  // Rebuild the editable rows whenever the selected offering (or data) changes.
  React.useEffect(() => {
    if (!detail?.students || !offeringId) {
      setRows({});
      return;
    }
    const next: Record<string, CellState> = {};
    for (const s of detail.students) {
      next[s.id] = { scores: {}, isAbsent: false, isExempt: false };
    }
    for (const e of detail.entries ?? []) {
      if (e.subjectOfferingId !== offeringId) continue;
      const cell = next[e.studentId];
      if (!cell) continue;
      if (e.isExempt) cell.isExempt = true;
      else if (e.isAbsent) cell.isAbsent = true;
      else if (e.score !== null) cell.scores[e.componentId] = String(e.score);
    }
    setRows(next);
  }, [detail, offeringId]);

  async function save() {
    if (!offeringId || !detail?.students) return;
    setBusy(true);
    try {
      const entries: {
        studentId: string;
        subjectOfferingId: string;
        componentKey: string;
        score: number | null;
        isAbsent: boolean;
        isExempt: boolean;
      }[] = [];
      for (const s of detail.students) {
        const cell = rows[s.id];
        if (!cell) continue;
        for (const c of components) {
          const raw = cell.scores[c.id];
          const hasScore = raw !== undefined && raw !== '';
          if (!hasScore && !cell.isAbsent && !cell.isExempt) continue;
          entries.push({
            studentId: s.id,
            subjectOfferingId: offeringId,
            componentKey: c.key,
            score:
              cell.isAbsent || cell.isExempt || !hasScore ? null : Number(raw),
            isAbsent: cell.isAbsent,
            isExempt: cell.isExempt,
          });
        }
      }
      const res = await apiPost<{ upserted: number }>(
        `/cycles/${cycleId}/entries`,
        { entries },
      );
      toast.success(`Saved ${res.upserted} cell(s)`);
      await loadSection(sectionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function seed() {
    setBusy(true);
    try {
      const res = await apiPost<{
        seeded: number;
        skippedExisting: number;
        unmatchedSubjects: string[];
      }>(`/cycles/${cycleId}/seed-from-gradebook`, {});
      toast.success(
        `Seeded ${res.seeded} cell(s)${
          res.unmatchedSubjects.length
            ? ` · ${res.unmatchedSubjects.length} subject(s) unmatched`
            : ''
        }`,
      );
      if (sectionId) await loadSection(sectionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not seed');
    } finally {
      setBusy(false);
    }
  }

  const canEdit = editable && canEnter;

  if (sections.length === 0) {
    return (
      <EmptyState
        title="No sections in scope"
        description="Add class sections to the cycle in the Configure tab first."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!editable && (
        <p className="rounded-sm border border-dashed p-3 text-sm text-muted-foreground">
          Entry is closed for this cycle. Reopen it in the Configure tab to edit
          scores.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Section</Label>
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="w-56">
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
        {detail?.offerings && detail.offerings.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label>Subject</Label>
            <Select value={offeringId} onValueChange={setOfferingId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose a subject" />
              </SelectTrigger>
              <SelectContent>
                {detail.offerings.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.subjectLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {canEdit && (
          <Button variant="outline" onClick={seed} disabled={busy}>
            Seed from gradebook
          </Button>
        )}
      </div>

      {detail?.students && offeringId ? (
        detail.students.length === 0 ? (
          <EmptyState
            title="No students enrolled"
            description="This section has no active enrollments for the cycle's year."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Student</th>
                    {components.map((c) => (
                      <th key={c.id} className="px-2 py-2 font-medium">
                        {c.label}
                        <span className="text-xs text-muted-foreground">
                          {' '}
                          /{Number(c.maxScore)}
                        </span>
                      </th>
                    ))}
                    <th className="px-2 py-2 font-medium">Absent</th>
                    <th className="px-2 py-2 font-medium">Exempt</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.students.map((s) => {
                    const cell = rows[s.id] ?? {
                      scores: {},
                      isAbsent: false,
                      isExempt: false,
                    };
                    const blocked = cell.isAbsent || cell.isExempt;
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="px-2 py-1.5">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.studentNumber}
                          </div>
                        </td>
                        {components.map((c) => (
                          <td key={c.id} className="px-2 py-1.5">
                            <Input
                              type="number"
                              className="h-8 w-20"
                              disabled={!canEdit || blocked}
                              value={cell.scores[c.id] ?? ''}
                              max={Number(c.maxScore)}
                              onChange={(e) =>
                                setRows((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    ...cell,
                                    scores: {
                                      ...cell.scores,
                                      [c.id]: e.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1.5">
                          <Checkbox
                            checked={cell.isAbsent}
                            disabled={!canEdit}
                            onCheckedChange={(v) =>
                              setRows((prev) => ({
                                ...prev,
                                [s.id]: {
                                  ...cell,
                                  isAbsent: !!v,
                                  isExempt: false,
                                },
                              }))
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Checkbox
                            checked={cell.isExempt}
                            disabled={!canEdit}
                            onCheckedChange={(v) =>
                              setRows((prev) => ({
                                ...prev,
                                [s.id]: {
                                  ...cell,
                                  isExempt: !!v,
                                  isAbsent: false,
                                },
                              }))
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {canEdit && (
              <div>
                <Button onClick={save} disabled={busy}>
                  Save scores
                </Button>
              </div>
            )}
          </>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Choose a section and subject to enter scores.
        </p>
      )}
    </div>
  );
}
