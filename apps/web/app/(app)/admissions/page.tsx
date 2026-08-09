/**
 * WB3 · Admissions (structured intake). A full-width Applications table with a
 * cascade-driven New Application form and an at-a-glance drawer; the full
 * detail/edit lives at /admissions/[id]. Reads gated `admissions.view`; each
 * action is additionally gated server-side.
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import { PageTitle } from '@workspace/ui/custom/shell/page-title';
import { AdmissionsWorkspace } from './admissions-workspace';
import type { Application, IntakeStructure } from './admissions-types';

export const dynamic = 'force-dynamic';

const EMPTY_STRUCTURE: IntakeStructure = {
  campuses: [],
  stages: [],
  yearLevels: [],
  streams: [],
};

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

  const [applications, structure] = await Promise.all([
    serverApiGet<Application[]>('/admissions/applications'),
    serverApiGet<IntakeStructure>('/admissions/intake-structure'),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <PageTitle>Admissions</PageTitle>
        <p className="text-sm text-muted-foreground">
          Capture applications against the school&apos;s own classes, collect
          the requirement checklist at each stage, and convert an accepted
          applicant into a registered student in one command.
        </p>
      </header>

      <AdmissionsWorkspace
        perms={{
          create: permissions.includes('admissions.create'),
          review: permissions.includes('admissions.review'),
          approve: permissions.includes('admissions.approve'),
          reject: permissions.includes('admissions.reject'),
          convert: permissions.includes('admissions.convert'),
          documents: permissions.includes('admissions.documents'),
          criteria: permissions.includes('admissions.criteria'),
        }}
        applications={applications ?? []}
        structure={structure ?? EMPTY_STRUCTURE}
      />
    </div>
  );
}
