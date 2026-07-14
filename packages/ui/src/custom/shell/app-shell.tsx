'use client';

/* ============================================================
   AppShell — Aurora Layout A application frame

   The structural chrome for authenticated surfaces:

     ┌───────────────── header ─────────────────┐
     │ rail │ nav │      main      │ inspector   │
     └──────────────── status bar ──────────────┘

   Pure layout primitive driven by slots. Consumes the
   layout-dimension tokens (--header-height, --rail-width,
   --nav-width, --inspector-width) and colour roles from the
   Milestone 2 token layer — no hardcoded dimensions or colours.

   Responsive behaviour (CSS-only, SSR-safe — no layout shift):
     • <md   : rail becomes a collapsible side navigation (rendered
               by AppSidebar); inspector and status bar are hidden.
     • md–lg : icon rail visible, secondary nav hidden.
     • lg+   : icon rail + secondary nav visible.
     • xl+   : inspector visible (when provided).
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

export interface AppShellProps {
  /** Top bar — typically <AppHeader/>. */
  header?: React.ReactNode;
  /** Desktop rail/panel and mobile side navigation — <AppSidebar/>. */
  sidebar?: React.ReactNode;
  /** Optional right-hand contextual panel (inspector). Shown at xl+. */
  inspector?: React.ReactNode;
  /** Optional bottom status bar. Hidden on mobile. */
  statusBar?: React.ReactNode;
  /** Main content region. */
  children: React.ReactNode;
  className?: string;
  /** Optional bottom inset reserved by mobile shell overlays. */
  mobileBottomInset?: string;
}

export function AppShell({
  header,
  sidebar,
  inspector,
  statusBar,
  children,
  className,
  mobileBottomInset = '0rem',
}: AppShellProps) {
  return (
    <div
      data-slot="app-shell"
      style={
        {
          '--shell-mobile-bottom-inset': mobileBottomInset,
        } as React.CSSProperties
      }
      className={cn(
        'relative flex h-full w-full flex-col overflow-hidden bg-background font-sans text-foreground',
        className,
      )}
    >
      {header}

      <div className="flex min-h-0 flex-1">
        {sidebar}

        <main className="@container/main flex min-w-0 flex-1 flex-col bg-background pb-[var(--shell-mobile-bottom-inset)] md:pb-0">
          {children}
        </main>

        {inspector ? (
          <aside
            data-slot="app-inspector"
            className="hidden w-[var(--inspector-width)] shrink-0 flex-col border-l border-border bg-sidebar xl:flex"
          >
            {inspector}
          </aside>
        ) : null}
      </div>

      {statusBar ? <div className="max-md:hidden">{statusBar}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------
   ShellMain — optional padded scroll region for page content.
   Consumes the --content-padding token. Pages can use this or
   supply their own layout pattern (Milestone 6).
   ------------------------------------------------------------ */
export interface ShellMainProps extends React.ComponentProps<'div'> {
  /** Apply the standard --content-padding inset. */
  padded?: boolean;
}

export function ShellMain({
  className,
  padded = true,
  ...props
}: ShellMainProps) {
  return (
    <div
      data-slot="shell-main"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto',
        // Reserve extra bottom space on mobile so the last row/card clears the
        // fixed AI launcher FAB (bottom-right) instead of scrolling under it.
        // On md+ the FAB sits in the corner clear of content, so the standard
        // inset is enough.
        padded && 'p-[var(--content-padding)] max-md:pb-24',
        className,
      )}
      {...props}
    />
  );
}
