/* ============================================================
   Folder tabs — the shape, and the one strip that needs no JS

   NO `'use client'` HERE, deliberately. A strip of tab LINKS is static
   markup: no state, no handlers, nothing to hydrate. Keeping it out of
   the client graph means a server component can render it directly and
   hand it plain functions (`href`, `label`) — pass those across a
   client boundary instead and React refuses to serialise them, which is
   exactly the error this split fixes. The interactive strips live in
   `folder-tabs`, which is `'use client'` and builds on this file.

   THE SHAPE. The rule under a tab strip stops being a straight line and
   becomes the active tab's own outline: it runs along, sweeps up into
   the tab's side, over the crown, and back down the other side.

   The joins speak the SAME curve as FlyoutContour, the shape that
   anchors a flyout to the collapsed sidebar rail — a cubic Bézier, not
   a circular arc, flaring wide across a shallow rise. Both scale the one
   pair of easing ratios in `lib/curve` rather than copying them, so the
   two cannot drift. `border-radius` cannot express this curve, which is
   why each join is an SVG.

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

   GROUND. A tab reads as attached to the panel below it, so its fill and
   its joins must be painted in whatever colour that panel is. That ground
   travels as `--tab-ground`, set once on the strip: page-level strips
   leave it at `--background`, a strip inside a Card sets `--card`. Get it
   wrong and the tab looks like a sticker laid over the panel rather than
   part of it.
   ============================================================ */

import * as React from 'react';

import { CURVE_EASE_ACROSS, CURVE_EASE_ALONG } from '@workspace/ui/lib/curve';
import { cn } from '@workspace/ui/lib/utils';

/** How far each join flares sideways from the tab. */
export const TAB_JOIN_REACH = 16;
/** How far it rises from the rule before the tab's side goes vertical. */
export const TAB_JOIN_DEPTH = 11;

/** The panel colour a strip sits on, and so what its tabs are filled with. */
export type TabGround = 'background' | 'card' | 'sidebar';

export const GROUND_VAR: Record<TabGround, string> = {
  background: 'var(--background)',
  card: 'var(--card)',
  sidebar: 'var(--sidebar)',
};

/** Resolved ground, with the fallback that keeps a bare TabJoin usable. */
const GROUND = 'var(--tab-ground,var(--background))';

export function TabJoin({
  side,
  className,
}: {
  side: 'left' | 'right';
  className?: string;
}) {
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
        className,
      )}
    >
      {/* erase the rule across the whole join … */}
      <rect x={0} y={h - 1} width={w} height={1} fill={GROUND} />
      {/* … and the tab border's last `h` pixels, so the curve alone draws
          this corner before handing back to the border at y=0 */}
      <rect x={w - 1} y={0} width={1} height={h} fill={GROUND} />
      {/* the flare, filled with the CONTENT ground so the tab reads as
          attached to the panel below rather than to the chrome behind it */}
      <path d={flare} fill={GROUND} />
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

/**
 * Shared trigger chrome. `active` is a boolean for the link/button strips,
 * which know their own state; the Radix trigger passes `'data'` instead and
 * lets `data-[state=active]` do the selecting, since Radix owns that state.
 */
export function tabClass(active: boolean | 'data') {
  const base =
    'group relative shrink-0 rounded-t-[10px] border border-b-0 border-transparent px-3 pb-2 pt-2 text-[calc(13px*var(--font-scale))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';
  if (active === 'data') {
    return cn(
      base,
      'font-medium text-muted-foreground hover:text-foreground',
      'data-[state=active]:z-10 data-[state=active]:border-border data-[state=active]:bg-[var(--tab-ground,var(--background))] data-[state=active]:font-semibold data-[state=active]:text-foreground',
    );
  }
  return cn(
    base,
    active
      ? 'z-10 border-border bg-[var(--tab-ground,var(--background))] font-semibold text-foreground'
      : 'font-medium text-muted-foreground hover:text-foreground',
  );
}

export interface FolderTabStripProps extends React.ComponentProps<'div'> {
  /**
   * Bleed the strip past its container's horizontal padding, so the rule
   * reaches the panel's edges. `5` matches a drawer header's `px-5`.
   */
  bleed?: false | 5;
  ground?: TabGround;
}

/**
 * The scroll container: paints the boundary rule and carries the ground.
 *
 * The scroll inset lives INSIDE the scrollable content because the joins are
 * absolutely positioned and add nothing to scrollWidth — without it, the first
 * and last tab's join is sheared off the moment the strip scrolls.
 */
export function FolderTabStrip({
  bleed = false,
  ground = 'background',
  className,
  children,
  style,
  ...props
}: FolderTabStripProps) {
  return (
    <div
      className={cn(
        'overflow-x-auto bg-[linear-gradient(to_top,var(--border)_0_1px,transparent_1px)] px-1',
        bleed === 5 && '-mx-5',
        className,
      )}
      style={{ ['--tab-ground' as string]: GROUND_VAR[ground], ...style }}
      {...props}
    >
      <div className="flex w-max items-end gap-3 px-4">{children}</div>
    </div>
  );
}

/* ---- Link-backed: tabs that are routes -------------------------------- */

export interface FolderTabLinksProps<TTab extends string> {
  tabs: readonly TTab[];
  activeTab: TTab;
  href: (tab: TTab) => string;
  label: (tab: TTab) => React.ReactNode;
  /**
   * The link element to render — `next/link` from the app, so this package
   * stays framework-agnostic.
   */
  as: React.ElementType;
  ariaLabel?: string;
  bleed?: false | 5;
  ground?: TabGround;
  className?: string;
  /**
   * Called with the tab that was just clicked, BEFORE the router commits.
   * A route-backed strip cannot know it is selected until the navigation
   * lands, which on a cold route is hundreds of milliseconds after the click;
   * this lets the caller move the selection optimistically in the meantime.
   */
  onTabClick?: (tab: TTab) => void;
  /** Marks the strip busy while an optimistic selection is in flight. */
  'aria-busy'?: boolean;
}

export function FolderTabLinks<TTab extends string>({
  tabs,
  activeTab,
  href,
  label,
  as: LinkComponent,
  ariaLabel,
  bleed = false,
  ground = 'background',
  className,
  onTabClick,
  'aria-busy': ariaBusy,
}: FolderTabLinksProps<TTab>) {
  if (tabs.length < 2) return null;
  return (
    <FolderTabStrip
      aria-label={ariaLabel}
      aria-busy={ariaBusy}
      bleed={bleed}
      ground={ground}
      className={className}
    >
      {tabs.map((t) => {
        const active = t === activeTab;
        return (
          <LinkComponent
            key={t}
            href={href(t)}
            aria-current={active ? 'page' : undefined}
            className={tabClass(active)}
            onClick={onTabClick ? () => onTabClick(t) : undefined}
          >
            {active ? (
              <>
                <TabJoin side="left" />
                <TabJoin side="right" />
              </>
            ) : null}
            {label(t)}
          </LinkComponent>
        );
      })}
    </FolderTabStrip>
  );
}
