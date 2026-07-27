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
import { ChevronDown, Monitor, Moon, Sparkles, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '@workspace/ui/lib/utils';
import { toTitleCase } from '@workspace/ui/lib/names';
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

/* ---- section heading: italic handwriting (Caveat) for quick scanning ---- */
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
export function NavItemRow({
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

export function NavGroups({
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

export function ThemeControl({ expanded }: { expanded: boolean }) {
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
      textClassName="text-[11px]"
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
          <span className="truncate text-[13px] font-semibold text-foreground">
            {toTitleCase(user.name)}
          </span>
          {/* email here — the role/persona lives in the context switcher */}
          {user.email ? (
            <span className="truncate text-[11px] text-muted-foreground">
              {user.email}
            </span>
          ) : null}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      {menu}
    </DropdownMenu>
  );
}
