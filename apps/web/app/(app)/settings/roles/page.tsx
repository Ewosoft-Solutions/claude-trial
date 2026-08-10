import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { RolesManager, type ApiRole, type RoleTemplate } from './roles-manager';

interface UserProfile {
  userTenantRole?: {
    role?: { id?: string | null; name?: string | null } | null;
  } | null;
}
interface ProfileResponse {
  data?: UserProfile[];
}

export default async function RolesSettingsPage() {
  const session = await getSession();
  const tenantId = session?.defaultSchoolId;
  const [roles, templates, profiles] = await Promise.all([
    serverApiGet<ApiRole[]>('/roles'),
    serverApiGet<RoleTemplate[]>('/roles/templates'),
    tenantId
      ? serverApiGet<ProfileResponse>(`/tenant/${tenantId}/users?limit=500`)
      : null,
  ]);

  const memberCounts = new Map<string, number>();
  for (const profile of profiles?.data ?? []) {
    const role = profile.userTenantRole?.role;
    const key = role?.id ?? role?.name;
    if (key) memberCounts.set(key, (memberCounts.get(key) ?? 0) + 1);
  }

  const rows = (roles ?? []).map((r) => ({
    ...r,
    members: memberCounts.get(r.id) ?? memberCounts.get(r.name ?? '') ?? 0,
  }));

  return (
    <RolesManager
      roles={rows}
      templates={templates ?? []}
      clearanceLevel={session?.clearanceLevel ?? 0}
    />
  );
}
