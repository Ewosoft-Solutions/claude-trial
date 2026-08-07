/* ============================================================
   /library/loans — books on loan (server component)

   Books currently checked out, with borrower, due date, and an
   overdue flag. Data comes from the NestJS GET /library/loans view;
   search / filters / sort / paging run client-side in LoansClient
   (the endpoint returns the full set, so nothing is hidden).
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';

import { LoansClient, type Loan } from './loans-client';

export default async function LibraryLoansPage() {
  const loans = (await serverApiGet<Loan[]>('/library/loans')) ?? [];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Loans"
          description="Books currently on loan, soonest due first."
        />
        <LoansClient loans={loans} />
      </div>
    </ShellMain>
  );
}
