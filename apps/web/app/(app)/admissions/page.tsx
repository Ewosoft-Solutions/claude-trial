/**
 * WB3 · Admissions pipeline — a durable, Person-linked application journey from
 * submission through review, offer and acceptance to a one-command conversion
 * into a registered student. Reads gated `admissions.view`; each action is
 * additionally gated server-side (create/review/approve/reject/convert).
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import {
  AdmissionsPipeline,
  type Application,
  type SectionOption,
  type YearOption,
} from './admissions-pipeline';

export const dynamic = 'force-dynamic';

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const data = (value as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

export default async function AdmissionsPage() {
  const session = await getSession();
  const permissions = session?.permissions ?? [];
  const canView = permissions.includes('admissions.view');

  if (!canView) {
    return (
      <div className="p-6">
        <PermissionDeniedState
          title="You don't have access to admissions"
          description="Ask an administrator for the “View admissions” permission."
        />
      </div>
    );
  }

  // The offer/convert target pickers need sections + years, which are gated by
  // `academics.structure.view` + `schedules.view` respectively — a caller with
  // only admissions permissions gets empty pickers (handled gracefully below),
  // so offering/converting effectively also requires those read scopes.
  const [applications, sections, years] = await Promise.all([
    serverApiGet<Application[]>('/admissions/applications'),
    serverApiGet<SectionOption[]>('/academics/structure/sections'),
    serverApiGet<YearOption[]>('/academic-years'),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admissions</h1>
        <p className="text-sm text-muted-foreground">
          Move an applicant from submission through review and offer to a
          registered student — one command converts an accepted applicant into
          an enrolled student.
        </p>
      </header>

      <AdmissionsPipeline
        perms={{
          create: permissions.includes('admissions.create'),
          review: permissions.includes('admissions.review'),
          approve: permissions.includes('admissions.approve'),
          reject: permissions.includes('admissions.reject'),
          convert: permissions.includes('admissions.convert'),
        }}
        applications={applications ?? []}
        sections={sections ?? []}
        years={toArray<YearOption>(years)}
      />
    </div>
  );
}
