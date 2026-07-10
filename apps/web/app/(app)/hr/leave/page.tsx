/* ============================================================
   /hr/leave — staff leave requests (server component)

   Leave requests with their approval state. Data comes from the
   NestJS GET /hr/leave view.
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

interface LeaveRequest {
  id: string;
  staffName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason: string | null;
}

const STATUS_TONE: Record<string, StateTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  cancelled: 'neutral',
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export default async function HrLeavePage() {
  const leave = (await serverApiGet<LeaveRequest[]>('/hr/leave')) ?? [];
  const pending = leave.filter((l) => l.status === 'pending').length;

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Leave"
          description="Staff leave requests and their approval state."
        />
        <DataCard
          title="Leave requests"
          count={leave.length}
          unit="request"
          description={`${leave.length} request${leave.length === 1 ? '' : 's'} · ${pending} pending`}
        >
          {leave.length === 0 ? (
            <EmptyState
              compact
              title="No leave requests"
              description="Staff leave requests appear here for review and approval."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Staff</TableHead>
                  <TableHead className="max-sm:hidden">Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right max-md:hidden">Days</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leave.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-6 font-medium">{l.staffName}</TableCell>
                    <TableCell className="capitalize text-muted-foreground max-sm:hidden">
                      {l.leaveType}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatDate(l.startDate)} – {formatDate(l.endDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-md:hidden">
                      {l.days}
                    </TableCell>
                    <TableCell className="pr-6">
                      <StatusBadge tone={STATUS_TONE[l.status] ?? 'neutral'} dot>
                        {l.status}
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
