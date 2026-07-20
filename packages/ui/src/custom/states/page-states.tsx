'use client';

/* ============================================================
   Page / section states — EmptyState · ErrorState · ForbiddenState

   Thin presets over StateView (state-view.tsx) that fix the tone,
   a sensible default decorative icon, and the accessibility role
   for each situation. All copy stays consumer-supplied. Pass
   `icon={null}` to drop the medallion, or override `icon` / `tone`
   for a bespoke variant.

   ForbiddenState pairs with the M4 navigation model: access
   filtering hides nav the viewer can't reach, while ForbiddenState
   covers the direct / deep-link case where the route is opened
   anyway. It does not enforce anything — real authorization stays
   server-side.
   ============================================================ */

import * as React from 'react';
import { Inbox, ShieldX, TriangleAlert } from 'lucide-react';

import {
  StateView,
  type StateViewProps,
} from '@workspace/ui/custom/states/state-view';

/** Shared props for the presets — `tone` keeps its preset default. */
export type StatePresetProps = StateViewProps;

/**
 * Empty state — a surface that has loaded successfully but has no
 * content yet (no records, no results, nothing created). Neutral tone.
 */
export function EmptyState({
  icon = <Inbox aria-hidden />,
  tone = 'neutral',
  ...props
}: StatePresetProps) {
  return <StateView icon={icon} tone={tone} {...props} />;
}

/**
 * Error state — something failed to load or an action errored.
 * Destructive tone, `role="alert"` so it is announced when it
 * appears. Pair `primaryAction` with a retry handler.
 */
export function ErrorState({
  icon = <TriangleAlert aria-hidden />,
  tone = 'destructive',
  role = 'alert',
  ...props
}: StatePresetProps) {
  return <StateView icon={icon} tone={tone} role={role} {...props} />;
}

/**
 * Forbidden state — the viewer reached a route they are not
 * permitted to see (deep link / direct navigation). Warning tone.
 * Offer a way back rather than a retry.
 */
export function ForbiddenState({
  icon = <ShieldX aria-hidden />,
  tone = 'warning',
  ...props
}: StatePresetProps) {
  return <StateView icon={icon} tone={tone} {...props} />;
}
