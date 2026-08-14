/**
 * WB3-5 · the Admission requirements editor — the per-tenant, configurable
 * checklist (documents / measurements / fees) collected across the admissions
 * journey. Fee rows carry their pricing here (default + per-class / per-section
 * overrides), which is what the applicant detail page resolves and bills.
 *
 * Reads gated `admissions.view`; editing is gated `admissions.criteria` (enforced
 * server-side too — `canManage` only decides whether the controls render).
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';

import { RequirementsEditor } from './requirements-editor';
import type { IntakeStructure, SectionOption } from '../admissions-types';
import type { RequirementTemplateRow } from './requirements-editor';

export const dynamic = 'force-dynamic';

export default async function AdmissionRequirementsPage() {
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

  const [template, structure, sections] = await Promise.all([
    serverApiGet<RequirementTemplateRow[]>('/admissions/requirements'),
    serverApiGet<IntakeStructure>('/admissions/intake-structure'),
    // Sections need `academics.structure.view`; degrade gracefully (section-level
    // pricing simply won't be offered) if the admissions user lacks it.
    serverApiGet<SectionOption[]>('/academics/structure/sections'),
  ]);

  const yearLevels = (structure?.yearLevels ?? []).map((y) => ({
    id: y.id,
    name: y.name,
  }));

  return (
    <RequirementsEditor
      requirements={Array.isArray(template) ? template : []}
      yearLevels={yearLevels}
      sections={Array.isArray(sections) ? sections : []}
      canManage={permissions.includes('admissions.criteria')}
    />
  );
}
