/* ============================================================
   /finance/fee-items — the tenant's fee-item catalogue (server component)

   Reads the whole managed catalogue from NestJS `/finance/fee-items`. It is a
   small set, so no server-driven paging here — the client renders it directly
   and re-fetches (router.refresh) after add/edit. `canManage` comes off the
   session so the write controls only render for a `finance.manage` holder; the
   API enforces it authoritatively.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { FeeItemsClient, type FeeItem } from './fee-items-client';

interface ApiFeeItem {
  id: string;
  code: string;
  name: string;
  defaultAmount?: number | null;
  active: boolean;
}

export default async function FeeItemsPage() {
  const [items, session] = await Promise.all([
    serverApiGet<ApiFeeItem[]>('/finance/fee-items'),
    getSession(),
  ]);

  const rows: FeeItem[] = (items ?? []).map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    defaultAmount: item.defaultAmount ?? null,
    active: item.active,
  }));

  const canManage =
    session?.permissions.includes('finance.manage' as never) ?? false;

  return <FeeItemsClient items={rows} canManage={canManage} />;
}
