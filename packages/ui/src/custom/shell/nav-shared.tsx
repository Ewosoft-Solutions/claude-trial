'use client';

/* ============================================================
   nav-shared — presentational parts shared by the Aurora
   navigation surfaces.

   The desktop rail/panel (AppSidebar) and the mobile bottom-bar +
   overlay drawer (MobileNav) render the same rows, section labels,
   theme control, and profile card. Those pure, stateless pieces live
   here so both surfaces stay visually identical and DRY — the
   stateful chrome (flyouts, accordions, sheet) stays in each host.
   No embedded navigation data (TD-001).
   ============================================================ */

import * as React from 'react';
import {
  ChevronDown,
  EllipsisVertical,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '@workspace/ui/lib/utils';
import { toTitleCase } from '@workspace/ui/lib/names';
import { FlyoutContour } from '@workspace/ui/custom/shell/flyout-contour';
import { CountBadge } from '@workspace/ui/custom/data-display/count-badge';
import { InitialsAvatar } from '@workspace/ui/custom/data-display/initials-avatar';
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
  UserMenuItem,
  UserProfile,
} from '@workspace/ui/types/shell.types';

/* Active-item accent: a neon gradient wash + inset hairline. Falls back to a
   flat primary tint under Classic Dark (where --grad-nav-active is `none`). */
export const NAV_ACTIVE =
  'bg-primary/10 [background-image:var(--grad-nav-active)] text-foreground ring-1 ring-inset ring-white/10';

/* A comfortable touch target for label rows on both surfaces. */
export const MOBILE_NAV_ROW_STYLE: React.CSSProperties = {
  minHeight: '2.375rem',
  lineHeight: '1.25rem',
};

/* ---- shared element picker: anchor when href, button otherwise ---- */
export type NavElementProps = {
  href?: string;
  onSelect?: () => void;
  onPrefetch?: () => void;
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  'aria-controls'?: string;
  'aria-expanded'?: boolean;
  'aria-label'?: string;
  children: React.ReactNode;
  /** Composed with onSelect when a parent injects its own click handler. */
  onClick?: React.MouseEventHandler<HTMLElement>;
};

