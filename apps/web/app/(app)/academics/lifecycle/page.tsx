/**
 * WB2-2 + WB2-3 · Student placement — the merged enrolment + lifecycle page.
 *
 * Enrolment and lifecycle were two screens writing one fact (section
 * membership). The lifecycle service is the authoritative writer — it keeps the
 * `SectionEnrollment`, the effective-dated history span and
 * `Student.enrollmentStatus` in lock-step — so it hosts, and enrolment (plus its
 * student→subjects resolver) becomes a tab.
 *
 * Reads need `academics.lifecycle.view`; each tab's write controls are gated on
 * that domain's own `.manage` permission, and the server enforces both
 * regardless — the flags here are UI hints.
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';

import type {
  SectionOption,
  StudentOption,
  YearOption,
} from './lifecycle-manager';
import type { ResolvedModel } from '../enrollment/enrollment-manager';
import { PlacementWorkspace } from './placement-workspace';

export const dynamic = 'force-dynamic';

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const data = (value as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

export default async function StudentPlacementPage() {
  const session = await getSession();
  const permissions = session?.permissions ?? [];
  const canView =
    permissions.includes('academics.lifecycle.view') ||
    permissions.includes('academics.enrollment.view');

  if (!canView) {
    return (
      <ShellMain>
        <PermissionDeniedState
          title="You don't have access to student placement"
          description="Ask an administrator for the “View student lifecycle” permission."
        />
      </ShellMain>
    );
  }

  const [sections, years, studentsRaw, model] = await Promise.all([
    serverApiGet<SectionOption[]>('/academics/structure/sections'),
    serverApiGet<YearOption[]>('/academic-years'),
    // /students caps `limit` at 100 (PaginationDto @Max(100)); a higher value is
    // rejected 400 and serverApiGet returns null, blanking the picker. 100 is the
    // max the endpoint allows — a searchable picker is the real fix past 100.
    serverApiGet<unknown>('/students?limit=100'),
    serverApiGet<ResolvedModel>('/academics/enrollment/profiles/resolve'),
  ]);

  return (
    <PlacementWorkspace
      canManageLifecycle={permissions.includes('academics.lifecycle.manage')}
      canManageEnrollment={permissions.includes('academics.enrollment.manage')}
      model={model ?? { model: 'class', source: 'schoolType' }}
      sections={sections ?? []}
      years={toArray<YearOption>(years)}
      students={toArray<StudentOption>(studentsRaw)}
    />
  );
}
