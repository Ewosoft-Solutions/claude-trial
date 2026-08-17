/**
 * WB2-2 · Enrollment — join students to what they study, the way the tenant's
 * academic profile demands (K-12 section enrollment vs tertiary per-course
 * registration). Reads gated `academics.enrollment.view`; the enroll controls
 * need `academics.enrollment.manage` (server-enforced — UI hint only).
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import {
  EnrollmentManager,
  type ResolvedModel,
  type SectionOption,
  type StudentOption,
  type YearOption,
} from './enrollment-manager';

export const dynamic = 'force-dynamic';

// The students list may come back as a bare array or a paginated envelope.
function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const data = (value as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

export default async function EnrollmentPage() {
  const session = await getSession();
  const permissions = session?.permissions ?? [];
  const canView = permissions.includes('academics.enrollment.view');
  const canManage = permissions.includes('academics.enrollment.manage');

  if (!canView) {
    return (
      <ShellMain>
        <PermissionDeniedState
          title="You don't have access to enrollment"
          description="Ask an administrator for the “View enrollment” permission."
        />
      </ShellMain>
    );
  }

  const [model, sections, years, studentsRaw] = await Promise.all([
    serverApiGet<ResolvedModel>('/academics/enrollment/profiles/resolve'),
    serverApiGet<SectionOption[]>('/academics/structure/sections'),
    serverApiGet<YearOption[]>('/academic-years'),
    // /students caps `limit` at 100 (PaginationDto @Max(100)); a higher value is
    // rejected 400 and serverApiGet returns null, blanking the picker.
    serverApiGet<unknown>('/students?limit=100'),
  ]);

  return (
    <EnrollmentManager
      canManage={canManage}
      model={model ?? { model: 'class', source: 'schoolType' }}
      sections={sections ?? []}
      years={toArray<YearOption>(years)}
      students={toArray<StudentOption>(studentsRaw)}
    />
  );
}
