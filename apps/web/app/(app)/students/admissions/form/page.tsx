/**
 * WB3 consolidation · the unified "Application form" authoring surface. Folds the
 * former `/admissions/forms` (form builder) and `/admissions/requirements`
 * (documents & fees) into one tabbed page. A `?campus=` query selects a per-campus
 * form variant; versions are re-resolved for that campus server-side.
 *
 * Reads gated `admissions.view`; editing is gated `admissions.criteria` (enforced
 * server-side too — `canManage` only decides whether the controls render).
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';

import { ApplicationFormShell } from './application-form-shell';
import type { RequirementTemplateRow } from '../requirements/requirements-editor';
import type {
  FormVersion,
  IntakeStructure,
  SectionOption,
} from '../admissions-types';

export const dynamic = 'force-dynamic';

export default async function ApplicationFormPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const permissions = session?.permissions ?? [];

  if (!permissions.includes('admissions.view')) {
    return (
      <div className="p-6">
        <PermissionDeniedState
          title="You don't have access to admissions"
          description="Ask an administrator for the “View admissions” permission."
        />
      </div>
    );
  }

  const params = await searchParams;
  const raw = params['campus'];
  const campus = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  const campusQuery = campus ? `?campusId=${encodeURIComponent(campus)}` : '';
  const tabRaw = params['tab'];
  const tab =
    (Array.isArray(tabRaw) ? tabRaw[0] : tabRaw) === 'requirements'
      ? 'requirements'
      : 'fields';

  const [versions, structure, template, sections] = await Promise.all([
    serverApiGet<FormVersion[]>(`/admissions/forms${campusQuery}`),
    serverApiGet<IntakeStructure>('/admissions/intake-structure'),
    serverApiGet<RequirementTemplateRow[]>('/admissions/requirements'),
    // Section-level fee pricing needs `academics.structure.view`; degrade
    // gracefully (it simply won't be offered) if the admissions user lacks it.
    serverApiGet<SectionOption[]>('/academics/structure/sections'),
  ]);

  const campuses = structure?.campuses ?? [];
  const campusOverrides =
    campuses.length > 0
      ? ((await serverApiGet<string[]>(
          `/admissions/forms/campus-overrides?campusIds=${campuses
            .map((c) => encodeURIComponent(c.id))
            .join(',')}`,
        )) ?? [])
      : [];

  const yearLevels = (structure?.yearLevels ?? []).map((y) => ({
    id: y.id,
    name: y.name,
  }));

  return (
    <ApplicationFormShell
      versions={Array.isArray(versions) ? versions : []}
      campuses={campuses}
      campusOverrides={Array.isArray(campusOverrides) ? campusOverrides : []}
      selectedCampus={campus}
      canManage={permissions.includes('admissions.criteria')}
      requirements={Array.isArray(template) ? template : []}
      yearLevels={yearLevels}
      sections={Array.isArray(sections) ? sections : []}
      initialTab={tab}
    />
  );
}
