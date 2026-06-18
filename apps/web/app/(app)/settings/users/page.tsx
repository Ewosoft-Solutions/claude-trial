/* ============================================================
   /settings/users — staff accounts

   The school's user accounts (role + status). Mock rows; account
   management lands with the API.
   ============================================================ */

import { UserPlus } from 'lucide-react';

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
import type { StateTone } from '@workspace/ui/types/states.types';

type Status = 'active' | 'invited' | 'suspended';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  lastActive: string;
  status: Status;
}

const USERS: User[] = [
  { id: 'u1', name: 'Margaret Bello', email: 'm.bello@stjude.edu.ng', role: 'Owner', lastActive: '2m ago', status: 'active' },
  { id: 'u2', name: 'Samuel Okonkwo', email: 's.okonkwo@stjude.edu.ng', role: 'Principal', lastActive: '1h ago', status: 'active' },
  { id: 'u3', name: 'Patricia Adamu', email: 'p.adamu@stjude.edu.ng', role: 'Bursar', lastActive: '3h ago', status: 'active' },
  { id: 'u4', name: 'Daniel Eze', email: 'd.eze@stjude.edu.ng', role: 'Registrar', lastActive: 'yesterday', status: 'active' },
  { id: 'u5', name: 'Grace Otu', email: 'g.otu@stjude.edu.ng', role: 'Teacher', lastActive: '—', status: 'invited' },
  { id: 'u6', name: 'Henry Coker', email: 'h.coker@stjude.edu.ng', role: 'Teacher', lastActive: '2 weeks ago', status: 'suspended' },
];

const STATUS_META: Record<Status, { label: string; tone: StateTone }> = {
  active: { label: 'Active', tone: 'success' },
  invited: { label: 'Invited', tone: 'info' },
  suspended: { label: 'Suspended', tone: 'warning' },
};

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function UsersSettingsPage() {
  return (
    <Card className="shadow-card">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base">Users</CardTitle>
          <CardDescription>{USERS.length} staff accounts</CardDescription>
        </div>
        <Button size="sm">
          <UserPlus /> Invite user
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">User</TableHead>
              <TableHead className="max-md:hidden">Role</TableHead>
              <TableHead className="max-sm:hidden">Last active</TableHead>
              <TableHead className="pr-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {USERS.map((u) => {
              const status = STATUS_META[u.status];
              return (
                <TableRow key={u.id}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-[11px] font-semibold">
                          {initials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">
                          {u.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-md:hidden">
                    {u.role}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-sm:hidden">
                    {u.lastActive}
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
      </CardContent>
    </Card>
  );
}
