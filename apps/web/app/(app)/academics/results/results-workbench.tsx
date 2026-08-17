'use client';

/**
 * WB4 · Results workbench (client). Create a result cycle, then drive it through
 * its lifecycle: Configure → Enter → Validate/Moderate → Publish (second
 * approver) → Amend. Everything writes through /api/academics/results/*
 * (permissions + maker-checker + campus scope enforced server-side).
 */
import * as React from 'react';
import { toast } from 'sonner';
import { Plus, ListChecks, FileText } from 'lucide-react';

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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/tabs';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';
import { EmptyState } from '@workspace/ui/custom/states/page-states';

import { apiGet, apiPost } from './results-api';
import { ConfigPanel } from './config-panel';
import { EntryGrid } from './entry-grid';
import { PublicationsPanel } from './publications-panel';
import { FinancialHoldsPanel } from './financial-holds-panel';
import { TraitsPanel } from './traits-panel';
import {
  TranscriptPanel,
  type TranscriptStudentOption,
} from './transcript-panel';

export interface ResultCycle {
  id: string;
  name: string;
  status: string;
  academicYearId: string;
  termId?: string | null;
  yearLevelId?: string | null;
  campusId?: string | null;
  gradingSystemId?: string | null;
  subjectRemarkRuleSetId?: string | null;
  principalRemarkRuleSetId?: string | null;
  rankingEnabled?: boolean;
  approvalRequestId?: string | null;
  promotionPolicy?: {
    passMark: number;
    maxFailedSubjects: number;
    coreSubjectOfferingIds?: string[];
  } | null;
}
export interface YearOption {
  id: string;
  name: string;
}
export interface TermOption {
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
  campusId?: string | null;
  yearLevelId?: string | null;
}
export interface CampusOption {
  id: string;
  name: string;
}
export interface GradingSystemOption {
  id: string;
  name: string;
}
export interface RemarkRuleSetOption {
  id: string;
  name: string;
  kind: string;
}

export interface CycleComponent {
  id: string;
  key: string;
  label: string;
  maxScore: number | string;
  weight?: number | string | null;
  order: number;
  isExam: boolean;
}
export interface CycleDetail {
  cycle: ResultCycle;
  components: CycleComponent[];
  sections: {
    id: string;
    classSectionId: string;
    displayLabel: string | null;
  }[];
}

export const RESULT_STATUS_TONE: Record<string, StateTone> = {
  draft: 'neutral',
  entry_open: 'info',
  entry_closed: 'info',
  moderation: 'warning',
  pending_approval: 'warning',
  published: 'success',
  archived: 'neutral',
  cancelled: 'neutral',
};

