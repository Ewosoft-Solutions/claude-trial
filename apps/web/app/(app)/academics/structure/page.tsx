/**
 * WB2-1 · Academic structure — the guided class-builder that replaces free-text
 * class names with the ADR-02 dimensional model (campus · stage · year · stream
 * · section + offerings). Reads are gated `academics.structure.view`; the create
 * controls are shown only with `academics.structure.manage` (the server enforces
 * it regardless — this is a UI hint).
 *
 * This page also owns SUBJECT OFFERINGS (the section × curriculum-subject join).
 * Nothing in the app authored one before, so offerings existed only from seed
 * data while `Classes → Subjects` still edited the legacy `Course` catalogue
 * ADR-02 retired — the gap that made the Classes/Academics boundary read as
 * arbitrary.
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import {
  StructureBuilder,
  type Campus,
  type Stage,
  type YearLevel,
  type Stream,
  type ClassSection,
  type SubjectOffering,
  type OfferableSubject,
  type YearOption,
  type TermOption,
  type BandOption,
  type LevelSpineOption,
} from './structure-builder';

export const dynamic = 'force-dynamic';

export default async function AcademicStructurePage() {
  const session = await getSession();
  const permissions = session?.permissions ?? [];
  const canView = permissions.includes('academics.structure.view');
  const canManage = permissions.includes('academics.structure.manage');

  if (!canView) {
    return (
      <ShellMain>
        <PermissionDeniedState
          title="You don't have access to the academic structure"
          description="Ask an administrator for the “View academic structure” permission."
        />
      </ShellMain>
    );
  }

  const [
    campuses,
    stages,
    yearLevels,
    streams,
    sections,
    offerings,
    offerableSubjects,
    years,
    spine,
  ] = await Promise.all([
    serverApiGet<Campus[]>('/campuses'),
    serverApiGet<Stage[]>('/academics/structure/stages'),
    serverApiGet<YearLevel[]>('/academics/structure/year-levels'),
    serverApiGet<Stream[]>('/academics/structure/streams'),
    serverApiGet<ClassSection[]>('/academics/structure/sections'),
    serverApiGet<SubjectOffering[]>('/academics/structure/offerings'),
    serverApiGet<OfferableSubject[]>('/academics/structure/offerable-subjects'),
    serverApiGet<YearOption[]>('/academic-years'),
    // The fixed spine is reference data served by the API, so the web bundle
    // never imports the database package.
    serverApiGet<{ bands: BandOption[]; levels: LevelSpineOption[] }>(
      '/academics/structure/level-spine',
    ),
  ]);

  // Terms per year (the list endpoint omits them); a handful of years at most.
  const yearList = Array.isArray(years) ? years : [];
  const termEntries = await Promise.all(
    yearList.map(async (y) => {
      const terms = await serverApiGet<TermOption[]>(
        `/academic-years/${y.id}/terms`,
      );
      return [y.id, Array.isArray(terms) ? terms : []] as const;
    }),
  );

  return (
    <StructureBuilder
      canManage={canManage}
      initialCampuses={campuses ?? []}
      initialStages={stages ?? []}
      initialYearLevels={yearLevels ?? []}
      initialStreams={streams ?? []}
      initialSections={sections ?? []}
      initialOfferings={offerings ?? []}
      offerableSubjects={offerableSubjects ?? []}
      years={yearList}
      termsByYear={Object.fromEntries(termEntries)}
      bands={spine?.bands ?? []}
      levelSpine={spine?.levels ?? []}
    />
  );
}
