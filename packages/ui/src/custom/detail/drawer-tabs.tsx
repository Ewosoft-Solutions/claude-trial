'use client';

/* ============================================================
   DrawerTabs — the folder-tab strip a detail drawer switches on

   The header rule stops being a straight line under the tabs and
   becomes the active tab's own outline: it runs along, sweeps up into
   the tab's side, over the crown, and back down the other side.

   The joins speak the SAME curve as FlyoutContour, the shape that
   anchors a flyout to the collapsed sidebar rail — a cubic Bézier, not
   a circular arc, flaring wide across a shallow rise. The easing ratios
   are imported from there rather than copied, so the two cannot drift.
   `border-radius` cannot express this curve, which is why each join is
   an SVG.

   Three details are load-bearing, and each was a bug first:

     · The RULE is painted as the scroll container's background — a 1px
       linear-gradient at its bottom edge — not a border, so the active
       tab (a descendant, painted above it) interrupts it just by being
       opaque, with no negative margins fighting the scroller.

     · Nothing is drawn TWICE. `--border` is translucent, so anywhere two
       of the three mechanisms that draw this line overlap they composite
       (0.1 over 0.1 reads as 0.19, about double weight) and the join
       looks retraced. The masks in TabJoin clear the rule's row and the
       tab border's column so the curve draws the line exactly once and
       hands back cleanly at each end.

     · Half-pixel alignment. A 1px stroke on an integer coordinate
       straddles two pixel columns at ~50% each: soft, a shade light, and
       landing on the border's outer edge rather than its centre, which
       reads as the tab's verticals leaning. Everything terminates on a
       centre line.

   LAYOUT CONTRACT: the strip bleeds to the drawer's edges with `-mx-5`,
   so it expects a header padded `px-5`. The scroll inset lives INSIDE
   the scrollable content because the joins are absolutely positioned and
   add nothing to scrollWidth — without it, the first and last tab's join
   is sheared off the moment the strip scrolls.
   ============================================================ */

import * as React from 'react';

import {
  CURVE_EASE_ACROSS,
  CURVE_EASE_ALONG,
} from '@workspace/ui/custom/shell/flyout-contour';
import { cn } from '@workspace/ui/lib/utils';

/** How far each join flares sideways from the tab. */
export const TAB_JOIN_REACH = 16;
/** How far it rises from the rule before the tab's side goes vertical. */
export const TAB_JOIN_DEPTH = 11;

function TabJoin({ side }: { side: 'left' | 'right' }) {
  const w = TAB_JOIN_REACH;
  const h = TAB_JOIN_DEPTH;
  // Centre lines: the tab's side border occupies [w-1, w] and the rule the
  // bottom pixel, so their centres — where a 1px stroke must land to stay
  // crisp — are half a pixel in from each.
  const bx = w - 0.5;
  const by = h - 0.5;
  const curve = `M 0 ${by} C ${bx * CURVE_EASE_ALONG} ${by} ${bx} ${h * CURVE_EASE_ACROSS} ${bx} 0`;
  const flare = `M 0 ${h} C ${bx * CURVE_EASE_ALONG} ${h} ${bx} ${h * CURVE_EASE_ACROSS} ${bx} 0 H ${w} V ${h} Z`;

  return (
    <svg
      aria-hidden
      focusable="false"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={cn(
        'pointer-events-none absolute bottom-0',
        side === 'left' ? '-left-4' : '-right-4 -scale-x-100',
      )}
    >
      {/* erase the rule across the whole join … */}
      <rect x={0} y={h - 1} width={w} height={1} fill="var(--background)" />
      {/* … and the tab border's last `h` pixels, so the curve alone draws
          this corner before handing back to the border at y=0 */}
      <rect x={w - 1} y={0} width={1} height={h} fill="var(--background)" />
      {/* the flare, filled with the CONTENT ground so the tab reads as
          attached to the panel below rather than to the chrome behind it */}
      <path d={flare} fill="var(--background)" />
      <path
        d={curve}
        fill="none"
        stroke="var(--border)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export interface DrawerTabsProps<TTab extends string> {
  tabs: readonly TTab[];
  /** The active tab. */
  value: TTab;
  onChange: (tab: TTab) => void;
  /** Visible label for a tab. */
  label: (tab: TTab) => React.ReactNode;
  /** Accessible name for the strip, e.g. "Person detail sections". */
  ariaLabel?: string;
  className?: string;
}

export function DrawerTabs<TTab extends string>({
  tabs,
  value,
  onChange,
  label,
  ariaLabel,
  className,
}: DrawerTabsProps<TTab>) {
  if (tabs.length < 2) return null;
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        '-mx-5 overflow-x-auto bg-[linear-gradient(to_top,var(--border)_0_1px,transparent_1px)] px-1',
        className,
      )}
    >
      <div className="flex w-max items-end gap-3 px-4">
        {tabs.map((t) => {
          const active = t === value;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              // The selection is carried by SHAPE now, so it needs a
              // programmatic counterpart or it exists for sighted users only.
              aria-current={active || undefined}
              className={cn(
                'relative shrink-0 rounded-t-[10px] border border-b-0 border-transparent px-3 pb-2 pt-2 text-[calc(13px*var(--font-scale))] transition-colors',
                active
                  ? 'z-10 border-border bg-background font-semibold text-foreground'
                  : 'font-medium text-muted-foreground hover:text-foreground',
              )}
            >
              {active ? (
                <>
                  <TabJoin side="left" />
                  <TabJoin side="right" />
                </>
              ) : null}
              {label(t)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