export const NavElement = React.forwardRef<HTMLElement, NavElementProps>(
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

export function NestedItemBullet() {
  return (
    <span
      data-slot="nav-nested-bullet"
      className="mr-2 size-1.5 shrink-0 rounded-full border border-muted-foreground/70 bg-transparent group-aria-[current=page]:border-primary"
      aria-hidden
    />
  );
}

/* ---- section heading: uppercase tracked sans, matching the design-system
   category labels (e.g. the table filter groups) for consistent scanning ---- */
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'truncate text-[calc(11px*var(--font-scale))] font-bold uppercase tracking-wider leading-none text-muted-foreground',
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
export function NavItemRow({
  item,
  depth = 0,
  isLast = false,
  tree = true,
  onNavigate,
}: {
  item: NavItem;
  depth?: number;
  /** Last item at the top submenu level — the trunk stops at its curve. */
  isLast?: boolean;
  /** Hang top-level items off the hierarchy line. False = a flat list (the
   *  collapsed-rail flyout, which needs no tree). */
  tree?: boolean;
  onNavigate?: () => void;
}) {
  const isSub = depth > 0;
  const handleSelect = () => {
    item.onSelect?.();
    onNavigate?.();
  };

  const row = (
    <NavElement
      href={item.href}
      onSelect={handleSelect}
      onPrefetch={item.onPrefetch}
      active={item.active}
      style={MOBILE_NAV_ROW_STYLE}
      className={cn(
        // w-full so the pill fills the row even when it renders as a <button>
        // (buttons shrink-to-fit by default, unlike the block-level rows).
        'group flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 text-[calc(13.5px*var(--font-scale))] font-medium text-muted-foreground outline-none',
        'transition-colors hover:bg-accent hover:text-foreground',
        'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
        'aria-[current=page]:bg-primary/10 aria-[current=page]:[background-image:var(--grad-nav-active)] aria-[current=page]:font-semibold aria-[current=page]:text-foreground aria-[current=page]:ring-1 aria-[current=page]:ring-inset aria-[current=page]:ring-white/10',
        isSub && 'text-[calc(12.5px*var(--font-scale))]',
      )}
    >
      {isSub ? <NestedItemBullet /> : null}
      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
      {item.badge != null ? (
        <CountBadge
          count={item.badge}
          size="md"
          tone={item.badgeTone === 'hot' ? 'accent' : 'info'}
        />
      ) : null}
    </NavElement>
  );

  return (
    <>
      {/* Top-level items hang off the hierarchy line; nested items keep the
          simple bullet (the real nav does not nest, but the flyout may). The
          flyout passes tree=false for a plain flat list. */}
      {isSub || !tree ? (
        row
      ) : (
        <div data-slot="nav-branch" data-last={isLast ? 'true' : undefined}>
          {row}
        </div>
      )}
      {item.items?.map((child) => (
        <NavItemRow
          key={child.key}
          item={child}
          depth={depth + 1}
          tree={tree}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}

export function NavGroups({
  groups,
  onNavigate,
  tree = true,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
  /** Draw the hierarchy line (default). False renders a flat list — used by
   *  the collapsed-rail flyout, where the tree isn't needed. */
  tree?: boolean;
}) {
  // Submenu headings are gone: every (already access-resolved) group flattens
  // into one list that hangs off the parent's single hierarchy line, so the
  // eye travels one continuous tree instead of several labelled clusters.
  const items = groups.flatMap((group) => group.items);
  if (items.length === 0) return null;
  return (
    <div
      data-slot={tree ? 'nav-group' : undefined}
      className={cn('flex flex-col', !tree && 'gap-px')}
    >
      {items.map((item, index) => (
        <NavItemRow
          key={item.key}
          item={item}
          isLast={index === items.length - 1}
          tree={tree}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

/** Whether an item or any descendant is the active route. */
export function hasActiveNavItem(item: NavItem): boolean {
  if (item.active) return true;
  return item.items?.some(hasActiveNavItem) ?? false;
}

/* ============================================================
   Footer controls — theme + profile
   ============================================================ */
export const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark · Aurora', icon: Sparkles },
  { value: 'classic-dark', label: 'Classic Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

/** The theme icon that tracks the active scheme (sun in light, moon in dark). */
function ThemeGlyph({ className }: { className?: string }) {
  return (
    <>
      <Sun className={cn('dark:hidden', className)} aria-hidden />
      <Moon className={cn('hidden dark:block', className)} aria-hidden />
    </>
  );
}

/** The theme option rows, shared by the collapsed flyout and the expanded
 *  accordion. Each host supplies its own "Theme" heading. */
function ThemeOptionList({
  theme,
  onSelect,
}: {
  theme?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div role="menu" aria-label="Theme" className="flex flex-col gap-0.5">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            onClick={() => onSelect(value)}
            className={cn(
              'flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[calc(13px*var(--font-scale))] font-medium text-muted-foreground outline-none',
              'transition-colors hover:bg-accent hover:text-foreground',
              'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
              selected && 'text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            {selected ? (
              <span
                className="size-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The theme control on the Aurora sidebar. Collapsed, it is an icon+label rail
 * button whose menu opens as the same curved flyout the nav sections use.
 * Expanded, it is an inline accordion — the same disclosure pattern the nav
 * sections use inline — so the footer stays pinned to the bottom.
 */
function CurveThemeControl({
  expanded,
  open: openProp,
  onOpenChange,
}: {
  expanded: boolean;
  /** Controlled open state — lets a host make it exclusive with other overlays. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = React.useCallback(
    (value: boolean) => {
      if (openProp === undefined) setOpenState(value);
      onOpenChange?.(value);
    },
    [openProp, onOpenChange],
  );
  const rootRef = React.useRef<HTMLDivElement>(null);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 184, height: 236 });

  // Measure the collapsed flyout so its contour matches the content.
  React.useLayoutEffect(() => {
    if (!open || expanded) return;
    const surface = surfaceRef.current;
    if (!surface) return;
    const measure = () => {
      const rect = surface.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const next = {
        width: Math.round(rect.width * 2) / 2,
        height: Math.round(rect.height * 2) / 2,
      };
      setSize((current) =>
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
  }, [open, expanded]);

  // Dismiss on outside pointer / Escape.
  React.useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  const choose = (value: string) => {
    setTheme(value);
    setOpen(false);
  };

  /* ---- Expanded: an inline accordion, mirroring the nav sections ---- */
  if (expanded) {
    return (
      <div ref={rootRef} className="w-full">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="theme-accordion"
          style={MOBILE_NAV_ROW_STYLE}
          className={cn(
            'group flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 text-[calc(13.5px*var(--font-scale))] font-medium text-muted-foreground outline-none',
            'transition-colors hover:bg-accent hover:text-foreground',
            'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
            'aria-expanded:bg-accent aria-expanded:text-foreground',
          )}
        >
          <span className="relative grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] [&>svg]:size-[18px]">
            <ThemeGlyph />
          </span>
          <span className="min-w-0 flex-1 truncate text-left">Theme</span>
          <ChevronDown
            className={cn(
              'size-3.5 shrink-0 transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
        {open ? (
          <div id="theme-accordion" className="relative mb-px ml-3 pl-1 pt-0.5">
            <ThemeOptionList theme={theme} onSelect={choose} />
          </div>
        ) : null}
      </div>
    );
  }

  /* ---- Collapsed: an icon+label rail button with a curved flyout ---- */
  return (
    <div ref={rootRef} className="relative flex w-full flex-col items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'group grid h-[3.375rem] w-[calc(var(--rail-width)-0.5rem)] shrink-0 grid-rows-[2rem_auto] place-items-center gap-0.5 rounded-[var(--radius-sm)] px-0.5 py-0.5 text-muted-foreground outline-none',
          'transition-colors hover:text-foreground',
          'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
          open && 'text-foreground',
        )}
      >
        <span
          className={cn(
            'relative grid size-8 place-items-center rounded-[var(--radius-sm)] transition-colors group-hover:bg-accent [&>svg]:size-[19px]',
            open && 'bg-accent text-foreground ring-1 ring-sidebar-ring/60',
          )}
        >
          <ThemeGlyph />
        </span>
        <span className="w-full truncate text-center text-[calc(10px*var(--font-scale))] font-medium leading-none">
          Theme
        </span>
      </button>
      {open ? (
        <div
          ref={surfaceRef}
          id="theme-flyout"
          className="absolute bottom-0 z-40 flex w-[clamp(9.5rem,42vw,11.5rem)] flex-col"
          style={{ left: 'calc(100% + 0.5px)' }}
        >
          <FlyoutContour width={size.width} height={size.height} />
          <div className="relative z-10 my-7 flex min-h-0 flex-col overflow-hidden rounded-r-[var(--radius)] bg-transparent">
            <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-2.5 py-2">
              <div className="min-w-0 flex-1 truncate font-display text-base font-semibold leading-tight text-foreground">
                Theme
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
                aria-label="Close theme menu"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
              <ThemeOptionList theme={theme} onSelect={choose} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ThemeControl({
  expanded,
  variant = 'menu',
  open,
  onOpenChange,
}: {
  expanded: boolean;
  /** `menu` = Radix dropdown (default); `curve` = the Aurora flyout surface. */
  variant?: 'menu' | 'curve';
  /** Controlled open state for the curve variant (ignored by `menu`). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { theme, setTheme } = useTheme();

  if (variant === 'curve') {
    return (
      <CurveThemeControl
        expanded={expanded}
        open={open}
        onOpenChange={onOpenChange}
      />
    );
  }

  const trigger = expanded ? (
    <button
      type="button"
      className="group flex h-9 w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 text-[calc(13.5px*var(--font-scale))] font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
      aria-label="Theme"
    >
      <ThemeGlyph className="size-[18px] shrink-0" />
      <span className="flex-1 text-left">Theme</span>
      <ChevronDown className="size-3.5 opacity-60" aria-hidden />
    </button>
  ) : (
    <button
      type="button"
      className="grid size-9 place-items-center rounded-[var(--radius-sm)] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50 [&>svg]:size-[18px]"
      aria-label="Theme"
    >
      <ThemeGlyph />
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

export function ProfileAvatar({
  user,
  className,
}: {
  user: UserProfile;
  className?: string;
}) {
  return (
    <InitialsAvatar
      name={user.name}
      initials={user.initials}
      seed={user.email ?? user.name}
      imageUrl={user.avatarUrl}
      className={cn('size-8', className)}
      textClassName="text-[calc(11px*var(--font-scale))]"
    />
  );
}

export function SidebarProfile({
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
            {toTitleCase(user.name)}
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
          <span className="truncate text-[calc(13px*var(--font-scale))] font-semibold text-foreground">
            {toTitleCase(user.name)}
          </span>
          {/* email here — the role/persona lives in the context switcher */}
          {user.email ? (
            <span className="truncate text-[calc(11px*var(--font-scale))] text-muted-foreground">
              {user.email}
            </span>
          ) : null}
        </span>
        <EllipsisVertical
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>
      {menu}
    </DropdownMenu>
  );
}
