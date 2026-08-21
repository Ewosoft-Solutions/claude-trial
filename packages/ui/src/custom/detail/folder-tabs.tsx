'use client';

/* ============================================================
   Folder tabs — the interactive strips

   The shape itself (the joins, the rule, the ground) lives in
   `folder-tab-shape`, which carries no `'use client'` so that a strip of
   tab LINKS can render on the server. This file adds the two strips that
   genuinely need a client runtime:

     · `FolderTabs` / `FolderTabsList` / `FolderTabsTrigger` /
       `FolderTabsContent` — Radix-backed, for in-page section switching.
       Keeps roving-tabindex arrow-key navigation and the panel wiring.
     · `FolderTabButtons` — for local state with no panel semantics
       (a drawer switching its own body).

   For route tabs, import `FolderTabLinks` from `folder-tab-shape`
   DIRECTLY rather than through the re-export below: reaching it through
   this module drags it across the client boundary, and its `href` and
   `label` functions cannot be serialised across one.
   ============================================================ */

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import {
  FolderTabStrip,
  GROUND_VAR,
  TabJoin,
  tabClass,
  type TabGround,
} from '@workspace/ui/custom/detail/folder-tab-shape';
import { cn } from '@workspace/ui/lib/utils';

export {
  FolderTabLinks,
  FolderTabStrip,
  TabJoin,
  TAB_JOIN_DEPTH,
  TAB_JOIN_REACH,
  type FolderTabLinksProps,
  type FolderTabStripProps,
  type TabGround,
} from '@workspace/ui/custom/detail/folder-tab-shape';

/* ---- Radix-backed: in-page section switching ------------------------- */

export const FolderTabs = TabsPrimitive.Root;

export interface FolderTabsListProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.List
> {
  bleed?: false | 5;
  ground?: TabGround;
}

export const FolderTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  FolderTabsListProps
>(
  (
    { bleed = false, ground = 'background', className, style, ...props },
    ref,
  ) => (
    <div
      className={cn(
        'overflow-x-auto bg-[linear-gradient(to_top,var(--border)_0_1px,transparent_1px)] px-1',
        bleed === 5 && '-mx-5',
        className,
      )}
      style={{ ['--tab-ground' as string]: GROUND_VAR[ground], ...style }}
    >
      <TabsPrimitive.List
        ref={ref}
        className="flex w-max items-end gap-3 px-4"
        {...props}
      />
    </div>
  ),
);
FolderTabsList.displayName = 'FolderTabsList';

export const FolderTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabClass('data'), className)}
    {...props}
  >
    {/* Always mounted, revealed by the trigger's own state — Radix owns
        which tab is active, so the joins follow it in CSS rather than
        asking this component to duplicate that knowledge. */}
    <TabJoin side="left" className="hidden group-data-[state=active]:block" />
    <TabJoin side="right" className="hidden group-data-[state=active]:block" />
    {children}
  </TabsPrimitive.Trigger>
));
FolderTabsTrigger.displayName = 'FolderTabsTrigger';

export const FolderTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className,
    )}
    {...props}
  />
));
FolderTabsContent.displayName = 'FolderTabsContent';

/* ---- Button-backed: local state, no panel semantics ------------------- */

export interface FolderTabButtonsProps<TTab extends string> {
  tabs: readonly TTab[];
  value: TTab;
  onChange: (tab: TTab) => void;
  label: (tab: TTab) => React.ReactNode;
  ariaLabel?: string;
  bleed?: false | 5;
  ground?: TabGround;
  className?: string;
}

export function FolderTabButtons<TTab extends string>({
  tabs,
  value,
  onChange,
  label,
  ariaLabel,
  bleed = false,
  ground = 'background',
  className,
}: FolderTabButtonsProps<TTab>) {
  if (tabs.length < 2) return null;
  return (
    <FolderTabStrip
      aria-label={ariaLabel}
      bleed={bleed}
      ground={ground}
      className={className}
    >
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
            className={tabClass(active)}
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
    </FolderTabStrip>
  );
}
