'use client';

/* ============================================================
   AppHeader — Aurora Layout A top bar

   Slot-based header: school switcher (left), breadcrumbs, a
   command/omni search affordance (center), and an actions
   cluster (right) that typically holds icon buttons + the
   user menu. Consumes the --header-height layout token and the
   sidebar/elevation token roles. No embedded data.
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
        'flex h-[var(--header-height)] min-h-[50px] shrink-0 items-center gap-3.5 border-b border-border bg-sidebar px-4',
        className,
      )}
    >
      {schoolSwitcher}
      {breadcrumbs ? (
        <div className="min-w-0 max-md:hidden">{breadcrumbs}</div>
      ) : null}
      {search ? (
        <div className="flex min-w-0 flex-1 justify-center">{search}</div>
      ) : (
        <div className="flex-1" />
      )}
      {actions ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
