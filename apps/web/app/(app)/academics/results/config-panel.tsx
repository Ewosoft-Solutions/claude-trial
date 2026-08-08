'use client';

/**
 * WB4 · Configure panel — components (CA/EXAM), sections in scope, grade scale,
 * structured remark sets, promotion policy + ranking, and the lifecycle
 * transitions up to the publish gate. Components/sections are editable only while
 * the cycle is a draft; config (scale/remarks/policy) until it is published.
 */
import * as React from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

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

import { apiPatch, apiPost, apiPut } from './results-api';
import type {
  CycleDetail,
  GradingSystemOption,
  RemarkRuleSetOption,
  SectionOption,
} from './results-workbench';

interface DraftComponent {
  key: string;
  label: string;
  maxScore: number;
  isExam: boolean;
}

const DEFAULT_COMPONENTS: DraftComponent[] = [
  { key: 'CA1', label: 'First CA', maxScore: 20, isExam: false },
  { key: 'CA2', label: 'Second CA', maxScore: 20, isExam: false },
  { key: 'EXAM', label: 'Exam', maxScore: 60, isExam: true },
];

export function ConfigPanel({
  detail,
  canManage,
  sections,
  gradingSystems,
  remarkSets,
  busy,
  onChanged,
}: {
  detail: CycleDetail;
  canManage: boolean;
  sections: SectionOption[];
  gradingSystems: GradingSystemOption[];
  remarkSets: RemarkRuleSetOption[];
  busy: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const cycle = detail.cycle;
  const isDraft = cycle.status === 'draft';
  const locked = cycle.status === 'published' || cycle.status === 'archived';
  const [saving, setSaving] = React.useState(false);

  // Components editor
  const [components, setComponents] = React.useState<DraftComponent[]>(
    detail.components.length
      ? detail.components.map((c) => ({
          key: c.key,
          label: c.label,
          maxScore: Number(c.maxScore),
          isExam: c.isExam,
        }))
      : DEFAULT_COMPONENTS,
  );

  // Sections
  const [selectedSections, setSelectedSections] = React.useState<Set<string>>(
    new Set(detail.sections.map((s) => s.classSectionId)),
  );

  // Config
  const [gradingSystemId, setGradingSystemId] = React.useState(
    cycle.gradingSystemId ?? '',
  );
  const [subjectSet, setSubjectSet] = React.useState(
    cycle.subjectRemarkRuleSetId ?? '',
  );
  const [principalSet, setPrincipalSet] = React.useState(
    cycle.principalRemarkRuleSetId ?? '',
  );
  const [ranking, setRanking] = React.useState(!!cycle.rankingEnabled);
  const [passMark, setPassMark] = React.useState(
    String(cycle.promotionPolicy?.passMark ?? 40),
  );
  const [maxFailed, setMaxFailed] = React.useState(
    String(cycle.promotionPolicy?.maxFailedSubjects ?? 3),
  );

  const subjectSets = remarkSets.filter((r) => r.kind === 'subject');
  const principalSets = remarkSets.filter((r) => r.kind === 'principal');

  async function run(fn: () => Promise<unknown>, ok: string) {
    setSaving(true);
    try {
      await fn();
      toast.success(ok);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  }

  const disabled = busy || saving || !canManage;

  return (
    <div className="flex flex-col gap-8">
      {/* Components */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Components</h3>
          {isDraft && canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setComponents((c) => [
                  ...c,
                  {
                    key: `C${c.length + 1}`,
                    label: '',
                    maxScore: 10,
                    isExam: false,
                  },
                ])
              }
            >
              <Plus className="size-4" /> Add
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Key</th>
                <th className="px-2 py-2 font-medium">Label</th>
                <th className="px-2 py-2 font-medium">Max</th>
                <th className="px-2 py-2 font-medium">Exam</th>
                {isDraft && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {components.map((c, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-2 py-1.5">
                    <Input
                      value={c.key}
                      disabled={!isDraft || disabled}
                      onChange={(e) =>
                        setComponents((cs) =>
                          cs.map((x, j) =>
                            j === i ? { ...x, key: e.target.value } : x,
                          ),
                        )
                      }
                      className="h-8 w-24"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={c.label}
                      disabled={!isDraft || disabled}
                      onChange={(e) =>
                        setComponents((cs) =>
                          cs.map((x, j) =>
                            j === i ? { ...x, label: e.target.value } : x,
                          ),
                        )
                      }
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      value={c.maxScore}
                      disabled={!isDraft || disabled}
                      onChange={(e) =>
                        setComponents((cs) =>
                          cs.map((x, j) =>
                            j === i
                              ? { ...x, maxScore: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                      className="h-8 w-20"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Checkbox
                      checked={c.isExam}
                      disabled={!isDraft || disabled}
                      onCheckedChange={(v) =>
                        setComponents((cs) =>
                          cs.map((x, j) =>
                            j === i ? { ...x, isExam: !!v } : x,
                          ),
                        )
                      }
                    />
                  </td>
                  {isDraft && (
                    <td className="px-2 py-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        onClick={() =>
                          setComponents((cs) => cs.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Total across components:{' '}
          <b>{components.reduce((n, c) => n + (Number(c.maxScore) || 0), 0)}</b>
        </p>
        {isDraft && canManage && (
          <div>
            <Button
              onClick={() =>
                run(
                  () =>
                    apiPut(`/cycles/${cycle.id}/components`, {
                      components: components.map((c, i) => ({
                        key: c.key.trim(),
                        label: c.label.trim() || c.key.trim(),
                        maxScore: Number(c.maxScore),
                        order: i,
                        isExam: c.isExam,
                      })),
                    }),
                  'Components saved',
                )
              }
              disabled={disabled}
            >
              Save components
            </Button>
          </div>
        )}
      </section>

      {/* Sections */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Class sections in scope</h3>
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No class sections found.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 rounded-sm border p-2 text-sm"
              >
                <Checkbox
                  checked={selectedSections.has(s.id)}
                  disabled={!isDraft || disabled}
                  onCheckedChange={(v) =>
                    setSelectedSections((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(s.id);
                      else next.delete(s.id);
                      return next;
                    })
                  }
                />
                {s.displayLabel}
              </label>
            ))}
          </div>
        )}
        {isDraft && canManage && (
          <div>
            <Button
              variant="outline"
              onClick={() =>
                run(
                  () =>
                    apiPut(`/cycles/${cycle.id}/sections`, {
                      classSectionIds: [...selectedSections],
                    }),
                  'Sections saved',
                )
              }
              disabled={disabled}
            >
              Save sections
            </Button>
          </div>
        )}
      </section>

      {/* Config */}
      {!locked && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Grade scale</Label>
            <Select
              value={gradingSystemId}
              onValueChange={setGradingSystemId}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a grading system" />
              </SelectTrigger>
              <SelectContent>
                {gradingSystems.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Subject remark set</Label>
            <Select
              value={subjectSet}
              onValueChange={setSubjectSet}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {subjectSets.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Principal remark set</Label>
            <Select
              value={principalSet}
              onValueChange={setPrincipalSet}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {principalSets.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              checked={ranking}
              disabled={disabled}
              onCheckedChange={(v) => setRanking(!!v)}
              id="rc-ranking"
            />
            <Label htmlFor="rc-ranking">Compute positions (ranking)</Label>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Promotion pass mark (%)</Label>
            <Input
              type="number"
              value={passMark}
              onChange={(e) => setPassMark(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Max failed subjects</Label>
            <Input
              type="number"
              value={maxFailed}
              onChange={(e) => setMaxFailed(e.target.value)}
              disabled={disabled}
            />
          </div>
          {canManage && (
            <div className="sm:col-span-2">
              <Button
                onClick={() =>
                  run(
                    () =>
                      apiPatch(`/cycles/${cycle.id}`, {
                        gradingSystemId: gradingSystemId || undefined,
                        subjectRemarkRuleSetId: subjectSet || undefined,
                        principalRemarkRuleSetId: principalSet || undefined,
                        rankingEnabled: ranking,
                        promotionPolicy: {
                          passMark: Number(passMark),
                          maxFailedSubjects: Number(maxFailed),
                        },
                      }),
                    'Configuration saved',
                  )
                }
                disabled={disabled}
              >
                Save configuration
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Lifecycle */}
      {canManage && (
        <section className="flex flex-wrap gap-2 border-t pt-4">
          {cycle.status === 'draft' && (
            <Button
              onClick={() =>
                run(
                  () => apiPost(`/cycles/${cycle.id}/open-entry`),
                  'Entry opened',
                )
              }
              disabled={disabled}
            >
              Open for entry
            </Button>
          )}
          {cycle.status === 'entry_open' && (
            <Button
              variant="outline"
              onClick={() =>
                run(
                  () => apiPost(`/cycles/${cycle.id}/close-entry`),
                  'Entry closed',
                )
              }
              disabled={disabled}
            >
              Close entry
            </Button>
          )}
          {cycle.status === 'entry_closed' && (
            <>
              <Button
                onClick={() =>
                  run(
                    () => apiPost(`/cycles/${cycle.id}/moderation`),
                    'Moved to moderation',
                  )
                }
                disabled={disabled}
              >
                Move to moderation
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  run(
                    () => apiPost(`/cycles/${cycle.id}/open-entry`),
                    'Entry reopened',
                  )
                }
                disabled={disabled}
              >
                Reopen entry
              </Button>
            </>
          )}
          {['draft', 'entry_open', 'entry_closed', 'moderation'].includes(
            cycle.status,
          ) && (
            <Button
              variant="ghost"
              onClick={() =>
                run(
                  () => apiPost(`/cycles/${cycle.id}/cancel`, {}),
                  'Cycle cancelled',
                )
              }
              disabled={disabled}
            >
              Cancel cycle
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
