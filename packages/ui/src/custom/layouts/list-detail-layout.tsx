'use client';

/* ============================================================
   ListDetailLayout — master/detail (two-pane) scaffold

   A fixed-width master list beside a flexible detail pane (the
   Aurora "list + summary" shape). Responsive: on < md only one pane
   shows at a time — the list by default, or the detail when
   `showDetail` is set (the consumer drives this from its selection,
   and supplies any "back to list" affordance inside the detail).
   Slots only; no embedded copy.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

export interface ListDetailLayoutProps {
  /** Master list / index pane. */
  list: React.ReactNode;
  /** Detail pane for the active item (or an empty-selection state). */
  detail: React.ReactNode;
  /**
   * Mobile active pane: when true the detail shows and the list hides
   * (< md only). Ignored at md+, where both panes are always visible.
   */
  showDetail?: boolean;
  /** Master column width at md+. Defaults to 320px. */
  listWidth?: number;
  className?: string;
}

export function ListDetailLayout({
  list,
  detail,
  showDetail = false,
  listWidth = 320,
  className,
}: ListDetailLayoutProps) {
  return (
    <div
      data-slot="list-detail-layout"
      style={{ ['--list-width' as string]: `${listWidth}px` }}
      className={cn(
        'flex min-h-0 w-full flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card @3xl/main:flex-row',
        className,
      )}
    >
      <div
        data-slot="list-detail-master"
        className={cn(
          'min-w-0 @3xl/main:w-[var(--list-width)] @3xl/main:shrink-0 @3xl/main:border-r @3xl/main:border-border',
          'overflow-y-auto',
          showDetail ? 'hidden @3xl/main:block' : 'block',
        )}
      >
        {list}
      </div>
      <div
        data-slot="list-detail-detail"
        className={cn(
          'min-w-0 flex-1 overflow-y-auto',
          showDetail ? 'block' : 'hidden @3xl/main:block',
        )}
      >
        {detail}
      </div>
    </div>
  );
}
