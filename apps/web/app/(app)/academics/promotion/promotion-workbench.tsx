'use client';

/**
 * WB2-4 · Promotion workbench (client).
 *
 * Create a year-rollover run, preview the cohort with proposed next-year
 * placements, mark per-student exceptions, submit for approval, and — as a
 * second approver — commit. Everything writes through /api/academics/promotion/*
 * (permissions + maker-checker + campus scope enforced server-side).
 */
import * as React from 'react';
import { toast } from 'sonner';
import { CalendarClock, Plus } from 'lucide-react';

import { Sheet, SheetDescription } from '@workspace/ui/components/sheet';
import {
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@workspace/ui/custom/detail/drawer-chrome';
import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
import { Input } from '@workspace/ui/components/input';
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
import type { StateTone } from '@workspace/ui/types/states.types';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { ApprovalPanel } from '@workspace/ui/custom/approval/approval-panel';

export interface PromotionRun {
  id: string;
  name: string;
  status: string;
  approvalRequestId?: string | null;
  /**
   * True when the signed-in reviewer raised this run's approval request.
   * Decided by the API, which owns the same maker-checker rule it enforces —
   * the browser has no reliable identity to compare against. Absent on older
   * payloads, so `undefined` reads as "not mine" and the API stays the
   * backstop.
   */
  isOwnRequest?: boolean;
  fromAcademicYearId: string;
  toAcademicYearId: string;
  fromYearLevelId: string;
  toYearLevelId: string;
  campusId?: string | null;
}
export interface YearOption {
  id: string;
  name: string;
}
export interface YearLevelOption {
  id: string;
  name: string;
  code?: string;
}
export interface SectionOption {
  id: string;
  displayLabel: string;
}
export interface CampusOption {
  id: string;
  name: string;
}
interface RunItem {
  id: string;
  studentId: string;
  studentNumber: string | null;
  fromSectionLabel: string | null;
  proposedClassSectionId: string | null;
  proposedSectionLabel: string | null;
  decision: string;
  status: string;
  exceptionReason: string | null;
}

const DECISIONS = ['promote', 'repeat', 'withhold', 'manual'] as const;

const RUN_TONE: Record<string, StateTone> = {
  draft: 'neutral',
  previewed: 'info',
  pending_approval: 'warning',
  committed: 'success',
  cancelled: 'neutral',
};
const ITEM_TONE: Record<string, StateTone> = {
  pending: 'info',
  committed: 'success',
  skipped: 'neutral',
};

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

export function PromotionWorkbench({
  canManage,
  canApprove,
  runs,
  years,
  yearLevels,
  sections,
  campuses,
}: {
  canManage: boolean;
  canApprove: boolean;
  runs: PromotionRun[];
  years: YearOption[];
  yearLevels: YearLevelOption[];
  sections: SectionOption[];
  campuses: CampusOption[];
}) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [runList, setRunList] = React.useState<PromotionRun[]>(runs);
  const [selectedId, setSelectedId] = React.useState<string>('');
  const [run, setRun] = React.useState<PromotionRun | null>(null);
  const [items, setItems] = React.useState<RunItem[]>([]);
  const [busy, setBusy] = React.useState(false);

  // Create-run form
  const [name, setName] = React.useState('');
  const [fromYear, setFromYear] = React.useState('');
  const [toYear, setToYear] = React.useState('');
  const [fromLevel, setFromLevel] = React.useState('');
  const [toLevel, setToLevel] = React.useState('');
  const [campus, setCampus] = React.useState('');

  const loadRun = React.useCallback(async (id: string) => {
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/academics/promotion/runs/${id}`);
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not load run'));
        return;
      }
      const data = (await res.json()) as {
        run: PromotionRun;
        items: RunItem[];
      };
      setRun(data.run);
      setItems(data.items);
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (selectedId) void loadRun(selectedId);
    else {
      setRun(null);
      setItems([]);
    }
  }, [selectedId, loadRun]);

  async function createRun() {
    setBusy(true);
    try {
      const res = await fetch('/api/academics/promotion/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          fromAcademicYearId: fromYear,
          toAcademicYearId: toYear,
          fromYearLevelId: fromLevel,
          toYearLevelId: toLevel,
          campusId: campus || undefined,
        }),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not create run'));
        return;
      }
      const created = (await res.json()) as PromotionRun;
      toast.success('Promotion run created');
      setRunList((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setName('');
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function post(path: string, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/academics/promotion/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Action failed'));
        return false;
      }
      toast.success(okMsg);
      await loadRun(selectedId);
      return true;
    } catch {
      toast.error('Network error — please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function setException(
    item: RunItem,
    decision: string,
    proposedClassSectionId?: string,
  ) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/academics/promotion/runs/${selectedId}/items/${item.id}/exception`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            // withhold + repeat clear the next-level proposal (repeat falls back
            // to the source section server-side); promote/manual keep it.
            proposedClassSectionId:
              proposedClassSectionId ??
              (decision === 'withhold' || decision === 'repeat'
                ? undefined
                : (item.proposedClassSectionId ?? undefined)),
            reason: item.exceptionReason ?? undefined,
          }),
        },
      );
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not set exception'));
        return;
      }
      await loadRun(selectedId);
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  const yearName = (id: string) => years.find((y) => y.id === id)?.name ?? id;
  const status = run?.status;
  const canCreate =
    canManage && name.trim() && fromYear && toYear && fromLevel && toLevel;

  return (
    <ShellMain>
      <PageHeader
        title="Promotion workbench"
        description="Roll a year over as ONE reviewable operation — preview who advances, set exceptions, then a second approver commits. The prior year is never touched."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> New run
            </Button>
          ) : undefined
        }
      />

      {canManage && (
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <DrawerContent>
            <DrawerHeader className="gap-1.5">
              <DrawerTitle className="pr-8">New promotion run</DrawerTitle>
              <SheetDescription className="text-[calc(12.5px*var(--font-scale))]">
                Choose the year you are promoting from and the year the cohort
                moves into.
              </SheetDescription>
            </DrawerHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="pr-name">Name</Label>
                  <Input
                    id="pr-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. SS1 → SS2 (2026/27 → 2027/28)"
                  />
                </div>
                <YearLevelSelect
                  id="pr-from-level"
                  label="From year level"
                  value={fromLevel}
                  onChange={setFromLevel}
                  options={yearLevels}
                />
                <YearLevelSelect
                  id="pr-to-level"
                  label="To year level"
                  value={toLevel}
                  onChange={setToLevel}
                  options={yearLevels}
                />
                <YearSelect
                  id="pr-from-year"
                  label="From academic year"
                  value={fromYear}
                  onChange={setFromYear}
                  options={years}
                />
                <YearSelect
                  id="pr-to-year"
                  label="To academic year"
                  value={toYear}
                  onChange={setToYear}
                  options={years}
                />
                <YearSelect
                  id="pr-campus"
                  label="Campus (optional)"
                  value={campus}
                  onChange={setCampus}
                  options={campuses.map((c) => ({ id: c.id, name: c.name }))}
                  placeholder="Whole school"
                />
              </div>
            </div>
            <DrawerFooter className="flex-row justify-end gap-2">
              <Button onClick={createRun} disabled={busy || !canCreate}>
                Create run
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Sheet>
      )}

      {/* Pick a run */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4" aria-hidden /> Promotion runs
          </CardTitle>
          <CardDescription>Select a run to preview and commit.</CardDescription>
        </CardHeader>
        <CardContent>
          {runList.length === 0 ? (
            <EmptyState
              title="No promotion runs yet"
              description={
                canManage
                  ? 'Create a run above to roll a cohort into the next year.'
                  : 'A registrar will create the year-rollover runs.'
              }
            />
          ) : (
            <div className="flex flex-col gap-1.5 sm:max-w-md">
              <Label htmlFor="pr-select">Run</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger id="pr-select">
                  <SelectValue placeholder="Choose a run" />
                </SelectTrigger>
                <SelectContent>
                  {runList.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected run */}
      {run && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {run.name}
              <StatusBadge tone={RUN_TONE[run.status] ?? 'neutral'}>
                {run.status.replace('_', ' ')}
              </StatusBadge>
            </CardTitle>
            <CardDescription>
              {yearName(run.fromAcademicYearId)} →{' '}
              {yearName(run.toAcademicYearId)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Actions */}
            {canManage && (
              <div className="flex flex-wrap gap-2">
                {(status === 'draft' || status === 'previewed') && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      post(`runs/${selectedId}/preview`, 'Cohort previewed')
                    }
                    disabled={busy}
                  >
                    {status === 'previewed' ? 'Re-preview' : 'Preview cohort'}
                  </Button>
                )}
                {status === 'previewed' && (
                  <Button
                    onClick={() =>
                      post(
                        `runs/${selectedId}/request-commit`,
                        'Submitted for approval',
                      )
                    }
                    disabled={busy}
                  >
                    Submit for approval
                  </Button>
                )}
                {(status === 'previewed' ||
                  status === 'pending_approval' ||
                  status === 'draft') && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      post(`runs/${selectedId}/cancel`, 'Run cancelled')
                    }
                    disabled={busy}
                  >
                    Cancel run
                  </Button>
                )}
              </div>
            )}

            {/* Approval panel (second approver) */}
            {status === 'pending_approval' && (
              <ApprovalPanel
                request={{
                  title: `Commit ${run.name}`,
                  requestedBy: run.isOwnRequest ? 'you' : 'a colleague',
                  reason: `${items.filter((i) => i.decision !== 'withhold').length} students promoted, ${items.filter((i) => i.decision === 'withhold').length} withheld`,
                  riskLabel: 'Bulk change',
                }}
                fields={[
                  {
                    key: 'cohort',
                    label: 'Cohort',
                    before: `${items.length} students`,
                    after: `${items.filter((i) => i.decision !== 'withhold').length} promoted`,
                  },
                ]}
                canApprove={canApprove}
                // `canApprove` is the PERMISSION; this is separation of duties.
                // ApprovalPanel blocks on either, and they are not the same
                // question — see docs/self-approval-audit.md.
                isSelfRequest={run.isOwnRequest === true}
                stepUpRequired={false}
                onApprove={
                  canApprove
                    ? () =>
                        void post(
                          `runs/${selectedId}/approve`,
                          'Promotion committed',
                        )
                    : undefined
                }
              />
            )}

            {/* Items table */}
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {status === 'draft'
                  ? 'Preview the run to build the cohort.'
                  : 'No students in this cohort.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Student</th>
                      <th className="px-2 py-2 font-medium">From</th>
                      <th className="px-2 py-2 font-medium">Proposed</th>
                      <th className="px-2 py-2 font-medium">Decision</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-2 py-2 font-medium">
                          {item.studentNumber ?? item.studentId}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {item.fromSectionLabel ?? '—'}
                        </td>
                        <td className="px-2 py-2">
                          {canManage &&
                          status === 'previewed' &&
                          item.decision === 'manual' ? (
                            <Select
                              value={item.proposedClassSectionId ?? ''}
                              onValueChange={(v) =>
                                void setException(item, 'manual', v)
                              }
                            >
                              <SelectTrigger className="h-8 w-40">
                                <SelectValue placeholder="Choose section" />
                              </SelectTrigger>
                              <SelectContent>
                                {sections.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.displayLabel}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : item.decision === 'withhold' ? (
                            '—'
                          ) : (
                            (item.proposedSectionLabel ??
                            (item.decision === 'repeat'
                              ? item.fromSectionLabel
                              : 'needs placement'))
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {canManage && status === 'previewed' ? (
                            <Select
                              value={item.decision}
                              onValueChange={(v) => void setException(item, v)}
                            >
                              <SelectTrigger className="h-8 w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DECISIONS.map((d) => (
                                  <SelectItem key={d} value={d}>
                                    {d}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="capitalize">{item.decision}</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <StatusBadge
                            tone={ITEM_TONE[item.status] ?? 'neutral'}
                          >
                            {item.status}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </ShellMain>
  );
}

function YearSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = 'Choose',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function YearLevelSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: YearLevelOption[];
}) {
  return (
    <YearSelect
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      options={options.map((o) => ({
        id: o.id,
        name: o.code ? `${o.name} (${o.code})` : o.name,
      }))}
    />
  );
}
