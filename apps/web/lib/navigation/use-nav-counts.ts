'use client';

/* ============================================================
   useNavCounts — live, tenant-scoped counts for the sidebar

   Maps the real figures already served by GET /api/overview onto
   nav destination hrefs, so `resolveNavigation` can badge the
   leaves (and roll them up onto their parent sections). Only the
   actionable numbers are surfaced — pending admissions, outstanding
   invoices, and pending user invitations.

   Shares the '/api/overview' SWR cache key with the dashboard, so
   this adds no extra request when the overview page is open and at
   most one lightweight, focus-revalidated request elsewhere.
   Platform-scoped viewers have no tenant counts.
   ============================================================ */

import * as React from 'react';
import useSWR from 'swr';

import type { ViewerContext } from '@workspace/ui/types/access.types';
import type { NavCounts } from '@workspace/ui/types/navigation.types';

/** The slice of the overview payload this hook reads (all fields optional so a
 *  partial/failed response degrades to "no badges" rather than throwing). */
interface OverviewCountsResponse {
  school?: {
    admissionsPending?: number;
    pendingInvitations?: number;
    finance?: { outstandingInvoices?: number };
  };
}

export function useNavCounts(viewer: ViewerContext): NavCounts {
  // Only school-scoped viewers have these tenant counts; a null SWR key
  // disables the request entirely for platform scope.
  const enabled = viewer.scope === 'school';
  const { data } = useSWR<OverviewCountsResponse>(
    enabled ? '/api/overview' : null,
  );

  return React.useMemo(() => {
    const school = data?.school;
    if (!school) return {};

    const counts: NavCounts = {};
    const admissions = school.admissionsPending ?? 0;
    const invoices = school.finance?.outstandingInvoices ?? 0;
    const invitations = school.pendingInvitations ?? 0;

    if (admissions > 0) counts['/students/admissions'] = admissions;
    if (invoices > 0) counts['/finance/invoices'] = invoices;
    if (invitations > 0) counts['/settings/users'] = invitations;
    return counts;
  }, [data]);
}
