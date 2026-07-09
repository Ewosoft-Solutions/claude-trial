/* ============================================================
   /hr/directory — staff directory (server component)

   One row per distinct staff member seen in payroll, with their
   latest role snapshot and pay period. Data comes from the NestJS
   GET /hr/directory view (derived from payroll — the roster of paid
   staff, since there is no dedicated employee table).
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
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

interface StaffMember {
  staffUserTenantId: string;
  staffName: string;
  role: string | null;
  latestPayPeriod: string;
  latestStatus: string;
  recordCount: number;
}

const STATUS_TONE: Record<string, StateTone> = {
  paid: 'success',
  approved: 'info',
  draft: 'neutral',
};

export default async function HrDirectoryPage() {
  const staff = (await serverApiGet<StaffMember[]>('/hr/directory')) ?? [];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Directory"
          description="Staff on the payroll roster, with their latest role and pay period."
        />
        <DataCard title="Staff" count={staff.length} unit="staff member">
          {staff.length === 0 ? (
            <EmptyState
              compact
              title="No staff on record"
              description="Staff appear here once payroll records exist for them."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead className="max-sm:hidden">Role</TableHead>
                  <TableHead>Latest period</TableHead>
                  <TableHead className="text-right max-md:hidden">Records</TableHead>
                  <TableHead className="pr-6">Latest status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={s.staffUserTenantId}>
                    <TableCell className="pl-6 font-medium">{s.staffName}</TableCell>
                    <TableCell className="text-muted-foreground max-sm:hidden">
                      {s.role ?? '—'}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {s.latestPayPeriod}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-md:hidden">
                      {s.recordCount}
                    </TableCell>
                    <TableCell className="pr-6">
                      <StatusBadge tone={STATUS_TONE[s.latestStatus] ?? 'neutral'} dot>
                        {s.latestStatus}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataCard>
      </div>
    </ShellMain>
  );
}
