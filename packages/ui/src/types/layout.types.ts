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
  /** Primary value, e.g. "1,420" or "₦1,234,567.00". */
  value: React.ReactNode;
  /**
   * The value can be long — e.g. a full money amount. Gives this tile a
   * full-width cell on narrow screens (money 1-up, short values 2-up flowing
   * around it) instead of clipping. Deterministic per item, so the skeleton
   * mirrors the exact same spans. See StatGrid / statGridClass.
   */
  wide?: boolean;
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
  /**
   * Mark this tile as the current selection (for interactive tiles used as a
   * selector, e.g. the People directory type cards). Adds a highlight ring +
   * `aria-current`.
   */
  active?: boolean;
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
