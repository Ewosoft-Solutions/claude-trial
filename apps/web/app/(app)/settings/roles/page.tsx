import { Plus } from 'lucide-react';

import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { Button } from '@workspace/ui/components/button';
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

interface ApiRole {
  id: string;
  name?: string | null;
  description?: string | null;
  clearanceLevel?: number | null;
  roleType?: string | null;
}

interface UserProfile {
  // `userTenantRole` is a to-one relation (UserTenantRole?) — one role per
  // profile — so the API returns a single object (or null), not an array.
  userTenantRole?: {
    role?: { id?: string | null; name?: string | null } | null;
  } | null;
}

interface ProfileResponse {
  data?: UserProfile[];
}

function clearanceTone(level: number): StateTone {
  if (level >= 7) return 'destructive';
  if (level >= 5) return 'warning';
  if (level >= 3) return 'info';
  return 'neutral';
}

export default async function RolesSettingsPage() {
  const session = await getSession();
  const tenantId = session?.defaultSchoolId;
  const [roles, profiles] = await Promise.all([
    serverApiGet<ApiRole[]>('/roles'),
    tenantId ? serverApiGet<ProfileResponse>(`/tenant/${tenantId}/users?limit=500`) : null,
  ]);
  const memberCounts = new Map<string, number>();
  for (const profile of profiles?.data ?? []) {
    const role = profile.userTenantRole?.role;
    const key = role?.id ?? role?.name;
    if (key) memberCounts.set(key, (memberCounts.get(key) ?? 0) + 1);
  }
  const rows = roles ?? [];

  return (
    <DataCard
      title="Roles"
      count={rows.length}
      unit="role"
      description={`${rows.length} roles returned by the tenant role API.`}
      action={
        <Button size="sm">
          <Plus /> Add role
        </Button>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          compact
          title="No roles found"
          description="Tenant roles returned by the API will appear here."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="text-right">Clearance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((role) => {
              const level = Number(role.clearanceLevel ?? 0);
              const members =
                memberCounts.get(role.id) ?? memberCounts.get(role.name ?? '') ?? 0;
              return (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        {role.name ?? role.id}
                        {role.roleType ? (
                          <StatusBadge tone="info">{role.roleType}</StatusBadge>
                        ) : null}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {role.description ?? 'No description'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {members}
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge tone={clearanceTone(level)} dot>
                      Level {level}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </DataCard>
  );
}
