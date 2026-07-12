'use client';

/* ============================================================
   AppSidebar — Aurora Layout A navigation

   Three coordinated regions driven by typed props:
     • NavRail      — icon rail of primary destinations (md+).
     • NavPanel     — secondary nav: groups, items, sub-items,
                      badges, and an optional footer slot (lg+).
     • MobileSideNav — labelled compact rail + adjacent secondary
                       panel, expandable into an inline menu (<md).

   Consumes the --rail-width / --nav-width layout tokens and the
   sidebar/colour roles. No embedded navigation data — TD-001.
   ============================================================ */

import * as React from 'react';
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import type {
  NavGroup,
  NavItem,
  NavPanelData,
  RailItem,
} from '@workspace/ui/types/shell.types';

/* ---- shared element picker: anchor when href, button otherwise ---- */
type NavElementProps = {
  href?: string;
  onSelect?: () => void;
  onPrefetch?: () => void;
  active?: boolean;
  className?: string;
  title?: string;
  'aria-controls'?: string;
  'aria-expanded'?: boolean;
  children: React.ReactNode;
  /** Composed with onSelect when a parent injects its own click handler. */
  onClick?: React.MouseEventHandler<HTMLElement>;
};

const NavElement = React.forwardRef<HTMLElement, NavElementProps>(
  function NavElement(
    { href, onSelect, onPrefetch, active, children, onClick, ...rest },
    ref,
  ) {
    // Compose any injected handler with our onSelect so neither is lost.
    const handleClick: React.MouseEventHandler<HTMLElement> = (event) => {
      onClick?.(event);
      onSelect?.();
    };
    const common = {
      ...rest,
      onClick: handleClick,
      onPointerEnter: onPrefetch,
      onPointerDown: onPrefetch,
      onFocus: onPrefetch,
      'aria-current': active ? ('page' as const) : undefined,
    };
    if (href) {
      return (
        <a ref={ref as React.Ref<HTMLAnchorElement>} href={href} {...common}>
          {children}
        </a>
      );
    }
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        {...common}
      >
        {children}
      </button>
    );
  },
);

/* ---- rail count badge ---- */
function RailBadge({ badge }: { badge: string | number }) {
  return (
    <span className="pointer-events-none absolute -right-2 -top-1.5 z-10 grid h-[17px] min-w-[17px] max-w-8 place-items-center truncate rounded-full border-2 border-sidebar bg-info px-1 text-[9px] font-bold leading-none text-info-foreground">
      {badge}
    </span>
  );
}

/* ============================================================
   NavRail — vertical icon rail (md+)
   ============================================================ */
