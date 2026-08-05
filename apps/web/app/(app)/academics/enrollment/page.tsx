/**
 * WB2-2 · Enrollment — join students to what they study, the way the tenant's
 * academic profile demands (K-12 section enrollment vs tertiary per-course
 * registration). Reads gated `academics.enrollment.view`; the enroll controls
 * need `academics.enrollment.manage` (server-enforced — UI hint only).
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
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
      <div className="p-6">
        <PermissionDeniedState
          title="You don't have access to enrollment"
          description="Ask an administrator for the “View enrollment” permission."
        />
      </div>
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Enrollment</h1>
        <p className="text-sm text-muted-foreground">
          Enroll a student into a class section and see the subjects that
          resolves to — through offerings, never a typed label.
        </p>
      </header>

      <EnrollmentManager
        canManage={canManage}
        model={model ?? { model: 'class', source: 'schoolType' }}
        sections={sections ?? []}
        years={toArray<YearOption>(years)}
        students={toArray<StudentOption>(studentsRaw)}
      />
    </div>
  );
}
