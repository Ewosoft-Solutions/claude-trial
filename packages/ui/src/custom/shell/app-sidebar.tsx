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
import {
  ChevronDown,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '@workspace/ui/lib/utils';
import { neonAvatarColor } from '@workspace/ui/lib/avatar-color';
import { useIsMobile } from '@workspace/ui/hooks/use-mobile';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import type {
  NavGroup,
  NavItem,
  NavPanelData,
  RailItem,
  UserMenuItem,
  UserProfile,
} from '@workspace/ui/types/shell.types';

/* Active-item accent: a neon gradient wash + inset hairline. Falls back to a
   flat primary tint under Classic Dark (where --grad-nav-active is `none`). */
const NAV_ACTIVE =
  'bg-primary/10 [background-image:var(--grad-nav-active)] text-foreground ring-1 ring-inset ring-white/10';

/* ---- shared element picker: anchor when href, button otherwise ---- */
type NavElementProps = {
  href?: string;
  onSelect?: () => void;
  onPrefetch?: () => void;
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  'aria-controls'?: string;
  'aria-expanded'?: boolean;
  children: React.ReactNode;
  /** Composed with onSelect when a parent injects its own click handler. */
  onClick?: React.MouseEventHandler<HTMLElement>;
};

const MOBILE_NAV_ROW_STYLE: React.CSSProperties = {
  minHeight: '2.375rem',
  lineHeight: '1.25rem',
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
    <span className="pointer-events-none absolute -right-2 -top-1.5 z-10 grid h-[17px] min-w-[17px] max-w-8 place-items-center truncate rounded-full border-2 border-background bg-info px-1 text-[9px] font-bold leading-none text-info-foreground">
      {badge}
    </span>
  );
}

function NestedItemBullet() {
  return (
    <span
      data-slot="nav-nested-bullet"
      className="mr-2 size-1.5 shrink-0 rounded-full border border-muted-foreground/70 bg-transparent group-aria-[current=page]:border-primary"
      aria-hidden
    />
  );
}

/* ---- section heading: italic handwriting (Caveat) for quick scanning ---- */
function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'truncate font-display text-[15px] font-medium italic leading-none text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ============================================================
   Nav rows (expanded / inline)
   ============================================================ */
