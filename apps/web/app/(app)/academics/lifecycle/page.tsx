/**
 * WB2-3 · Student lifecycle — registration · transfer · withdrawal · graduation,
 * each a durable, effective-dated event that keeps history (never a delete-and-
 * retype). Reads gated `academics.lifecycle.view`; the transition controls need
 * `academics.lifecycle.manage` (server-enforced — UI hint only).
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import { PageTitle } from '@workspace/ui/custom/shell/page-title';
import {
  LifecycleManager,
  type SectionOption,
  type StudentOption,
  type YearOption,
} from './lifecycle-manager';

export const dynamic = 'force-dynamic';

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const data = (value as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

export default async function StudentLifecyclePage() {
  const session = await getSession();
  const permissions = session?.permissions ?? [];
  const canView = permissions.includes('academics.lifecycle.view');
  const canManage = permissions.includes('academics.lifecycle.manage');

  if (!canView) {
    return (
      <div className="p-6">
        <PermissionDeniedState
          title="You don't have access to the student lifecycle"
          description="Ask an administrator for the “View student lifecycle” permission."
        />
      </div>
    );
  }

  const [sections, years, studentsRaw] = await Promise.all([
    serverApiGet<SectionOption[]>('/academics/structure/sections'),
    serverApiGet<YearOption[]>('/academic-years'),
    // /students caps `limit` at 100 (PaginationDto @Max(100)); a higher value is
    // rejected 400 and serverApiGet returns null, blanking the picker. 100 is the
    // max the endpoint allows — a searchable picker is the real fix past 100.
    serverApiGet<unknown>('/students?limit=100'),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <PageTitle>Student lifecycle</PageTitle>
        <p className="text-sm text-muted-foreground">
          Register, transfer, withdraw and graduate students — every change is a
          durable, dated event, so a placement is never overwritten.
        </p>
      </header>

      <LifecycleManager
        canManage={canManage}
        sections={sections ?? []}
        years={toArray<YearOption>(years)}
        students={toArray<StudentOption>(studentsRaw)}
      />
    </div>
  );
}
