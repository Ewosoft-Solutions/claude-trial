import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { StateTone } from '@workspace/ui/types/states.types';
import { DataCard } from '../../_shared/data-card';
import { UsersInvitePanel } from './users-invite-panel';

type ProfileStatus =
  | 'active'
  | 'invited'
  | 'suspended'
  | 'pending'
  | 'inactive';

interface UserProfile {
  id: string;
  status?: string | null;
  user?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    isActive?: boolean | null;
    isVerified?: boolean | null;
  } | null;
  // To-one relation (one role per profile), not an array.
  userTenantRole?: {
    role?: { name?: string | null; clearanceLevel?: number | null } | null;
  } | null;
}

interface ProfileResponse {
  data?: UserProfile[];
}

const STATUS_META: Record<ProfileStatus, { label: string; tone: StateTone }> = {
  active: { label: 'Active', tone: 'success' },
  invited: { label: 'Invited', tone: 'info' },
  pending: { label: 'Pending', tone: 'info' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  suspended: { label: 'Suspended', tone: 'warning' },
};

function statusKey(profile: UserProfile): ProfileStatus {
  const raw = String(
    profile.status ?? (profile.user?.isActive ? 'active' : 'inactive'),
  ).toLowerCase();
  if (raw in STATUS_META) return raw as ProfileStatus;
  return profile.user?.isActive === false ? 'inactive' : 'active';
}

function displayName(profile: UserProfile): string {
  const user = profile.user;
  return (
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email ||
    'Unknown user'
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function roles(profile: UserProfile): string {
  return profile.userTenantRole?.role?.name ?? 'No role';
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
      <DataCard title="Users" count={users.length} unit="tenant profile">
        {users.length === 0 ? (
          <EmptyState
            compact
            title="No users found"
            description="Tenant users returned by the API will appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((profile) => {
                const name = displayName(profile);
                const status = STATUS_META[statusKey(profile)];
                return (
                  <TableRow key={profile.id} id={`user-${profile.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="break-words font-medium text-foreground">
                            {name}
                          </span>
                          <span className="break-words text-xs text-muted-foreground">
                            {profile.user?.email ?? 'No email'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {roles(profile)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {profile.user?.isVerified ? 'Verified' : 'Unverified'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} dot>
                        {status.label}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DataCard>
    </div>
  );
}
