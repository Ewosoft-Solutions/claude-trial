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
import { ShortcutHint } from '@workspace/ui/components/shortcut-hint';
import { InitialsAvatar } from '@workspace/ui/custom/data-display/initials-avatar';
import type { SchoolOption } from '@workspace/ui/types/shell.types';

export interface OmniSearchProps {
  placeholder?: string;
  /** Non-modifier key for the shortcut hint (rendered OS-aware). Default "K". */
  shortcutKey?: string;
  onClick?: () => void;
  className?: string;
}

/** Responsive command-palette trigger for the Aurora top bar. */
export function OmniSearch({
  placeholder = 'Search…',
  shortcutKey = 'K',
  onClick,
  className,
}: OmniSearchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={placeholder}
      className={cn(
        'mx-auto flex h-9 w-9 min-w-0 shrink-0 items-center justify-center gap-2.5 rounded-[var(--radius)] border border-border bg-background text-[13px] text-muted-foreground outline-none',
        'sm:w-full sm:justify-start sm:px-3',
        'transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <Search className="size-[15px] shrink-0" aria-hidden />
      <span className="hidden truncate sm:inline">{placeholder}</span>
      {shortcutKey ? (
        <ShortcutHint
          keyName={shortcutKey}
          className="ml-auto hidden xl:inline-flex [@media(pointer:coarse)]:hidden"
        />
      ) : null}
    </button>
  );
}

export interface AppHeaderProps {
  /** Brand wordmark shown on the left below md, where the rail (which carries
   *  the brand at md+) is replaced by the mobile bottom bar. */
  brandLabel?: string;
  /** Active school. When set, the mobile top bar leads with the school's
   *  logo/initials chip + name (the customer's identity owns the space),
   *  instead of the product wordmark. */
  school?: SchoolOption;
  /** Tenant/school switcher — typically <SchoolSwitcher/>. */
  schoolSwitcher?: React.ReactNode;
  /** Breadcrumb trail — typically <AppBreadcrumbs/>. Hidden on mobile. */
  breadcrumbs?: React.ReactNode;
  /** Center command/search affordance — typically <OmniSearch/>. */
  search?: React.ReactNode;
  /** Optional action displayed immediately beside the search affordance. */
  searchAction?: React.ReactNode;
  /** Right-aligned actions: icon buttons, then the user menu. */
  actions?: React.ReactNode;
  className?: string;
}

export function AppHeader({
  brandLabel = 'SchoolWithEase',
  school,
  schoolSwitcher,
  breadcrumbs,
  search,
  searchAction,
  actions,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        // Horizontal padding matches --content-padding so the top-bar content
        // lines up with the page content below it.
        'grid h-[var(--header-height)] min-h-[50px] shrink-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border bg-sidebar px-[var(--content-padding)] sm:grid-cols-[minmax(0,auto)_minmax(2.25rem,1fr)_auto] sm:gap-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5 overflow-hidden">
        {/* At md+ the rail carries the brand; below md it lives here. When a
            school is active, lead with the school's logo/initials chip + name
            (the customer's identity owns the space) — same lockup as the nav
            switcher. Otherwise fall back to the product wordmark. */}
        {school ? (
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <InitialsAvatar
              square
              initials={school.initials}
              name={school.name}
              seed={school.id || school.name}
              color={school.color}
              imageUrl={school.logoUrl}
              className="size-8 shrink-0 shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset]"
              textClassName="text-[11px] font-extrabold"
            />
            <span className="truncate text-[14px] font-semibold leading-tight text-foreground">
              {school.name}
            </span>
          </div>
        ) : (
          <span className="truncate font-display text-[22px] font-bold leading-none text-foreground md:hidden">
            {brandLabel}
          </span>
        )}
        {schoolSwitcher}
        {breadcrumbs ? (
          <div className="min-w-0 overflow-hidden max-xl:hidden">
            {breadcrumbs}
          </div>
        ) : null}
      </div>
      {search ? (
        <div
          className={cn(
            'mx-auto flex min-w-0 items-center justify-self-center',
            searchAction
              ? 'w-auto gap-2 sm:w-full sm:max-w-[40rem]'
              : 'w-9 sm:w-full sm:max-w-[34rem]',
          )}
        >
          <div
            className={cn(
              'flex min-w-0',
              searchAction ? 'w-9 sm:flex-1' : 'w-full',
            )}
          >
            {search}
          </div>
          {searchAction}
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
