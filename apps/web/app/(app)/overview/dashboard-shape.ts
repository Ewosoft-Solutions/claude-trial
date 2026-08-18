/* ============================================================
   Dashboard shape — ONE description of what each persona's overview
   actually contains, so its loading skeleton matches it.

   /overview renders a different dashboard per persona, and those
   dashboards genuinely differ in shape: an owner gets six stat tiles and
   two aside cards, a parent gets three tiles (one wide, for money) and
   one. A single generic skeleton therefore mis-describes every persona
   but one, and the layout jumps when the real content lands.

   Both skeleton paths read from here:
     · `loading.tsx` — the ROUTE fallback, shown on a hard load/refresh
       while the server streams. Server-side, so it resolves the persona
       from the session.
     · each dashboard's own `loading` branch — shown on a CLIENT
       navigation, where the route fallback never runs because the page
       is already mounted and only SWR is still fetching.

   Keeping both on this table is what stops the two from drifting apart,
   and `dashboardKindFor` is the same routing rule `page.tsx` uses, so the
   skeleton can never describe a different dashboard than the one that
   follows it.
   ============================================================ */

export type DashboardKind =
  | 'platform'
  | 'admin'
  | 'it'
  | 'finance'
  | 'operations'
  | 'teacher'
  | 'parent'
  | 'student';

export interface DashboardShape {
  /** Stat tiles across the top. */
  stats: number;
  /** Which tiles hold a long value (money) and take a wider cell. */
  wideStats?: boolean[];
  /** Cards in the main column. */
  mainCards: number;
  /** Cards in the aside column (Quick actions counts as one). */
  asideCards: number;
}

/**
 * Counted against each dashboard's own `STATS` array and its `aside` slot.
 * When a dashboard gains or loses a tile or a card, update it here — the
 * skeleton is only worth having while it still resembles the page.
 */
export const DASHBOARD_SHAPES: Record<DashboardKind, DashboardShape> = {
  platform: { stats: 4, mainCards: 2, asideCards: 2 },
  admin: {
    stats: 6,
    // revenue + outstanding are ₦ values
    wideStats: [false, false, true, true, false, false],
    mainCards: 1,
    asideCards: 2,
  },
  it: { stats: 4, mainCards: 1, asideCards: 1 },
  finance: {
    stats: 4,
    // collected + outstanding are ₦ values
    wideStats: [true, true, false, false],
    mainCards: 1,
    asideCards: 1,
  },
  operations: { stats: 3, mainCards: 1, asideCards: 1 },
  teacher: { stats: 4, mainCards: 1, asideCards: 1 },
  parent: {
    stats: 3,
    // fee balance is a ₦ value
    wideStats: [false, false, true],
    mainCards: 1,
    asideCards: 1,
  },
  student: { stats: 3, mainCards: 1, asideCards: 1 },
};

/**
 * Which dashboard a viewer lands on. Scope outranks clearance: a platform
 * operator gets the platform overview, not a school one (they have no active
 * school, so a school dashboard would have nothing to show).
 *
 * Mirrors the routing in `page.tsx`, which calls this so the two cannot drift.
 */
export function dashboardKindFor(
  scope: string | undefined,
  clearanceLevel: number,
): DashboardKind {
  if (scope === 'platform') return 'platform';
  if (clearanceLevel >= 7) return 'admin';
  if (clearanceLevel === 6) return 'it';
  if (clearanceLevel === 5) return 'finance';
  if (clearanceLevel === 4) return 'operations';
  if (clearanceLevel === 3) return 'teacher';
  if (clearanceLevel === 2) return 'parent';
  // L0–L1: student or guest
  return 'student';
}
