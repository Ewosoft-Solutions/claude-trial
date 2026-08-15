/**
 * WB3 · Admissions (structured intake) — the governed DirectoryTable workspace
 * with a StatGrid pipeline summary, a cascade-driven New Application form and an
 * at-a-glance drawer; the full detail/edit lives at /students/admissions/[id].
 * Reads gated `admissions.view`; each action is additionally gated server-side.
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import { AdmissionsWorkspace } from './admissions-workspace';
import type {
  Application,
  FormVersion,
  IntakeStructure,
} from './admissions-types';

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

  const [applications, structure, currentForm] = await Promise.all([
    serverApiGet<Application[]>('/admissions/applications'),
    serverApiGet<IntakeStructure>('/admissions/intake-structure'),
    // The school's current published application form (the tenant default). Its
    // system sections drive the New Application layout; null → the built-in one.
    serverApiGet<FormVersion>('/admissions/forms/current'),
  ]);

  return (
    <AdmissionsWorkspace
      perms={{
        create: permissions.includes('admissions.create'),
        review: permissions.includes('admissions.review'),
        approve: permissions.includes('admissions.approve'),
        reject: permissions.includes('admissions.reject'),
        convert: permissions.includes('admissions.convert'),
        documents: permissions.includes('admissions.documents'),
        criteria: permissions.includes('admissions.criteria'),
        interviews: permissions.includes('admissions.interviews'),
      }}
      applications={applications ?? []}
      structure={structure ?? EMPTY_STRUCTURE}
      formDefinition={currentForm?.definition ?? null}
    />
  );
}
