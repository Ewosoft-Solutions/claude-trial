'use client';

/* ============================================================
   DataTableLayout — table surface scaffold

   A Card-framed collection view: a toolbar header (title + search /
   filters / actions), the table body, and an optional footer
   (pagination / selection summary). Wires the M5 state components —
   `loading` swaps in a SkeletonTable, `empty` swaps in the
   consumer-supplied EmptyState — so a table view never renders blank.
   The table itself (built from the shared Table primitive) is passed
   as children; copy stays consumer-supplied.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';
import { SkeletonTable } from '@workspace/ui/custom/states/skeletons';

export interface DataTableLayoutProps {
  /** Collection title, e.g. "Students". */
  title?: React.ReactNode;
  /** Optional sub-line beneath the title (count, scope). */
  description?: React.ReactNode;
  /** Right-aligned toolbar slot (search, filters, primary action). */
  toolbar?: React.ReactNode;
  /** The table — typically built from the shared Table primitive. */
  children: React.ReactNode;
  /** Show the loading placeholder instead of the table. */
  loading?: boolean;
  /** Show the empty state instead of the table (ignored while loading). */
  empty?: boolean;
  /** Empty-state slot (typically <EmptyState/>); required when `empty`. */
  emptyState?: React.ReactNode;
  /** Override the default loading placeholder. */
  loadingState?: React.ReactNode;
  /** Rows/columns for the default SkeletonTable placeholder. */
  skeletonRows?: number;
  skeletonColumns?: number;
  /** Footer slot (pagination, bulk actions). Hidden in loading/empty. */
  footer?: React.ReactNode;
  className?: string;
}

export function DataTableLayout({
  title,
  description,
  toolbar,
  children,
  loading = false,
  empty = false,
  emptyState,
  loadingState,
  skeletonRows = 6,
  skeletonColumns = 5,
  footer,
  className,
}: DataTableLayoutProps) {
  const hasHeader = Boolean(title || description || toolbar);

  return (
    <section
      data-slot="data-table-layout"
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card',
        className,
      )}
    >
      {hasHeader ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-border px-4 py-3">
          {title || description ? (
            <div className="min-w-0 flex flex-col gap-0.5">
              {title ? (
                <h2 className="truncate text-sm font-bold text-foreground">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="truncate text-[12.5px] text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          ) : null}
          {toolbar ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {toolbar}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="min-w-0">
        {loading ? (
          <div className="p-4">
            {loadingState ?? (
              <SkeletonTable
                rows={skeletonRows}
                columns={skeletonColumns}
                className="border-0"
              />
            )}
          </div>
        ) : empty ? (
          <div className="px-4">{emptyState}</div>
        ) : (
          <div className="overflow-x-auto">{children}</div>
        )}
      </div>

      {footer && !loading && !empty ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-[12.5px] text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
