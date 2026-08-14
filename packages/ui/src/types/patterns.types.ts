/* ============================================================
   SchoolWithEase — Workspace pattern contracts (F8)

   Typed data shapes for the reusable Aurora workspace shells:
   Workbench (context-bar + tabs), Lifecycle (status views),
   Policy (versioned config: clone / compare / activate) and
   Approval (maker-checker surface). Like the state components,
   these are data-driven and presentational — no product copy
   lives inside them; the consumer supplies every label.
   ============================================================ */

import type * as React from 'react';
import type { StateTone } from './states.types';

// ---- Workbench --------------------------------------------------------

/** One tab in a workbench's section strip. */
export interface WorkbenchTab {
  key: string;
  label: string;
  /** Optional trailing count, rendered as a `CountBadge`. */
  badge?: string | number;
  /** Optional leading icon. */
  icon?: React.ReactNode;
  disabled?: boolean;
}

// ---- Lifecycle --------------------------------------------------------

/** Position of a step in a record's lifecycle. */
export type LifecycleState = 'done' | 'current' | 'upcoming' | 'skipped';

/** One state in an ordered lifecycle (e.g. draft → approved → active). */
export interface LifecycleStep {
  key: string;
  label: string;
  description?: string;
  /** Position; drives the default icon + tone when `tone` is omitted. */
  state?: LifecycleState;
  /** Override the derived tone (e.g. force `warning` on an amended state). */
  tone?: StateTone;
}

// ---- Policy (versioned config) ---------------------------------------

/** A single version of a versioned config (a curriculum version, a role
    policy, a fee schedule, …). */
export interface PolicyVersion {
  id: string;
  label: string;
  /** Freeform sub-label, e.g. an approval state. */
  status?: string;
  tone?: StateTone;
  isActive?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  /** Provenance line, e.g. "by Ada · 2 Aug". */
  meta?: string;
}

/** One field in a before/after comparison between two versions. */
export interface PolicyCompareRow {
  key: string;
  label: string;
  before?: React.ReactNode;
  after?: React.ReactNode;
  /** Highlight as changed (also flagged non-visually for assistive tech). */
  changed?: boolean;
}

// ---- Approval (maker-checker) ----------------------------------------

/** Header/meta for a maker-checker request. */
export interface ApprovalRequestMeta {
  title: string;
  requestedBy: string;
  requestedAt?: string;
  reason?: string;
  /** Risk tone for the header badge (defaults to `warning`). */
  riskTone?: StateTone;
  riskLabel?: string;
}

/** One field the request would change, shown as before → after. */
export interface ApprovalField {
  key: string;
  label: string;
  before?: React.ReactNode;
  after?: React.ReactNode;
}
