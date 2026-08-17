/**
 * WB2-4 · Promotion workbench — year rollover as one reviewable operation
 * (preview + exceptions, maker-checker-gated commit). Reads gated
 * `academics.promotion.view`; run management needs `academics.promotion.manage`
 * and the commit approval `academics.promotion.approve` (server-enforced — the
 * commit is additionally a maker-checker with a second approver).
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import {
  PromotionWorkbench,
  type CampusOption,
  type PromotionRun,
  type SectionOption,
  type YearLevelOption,
  type YearOption,
} from './promotion-workbench';

export const dynamic = 'force-dynamic';

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const data = (value as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

export default async function PromotionPage() {
  const session = await getSession();
  const permissions = session?.permissions ?? [];
  const canView = permissions.includes('academics.promotion.view');
  const canManage = permissions.includes('academics.promotion.manage');
  const canApprove = permissions.includes('academics.promotion.approve');

  if (!canView) {
    return (
      <ShellMain>
        <PermissionDeniedState
          title="You don't have access to promotion"
          description="Ask an administrator for the “View promotion runs” permission."
        />
      </ShellMain>
    );
  }

  // Each read is independently permission-gated server-side; fall back to empty.
  const [runs, years, yearLevels, sections, campuses] = await Promise.all([
    serverApiGet<PromotionRun[]>('/academics/promotion/runs'),
    serverApiGet<unknown>('/academic-years'),
    serverApiGet<YearLevelOption[]>('/academics/structure/year-levels'),
    serverApiGet<SectionOption[]>('/academics/structure/sections'),
    serverApiGet<CampusOption[]>('/campuses'),
  ]);

  return (
    <PromotionWorkbench
      canManage={canManage}
      canApprove={canApprove}
      runs={runs ?? []}
      years={toArray<YearOption>(years)}
      yearLevels={yearLevels ?? []}
      sections={sections ?? []}
      campuses={campuses ?? []}
    />
  );
}
