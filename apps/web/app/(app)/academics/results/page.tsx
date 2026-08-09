/**
 * WB4 · Results workbench (ADR-04) — configure a result cycle, capture component
 * scores, moderate, publish an immutable snapshot (maker-checker) with report-
 * card + broadsheet artifacts, amend by supersession, and gate visibility with
 * audited financial holds. Reads gated `academics.results.view`; entry needs
 * `.enter`, configuration/publish-request `.manage`, publish/amend approval
 * `.approve`, holds `.financial_hold` — all enforced server-side.
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import { PageTitle } from '@workspace/ui/custom/shell/page-title';
import {
  ResultsWorkbench,
  type CampusOption,
  type GradingSystemOption,
  type RemarkRuleSetOption,
  type ResultCycle,
  type SectionOption,
  type TermOption,
  type YearLevelOption,
  type YearOption,
} from './results-workbench';

export const dynamic = 'force-dynamic';

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const data = (value as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

export default async function ResultsPage() {
  const session = await getSession();
  const permissions = session?.permissions ?? [];
  const canView = permissions.includes('academics.results.view');
  if (!canView) {
    return (
      <div className="p-6">
        <PermissionDeniedState
          title="You don't have access to results"
          description="Ask an administrator for the “View results” permission."
        />
      </div>
    );
  }

  const [
    cycles,
    years,
    yearLevels,
    sections,
    campuses,
    gradingSystems,
    remarkSets,
  ] = await Promise.all([
    serverApiGet<ResultCycle[]>('/academics/results/cycles'),
    serverApiGet<YearOption[]>('/academic-years'),
    serverApiGet<YearLevelOption[]>('/academics/structure/year-levels'),
    serverApiGet<SectionOption[]>('/academics/structure/sections'),
    serverApiGet<CampusOption[]>('/campuses'),
    serverApiGet<GradingSystemOption[]>('/grading-systems'),
    serverApiGet<RemarkRuleSetOption[]>('/academics/results/remark-rule-sets'),
  ]);

  const yearList = toArray<YearOption>(years);
  // Terms per year (the list endpoint omits them); a handful of years at most.
  const termEntries = await Promise.all(
    yearList.map(async (y) => {
      const terms = await serverApiGet<TermOption[]>(
        `/academic-years/${y.id}/terms`,
      );
      return [y.id, toArray<TermOption>(terms)] as const;
    }),
  );
  const termsByYear = Object.fromEntries(termEntries);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <PageTitle>Results</PageTitle>
        <p className="text-sm text-muted-foreground">
          Run a term’s results end to end — configure, enter scores, validate,
          moderate, then a second approver publishes an immutable, reproducible
          snapshot. Corrections are amendments, never overwrites.
        </p>
      </header>

      <ResultsWorkbench
        canManage={permissions.includes('academics.results.manage')}
        canEnter={permissions.includes('academics.results.enter')}
        canApprove={permissions.includes('academics.results.approve')}
        canHold={permissions.includes('academics.results.financial_hold')}
        cycles={toArray<ResultCycle>(cycles)}
        years={yearList}
        termsByYear={termsByYear}
        yearLevels={toArray<YearLevelOption>(yearLevels)}
        sections={toArray<SectionOption>(sections)}
        campuses={toArray<CampusOption>(campuses)}
        gradingSystems={toArray<GradingSystemOption>(gradingSystems)}
        remarkSets={toArray<RemarkRuleSetOption>(remarkSets)}
      />
    </div>
  );
}
