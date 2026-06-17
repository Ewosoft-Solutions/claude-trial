/* ============================================================
   SchoolWithEase — State & feedback contracts (Phase 1 / M5)

   Typed data shapes for the reusable page/section state
   components (StateView and its presets, LoadingState, the
   skeleton patterns, NoticeBanner, ValidationSummary). These
   components are data-driven: no product copy lives inside them
   (titles, descriptions and action labels are always supplied
   by the consumer). The preview surface provides example copy.
   ============================================================ */

import type * as React from 'react';

/**
 * Semantic tone for a state surface. Maps onto the shared status
 * tokens (success / warning / info / destructive) plus a neutral
 * default. Affects only colour, never layout.
 */
export type StateTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'destructive';

/**
 * Button styling for a state action. Mirrors the shared Button
 * variant names so a `StateAction` maps straight onto <Button>.
 */
export type StateActionVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'link';

/**
 * A single call-to-action rendered inside a state. Supply either
 * `href` (renders a link) or `onClick` (renders a button); both is
 * allowed (link that also fires a handler).
 */
export interface StateAction {
  /** Visible label — always consumer-supplied (no embedded copy). */
  label: string;
  /** Navigate on activation. */
  href?: string;
  /** Handle activation (e.g. retry, refresh). */
  onClick?: () => void;
  /** Optional leading icon. */
  icon?: React.ReactNode;
  /** Button styling; defaults are tone/role appropriate. */
  variant?: StateActionVariant;
  /** Disable the action (e.g. while a retry is in flight). */
  disabled?: boolean;
  /** Accessible label when `label` alone is not descriptive. */
  ariaLabel?: string;
}

/**
 * A single field-level problem surfaced in a ValidationSummary.
 * `fieldId` should match the offending control's `id` so the
 * summary can link focus to it.
 */
export interface ValidationItem {
  /** Stable key for React lists. */
  key: string;
  /** Human-readable message describing the problem. */
  message: string;
  /** `id` of the control this message refers to (enables focus link). */
  fieldId?: string;
}
