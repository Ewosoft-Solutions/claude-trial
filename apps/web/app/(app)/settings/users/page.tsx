import { UserPlus } from 'lucide-react';

import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
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

type ProfileStatus = 'active' | 'invited' | 'suspended' | 'pending' | 'inactive';

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
  userTenantRole?: Array<{
    role?: { name?: string | null; clearanceLevel?: number | null } | null;
  }>;
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
  const raw = String(profile.status ?? (profile.user?.isActive ? 'active' : 'inactive')).toLowerCase();
  if (raw in STATUS_META) return raw as ProfileStatus;
  return profile.user?.isActive === false ? 'inactive' : 'active';
}

function displayName(profile: UserProfile): string {
  const user = profile.user;
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Unknown user';
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
  const names =
    profile.userTenantRole
      ?.map((item) => item.role?.name)
      .filter((name): name is string => Boolean(name)) ?? [];
  return names.length ? names.join(', ') : 'No role';
}

export default async function UsersSettingsPage() {
  const session = await getSession();
  const tenantId = session?.defaultSchoolId;
  const response = tenantId
    ? await serverApiGet<ProfileResponse>(`/tenant/${tenantId}/users?limit=200`)
    : null;
  const users = response?.data ?? [];

  return (
    <Card className="shadow-card">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base">Users</CardTitle>
          <CardDescription>{users.length} tenant profiles</CardDescription>
        </div>
        <Button size="sm">
          <UserPlus /> Invite user
        </Button>
      </CardHeader>
      <CardContent className={users.length ? 'px-0' : undefined}>
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
                <TableHead className="pl-6">User</TableHead>
                <TableHead className="max-md:hidden">Role</TableHead>
                <TableHead className="max-sm:hidden">Verified</TableHead>
                <TableHead className="pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((profile) => {
                const name = displayName(profile);
                const status = STATUS_META[statusKey(profile)];
                return (
                  <TableRow key={profile.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">
                            {name}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {profile.user?.email ?? 'No email'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {roles(profile)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-sm:hidden">
                      {profile.user?.isVerified ? 'Verified' : 'Unverified'}
                    </TableCell>
                    <TableCell className="pr-6">
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
      </CardContent>
    </Card>
  );
}
