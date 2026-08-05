/**
 * WB2-1 · Academic structure — the guided class-builder that replaces free-text
 * class names with the ADR-02 dimensional model (campus · stage · year · stream
 * · section + offerings). Reads are gated `academics.structure.view`; the create
 * controls are shown only with `academics.structure.manage` (the server enforces
 * it regardless — this is a UI hint).
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import {
  StructureBuilder,
  type Campus,
  type Stage,
  type YearLevel,
  type Stream,
  type ClassSection,
} from './structure-builder';

export const dynamic = 'force-dynamic';

export default async function AcademicStructurePage() {
  const session = await getSession();
  const permissions = session?.permissions ?? [];
  const canView = permissions.includes('academics.structure.view');
  const canManage = permissions.includes('academics.structure.manage');

  if (!canView) {
    return (
      <div className="p-6">
        <PermissionDeniedState
          title="You don't have access to the academic structure"
          description="Ask an administrator for the “View academic structure” permission."
        />
      </div>
    );
  }

  const [campuses, stages, yearLevels, streams, sections] = await Promise.all([
    serverApiGet<Campus[]>('/campuses'),
    serverApiGet<Stage[]>('/academics/structure/stages'),
    serverApiGet<YearLevel[]>('/academics/structure/year-levels'),
    serverApiGet<Stream[]>('/academics/structure/streams'),
    serverApiGet<ClassSection[]>('/academics/structure/sections'),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Academic structure
        </h1>
        <p className="text-sm text-muted-foreground">
          Build classes from dimensions — campus, stage, year level, stream and
          section — instead of typing a name like “SS1 Science A”. The label is
          composed for you.
        </p>
      </header>

      <StructureBuilder
        canManage={canManage}
        initialCampuses={campuses ?? []}
        initialStages={stages ?? []}
        initialYearLevels={yearLevels ?? []}
        initialStreams={streams ?? []}
        initialSections={sections ?? []}
      />
    </div>
  );
}
