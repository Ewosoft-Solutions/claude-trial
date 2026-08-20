'use client';

/* ============================================================
   useNavCounts — live, tenant-scoped counts for the sidebar

   Maps the lean figures served by GET /api/nav/counts onto nav
   destination hrefs, so `resolveNavigation` can badge the leaves
   (and roll them up onto their parent sections). Only the actionable
   numbers are surfaced — pending admissions, outstanding invoices,
   pending user invitations, and discounts awaiting approval.

   This is a purpose-built counts endpoint, not the dashboard
   aggregate: a handful of cheap tenant-scoped COUNTs, so the badges
   (which load on every page) don't cost a full /overview roll-up.
   Which badge a given viewer actually sees is still gated by
   `resolveNavigation`. Platform-scoped viewers have no tenant counts.
   ============================================================ */

import * as React from 'react';
import useSWR from 'swr';

import type { ViewerContext } from '@workspace/ui/types/access.types';
import type { NavCounts } from '@workspace/ui/types/navigation.types';

/** The GET /api/nav/counts payload (all fields optional so a partial/failed
 *  response degrades to "no badges" rather than throwing). */
interface NavCountsResponse {
  admissionsPending?: number;
  outstandingInvoices?: number;
  pendingInvitations?: number;
  pendingAdjustments?: number;
}

export function useNavCounts(viewer: ViewerContext): NavCounts {
  // Only school-scoped viewers have these tenant counts; a null SWR key
  // disables the request entirely for platform scope.
  const enabled = viewer.scope === 'school';
  const { data } = useSWR<NavCountsResponse>(
    enabled ? '/api/nav/counts' : null,
  );

  return React.useMemo(() => {
    if (!data) return {};

    const counts: NavCounts = {};
    const admissions = data.admissionsPending ?? 0;
    const invoices = data.outstandingInvoices ?? 0;
    const invitations = data.pendingInvitations ?? 0;
    const approvals = data.pendingAdjustments ?? 0;

    if (admissions > 0) counts['/students/admissions'] = admissions;
    if (invoices > 0) counts['/finance/invoices'] = invoices;
    if (invitations > 0) counts['/settings/users'] = invitations;
    if (approvals > 0) counts['/finance/approvals'] = approvals;
    return counts;
  }, [data]);
}
