/* ============================================================
   /hr/directory — staff directory (server component)

   One row per distinct staff member seen in payroll, with their
   latest role snapshot and pay period. Data comes from the NestJS
   GET /hr/directory view (derived from payroll — the roster of paid
   staff, since there is no dedicated employee table). Search / filters /
   sort / paging run client-side in StaffDirectoryClient.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';

import { StaffDirectoryClient, type StaffMember } from './directory-client';

export default async function HrDirectoryPage() {
  const staff = (await serverApiGet<StaffMember[]>('/hr/directory')) ?? [];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Directory"
          description="Staff on the payroll roster, with their latest role and pay period."
        />
        <StaffDirectoryClient staff={staff} />
      </div>
    </ShellMain>
  );
}
