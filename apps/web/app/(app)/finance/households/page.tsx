/* ============================================================
   /finance/households — billing households (server component)

   The durable family accounts invoices attach to. Lists each household with its
   current member + payer counts. Auto-derive builds them from shared
   primary/billing-guardian clusters; operators also create/merge by hand.
   `canManage` gates the write controls; the API enforces finance.manage.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { HouseholdsClient, type ApiHousehold } from './households-client';

export default async function HouseholdsPage() {
  const [households, session] = await Promise.all([
    serverApiGet<ApiHousehold[]>('/finance/households'),
    getSession(),
  ]);

  const canManage =
    session?.permissions.includes('finance.manage' as never) ?? false;

  return (
    <HouseholdsClient households={households ?? []} canManage={canManage} />
  );
}
