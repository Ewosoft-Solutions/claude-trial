/**
 * WB3-3 · the application-form builder. Reads gated `admissions.view`; building /
 * publishing versions is gated `admissions.criteria` (server-side too).
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import { FormsBuilder } from './forms-builder';
import type { FormVersion } from '../admissions-types';

export const dynamic = 'force-dynamic';

export default async function AdmissionFormsPage() {
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

  const versions = await serverApiGet<FormVersion[]>('/admissions/forms');

  return (
    <FormsBuilder
      versions={Array.isArray(versions) ? versions : []}
      canManage={permissions.includes('admissions.criteria')}
    />
  );
}
