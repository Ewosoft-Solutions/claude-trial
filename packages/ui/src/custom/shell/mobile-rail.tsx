'use client';

/* ============================================================
   MobileRail — the collapsed rail, pinned on phones (below md)

   An opt-in alternative to the bottom tab bar + drawer (MobileNav).
   When the user pins the menu, the bottom bar goes away entirely and
   this takes its place: the SAME collapsed icon rail the desktop
   sidebar shows, with the same flyout submenus, so a section's
   children are one tap away instead of drawer → accordion → item.

   Deliberate differences from the desktop rail:

     • No expand toggle. A labelled sidebar would eat most of a phone
       screen; the point of pinning is the compact form.
     • The flyout is wider, gets a scrim over the content column, and
       takes focus — touch has no hover, and a 155px panel is too
       tight for submenu labels.
     • "Unpin menu" is appended to the profile menu, so the user is
       never stranded without a way back to the bottom bar.

   Fed the same RBAC-resolved RailItem[] as every other navigation
   surface — no role logic here (TD-001).
   ============================================================ */

import * as React from 'react';
import { PinOff } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import {
  CompactNavItem,
  RailFlyout,
  useRailFlyout,
} from '@workspace/ui/custom/shell/compact-rail';
import {
  SidebarProfile,
  ThemeControl,
} from '@workspace/ui/custom/shell/nav-shared';
import type {
  NavPanelData,
  RailItem,
  UserMenuItem,
  UserProfile,
} from '@workspace/ui/types/shell.types';

export interface MobileRailProps {
  /** Compact brand mark, shown when there is no school lockup. */
  brandCollapsedLabel?: string;
  brandLabel?: string;
  /** Primary destinations (RBAC-resolved). */
  railItems: RailItem[];
  /** Utility items pinned above the footer (e.g. Help). */
  railFooterItems?: RailItem[];
  /** Secondary panels keyed by section, opened as flyouts. */
  navPanels?: Record<string, NavPanelData>;
  /** Tenant/school switcher. Receives `false` — the rail is always compact
   *  here — so it renders as the chip form with its menu. */
  schoolSwitcher?: (expanded: boolean) => React.ReactNode;
  /** Signed-in user rendered in the footer. */
  user?: UserProfile;
  /** Account menu items; "Unpin menu" is appended to them. */
  userMenuItems?: UserMenuItem[];
  /** Restore the bottom tab bar. */
  onUnpin?: () => void;
  className?: string;
}

export function MobileRail({
  brandCollapsedLabel = 'SWE',
  brandLabel = 'SchoolWithEase',
  railItems,
  railFooterItems,
  navPanels = {},
  schoolSwitcher,
  user,
  userMenuItems = [],
  onUnpin,
  className,
}: MobileRailProps) {
  const railRef = React.useRef<HTMLElement>(null);
  const [themeOpen, setThemeOpen] = React.useState(false);

  const allItems = [...railItems, ...(railFooterItems ?? [])];
  const flyout = useRailFlyout({
    items: allItems,
    panels: navPanels,
    containerRef: railRef,
  });

  // Touch has no hover and no Escape key at hand: move focus into the panel
  // when it opens so the submenu is reachable by keyboard/switch control too.
  const flyoutOpen = flyout.open;
  const flyoutSurfaceRef = flyout.surfaceRef;
  React.useEffect(() => {
    if (!flyoutOpen) return;
    flyoutSurfaceRef.current?.focus({ preventScroll: true });
  }, [flyoutOpen, flyoutSurfaceRef]);

  const selectItem = (item: RailItem, trigger: HTMLElement) => {
    setThemeOpen(false);
    flyout.openFrom(item, trigger);
  };

  const compactItem = (item: RailItem) => (
    <CompactNavItem
      key={item.key}
      item={item}
      panel={navPanels[item.key]}
      isOpen={flyout.open && flyout.item?.key === item.key}
      onTrigger={selectItem}
    />
  );

  // Sits with the other preference-ish entries, ABOVE the destructive tail
  // (sign out) — appending it would leave the terminal action mid-list.
  const menuItems: UserMenuItem[] = React.useMemo(() => {
    if (!onUnpin) return userMenuItems;
    const unpin: UserMenuItem = {
      key: 'unpin-menu',
      label: 'Unpin menu',
      icon: <PinOff />,
      onSelect: onUnpin,
    };
    const tail = userMenuItems.findIndex((item) => item.destructive);
    if (tail === -1) return [...userMenuItems, unpin];
    return [
      ...userMenuItems.slice(0, tail),
      unpin,
      ...userMenuItems.slice(tail),
    ];
  }, [userMenuItems, onUnpin]);

  return (
    <aside
      ref={railRef}
      data-slot="mobile-rail"
      // Full-height on the left, exactly like the desktop rail — the top bar
      // starts at its right edge. Widened by the left safe-area inset so the
      // icons clear a landscape notch.
      style={{
        width: 'calc(var(--rail-width) + env(safe-area-inset-left))',
        paddingLeft: 'env(safe-area-inset-left)',
      }}
      className={cn(
        'relative z-30 flex h-full shrink-0 flex-col border-r border-border bg-sidebar md:hidden',
        className,
      )}
    >
      {/* Lead: the school chip (and its switch menu) or the product mark. The
          top bar keeps the role + school NAME beside it, so this row carries
          the mark and the control, not a second copy of the text. */}
      <div className="flex h-[var(--header-height)] shrink-0 items-center justify-center">
        {schoolSwitcher ? (
          schoolSwitcher(false)
        ) : (
          <span
            className="font-display text-[calc(22px*var(--font-scale))] font-semibold leading-none text-foreground"
            title={brandLabel}
          >
            {brandCollapsedLabel}
          </span>
        )}
      </div>

      <div className="h-px w-full shrink-0 bg-border" />

      <nav
        aria-label="Primary"
        // pt matches the desktop rail so the first icon aligns with the page
        // title level; the -1px accounts for the divider above.
        className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain pb-2 pt-[calc(var(--content-padding)_-_1px)]"
      >
        {railItems.map(compactItem)}
      </nav>

      <div className="h-px w-full shrink-0 bg-border" />

      <div
        className="flex shrink-0 flex-col items-center gap-1 px-0 pt-2"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        {railFooterItems?.map(compactItem)}
        <ThemeControl
          expanded={false}
          variant="curve"
          open={themeOpen}
          onOpenChange={(next) => {
            setThemeOpen(next);
            if (next) flyout.close();
          }}
        />
        {user ? (
          <SidebarProfile user={user} items={menuItems} expanded={false} />
        ) : null}
      </div>

      {/* Scrim over the content column — touch has no "click outside without
          touching something", so the flyout needs a surface that absorbs the
          tap (and stops the page scrolling underneath it). */}
      {flyout.open ? (
        <div
          data-slot="mobile-rail-scrim"
          aria-hidden
          onPointerDown={flyout.close}
          className="fixed inset-y-0 right-0 z-20 bg-black/40"
          style={{
            left: 'calc(var(--rail-width) + env(safe-area-inset-left))',
          }}
        />
      ) : null}

      {flyout.open ? (
        <RailFlyout state={flyout} wide onNavigate={flyout.close} />
      ) : null}
    </aside>
  );
}
