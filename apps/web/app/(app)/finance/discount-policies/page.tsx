/* ============================================================
   /finance/discount-policies — discount policies (server component)

   Reusable discount rules (sibling discount, staff scholarship, …) that
   auto-apply to invoices at issue. Creating one is a request; a *different*
   authority activates it (maker-checker). Reads the tenant's policies + the
   fee-item catalogue (for the optional per-item target). `canManage` gates the
   create/activate controls; the API enforces both.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import {
  DiscountPoliciesClient,
  type ApiPolicy,
  type CatalogueItem,
} from './discount-policies-client';

interface ApiFeeItem {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export default async function DiscountPoliciesPage() {
  const [policies, feeItems, session] = await Promise.all([
    serverApiGet<ApiPolicy[]>('/finance/discount-policies'),
    serverApiGet<ApiFeeItem[]>('/finance/fee-items'),
    getSession(),
  ]);

  const catalogue: CatalogueItem[] = (feeItems ?? [])
    .filter((item) => item.active)
    .map((item) => ({ id: item.id, code: item.code, name: item.name }));

  const canManage =
    session?.permissions.includes('finance.manage' as never) ?? false;

  return (
    <DiscountPoliciesClient
      policies={policies ?? []}
      catalogue={catalogue}
      canManage={canManage}
    />
  );
}
