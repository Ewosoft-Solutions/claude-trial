/* ============================================================
   /settings/roles — roles & permissions

   A read-through of the school's roles (members, scope, clearance).
   Mirrors the RBAC vocabulary the nav model authorises against
   (clearance levels, scope). Mock rows; editing lands with the API.
   ============================================================ */

import { Plus } from 'lucide-react';

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

interface Role {
  key: string;
  name: string;
  description: string;
  members: number;
  clearance: number;
  custom: boolean;
}

const ROLES: Role[] = [
  { key: 'owner', name: 'Owner', description: 'Full control of the school', members: 2, clearance: 8, custom: false },
  { key: 'principal', name: 'Principal', description: 'School-wide management', members: 1, clearance: 7, custom: false },
  { key: 'bursar', name: 'Bursar', description: 'Finance & billing', members: 2, clearance: 5, custom: false },
  { key: 'registrar', name: 'Registrar', description: 'Admissions & records', members: 3, clearance: 4, custom: false },
  { key: 'teacher', name: 'Teacher', description: 'Classes, attendance & grades', members: 48, clearance: 3, custom: false },
  { key: 'form-tutor', name: 'Form tutor', description: 'Custom: class teacher + pastoral', members: 12, clearance: 3, custom: true },
];

function clearanceTone(level: number): StateTone {
  if (level >= 7) return 'destructive';
  if (level >= 5) return 'warning';
  if (level >= 3) return 'info';
  return 'neutral';
}

export default function RolesSettingsPage() {
  return (
    <Card className="shadow-card">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base">Roles</CardTitle>
          <CardDescription>
            {ROLES.length} roles · clearance governs what each can reach.
          </CardDescription>
        </div>
        <Button size="sm">
          <Plus /> Add role
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Role</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="pr-6 text-right">Clearance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROLES.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="pl-6">
                  <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {r.name}
                      {r.custom ? (
                        <StatusBadge tone="info">Custom</StatusBadge>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.description}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {r.members}
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <StatusBadge tone={clearanceTone(r.clearance)} dot>
                    Level {r.clearance}
                  </StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
