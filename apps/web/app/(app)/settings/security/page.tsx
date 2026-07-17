import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import type { SessionLifecyclePolicy } from '@/lib/session';
import { SessionSecurityForm } from './session-security-form';
import { requireAnyPermission } from '@/lib/access';
import type {
  BiometricEnrollmentPolicy,
  SensitiveOperationChangeRequest,
  SensitiveOperationPolicy,
} from '@/lib/security-governance';
import { TenantSecurityGovernance } from './tenant-security-governance';

export default async function SecuritySettingsPage() {
  await requireAnyPermission(['settings.view', 'settings.security']);
  const [session, policy, biometricPolicy, sensitivePolicies, requests] =
    await Promise.all([
      getSession(),
      serverApiGet<SessionLifecyclePolicy>('/security-policies/session'),
      serverApiGet<{ policy: BiometricEnrollmentPolicy }>(
        '/security-policies/biometrics',
      ),
      serverApiGet<SensitiveOperationPolicy[]>(
        '/security-policies/step-up-policies',
      ),
      serverApiGet<SensitiveOperationChangeRequest[]>(
        '/security-policies/step-up-change-requests',
      ),
    ]);

  if (
    !session ||
    !policy ||
    !biometricPolicy ||
    !sensitivePolicies ||
    !requests
  )
    return null;

  const canEdit = session.permissions.includes('settings.security');

  return (
    <div className="space-y-6">
      <SessionSecurityForm
        initialPolicy={policy}
        endpoint="/api/settings/security/session"
        canEdit={canEdit}
        tenantName={
          session.schools.find(
            (school) => school.id === session.defaultSchoolId,
          )?.name
        }
      />
      <TenantSecurityGovernance
        initialEnrollmentPolicy={biometricPolicy.policy}
        policies={sensitivePolicies}
        initialRequests={requests}
        canEdit={canEdit}
      />
    </div>
  );
}
