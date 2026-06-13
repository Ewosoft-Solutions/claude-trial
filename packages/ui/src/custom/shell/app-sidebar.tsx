'use client';

/* ============================================================
   AppSidebar — Aurora Layout A navigation

   Three coordinated regions driven by typed props:
     • NavRail      — icon rail of primary destinations (md+).
     • NavPanel     — secondary nav: groups, items, sub-items,
                      badges, and an optional footer slot (lg+).
     • MobileTabBar — the rail items as a bottom tab bar (<md),
                      absolutely positioned within <AppShell>.

   Consumes the --rail-width / --nav-width layout tokens and the
   sidebar/colour roles. No embedded navigation data — TD-001.
   ============================================================ */

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip';
import type {
  NavGroup,
  NavItem,
  RailItem,
} from '@workspace/ui/types/shell.types';

/* ---- shared element picker: anchor when href, button otherwise ---- */
type NavElementProps = {
  href?: string;
  onSelect?: () => void;
  active?: boolean;
  className?: string;
  title?: string;
  children: React.ReactNode;
  /** Injected by `asChild` wrappers (e.g. Tooltip); composed with onSelect. */
  onClick?: React.MouseEventHandler<HTMLElement>;
};

const NavElement = React.forwardRef<HTMLElement, NavElementProps>(
  function NavElement({ href, onSelect, active, children, onClick, ...rest }, ref) {
    // Compose any handler injected via `asChild` (Radix Tooltip merges its own
    // onClick onto the trigger) with our onSelect — never let one clobber the
    // other regardless of spread order.
    const handleClick: React.MouseEventHandler<HTMLElement> = (event) => {
      onClick?.(event);
      onSelect?.();
    };
    const common = {
      ...rest,
      onClick: handleClick,
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
      <button ref={ref as React.Ref<HTMLButtonElement>} type="button" {...common}>
        {children}
      </button>
    );
  },
);

/* ---- rail count badge ---- */
function RailBadge({ badge }: { badge: string | number }) {
  return (
    <span className="absolute -right-0.5 -top-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full border-2 border-sidebar bg-info px-1 text-[10px] font-bold leading-none text-info-foreground">
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
    <Tooltip key={item.key}>
      <TooltipTrigger asChild>
        <NavElement
          href={item.href}
          onSelect={item.onSelect}
          active={item.active}
          title={item.label}
          className={cn(
            'group relative grid size-10 place-items-center rounded-[var(--radius-sm)] text-muted-foreground outline-none',
            'transition-colors hover:bg-accent hover:text-foreground',
            'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
            'aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary',
          )}
        >
          {item.active ? (
            <span
              className="absolute -left-3 bottom-2 top-2 w-[3px] rounded-r bg-primary"
              aria-hidden
            />
          ) : null}
          <span className="grid size-[19px] place-items-center [&>svg]:size-[19px]">
            {item.icon}
          </span>
          {item.badge != null ? <RailBadge badge={item.badge} /> : null}
          <span className="sr-only">{item.label}</span>
        </NavElement>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label="Primary"
        className="hidden w-[var(--rail-width)] shrink-0 flex-col items-center gap-1.5 border-r border-border bg-sidebar py-3 md:flex"
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
    </TooltipProvider>
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
        active={item.active}
        className={cn(
          'group relative flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 text-muted-foreground outline-none',
          'transition-colors hover:bg-accent hover:text-foreground',
          'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
          'aria-[current=page]:bg-primary/10 aria-[current=page]:font-semibold aria-[current=page]:text-primary',
          isSub
            ? 'ml-4 py-1.5 text-[13px] font-medium'
            : 'py-1.5 text-[13.5px] font-medium',
        )}
      >
        {isSub ? (
          <span
            className="grid size-[17px] place-items-center"
            aria-hidden
          >
            <span className="size-[5px] rounded-full border-[1.5px] border-current" />
          </span>
        ) : (
          <span className="grid size-[17px] shrink-0 place-items-center text-muted-foreground group-aria-[current=page]:text-primary [&>svg]:size-[17px]">
            {item.icon}
          </span>
        )}
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
      className="hidden w-[var(--nav-width)] shrink-0 flex-col gap-0.5 overflow-hidden border-r border-border bg-sidebar px-3 py-3.5 lg:flex"
    >
      {header ? (
        <div className="flex items-center gap-2.5 px-1.5 pb-3 pt-0.5">
          {header.icon ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&>svg]:size-4">
              {header.icon}
            </span>
          ) : null}
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
              <div className="flex items-center px-2 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
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
   MobileTabBar — rail items as a bottom tab bar (<md)
   ============================================================ */
function MobileTabBar({ items }: { items: RailItem[] }) {
  return (
    <nav
      aria-label="Primary"
      className="absolute inset-x-0 bottom-0 z-30 flex h-[var(--shell-tabbar-h,3.75rem)] items-center justify-around gap-1 border-t border-border bg-sidebar/95 px-2.5 backdrop-blur-sm md:hidden"
    >
      {items.map((item) => (
        <NavElement
          key={item.key}
          href={item.href}
          onSelect={item.onSelect}
          active={item.active}
          className={cn(
            'relative grid h-12 flex-1 place-items-center rounded-[var(--radius-sm)] text-muted-foreground outline-none',
            'transition-colors hover:text-foreground',
            'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
            'aria-[current=page]:text-primary',
          )}
        >
          <span className="grid size-[22px] place-items-center [&>svg]:size-[22px]">
            {item.icon}
          </span>
          {item.badge != null ? <RailBadge badge={item.badge} /> : null}
          <span className="sr-only">{item.label}</span>
        </NavElement>
      ))}
    </nav>
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
  /** Brand mark shown at the top of the icon rail. */
  brand?: React.ReactNode;
  /** Primary destinations: icon rail (md+) and mobile tab bar (<md). */
  railItems: RailItem[];
  /** Utility rail items pinned to the bottom (e.g. Help, Settings). */
  railFooterItems?: RailItem[];
  /** Secondary nav header (icon + title + subtitle). */
  navHeader?: NavPanelHeader;
  /** Secondary nav groups. When omitted, only the rail renders. */
  navGroups?: NavGroup[];
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
  navFooter,
}: AppSidebarProps) {
  return (
    <>
      <NavRail brand={brand} items={railItems} footerItems={railFooterItems} />
      {navGroups?.length ? (
        <NavPanel header={navHeader} groups={navGroups} footer={navFooter} />
      ) : null}
      <MobileTabBar items={railItems} />
    </>
  );
}
