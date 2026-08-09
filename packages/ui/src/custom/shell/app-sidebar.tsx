'use client';

/* ============================================================
   AppSidebar — Aurora canonical navigation

   A single expandable/collapsible sidebar used at EVERY breakpoint
   (the previous always-open desktop rail+panel is retired). It has
   two states:

     • collapsed — an icon rail; nested sections open as opaque
                   flyouts anchored beside the rail.
     • expanded  — labelled rows with inline, accordion-style
                   sub-navigation.

   Footer carries the theme control and the signed-in profile
   (avatar when collapsed, an info card when expanded). Consumes the
   --rail-width / --nav-width layout tokens and the sidebar colour
   roles. No embedded navigation data — TD-001.
   ============================================================ */

import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import {
  CURVE_SIZE,
  FlyoutContour,
} from '@workspace/ui/custom/shell/flyout-contour';
import {
  hasActiveNavItem,
  MOBILE_NAV_ROW_STYLE,
  NAV_ACTIVE,
  NavElement,
  NavGroups,
  SidebarProfile,
  ThemeControl,
} from '@workspace/ui/custom/shell/nav-shared';
import type {
  NavGroup,
  NavPanelData,
  RailItem,
  UserMenuItem,
  UserProfile,
} from '@workspace/ui/types/shell.types';

/* ---- rail count badge ---- */
function RailBadge({ badge }: { badge: string | number }) {
  return (
    <span className="pointer-events-none absolute -right-2 -top-1.5 z-10 grid h-[17px] min-w-[17px] max-w-8 place-items-center truncate rounded-full border-2 border-background bg-info px-1 text-[9px] font-bold leading-none text-info-foreground">
      {badge}
    </span>
  );
}

/* ============================================================
   Sidebar — the desktop collapsible rail/panel (md+)
   ============================================================ */