export function ResultsWorkbench(props: {
  canManage: boolean;
  canEnter: boolean;
  canApprove: boolean;
  canHold: boolean;
  cycles: ResultCycle[];
  years: YearOption[];
  termsByYear: Record<string, TermOption[]>;
  yearLevels: YearLevelOption[];
  sections: SectionOption[];
  campuses: CampusOption[];
  gradingSystems: GradingSystemOption[];
  remarkSets: RemarkRuleSetOption[];
  students: TranscriptStudentOption[];
}) {
  const [cycleList, setCycleList] = React.useState<ResultCycle[]>(props.cycles);
  const [selectedId, setSelectedId] = React.useState<string>('');
  const [detail, setDetail] = React.useState<CycleDetail | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Create form
  const [name, setName] = React.useState('');
  const [year, setYear] = React.useState('');
  const [term, setTerm] = React.useState('');
  const [level, setLevel] = React.useState('');
  const [campus, setCampus] = React.useState('');

  const loadCycle = React.useCallback(async (id: string) => {
    if (!id) return;
    setBusy(true);
    try {
      const data = await apiGet<CycleDetail>(`/cycles/${id}`);
      setDetail(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load cycle');
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (selectedId) void loadCycle(selectedId);
    else setDetail(null);
  }, [selectedId, loadCycle]);

  async function createCycle() {
    setBusy(true);
    try {
      const created = await apiPost<ResultCycle>('/cycles', {
        name,
        academicYearId: year,
        termId: term || undefined,
        yearLevelId: level || undefined,
        campusId: campus || undefined,
      });
      toast.success('Result cycle created');
      setCycleList((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setName('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create cycle');
    } finally {
      setBusy(false);
    }
  }

  const refresh = React.useCallback(async () => {
    await loadCycle(selectedId);
    try {
      const list = await apiGet<ResultCycle[]>('/cycles');
      setCycleList(list);
    } catch {
      /* keep the current list on a refresh error */
    }
  }, [loadCycle, selectedId]);

  const terms = year ? (props.termsByYear[year] ?? []) : [];
  const canCreate = props.canManage && name.trim() && year;
  const status = detail?.cycle.status;

  return (
    <div className="flex flex-col gap-6">
      {props.canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-4" aria-hidden /> New result cycle
            </CardTitle>
            <CardDescription>
              A cycle covers a term’s results for the class sections you add to
              it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="rc-name">Name</Label>
              <Input
                id="rc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. First Term Results 2026/27"
              />
            </div>
            <PickSelect
              id="rc-year"
              label="Academic year"
              value={year}
              onChange={(v) => {
                setYear(v);
                setTerm('');
              }}
              options={props.years}
            />
            <PickSelect
              id="rc-term"
              label="Term (optional)"
              value={term}
              onChange={setTerm}
              options={terms}
              placeholder="Year-long"
              disabled={!year}
            />
            <PickSelect
              id="rc-level"
              label="Year level (optional)"
              value={level}
              onChange={setLevel}
              options={props.yearLevels.map((y) => ({
                id: y.id,
                name: y.code ? `${y.name} (${y.code})` : y.name,
              }))}
              placeholder="Any"
            />
            <PickSelect
              id="rc-campus"
              label="Campus (optional)"
              value={campus}
              onChange={setCampus}
              options={props.campuses}
              placeholder="Whole school"
            />
            <div className="flex items-end">
              <Button onClick={createCycle} disabled={busy || !canCreate}>
                Create cycle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-4" aria-hidden /> Result cycles
          </CardTitle>
          <CardDescription>
            Select a cycle to configure and publish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cycleList.length === 0 ? (
            <EmptyState
              title="No result cycles yet"
              description={
                props.canManage
                  ? 'Create a cycle above to start a term’s results.'
                  : 'A registrar will create the result cycles.'
              }
            />
          ) : (
            <div className="flex flex-col gap-1.5 sm:max-w-md">
              <Label htmlFor="rc-select">Cycle</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger id="rc-select">
                  <SelectValue placeholder="Choose a cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycleList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" aria-hidden /> Transcripts
          </CardTitle>
          <CardDescription>
            A student’s cumulative record across every published term — read
            from the immutable snapshots, not the live gradebook, so it
            reproduces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TranscriptPanel
            students={props.students}
            canManage={props.canManage}
          />
        </CardContent>
      </Card>

      {detail && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {detail.cycle.name}
              <StatusBadge
                tone={RESULT_STATUS_TONE[detail.cycle.status] ?? 'neutral'}
              >
                {detail.cycle.status.replace(/_/g, ' ')}
              </StatusBadge>
            </CardTitle>
            <CardDescription>
              {props.years.find((y) => y.id === detail.cycle.academicYearId)
                ?.name ?? 'Academic year'}
              {detail.cycle.termId
                ? ` · ${terms.find((t) => t.id === detail.cycle.termId)?.name ?? 'Term'}`
                : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="configure">
              <TabsList className="mb-4 flex flex-wrap">
                <TabsTrigger value="configure">Configure</TabsTrigger>
                <TabsTrigger value="enter">Enter scores</TabsTrigger>
                <TabsTrigger value="behaviour">Behaviour</TabsTrigger>
                <TabsTrigger value="publish">Publish</TabsTrigger>
                {props.canHold && (
                  <TabsTrigger value="holds">Financial holds</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="configure">
                <ConfigPanel
                  detail={detail}
                  canManage={props.canManage}
                  sections={props.sections}
                  gradingSystems={props.gradingSystems}
                  remarkSets={props.remarkSets}
                  busy={busy}
                  onChanged={refresh}
                />
              </TabsContent>

              <TabsContent value="enter">
                <EntryGrid
                  cycleId={detail.cycle.id}
                  editable={status === 'entry_open'}
                  canEnter={props.canEnter}
                />
              </TabsContent>

              <TabsContent value="behaviour">
                <TraitsPanel
                  cycleId={detail.cycle.id}
                  status={detail.cycle.status}
                  canManage={props.canManage}
                  canEnter={props.canEnter}
                />
              </TabsContent>

              <TabsContent value="publish">
                <PublicationsPanel
                  cycle={detail.cycle}
                  canManage={props.canManage}
                  canApprove={props.canApprove}
                  components={detail.components}
                  onChanged={refresh}
                />
              </TabsContent>

              {props.canHold && (
                <TabsContent value="holds">
                  <FinancialHoldsPanel canHold={props.canHold} />
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function PickSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = 'Choose',
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
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
