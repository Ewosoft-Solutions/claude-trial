'use client';

import { useEffect, useState } from 'react';

/** Shape returned by GET /api/overview (-> NestJS /overview/stats). */
export interface OverviewStats {
  school: {
    students: number;
    staff: number;
    classes: number;
    upcomingEvents: number;
    admissionsPending: number;
    announcements: number;
    pendingInvitations: number;
    attendanceRate: number | null;
    finance: {
      revenueThisMonth: number; // minor units (kobo)
      outstandingAmount: number; // minor units (kobo)
      outstandingInvoices: number;
    };
  };
  personal: {
    myClasses: number;
    myChildren: number;
    myEnrollments: number;
  };
}

interface State {
  stats: OverviewStats | null;
  loading: boolean;
  error: string | null;
}

/** Fetch the signed-in viewer's real, tenant-scoped dashboard stats. */
export function useOverviewStats(): State {
  const [state, setState] = useState<State>({
    stats: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    fetch('/api/overview')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error || 'Failed to load stats');
        return body as OverviewStats;
      })
      .then((stats) => active && setState({ stats, loading: false, error: null }))
      .catch(
        (err) =>
          active &&
          setState({
            stats: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Error',
          }),
      );
    return () => {
      active = false;
    };
  }, []);

  return state;
}

/** Format kobo (minor units) as a compact Naira amount, e.g. ₦12.4M, ₦3.1k. */
export function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`;
  if (naira >= 1_000) return `₦${(naira / 1_000).toFixed(1)}k`;
  return `₦${naira.toFixed(0)}`;
}

/** Compact integer, e.g. 1,420. */
export function formatCount(n: number): string {
  return n.toLocaleString();
}
