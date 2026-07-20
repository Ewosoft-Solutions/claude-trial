'use client';

/* ============================================================
   Skeleton patterns — content-shaped loading placeholders

   Composed from the shared Skeleton primitive. Each pattern mirrors
   the shape of the content it stands in for so the layout does not
   shift when real data arrives. Patterns are decorative (the bars
   are aria-hidden) but each root announces a busy "Loading" status.

   Use these when the eventual layout is known (lists, tables, card
   grids, forms). For short / indeterminate waits use LoadingState.
   ============================================================ */

import * as React from 'react';

import { Skeleton } from '@workspace/ui/components/skeleton';
import { cn } from '@workspace/ui/lib/utils';

/** Shared busy wrapper: marks the region as loading for assistive tech. */
function SkeletonRegion({
  className,
  children,
  label = 'Loading',
}: {
  className?: string;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div
      data-slot="skeleton-pattern"
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={className}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

export interface SkeletonTextProps {
  /** Number of lines. Defaults to 3. */
  lines?: number;
  /** Render the final line shorter, as real paragraphs read. */
  lastLineShort?: boolean;
  className?: string;
}

/** Stacked text lines (paragraph / description placeholder). */
export function SkeletonText({
  lines = 3,
  lastLineShort = true,
  className,
}: SkeletonTextProps) {
  return (
    <SkeletonRegion className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-3.5',
            lastLineShort && i === lines - 1 ? 'w-2/3' : 'w-full',
          )}
        />
      ))}
    </SkeletonRegion>
  );
}

export interface SkeletonListProps {
  /** Number of rows. Defaults to 5. */
  rows?: number;
  /** Show a leading avatar/icon block per row. */
  withAvatar?: boolean;
  className?: string;
}

/** Repeated rows of an avatar + two text lines (list / feed placeholder). */
export function SkeletonList({
  rows = 5,
  withAvatar = true,
  className,
}: SkeletonListProps) {
  return (
    <SkeletonRegion className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          {withAvatar ? (
            <Skeleton className="size-9 shrink-0 rounded-full" />
          ) : null}
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

export interface SkeletonTableProps {
  /** Body rows. Defaults to 5. */
  rows?: number;
  /** Columns. Defaults to 4. */
  columns?: number;
  /** Render a header row. Defaults to true. */
  withHeader?: boolean;
  className?: string;
}

/** A table-shaped grid of cells (data-table placeholder). */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  withHeader = true,
  className,
}: SkeletonTableProps) {
  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  };
  return (
    <SkeletonRegion
      className={cn(
        'overflow-hidden rounded-[var(--radius-sm)] border border-border',
        className,
      )}
    >
      {withHeader ? (
        <div
          className="grid gap-4 border-b border-border bg-secondary/50 px-4 py-3"
          style={gridStyle}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 w-2/3" />
          ))}
        </div>
      ) : null}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid gap-4 px-4 py-3.5" style={gridStyle}>
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn('h-3.5', c === 0 ? 'w-3/4' : 'w-1/2')}
              />
            ))}
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export interface SkeletonCardGridProps {
  /** Number of cards. Defaults to 4. */
  count?: number;
  /** Tailwind grid-cols utility classes for the layout. */
  columnsClassName?: string;
  className?: string;
}

/** A grid of stat/summary card placeholders. */
export function SkeletonCardGrid({
  count = 4,
  columnsClassName = 'sm:grid-cols-2 lg:grid-cols-4',
  className,
}: SkeletonCardGridProps) {
  return (
    <SkeletonRegion className={cn('grid gap-4', columnsClassName, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-[var(--radius)] border border-border bg-card p-5"
        >
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export interface SkeletonFormProps {
  /** Number of label + field pairs. Defaults to 4. */
  fields?: number;
  className?: string;
}

/** Stacked label + input placeholders (form placeholder). */
export function SkeletonForm({ fields = 4, className }: SkeletonFormProps) {
  return (
    <SkeletonRegion className={cn('space-y-5', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full rounded-[var(--radius-sm)]" />
        </div>
      ))}
    </SkeletonRegion>
  );
}
