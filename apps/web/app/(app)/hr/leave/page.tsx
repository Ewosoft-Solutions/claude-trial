/* ============================================================
   /hr/leave — staff leave requests (server component)

   Leave requests with their approval state. Data comes from the
   NestJS GET /hr/leave view; search / filters / sort / paging run
   client-side in LeaveClient.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';

import { LeaveClient, type LeaveRequest } from './leave-client';

export default async function HrLeavePage() {
  const leave = (await serverApiGet<LeaveRequest[]>('/hr/leave')) ?? [];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Leave"
          description="Staff leave requests and their approval state."
        />
        <LeaveClient leave={leave} />
      </div>
    </ShellMain>
  );
}
