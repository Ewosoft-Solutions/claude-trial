'use client';

import useSWR from 'swr';

import { isAbortError } from '@/lib/swr-abort';

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

  // An aborted read is NOT a failure the reader should see. `abortOnUnmount`
  // cancels the in-flight request whenever a newer one supersedes it or the
  // component unmounts — which a React StrictMode double-mount and a
  // revalidate-on-focus both do routinely — and SWR surfaces that rejection as
  // an ordinary error. Rendered, it reads as "signal is aborted without
  // reason" on the dashboard. SWR retries straight after, so the honest state
  // while that happens is still LOADING, not failed.
  const aborted = isAbortError(error);

  return {
    stats: data ?? null,
    loading: isLoading || (aborted && !data),
    error:
      !error || aborted
        ? null
        : error instanceof Error
          ? error.message
          : 'Error',
    refreshing: isValidating,
    refresh: () => {
      void mutate();
    },
  };
}

/** Money + count formatters live in one place (always full, never abbreviated);
 *  re-exported here so the many dashboards importing from this module keep
 *  working. See @/lib/format. */
export { formatNaira, formatCount } from '@/lib/format';
