import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';

import { UsersInvitePanel } from './users-invite-panel';
import { UsersClient, type UserProfile } from './users-client';

interface ProfileResponse {
  data?: UserProfile[];
}

export default async function UsersSettingsPage() {
  const session = await getSession();
  const tenantId = session?.defaultSchoolId;
  const response = tenantId
    ? await serverApiGet<ProfileResponse>(`/tenant/${tenantId}/users?limit=200`)
    : null;
  const users = response?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      {tenantId ? <UsersInvitePanel tenantId={tenantId} /> : null}
      <UsersClient users={users} />
    </div>
  );
}
