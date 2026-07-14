'use client';

import useSWR from 'swr';

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

interface OverviewStatsResult {
  stats: OverviewStats | null;
  loading: boolean;
  error: string | null;
  /** True while a (re)fetch is in flight — drives a Refresh control's spinner. */
  refreshing: boolean;
  /** Re-fetch on demand (e.g. a "Refresh" control). */
  refresh: () => void;
}

/**
 * Fetch the signed-in viewer's real, tenant-scoped dashboard stats.
 *
 * Backed by SWR (see SwrProvider): the data revalidates automatically when the
 * user refocuses the app or reconnects, so a long-lived PWA session doesn't
 * show stale KPIs. `loading` is the first-load state only — background
 * revalidations keep the previous data on screen rather than flashing a
 * skeleton.
 */
export function useOverviewStats(): OverviewStatsResult {
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<OverviewStats>('/api/overview');

  return {
    stats: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error.message : error ? 'Error' : null,
    refreshing: isValidating,
    refresh: () => {
      void mutate();
    },
  };
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
