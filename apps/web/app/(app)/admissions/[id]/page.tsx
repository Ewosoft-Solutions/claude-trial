/**
 * WB3 · Admissions — full application detail / edit. Reads gated
 * `admissions.view`; the requirement + decision actions are each gated
 * server-side. The requirement checklist is joined to the tenant template so
 * measurement/fee editors know their config.
 */
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import { ApplicationDetailView } from './application-detail';
import type {
  ApplicationDetail,
  FormResponse,
  FormVersion,
  Interview,
  SectionOption,
  YearOption,
} from '../admissions-types';

export const dynamic = 'force-dynamic';

interface TemplateRow {
  id: string;
  config?: Record<string, unknown> | null;
}

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const data = (value as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

export default async function AdmissionApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const [
    detail,
    template,
    sections,
    years,
    currentForm,
    formResponse,
    interviews,
  ] = await Promise.all([
    serverApiGet<ApplicationDetail>(`/admissions/applications/${id}`),
    serverApiGet<TemplateRow[]>('/admissions/requirements'),
    serverApiGet<SectionOption[]>('/academics/structure/sections'),
    serverApiGet<YearOption[]>('/academic-years'),
    serverApiGet<FormVersion | null>('/admissions/forms/current'),
    serverApiGet<FormResponse | null>(
      `/admissions/applications/${id}/form-response`,
    ),
    serverApiGet<Interview[]>(`/admissions/applications/${id}/interviews`),
  ]);

  if (!detail) notFound();

  const configByRequirementId: Record<
    string,
    Record<string, unknown> | undefined
  > = {};
  for (const row of template ?? []) {
    configByRequirementId[row.id] = row.config ?? undefined;
  }

  return (
    <ApplicationDetailView
      detail={detail}
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
      sections={sections ?? []}
      years={toArray<YearOption>(years)}
      configByRequirementId={configByRequirementId}
      currentForm={currentForm ?? null}
      formResponse={formResponse ?? null}
      interviews={Array.isArray(interviews) ? interviews : []}
    />
  );
}
