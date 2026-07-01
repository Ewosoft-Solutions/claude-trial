'use client';

/* ============================================================
   AppHeader — Aurora Layout A top bar

   Three-column grid: [switcher + breadcrumbs] | [search] | [actions].
   The left column has a capped max-width so a long breadcrumb trail
   truncates (see AppBreadcrumbs' own collapsing) instead of growing
   and shoving the center search column sideways — search stays at a
   fixed position and width regardless of the current route's
   breadcrumb length. Consumes the --header-height layout token and
   the sidebar/elevation token roles. No embedded data.

   Responsive: breadcrumbs and the full search pill both need real
   estate (breadcrumb text + a ~440px search bar), which only fits
   comfortably at xl (1280px)+ alongside the switcher and action icons
   — below that the two used to fight for the same shrinking space.
   Below xl, breadcrumbs hide (the sidebar's active nav item + each
   page's own title already convey location) and search collapses to
   an icon-only trigger (it opens a command palette, not a text field,
   so an icon loses no functionality — same pattern as Linear/GitHub).
   ============================================================ */

import * as React from 'react';
import { Search } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';

export interface OmniSearchProps {
  placeholder?: string;
  /** Keyboard hint rendered on the right, e.g. "⌘K". */
  shortcut?: string;
  onClick?: () => void;
  className?: string;
}

/** The non-interactive command-palette trigger from the Aurora top bar. */
export function OmniSearch({
  placeholder = 'Search…',
  shortcut = '⌘K',
  onClick,
  className,
}: OmniSearchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={placeholder}
      className={cn(
        'mx-auto flex h-[38px] w-9 shrink-0 items-center justify-center gap-2.5 rounded-[var(--radius)] border border-border bg-secondary text-[13px] text-muted-foreground outline-none',
        'xl:w-full xl:max-w-[440px] xl:justify-start xl:px-3',
        'transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <Search className="size-[15px] shrink-0" aria-hidden />
      <span className="hidden truncate xl:inline">{placeholder}</span>
      {shortcut ? (
        <kbd className="ml-auto hidden rounded-[5px] border border-border bg-card px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground xl:inline-block">
          {shortcut}
        </kbd>
      ) : null}
    </button>
  );
}

export interface AppHeaderProps {
  /** Tenant/school switcher — typically <SchoolSwitcher/>. */
  schoolSwitcher?: React.ReactNode;
  /** Breadcrumb trail — typically <AppBreadcrumbs/>. Hidden on mobile. */
  breadcrumbs?: React.ReactNode;
  /** Center command/search affordance — typically <OmniSearch/>. */
  search?: React.ReactNode;
  /** Right-aligned actions: icon buttons, then the user menu. */
  actions?: React.ReactNode;
  className?: string;
}

export function AppHeader({
  schoolSwitcher,
  breadcrumbs,
  search,
  actions,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        'grid h-[var(--header-height)] min-h-[50px] shrink-0 grid-cols-[minmax(0,26rem)_1fr_auto] items-center gap-3.5 border-b border-border bg-sidebar px-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5 overflow-hidden">
        {schoolSwitcher}
        {breadcrumbs ? (
          <div className="min-w-0 overflow-hidden max-xl:hidden">{breadcrumbs}</div>
        ) : null}
      </div>
      {search ? (
        <div className="mx-auto flex w-9 min-w-0 justify-self-center xl:w-full xl:max-w-[440px]">
          {search}
        </div>
      ) : (
        <div />
      )}
      {actions ? (
        <div className="flex shrink-0 items-center justify-self-end gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
