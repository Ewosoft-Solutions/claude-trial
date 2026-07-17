import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import type { SessionLifecyclePolicy } from '@/lib/session';
import { SessionSecurityForm } from './session-security-form';
import { requireAnyPermission } from '@/lib/access';

export default async function SecuritySettingsPage() {
  await requireAnyPermission(['settings.view', 'settings.security']);
  const session = await getSession();
  const policy = await serverApiGet<SessionLifecyclePolicy>(
    '/security-policies/session',
  );

  if (!session || !policy) return null;

  return (
    <SessionSecurityForm
      initialPolicy={policy}
      endpoint="/api/settings/security/session"
      canEdit={session.permissions.includes('settings.security')}
      tenantName={
        session.schools.find((school) => school.id === session.defaultSchoolId)
          ?.name
      }
    />
  );
}