function NavRail({
  brand,
  items,
  footerItems,
}: {
  brand?: React.ReactNode;
  items: RailItem[];
  footerItems?: RailItem[];
}) {
  const railItem = (item: RailItem) => (
    <NavElement
      key={item.key}
      href={item.hasPanel ? item.panelHref : item.href}
      onSelect={item.hasPanel ? item.onPanelSelect : item.onSelect}
      onPrefetch={item.hasPanel ? item.onPanelPrefetch : item.onPrefetch}
      active={item.active}
      className={cn(
        'group grid h-[3.375rem] w-[calc(var(--rail-width)-0.5rem)] grid-rows-[2rem_auto] place-items-center gap-0.5 rounded-[var(--radius-sm)] px-0.5 py-0.5 text-muted-foreground outline-none',
        'transition-colors hover:text-foreground',
        'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
        'aria-[current=page]:font-semibold aria-[current=page]:text-primary',
      )}
    >
      <span
        className={cn(
          'relative grid size-8 place-items-center rounded-[var(--radius-sm)] transition-colors [&>svg]:size-[19px]',
          'group-hover:bg-accent',
          item.active && 'bg-primary/10 group-hover:bg-primary/15',
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

  return (
    <nav
      aria-label="Primary"
      className="hidden w-[var(--rail-width)] shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-3 md:flex"
    >
      {brand ? <div className="mb-2">{brand}</div> : null}
      {items.map(railItem)}
      {footerItems?.length ? (
        <>
          <div className="flex-1" />
          <div className="my-1 h-px w-6 bg-border" />
          {footerItems.map(railItem)}
        </>
      ) : null}
    </nav>
  );
}

/* ============================================================
   NavPanel — secondary navigation (lg+)
   ============================================================ */
function NavItemRow({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const isSub = depth > 0;
  return (
    <>
      <NavElement
        href={item.href}
        onSelect={item.onSelect}
        onPrefetch={item.onPrefetch}
        active={item.active}
        className={cn(
          'group relative flex items-center rounded-[var(--radius-sm)] text-muted-foreground outline-none',
          'transition-colors hover:bg-accent hover:text-foreground',
          'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
          'aria-[current=page]:bg-primary/10 aria-[current=page]:font-semibold aria-[current=page]:text-primary',
          isSub
            ? 'ml-3 py-1 pl-3 pr-2.5 text-[13px] font-medium'
            : 'px-2.5 py-1 text-[13.5px] font-medium',
        )}
      >
        <span className="truncate">{item.label}</span>
        {item.badge != null ? (
          <span
            className={cn(
              'ml-auto min-w-[20px] rounded-full px-1.5 py-px text-center text-[11px] font-bold',
              item.badgeTone === 'hot'
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {item.badge}
          </span>
        ) : null}
      </NavElement>
      {item.items?.map((child) => (
        <NavItemRow key={child.key} item={child} depth={depth + 1} />
      ))}
    </>
  );
}

function NavPanel({
  header,
  groups,
  footer,
}: {
  header?: NavPanelHeader;
  groups: NavGroup[];
  footer?: React.ReactNode;
}) {
  return (
    <nav
      aria-label="Secondary"
      className="hidden w-[var(--nav-width)] shrink-0 flex-col gap-0.5 overflow-hidden border-r border-border bg-sidebar px-3 py-3 lg:flex"
    >
      {header ? (
        <div className="flex items-center gap-2.5 px-1.5 pb-2 pt-0.5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold leading-tight text-foreground">
              {header.title}
            </h2>
            {header.subtitle ? (
              <div className="truncate text-[11px] text-muted-foreground">
                {header.subtitle}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {groups.map((group) => (
          <React.Fragment key={group.key}>
            {group.label ? (
              <div className="flex items-center px-2 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <span className="truncate">{group.label}</span>
                {group.collapsible ? (
                  <ChevronDown
                    className="ml-auto size-3.5 opacity-60"
                    aria-hidden
                  />
                ) : null}
              </div>
            ) : null}
            {group.items.map((item) => (
              <NavItemRow key={item.key} item={item} />
            ))}
          </React.Fragment>
        ))}
      </div>

      {footer ? <div className="mt-auto pt-2">{footer}</div> : null}
    </nav>
  );
}

/* ============================================================
   MobileSideNav — compact labelled rail + expandable inline menu
   ============================================================ */
function MobileNavItemRow({
  item,
  depth = 0,
  onNavigate,
}: {
  item: NavItem;
  depth?: number;
  onNavigate?: () => void;
}) {
  const isSub = depth > 0;
  const handleSelect = () => {
    item.onSelect?.();
    onNavigate?.();
  };

  return (
    <>
      <NavElement
        href={item.href}
        onSelect={handleSelect}
        onPrefetch={item.onPrefetch}
        active={item.active}
        className={cn(
          'group flex min-h-[2.375rem] items-center rounded-[var(--radius-sm)] px-1.5 text-[13px] font-medium text-muted-foreground outline-none',
          'transition-colors hover:bg-accent hover:text-foreground',
          'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
          'aria-[current=page]:bg-primary/10 aria-[current=page]:font-semibold aria-[current=page]:text-primary',
          isSub && 'ml-2 pl-2 text-[12.5px]',
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        {item.badge != null ? (
          <span
            className={cn(
              'min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold',
              item.badgeTone === 'hot'
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {item.badge}
          </span>
        ) : null}
      </NavElement>
      {item.items?.map((child) => (
        <MobileNavItemRow
          key={child.key}
          item={child}
          depth={depth + 1}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}

function MobileNavGroups({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-px">
      {groups.map((group) => (
        <React.Fragment key={group.key}>
          {group.label ? (
            <div className="px-2 pb-0.5 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/80">
              {group.label}
            </div>
          ) : null}
          {group.items.map((item) => (
            <MobileNavItemRow
              key={item.key}
              item={item}
              onNavigate={onNavigate}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function MobileSideNav({
  items,
  footerItems,
  panels,
  footer,
}: {
  items: RailItem[];
  footerItems?: RailItem[];
  panels: Record<string, NavPanelData>;
  footer?: React.ReactNode;
}) {
  const mobileNavRef = React.useRef<HTMLElement>(null);
  const flyoutSurfaceRef = React.useRef<HTMLElement>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [flyoutSectionKey, setFlyoutSectionKey] = React.useState<string | null>(
    null,
  );
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
  const flyoutCurveSize = 28;
  const flyoutCurveReach = 40;
  const flyoutCornerRadius = 16;
  const flyoutTop = Math.max(0, flyoutAnchorTop - flyoutCurveSize);
  const shapeWidth = Math.max(1, flyoutSize.width);
  const shapeHeight = Math.max(
    flyoutCurveSize * 2 + flyoutCornerRadius * 2,
    flyoutSize.height,
  );
  const shapeFillPath = [
    'M 0 0',
    `C 0 ${flyoutCurveSize * 0.62} ${flyoutCurveReach * 0.4} ${flyoutCurveSize} ${flyoutCurveReach} ${flyoutCurveSize}`,
    `H ${shapeWidth - flyoutCornerRadius}`,
    `Q ${shapeWidth} ${flyoutCurveSize} ${shapeWidth} ${flyoutCurveSize + flyoutCornerRadius}`,
    `V ${shapeHeight - flyoutCurveSize - flyoutCornerRadius}`,
    `Q ${shapeWidth} ${shapeHeight - flyoutCurveSize} ${shapeWidth - flyoutCornerRadius} ${shapeHeight - flyoutCurveSize}`,
    `H ${flyoutCurveReach}`,
    `C ${flyoutCurveReach * 0.4} ${shapeHeight - flyoutCurveSize} 0 ${shapeHeight - flyoutCurveSize * 0.62} 0 ${shapeHeight}`,
    'Z',
  ].join(' ');
  const shapeStrokePath = [
    'M 0 0.5',
    `C 0 ${flyoutCurveSize * 0.62} ${flyoutCurveReach * 0.4} ${flyoutCurveSize + 0.5} ${flyoutCurveReach} ${flyoutCurveSize + 0.5}`,
    `H ${shapeWidth - flyoutCornerRadius}`,
    `Q ${shapeWidth - 0.5} ${flyoutCurveSize + 0.5} ${shapeWidth - 0.5} ${flyoutCurveSize + flyoutCornerRadius}`,
    `V ${shapeHeight - flyoutCurveSize - flyoutCornerRadius}`,
    `Q ${shapeWidth - 0.5} ${shapeHeight - flyoutCurveSize - 0.5} ${shapeWidth - flyoutCornerRadius} ${shapeHeight - flyoutCurveSize - 0.5}`,
    `H ${flyoutCurveReach}`,
    `C ${flyoutCurveReach * 0.4} ${shapeHeight - flyoutCurveSize - 0.5} 0 ${shapeHeight - flyoutCurveSize * 0.62} 0 ${shapeHeight - 0.5}`,
  ].join(' ');

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

  const toggleExpanded = () => {
    setExpanded((current) => !current);
    setFlyoutSectionKey(null);
    setExpandedSectionKey(undefined);
  };

  const selectCompactItem = (item: RailItem, trigger: HTMLElement) => {
    if (!item.hasPanel) {
      setFlyoutSectionKey(null);
      return;
    }
    const sideNav = mobileNavRef.current;
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
    const controls = item.hasPanel ? `mobile-panel-${item.key}` : undefined;
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
          'aria-[current=page]:font-semibold aria-[current=page]:text-primary',
          isOpen && 'focus-visible:ring-0',
        )}
      >
        <span
          className={cn(
            'relative grid size-8 place-items-center rounded-[var(--radius-sm)] transition-colors [&>svg]:size-[19px]',
            'group-hover:bg-accent',
            showParentActive && 'bg-primary/10 group-hover:bg-primary/15',
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
    const controls = item.hasPanel ? `mobile-inline-${item.key}` : undefined;

    return (
      <React.Fragment key={item.key}>
        <NavElement
          href={item.hasPanel ? undefined : item.href}
          onSelect={() => selectExpandedItem(item)}
          onPrefetch={item.hasPanel ? item.onPanelPrefetch : item.onPrefetch}
          active={showParentActive}
          aria-controls={controls}
          aria-expanded={item.hasPanel ? panelOpen : undefined}
          className={cn(
            'group flex min-h-[2.375rem] w-full items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 text-[13px] font-medium text-muted-foreground outline-none',
            'transition-colors hover:bg-accent hover:text-foreground',
            'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
            'aria-[current=page]:bg-primary/10 aria-[current=page]:font-semibold aria-[current=page]:text-primary',
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
            <MobileNavGroups groups={panel?.groups ?? []} />
          </div>
        ) : null}
      </React.Fragment>
    );
  };

  return (
    <aside
      ref={mobileNavRef}
      data-slot="mobile-side-nav"
      className={cn(
        'relative z-30 flex h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 md:hidden',
        expanded ? 'w-[clamp(9.75rem,42vw,10.75rem)]' : 'w-[var(--rail-width)]',
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center border-b border-border',
          expanded ? 'h-11 justify-between px-2.5' : 'h-12 justify-center',
        )}
      >
        {expanded ? (
          <span className="text-sm font-semibold text-foreground">
            Navigation
          </span>
        ) : null}
        <button
          type="button"
          onClick={toggleExpanded}
          className="grid size-8 place-items-center rounded-[var(--radius-sm)] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
          aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
        >
          {expanded ? (
            <PanelLeftClose className="size-5" aria-hidden />
          ) : (
            <PanelLeftOpen className="size-5" aria-hidden />
          )}
        </button>
      </div>

      {expanded ? (
        <>
          <nav
            aria-label="Mobile primary"
            className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto overscroll-contain px-1 py-1"
          >
            {items.map(expandedItem)}
            {footerItems?.length ? (
              <>
                <div className="my-0.5 h-px shrink-0 bg-border" />
                {footerItems.map(expandedItem)}
              </>
            ) : null}
          </nav>
          {footer ? (
            <div className="shrink-0 border-t border-border p-1.5">
              {footer}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <nav
            aria-label="Mobile primary"
            className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain py-2"
          >
            {items.map(compactItem)}
          </nav>
          {footerItems?.length ? (
            <div className="flex shrink-0 flex-col items-center gap-1 border-t border-border py-2">
              {footerItems.map(compactItem)}
            </div>
          ) : null}
        </>
      )}

      {flyoutOpen ? (
        <nav
          ref={flyoutSurfaceRef}
          id={`mobile-panel-${selectedFlyoutItem?.key ?? 'section'}`}
          aria-label="Mobile secondary"
          className="absolute z-40 flex w-[clamp(9rem,42vw,10.75rem)] max-w-[calc(100vw-var(--rail-width)-0.5rem)] flex-col"
          style={{
            left: 'calc(100% + 0.5px)',
            top: flyoutTop,
            maxHeight: `calc(100% - ${flyoutTop + 8}px)`,
          }}
        >
          <svg
            data-slot="mobile-flyout-contour"
            aria-hidden
            focusable="false"
            viewBox={`0 0 ${shapeWidth} ${shapeHeight}`}
            className="pointer-events-none absolute inset-0 z-0 size-full overflow-visible"
          >
            <path d={shapeFillPath} fill="var(--sidebar)" />
            <path
              d={shapeStrokePath}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div
            data-slot="mobile-flyout-content"
            className="relative z-10 my-7 flex min-h-0 flex-col overflow-hidden rounded-r-[var(--radius)] bg-transparent"
          >
            <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">
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
              <MobileNavGroups
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

function hasActiveNavItem(item: NavItem): boolean {
  if (item.active) return true;
  return item.items?.some(hasActiveNavItem) ?? false;
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
  /** Brand mark shown at the top of the icon rail. */
  brand?: React.ReactNode;
  /** Primary destinations: icon rail (md+) and mobile side navigation (<md). */
  railItems: RailItem[];
  /** Utility rail items pinned to the bottom (e.g. Help, Settings). */
  railFooterItems?: RailItem[];
  /** Secondary nav header (icon + title + subtitle). */
  navHeader?: NavPanelHeader;
  /** Secondary nav groups. When omitted, only the rail renders. */
  navGroups?: NavGroup[];
  /** RBAC-filtered panels available before their route becomes active. */
  navPanels?: Record<string, NavPanelData>;
  /** Optional footer slot beneath the secondary nav (e.g. a progress card). */
  navFooter?: React.ReactNode;
  className?: string;
}

export function AppSidebar({
  brand,
  railItems,
  railFooterItems,
  navHeader,
  navGroups,
  navPanels,
  navFooter,
}: AppSidebarProps) {
  const activeSection = [...railItems, ...(railFooterItems ?? [])].find(
    (item) => item.active,
  );
  const mobilePanels: Record<string, NavPanelData> = {
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
    <>
      <NavRail brand={brand} items={railItems} footerItems={railFooterItems} />
      {navGroups?.length ? (
        <NavPanel header={navHeader} groups={navGroups} footer={navFooter} />
      ) : null}
      <MobileSideNav
        items={railItems}
        footerItems={railFooterItems}
        panels={mobilePanels}
        footer={navFooter}
      />
    </>
  );
}