function NavItemRow({
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
        style={MOBILE_NAV_ROW_STYLE}
        className={cn(
          'group flex items-center rounded-[var(--radius-sm)] px-2 text-[13.5px] font-medium text-muted-foreground outline-none',
          'transition-colors hover:bg-accent hover:text-foreground',
          'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
          'aria-[current=page]:bg-primary/10 aria-[current=page]:[background-image:var(--grad-nav-active)] aria-[current=page]:font-semibold aria-[current=page]:text-foreground aria-[current=page]:ring-1 aria-[current=page]:ring-inset aria-[current=page]:ring-white/10',
          isSub && 'text-[12.5px]',
        )}
      >
        {isSub ? <NestedItemBullet /> : null}
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
        <NavItemRow
          key={child.key}
          item={child}
          depth={depth + 1}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}

function NavGroups({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {groups.map((group, groupIndex) => (
        <div
          key={group.key}
          data-slot="nav-group"
          className={cn('flex flex-col gap-px', groupIndex > 0 && 'mt-2.5')}
        >
          {group.label ? (
            <SectionLabel className="px-2 pb-1 pt-1.5">
              {group.label}
            </SectionLabel>
          ) : null}
          {group.items.map((item) => (
            <NavItemRow key={item.key} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Footer controls — theme + profile
   ============================================================ */
const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark · Aurora', icon: Sparkles },
  { value: 'classic-dark', label: 'Classic Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

function ThemeControl({ expanded }: { expanded: boolean }) {
  const { theme, setTheme } = useTheme();

  const trigger = expanded ? (
    <button
      type="button"
      className="group flex h-9 w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 text-[13.5px] font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
      aria-label="Theme"
    >
      <span className="relative grid size-[18px] shrink-0 place-items-center">
        <Sun className="size-[18px] dark:hidden" aria-hidden />
        <Moon className="hidden size-[18px] dark:block" aria-hidden />
      </span>
      <span className="flex-1 text-left">Theme</span>
      <ChevronDown className="size-3.5 opacity-60" aria-hidden />
    </button>
  ) : (
    <button
      type="button"
      className="grid size-9 place-items-center rounded-[var(--radius-sm)] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
      aria-label="Theme"
    >
      <Sun className="size-[18px] dark:hidden" aria-hidden />
      <Moon className="hidden size-[18px] dark:block" aria-hidden />
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        side={expanded ? 'top' : 'right'}
        align={expanded ? 'start' : 'end'}
        className="w-48"
      >
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={cn('gap-2', theme === value && 'text-foreground')}
          >
            <Icon className="size-4 opacity-80" aria-hidden />
            <span className="flex-1">{label}</span>
            {theme === value ? (
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileAvatar({
  user,
  className,
}: {
  user: UserProfile;
  className?: string;
}) {
  return (
    <Avatar className={cn('size-8 rounded-full', className)}>
      {user.avatarUrl ? (
        <AvatarImage src={user.avatarUrl} alt={user.name} />
      ) : null}
      <AvatarFallback
        className="text-[11px] font-bold text-white"
        style={{ background: neonAvatarColor(user.email ?? user.name) }}
      >
        {user.initials}
      </AvatarFallback>
    </Avatar>
  );
}

function SidebarProfile({
  user,
  items,
  expanded,
}: {
  user: UserProfile;
  items: UserMenuItem[];
  expanded: boolean;
}) {
  const menu = (
    <DropdownMenuContent
      side={expanded ? 'top' : 'right'}
      align={expanded ? 'start' : 'end'}
      className="w-60"
    >
      <DropdownMenuLabel className="flex items-center gap-2.5 py-1.5 font-normal">
        <ProfileAvatar user={user} className="size-9" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-foreground">
            {user.name}
          </span>
          {user.email ? (
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          ) : null}
        </span>
      </DropdownMenuLabel>
      {items.length ? <DropdownMenuSeparator /> : null}
      {items.map((item) => (
        <React.Fragment key={item.key}>
          {item.separatorBefore ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem
            variant={item.destructive ? 'destructive' : 'default'}
            onSelect={() => item.onSelect?.()}
            {...(item.href && !item.onSelect ? { asChild: true } : {})}
          >
            {item.href && !item.onSelect ? (
              <a href={item.href}>
                {item.icon}
                {item.label}
                {item.shortcut ? (
                  <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
                ) : null}
              </a>
            ) : (
              <>
                {item.icon}
                {item.label}
                {item.shortcut ? (
                  <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
                ) : null}
              </>
            )}
          </DropdownMenuItem>
        </React.Fragment>
      ))}
    </DropdownMenuContent>
  );

  if (!expanded) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="grid size-9 place-items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
          aria-label={`${user.name} — account menu`}
        >
          <ProfileAvatar user={user} />
        </DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    );
  }

  // Expanded — an info card mirroring the footer cards (e.g. Spring intake).
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border border-border bg-[image:var(--glass-card)] bg-card/40 p-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
        aria-label={`${user.name} — account menu`}
      >
        <ProfileAvatar user={user} className="size-9" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-semibold text-foreground">
            {user.name}
          </span>
          {user.caption || user.email ? (
            <span className="truncate text-[11px] text-muted-foreground">
              {user.caption ?? user.email}
            </span>
          ) : null}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      {menu}
    </DropdownMenu>
  );
}

/* ============================================================
   Sidebar — the single collapsible navigation surface
   ============================================================ */
function hasActiveNavItem(item: NavItem): boolean {
  if (item.active) return true;
  return item.items?.some(hasActiveNavItem) ?? false;
}

function Sidebar({
  brandLabel = 'SchoolWithEase',
  items,
  footerItems,
  panels,
  navFooter,
  user,
  userMenuItems = [],
}: {
  brandLabel?: string;
  items: RailItem[];
  footerItems?: RailItem[];
  panels: Record<string, NavPanelData>;
  navFooter?: React.ReactNode;
  user?: UserProfile;
  userMenuItems?: UserMenuItem[];
}) {
  const isMobile = useIsMobile();
  const sideNavRef = React.useRef<HTMLElement>(null);
  const flyoutSurfaceRef = React.useRef<HTMLElement>(null);
  const [expanded, setExpanded] = React.useState(true);
  const userToggledRef = React.useRef(false);
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

  // Default open on desktop, collapsed on mobile — until the user decides.
  React.useEffect(() => {
    if (userToggledRef.current) return;
    setExpanded(!isMobile);
  }, [isMobile]);

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
    userToggledRef.current = true;
    setExpanded((current) => !current);
    setFlyoutSectionKey(null);
    setExpandedSectionKey(undefined);
  };

  const selectCompactItem = (item: RailItem, trigger: HTMLElement) => {
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
        'relative z-30 flex h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200',
        expanded ? 'w-[15.25rem]' : 'w-[var(--rail-width)]',
      )}
    >
      {/* Brand + collapse toggle */}
      <div
        className={cn(
          'flex h-12 shrink-0 items-center',
          expanded ? 'justify-between pl-3 pr-2' : 'justify-center',
        )}
      >
        {expanded ? (
          <span className="truncate font-display text-[22px] font-bold leading-none text-foreground">
            {brandLabel}
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

      {/* Full-width divider below the toggle */}
      <div className="h-px w-full shrink-0 bg-border" />

      {expanded ? (
        <nav
          aria-label="Primary"
          className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto overscroll-contain px-2 py-2"
        >
          {items.map(expandedItem)}
        </nav>
      ) : (
        <nav
          aria-label="Primary"
          className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain py-2"
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
          'flex shrink-0 flex-col gap-1 p-2',
          !expanded && 'items-center',
        )}
      >
        {footerItems?.map((item) => (expanded ? expandedItem(item) : compactItem(item)))}
        <ThemeControl expanded={expanded} />
        {user ? (
          <SidebarProfile
            user={user}
            items={userMenuItems}
            expanded={expanded}
          />
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
          <svg
            data-slot="flyout-contour"
            aria-hidden
            focusable="false"
            viewBox={`0 0 ${shapeWidth} ${shapeHeight}`}
            className="pointer-events-none absolute inset-0 z-0 size-full overflow-visible"
          >
            <path d={shapeFillPath} fill="var(--popover)" />
            <path
              d={shapeStrokePath}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

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
  className?: string;
}

export function AppSidebar({
  brandLabel,
  railItems,
  railFooterItems,
  navHeader,
  navGroups,
  navPanels,
  navFooter,
  user,
  userMenuItems,
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
      items={railItems}
      footerItems={railFooterItems}
      panels={panels}
      navFooter={navFooter}
      user={user}
      userMenuItems={userMenuItems}
    />
  );
}