function Sidebar({
  brandLabel = 'SchoolWithEase',
  brandCollapsedLabel = 'SWE',
  items,
  footerItems,
  panels,
  navFooter,
  schoolSwitcher,
  user,
  userMenuItems = [],
  defaultExpanded = true,
  onExpandedChange,
}: {
  brandLabel?: string;
  brandCollapsedLabel?: string;
  items: RailItem[];
  footerItems?: RailItem[];
  panels: Record<string, NavPanelData>;
  navFooter?: React.ReactNode;
  /** Tenant/school context switcher, rendered under the brand. Receives the
   *  rail's current state so it can show a chip (collapsed) or a full row. */
  schoolSwitcher?: (expanded: boolean) => React.ReactNode;
  user?: UserProfile;
  userMenuItems?: UserMenuItem[];
  /** Initial expanded state — seed from a persisted cookie so the server
   *  renders the right width and there's no expand→collapse flash on refresh. */
  defaultExpanded?: boolean;
  /** Notified when the user toggles the rail, so the host can persist it. */
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const sideNavRef = React.useRef<HTMLElement>(null);
  const flyoutSurfaceRef = React.useRef<HTMLElement>(null);
  // Desktop rail is expanded by default; the user can collapse it to an icon
  // rail with flyouts. Mobile navigation is a separate surface (see MobileNav),
  // so this component no longer tracks viewport size.
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [flyoutSectionKey, setFlyoutSectionKey] = React.useState<string | null>(
    null,
  );
  // The theme flyout and the section flyouts are mutually exclusive overlays;
  // the rail owns the theme's open state so opening one closes the other.
  const [themeOpen, setThemeOpen] = React.useState(false);
  const [expandedSectionKey, setExpandedSectionKey] = React.useState<
    string | null | undefined
  >(undefined);
  const [flyoutAnchorTop, setFlyoutAnchorTop] = React.useState(8);
  const [flyoutSize, setFlyoutSize] = React.useState({
    width: 208,
    height: 400,
  });

  const allItems = [...items, ...(footerItems ?? [])];
  const activeItem = allItems.find((item) => item.active);
  const selectedFlyoutItem = allItems.find(
    (item) => item.key === flyoutSectionKey,
  );
  const selectedFlyoutPanel = selectedFlyoutItem
    ? panels[selectedFlyoutItem.key]
    : undefined;
  const flyoutOpen =
    !expanded &&
    selectedFlyoutItem?.hasPanel === true &&
    Boolean(selectedFlyoutPanel?.groups.length);
  const defaultExpandedKey = activeItem?.hasPanel ? activeItem.key : null;
  const openExpandedKey =
    expandedSectionKey === undefined ? defaultExpandedKey : expandedSectionKey;
  const flyoutTop = Math.max(0, flyoutAnchorTop - CURVE_SIZE);

  React.useLayoutEffect(() => {
    if (!flyoutOpen) return;
    const surface = flyoutSurfaceRef.current;
    if (!surface) return;

    const measure = () => {
      const rect = surface.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const next = {
        width: Math.round(rect.width * 2) / 2,
        height: Math.round(rect.height * 2) / 2,
      };
      setFlyoutSize((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next,
      );
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [flyoutOpen, selectedFlyoutItem?.key]);

  React.useEffect(() => {
    if (!flyoutOpen) return;

    const dismissOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (sideNavRef.current?.contains(target)) return;
      setFlyoutSectionKey(null);
    };

    document.addEventListener('pointerdown', dismissOnOutsidePointer);
    return () =>
      document.removeEventListener('pointerdown', dismissOnOutsidePointer);
  }, [flyoutOpen]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    onExpandedChange?.(next);
    setFlyoutSectionKey(null);
    setExpandedSectionKey(undefined);
    setThemeOpen(false);
  };

  const selectCompactItem = (item: RailItem, trigger: HTMLElement) => {
    // Opening a section flyout dismisses the theme flyout (they can't coexist).
    setThemeOpen(false);
    if (!item.hasPanel) {
      setFlyoutSectionKey(null);
      return;
    }
    const sideNav = sideNavRef.current;
    if (sideNav) {
      const triggerRect = trigger.getBoundingClientRect();
      const sideNavRect = sideNav.getBoundingClientRect();
      const relativeTop = triggerRect.top - sideNavRect.top;
      const maximumTop = Math.max(8, sideNavRect.height - 220);
      setFlyoutAnchorTop(Math.max(8, Math.min(relativeTop, maximumTop)));
    }
    setFlyoutSectionKey((current) =>
      item.active && current === item.key ? null : item.key,
    );
  };

  const selectExpandedItem = (item: RailItem) => {
    if (!item.hasPanel) {
      item.onSelect?.();
      setExpandedSectionKey(null);
      return;
    }
    setExpandedSectionKey((current) =>
      (current === undefined ? defaultExpandedKey : current) === item.key
        ? null
        : item.key,
    );
  };

  const compactItem = (item: RailItem) => {
    const panel = panels[item.key];
    const controls = item.hasPanel ? `nav-panel-${item.key}` : undefined;
    const isOpen = flyoutOpen && selectedFlyoutItem?.key === item.key;
    const panelHasActiveItem =
      panel?.groups.some((group) => group.items.some(hasActiveNavItem)) ??
      false;
    const showParentActive = item.active && !(isOpen && panelHasActiveItem);
    return (
      <NavElement
        key={item.key}
        href={item.hasPanel ? undefined : item.href}
        onSelect={item.hasPanel ? undefined : item.onSelect}
        onPrefetch={item.hasPanel ? item.onPanelPrefetch : item.onPrefetch}
        onClick={(event) => selectCompactItem(item, event.currentTarget)}
        active={showParentActive}
        aria-controls={controls}
        aria-expanded={item.hasPanel ? isOpen : undefined}
        className={cn(
          'group grid h-[3.375rem] w-[calc(var(--rail-width)-0.5rem)] shrink-0 grid-rows-[2rem_auto] place-items-center gap-0.5 rounded-[var(--radius-sm)] px-0.5 py-0.5 text-muted-foreground outline-none',
          'transition-colors hover:text-foreground',
          'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
          'aria-[current=page]:font-semibold aria-[current=page]:text-foreground',
          isOpen && 'focus-visible:ring-0',
        )}
      >
        <span
          className={cn(
            'relative grid size-8 place-items-center rounded-[var(--radius-sm)] transition-colors [&>svg]:size-[19px]',
            'group-hover:bg-accent',
            showParentActive && NAV_ACTIVE,
            isOpen && 'bg-accent text-foreground ring-1 ring-sidebar-ring/60',
          )}
        >
          {item.icon}
          {item.badge != null ? <RailBadge badge={item.badge} /> : null}
        </span>
        <span className="w-full truncate text-center text-[10px] font-medium leading-none">
          {item.label}
        </span>
      </NavElement>
    );
  };

  const expandedItem = (item: RailItem) => {
    const panel = panels[item.key];
    const panelOpen =
      item.hasPanel === true &&
      openExpandedKey === item.key &&
      Boolean(panel?.groups.length);
    const panelHasActiveItem =
      panel?.groups.some((group) => group.items.some(hasActiveNavItem)) ??
      false;
    const showParentActive = item.active && !(panelOpen && panelHasActiveItem);
    const controls = item.hasPanel ? `nav-inline-${item.key}` : undefined;

    return (
      <React.Fragment key={item.key}>
        <NavElement
          href={item.hasPanel ? undefined : item.href}
          onSelect={() => selectExpandedItem(item)}
          onPrefetch={item.hasPanel ? item.onPanelPrefetch : item.onPrefetch}
          active={showParentActive}
          style={MOBILE_NAV_ROW_STYLE}
          aria-controls={controls}
          aria-expanded={item.hasPanel ? panelOpen : undefined}
          className={cn(
            'group flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 text-[13.5px] font-medium text-muted-foreground outline-none',
            'transition-colors hover:bg-accent hover:text-foreground',
            'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
            'aria-[current=page]:font-semibold aria-[current=page]:bg-primary/10 aria-[current=page]:[background-image:var(--grad-nav-active)] aria-[current=page]:text-foreground aria-[current=page]:ring-1 aria-[current=page]:ring-inset aria-[current=page]:ring-white/10',
          )}
        >
          <span className="relative grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] [&>svg]:size-[18px]">
            {item.icon}
          </span>
          <span className="min-w-0 flex-1 truncate text-left">
            {item.label}
          </span>
          {item.badge != null ? (
            <span className="min-w-[22px] rounded-full bg-info px-1.5 py-0.5 text-center text-[10px] font-bold text-info-foreground">
              {item.badge}
            </span>
          ) : null}
          {item.hasPanel ? (
            <ChevronDown
              className={cn(
                'size-3.5 shrink-0 transition-transform',
                panelOpen && 'rotate-180',
              )}
              aria-hidden
            />
          ) : null}
        </NavElement>
        {panelOpen ? (
          <div id={controls} className="relative mb-px ml-3 pl-1">
            <NavGroups groups={panel?.groups ?? []} />
          </div>
        ) : null}
      </React.Fragment>
    );
  };

  return (
    <aside
      ref={sideNavRef}
      data-slot="app-sidebar"
      className={cn(
        // Desktop-only surface: below md the mobile bottom bar + drawer take
        // over, so the rail never competes with the content column for width.
        'relative z-30 hidden h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 md:flex',
        expanded ? 'w-[15.25rem]' : 'w-[var(--rail-width)]',
      )}
    >
      {/* Lead the rail with the CUSTOMER's identity — the school lockup (logo
          chip + role/name + switch). The product wordmark is demoted to a
          small signature in the footer. Fall back to the wordmark here only
          when there's no school (e.g. platform-scoped viewers). The lead row
          matches the header height so its bottom divider lines up with the top
          bar's bottom border. */}
      {schoolSwitcher ? (
        <div
          className={cn(
            'flex h-[var(--header-height)] shrink-0 items-center',
            expanded ? 'px-2' : 'justify-center',
          )}
        >
          {schoolSwitcher(expanded)}
        </div>
      ) : expanded ? (
        <div className="flex h-[var(--header-height)] shrink-0 items-center pl-3 pr-2">
          <span className="truncate font-display text-[22px] font-bold leading-none text-foreground">
            {brandLabel}
          </span>
        </div>
      ) : (
        <div className="flex h-[var(--header-height)] shrink-0 items-center justify-center">
          <span
            className="font-display text-[22px] font-bold leading-none text-foreground"
            title={brandLabel}
          >
            {brandCollapsedLabel}
          </span>
        </div>
      )}

      {/* Collapse/expand toggle — a circular chevron at the intersection of the
          logo column and the top bar (on the rail's right border, at the brand
          divider / header-bottom line). */}
      <button
        type="button"
        onClick={toggleExpanded}
        aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
        className="absolute -right-3 top-[calc(var(--header-height)-0.75rem)] z-40 grid size-6 place-items-center rounded-full border border-border bg-sidebar text-muted-foreground shadow-sm outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
      >
        {expanded ? (
          <ChevronLeft className="size-4" aria-hidden />
        ) : (
          <ChevronRight className="size-4" aria-hidden />
        )}
      </button>

      {/* Full-width divider below the lead */}
      <div className="h-px w-full shrink-0 bg-border" />

      {expanded ? (
        <nav
          aria-label="Primary"
          // pt aligns the first nav item with the page title ("Good morning…"),
          // which sits --content-padding below the top bar; the -1px accounts
          // for the divider between the lead row and the nav.
          className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto overscroll-contain px-2 pb-2 pt-[calc(var(--content-padding)_-_1px)]"
        >
          {items.map(expandedItem)}
        </nav>
      ) : (
        <nav
          aria-label="Primary"
          // pt matches the expanded rail so the first icon aligns with the
          // page title level (see the note above).
          className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain pb-2 pt-[calc(var(--content-padding)_-_1px)]"
        >
          {items.map(compactItem)}
        </nav>
      )}

      {/* Section footer card (e.g. Spring intake) — expanded only */}
      {expanded && navFooter ? (
        <div className="shrink-0 px-2 pb-1">{navFooter}</div>
      ) : null}

      {/* Full-width divider above the utility footer (Help · Theme · Profile) */}
      <div className="h-px w-full shrink-0 bg-border" />

      <div
        className={cn(
          'flex shrink-0 flex-col gap-1 py-2',
          expanded ? 'px-2' : 'items-center px-0',
        )}
      >
        {footerItems?.map((item) =>
          expanded ? expandedItem(item) : compactItem(item),
        )}
        <ThemeControl
          expanded={expanded}
          variant="curve"
          open={themeOpen}
          onOpenChange={(next) => {
            setThemeOpen(next);
            if (next) setFlyoutSectionKey(null);
          }}
        />
        {user ? (
          <SidebarProfile
            user={user}
            items={userMenuItems}
            expanded={expanded}
          />
        ) : null}
        {/* Product signature — demoted from the top of the rail to a small,
            muted line at the foot (only when the school leads above). */}
        {expanded && schoolSwitcher ? (
          <div className="pt-1 text-center">
            <span className="font-display text-[15px] leading-tight text-muted-foreground/70">
              {brandLabel}
            </span>
          </div>
        ) : null}
      </div>

      {/* Collapsed flyout submenu (opaque) */}
      {flyoutOpen ? (
        <nav
          ref={flyoutSurfaceRef}
          id={`nav-panel-${selectedFlyoutItem?.key ?? 'section'}`}
          aria-label="Secondary"
          className="absolute z-40 flex w-[clamp(9.5rem,42vw,11.5rem)] max-w-[calc(100vw-var(--rail-width)-0.5rem)] flex-col"
          style={{
            left: 'calc(100% + 0.5px)',
            top: flyoutTop,
            maxHeight: `calc(100% - ${flyoutTop + 8}px)`,
          }}
        >
          <FlyoutContour width={flyoutSize.width} height={flyoutSize.height} />

          <div
            data-slot="flyout-content"
            className="relative z-10 my-7 flex min-h-0 flex-col overflow-hidden rounded-r-[var(--radius)] bg-transparent"
          >
            <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg font-bold italic leading-tight text-foreground">
                  {selectedFlyoutPanel?.header?.title ??
                    selectedFlyoutItem?.label}
                </div>
                {selectedFlyoutPanel?.header?.subtitle ? (
                  <div className="truncate text-[11px] text-muted-foreground">
                    {selectedFlyoutPanel.header.subtitle}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setFlyoutSectionKey(null)}
                className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
                aria-label="Close secondary navigation"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
              <NavGroups
                groups={selectedFlyoutPanel?.groups ?? []}
                onNavigate={() => setFlyoutSectionKey(null)}
              />
            </div>
          </div>
        </nav>
      ) : null}
    </aside>
  );
}

/* ============================================================
   AppSidebar — composed export
   ============================================================ */
export interface NavPanelHeader {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}

export interface AppSidebarProps {
  /** Brand wordmark shown at the top when expanded. */
  brandLabel?: string;
  /** Compact brand mark shown when collapsed (logo placeholder). */
  brandCollapsedLabel?: string;
  /** Tenant/school context switcher, rendered under the brand. Receives the
   *  rail's current state so it can render a chip (collapsed) or a full row. */
  schoolSwitcher?: (expanded: boolean) => React.ReactNode;
  /** Primary destinations. */
  railItems: RailItem[];
  /** Utility rail items pinned above the footer (e.g. Help). */
  railFooterItems?: RailItem[];
  /** Secondary nav header (icon + title + subtitle). */
  navHeader?: NavPanelHeader;
  /** Secondary nav groups for the active section. */
  navGroups?: NavGroup[];
  /** RBAC-filtered panels available before their route becomes active. */
  navPanels?: Record<string, NavPanelData>;
  /** Optional footer slot beneath the nav (e.g. a progress card). */
  navFooter?: React.ReactNode;
  /** Signed-in user rendered in the sidebar footer. */
  user?: UserProfile;
  /** Account menu items for the footer profile. */
  userMenuItems?: UserMenuItem[];
  /** Initial expanded state (persisted cookie) — avoids a refresh flash. */
  defaultExpanded?: boolean;
  /** Notified when the user toggles the rail, so the host can persist it. */
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
}

export function AppSidebar({
  brandLabel,
  brandCollapsedLabel,
  schoolSwitcher,
  railItems,
  railFooterItems,
  navHeader,
  navGroups,
  navPanels,
  navFooter,
  user,
  userMenuItems,
  defaultExpanded,
  onExpandedChange,
}: AppSidebarProps) {
  const activeSection = [...railItems, ...(railFooterItems ?? [])].find(
    (item) => item.active,
  );
  const panels: Record<string, NavPanelData> = {
    ...(activeSection && navGroups?.length
      ? {
          [activeSection.key]: {
            header: navHeader,
            groups: navGroups,
          },
        }
      : {}),
    ...(navPanels ?? {}),
  };

  return (
    <Sidebar
      brandLabel={brandLabel}
      brandCollapsedLabel={brandCollapsedLabel}
      items={railItems}
      footerItems={railFooterItems}
      panels={panels}
      navFooter={navFooter}
      schoolSwitcher={schoolSwitcher}
      user={user}
      userMenuItems={userMenuItems}
      defaultExpanded={defaultExpanded}
      onExpandedChange={onExpandedChange}
    />
  );
}
