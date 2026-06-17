/* ============================================================
   SchoolWithEase — Layout-pattern contracts (Phase 1 / M6)

   Typed data shapes consumed by the reusable layout patterns
   (DashboardLayout, ListDetailLayout, DataTableLayout, FormLayout,
   SettingsLayout) and their building blocks (StatGrid, SettingsNav).
   Patterns are composition scaffolds: they hold no product copy and
   compose existing primitives + the M3 shell / M5 state components.
   The preview surface supplies the data.
   ============================================================ */

import type * as React from 'react';

/** Direction of a stat's trend delta, driving colour + icon. */
export type StatTrend = 'up' | 'down' | 'flat';

/** A change indicator shown beneath a stat value. */
export interface StatDelta {
  /** Display text, e.g. "+3%" or "12 fewer". */
  label: string;
  /** Trend direction. `up` is not assumed positive — see `intent`. */
  direction: StatTrend;
  /**
   * Whether this movement is good or bad for the metric (attendance up =
   * positive; outstanding fees up = negative). Defaults to neutral colour.
   */
  intent?: 'positive' | 'negative' | 'neutral';
}

/** A single KPI/metric tile in a StatGrid. */
export interface StatItem {
  key: string;
  /** Metric name, e.g. "Total students". */
  label: string;
  /** Primary value, e.g. "1,420" or "₦3.1M". */
  value: React.ReactNode;
  /** Optional trend delta. */
  delta?: StatDelta;
  /** Optional leading icon. */
  icon?: React.ReactNode;
  /** Optional secondary line beneath the value. */
  hint?: string;
  /** Make the whole tile a link. */
  href?: string;
  /** Make the whole tile a button (alternative to `href`). */
  onSelect?: () => void;
}

/** A destination in the SettingsLayout section nav. */
export interface SettingsNavItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  /** Optional short description shown beneath the label. */
  description?: string;
  href?: string;
  active?: boolean;
  onSelect?: () => void;
}
