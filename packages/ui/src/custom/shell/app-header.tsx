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
      className={cn(
        'mx-auto flex h-[38px] w-full max-w-[440px] items-center gap-2.5 rounded-[var(--radius)] border border-border bg-secondary px-3 text-[13px] text-muted-foreground outline-none',
        'transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <Search className="size-[15px] shrink-0" aria-hidden />
      <span className="truncate">{placeholder}</span>
      {shortcut ? (
        <kbd className="ml-auto rounded-[5px] border border-border bg-card px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
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
          <div className="min-w-0 overflow-hidden max-md:hidden">{breadcrumbs}</div>
        ) : null}
      </div>
      {search ? (
        <div className="mx-auto flex w-full min-w-0 max-w-[440px] justify-self-center">
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
