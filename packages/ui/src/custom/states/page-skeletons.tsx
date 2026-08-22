'use client';

/* ============================================================
   Page skeletons — full-page loading placeholders for route
   segment `loading.tsx` files.

   Each variant reproduces the standard page shell — a ShellMain
   scroll region, a layout-stable PageHeader row, then a body that
   mirrors one of the app's layout archetypes (data table, dashboard,
   list-detail, form, report, detail). Dropping the matching variant
   into a segment's `loading.tsx` gives the App Router an instant
   Suspense fallback: the shell paints the moment a link is clicked
   and the real server component streams in behind it, with no layout
   shift because the skeleton is the same shape as the content.

   IMPORTANT: every page renders inside the shell's `@container/main`
   region, so the responsive grids below use the SAME container-query
   breakpoints (`@md/main`, `@4xl/main`, `@5xl/main`, …) as the real
   layout primitives — never viewport breakpoints — so the skeleton
   column counts match the content exactly and nothing reflows when
   data arrives.

   The bars are decorative (aria-hidden); each page root announces a
   single busy "Loading" status for assistive tech.
   ============================================================ */

import * as React from 'react';

import { Skeleton } from '@workspace/ui/components/skeleton';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import {
  SkeletonForm,
  SkeletonList,
} from '@workspace/ui/custom/states/skeletons';
import { cn } from '@workspace/ui/lib/utils';
import {
  statCellSpanClass,
  statGridClass,
} from '@workspace/ui/custom/layouts/stat-grid';

/** Page-level busy wrapper: one polite status region per loading page. */
function PageSkeletonRoot({
  children,
  label = 'Loading',
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <ShellMain role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="contents">
        {children}
      </div>
    </ShellMain>
  );
}

export interface PageHeaderSkeletonProps {
  /** Render a meta sub-line beneath the title. Defaults to true. */
  withMeta?: boolean;
  /** Render a right-aligned actions cluster. Defaults to true. */
  withActions?: boolean;
  /** Number of action-button placeholders. Defaults to 2. */
  actions?: number;
  className?: string;
}

/** Mirrors PageHeader's head row (title + meta on the left, actions right). */
export function PageHeaderSkeleton({
  withMeta = true,
  withActions = true,
  actions = 2,
  className,
}: PageHeaderSkeletonProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-2.5',
        className,
      )}
    >
      <div className="flex min-w-[min(100%,12rem)] flex-1 flex-col gap-2">
        <Skeleton className="h-7 w-56 max-w-[70%]" />
        {withMeta ? <Skeleton className="h-3.5 w-72 max-w-[85%]" /> : null}
      </div>
      {withActions ? (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2.5 @md/main:ml-auto @md/main:w-auto">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                'h-9 rounded-[var(--radius-sm)]',
                i === 0 ? 'w-24' : 'w-32',
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface StatRowSkeletonProps {
  /** Number of stat tiles (all short values). Defaults to 4. Ignored when
   *  `wideCells` is given. */
  count?: number;
  /** Per-cell wide flags — mirrors the real StatGrid's per-item `wide` so the
   *  skeleton lays out with the exact same full-width / paired cells. */
  wideCells?: readonly boolean[];
  className?: string;
}

/** A KPI stat row that mirrors StatGrid (SAME shared grid + per-cell span
 *  helpers and StatCard shape) so it lays out identically to the real band. */
export function StatRowSkeleton({
  count = 4,
  wideCells,
  className,
}: StatRowSkeletonProps) {
  const cells = wideCells ?? Array.from({ length: count }, () => false);
  return (
    <div
      className={cn('grid gap-3 sm:gap-3.5', statGridClass(cells), className)}
    >
      {cells.map((wide, i) => (
        <div
          key={i}
          className={cn(
            'min-w-0 rounded-[var(--radius)] border border-border bg-card p-3 shadow-xs sm:p-4',
            statCellSpanClass(wide),
          )}
        >
          {/* Each line below is the REAL StatCard line box — same classes, same
              `&nbsp;` strut — with the grey bar laid inside it. Sizing the bars
              directly instead drifted: a phone tile measured 98px against the
              card's 92px, because `h-6` is not the value's 22px line and `h-3`
              is not the footnote's 17px one. Borrowing the box removes the
              guesswork; the bar only has to be shorter than the line it sits
              in. */}
          <div className="flex min-h-4 items-center justify-between gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="size-4 rounded" />
          </div>
          <div className="relative mt-2 font-stat text-[calc(22px*var(--font-scale))] leading-none sm:text-[calc(26px*var(--font-scale))]">
            &nbsp;
            <Skeleton className="absolute inset-y-0 left-0 my-auto h-5 w-24" />
          </div>
          {/* The footnote line every real tile reserves — without it the
              placeholder is a line shorter than the tile it stands for. */}
          <div className="relative mt-2 text-[calc(11px*var(--font-scale))] sm:text-[calc(12px*var(--font-scale))]">
            &nbsp;
            <Skeleton className="absolute inset-y-0 left-0 my-auto h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A Card-framed data-table placeholder that mirrors DataTableLayout:
 *  a toolbar header (title + search/filter/action) then a column grid. */
function DataTableCardSkeleton({
  rows = 6,
  columns = 5,
  withToolbar = true,
}: {
  rows?: number;
  columns?: number;
  withToolbar?: boolean;
}) {
  /**
   * `minmax(7rem, …)`, not `minmax(0, …)`.
   *
   * A real table keeps its columns at their natural width and SCROLLS when
   * they do not fit — measured on a phone: a 583px table inside a 329px
   * scroller. With a zero minimum the placeholder did the opposite, cramming
   * five columns into the screen, so the mobile skeleton looked nothing like
   * the table it stood for. A floor makes the tracks overflow their scroller
   * exactly as the real ones do, and on a wide screen `1fr` still wins, so
   * desktop is unchanged.
   */
  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${columns}, minmax(7rem, 1fr))`,
  };
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card">
      {withToolbar ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-border px-4 py-3.5 sm:px-6">
          <div className="min-w-0 flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-48 rounded-[var(--radius-sm)]" />
            <Skeleton className="h-9 w-24 rounded-[var(--radius-sm)]" />
          </div>
        </div>
      ) : null}
      {/* Header + body share one scroller, so they scroll together as the
          real table's do. */}
      <div className="w-full overflow-x-auto">
        {/* Header row */}
        <div
          className="grid gap-4 border-b border-border bg-secondary/50 px-4 py-3 sm:px-6"
          style={gridStyle}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 w-2/3" />
          ))}
        </div>
        {/* Body rows */}
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, r) => (
            <div
              key={r}
              className="grid min-h-[var(--table-row-h,3.25rem)] items-center gap-4 px-4 sm:px-6"
              style={gridStyle}
            >
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton
                  key={c}
                  className={cn('h-3.5', c === 0 ? 'w-3/4' : 'w-1/2')}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface TablePageSkeletonProps {
  /** Table body rows. Defaults to 6. */
  rows?: number;
  /** Table columns. Defaults to 5. */
  columns?: number;
  /** Number of stat cards above the table (0 hides the row). Defaults to 0. */
  stats?: number;
  /** Header action buttons. Defaults to 2. */
  actions?: number;
}

/** Data-table page: header, optional stat row, then a table card. */
export function TablePageSkeleton({
  rows = 6,
  columns = 5,
  stats = 0,
  actions = 2,
}: TablePageSkeletonProps) {
  return (
    <PageSkeletonRoot>
      <PageHeaderSkeleton actions={actions} />
      {stats > 0 ? <StatRowSkeleton count={stats} /> : null}
      <DataTableCardSkeleton rows={rows} columns={columns} />
    </PageSkeletonRoot>
  );
}

/** A single Card placeholder: title + a stack of list rows. */
function BlockCardSkeleton({
  lines = 4,
  compact = false,
}: {
  lines?: number;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4 rounded-[var(--radius)] border border-border bg-card p-5">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
      <SkeletonList rows={lines} withAvatar={!compact} />
    </div>
  );
}

export interface DashboardPageSkeletonProps {
  /** Stat cards in the top row. Defaults to 4. */
  stats?: number;
  /** Per-cell wide flags for the KPI row — mirrors the dashboard's per-item
   *  `wide` (money tiles) so the skeleton's full-width/paired cells match.
   *  When omitted, `stats` short tiles are drawn. */
  wideStats?: readonly boolean[];
  /** Large content cards in the main column. Defaults to 2. */
  mainCards?: number;
  /** Cards in the side rail. Defaults to 2. */
  asideCards?: number;
}

/** Persona dashboard: header, KPI stat row, then a main + aside grid that
 *  matches DashboardLayout's equal-width split. */
export function DashboardPageSkeleton({
  stats = 4,
  wideStats,
  mainCards = 2,
  asideCards = 2,
}: DashboardPageSkeletonProps) {
  return (
    <PageSkeletonRoot>
      <PageHeaderSkeleton actions={1} />
      <StatRowSkeleton count={stats} wideCells={wideStats} />
      <div className="grid grid-cols-1 gap-5 @5xl/main:grid-cols-2">
        <div className="order-2 flex flex-col gap-5 @5xl/main:order-1">
          {Array.from({ length: mainCards }).map((_, i) => (
            <BlockCardSkeleton key={i} lines={5} />
          ))}
        </div>
        <div className="order-1 flex flex-col gap-5 @5xl/main:order-2">
          {Array.from({ length: asideCards }).map((_, i) => (
            <BlockCardSkeleton key={i} lines={4} compact />
          ))}
        </div>
      </div>
    </PageSkeletonRoot>
  );
}

export interface ListDetailPageSkeletonProps {
  /**
   * Picker / filter controls sitting between the header and the panes.
   *
   * These pages choose their subject before they show anything — a class on
   * Lesson materials, a subject and a search on Assessments — and that row is
   * part of the page's silhouette, not decoration. Omitting it made the
   * placeholder a whole control-row shorter than the page.
   */
  filters?: number;
  /**
   * What the detail pane holds: a read-out with figures (`'summary'`, the
   * default) or an editor (`'form'`). Lesson materials opens straight into a
   * title-and-notes form, where a row of stat tiles is simply not what arrives.
   */
  detail?: 'summary' | 'form';
  /** Rows in the master list pane. Defaults to 7. */
  listRows?: number;
  /** Header action buttons. Defaults to 1. */
  actions?: number;
}

/** List-detail page: header, then a single card split into a fixed master
 *  list and a flexible detail pane, matching ListDetailLayout. */
export function ListDetailPageSkeleton({
  listRows = 7,
  actions = 1,
  filters = 0,
  detail = 'summary',
}: ListDetailPageSkeletonProps) {
  return (
    <PageSkeletonRoot>
      <PageHeaderSkeleton actions={actions} />
      {filters > 0 ? (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: filters }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-9 w-full max-w-xs rounded-[var(--radius-sm)] sm:w-64"
            />
          ))}
        </div>
      ) : null}
      <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card @3xl/main:flex-row">
        <div className="min-w-0 space-y-4 p-4 @3xl/main:w-[var(--list-width)] @3xl/main:shrink-0 @3xl/main:border-r @3xl/main:border-border">
          <Skeleton className="h-9 w-full rounded-[var(--radius-sm)]" />
          <SkeletonList rows={listRows} />
        </div>
        <div className="min-w-0 flex-1 space-y-5 p-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
          {detail === 'form' ? (
            // Label + control, the shape an editor actually arrives in.
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className={cn(i === 2 ? 'h-24' : 'h-9', 'w-full')} />
              </div>
            ))
          ) : (
            <>
              <StatRowSkeleton count={2} />
              <div className="space-y-2.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className={cn('h-3.5', i % 3 === 2 ? 'w-2/3' : 'w-full')}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PageSkeletonRoot>
  );
}

export interface FormPageSkeletonProps {
  /** Label+field pairs. Defaults to 6. */
  fields?: number;
  /** Render a settings-style left nav rail beside the form. Defaults to false. */
  withNav?: boolean;
  /** Header action buttons. Defaults to 1. */
  actions?: number;
}

/** Form / settings page: header, then a form card (optionally beside a nav
 *  rail, matching SettingsLayout's `@3xl/main:flex-row`). */
export function FormPageSkeleton({
  fields = 6,
  withNav = false,
  actions = 1,
}: FormPageSkeletonProps) {
  const formCard = (
    <div className="space-y-6 rounded-[var(--radius)] border border-border bg-card p-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>
      <SkeletonForm fields={fields} />
      <div className="flex justify-end gap-2.5 pt-2">
        <Skeleton className="h-9 w-24 rounded-[var(--radius-sm)]" />
        <Skeleton className="h-9 w-28 rounded-[var(--radius-sm)]" />
      </div>
    </div>
  );

  return (
    <PageSkeletonRoot>
      <PageHeaderSkeleton actions={actions} />
      {withNav ? (
        <div className="flex flex-col gap-5 @3xl/main:flex-row @3xl/main:gap-8">
          <div className="space-y-2 @3xl/main:w-[var(--settings-nav-width)] @3xl/main:shrink-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-9 w-full rounded-[var(--radius-sm)]"
              />
            ))}
          </div>
          <div className="min-w-0 flex-1">{formCard}</div>
        </div>
      ) : (
        formCard
      )}
    </PageSkeletonRoot>
  );
}

export interface ReportPageSkeletonProps {
  /** Stat cards in the top row. Defaults to 4. */
  stats?: number;
  /** Chart/table blocks below the stats. Defaults to 2. */
  charts?: number;
  /** Header action buttons. Defaults to 2. */
  actions?: number;
}

/** Reporting page: header, KPI stat row, then tall chart blocks laid out
 *  with the same `@4xl/main:grid-cols-2` split the report pages use. */
export function ReportPageSkeleton({
  stats = 4,
  charts = 2,
  actions = 2,
}: ReportPageSkeletonProps) {
  return (
    <PageSkeletonRoot>
      <PageHeaderSkeleton actions={actions} />
      <StatRowSkeleton count={stats} />
      <div
        className={cn(
          'grid gap-4',
          charts > 1 ? '@4xl/main:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {Array.from({ length: charts }).map((_, i) => (
          <div
            key={i}
            className="space-y-4 rounded-[var(--radius)] border border-border bg-card p-5"
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-48 w-full rounded-[var(--radius-sm)]" />
          </div>
        ))}
      </div>
    </PageSkeletonRoot>
  );
}

/**
 * Busy wrapper for a skeleton that fills a slot INSIDE a page shell that has
 * already painted — a `loading.tsx` nested under a layout that renders the
 * header. It must NOT open a second `ShellMain`, which would nest one scroll
 * region inside another.
 */
function BodySkeletonRoot({
  children,
  label = 'Loading',
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden className="contents">
        {children}
      </div>
    </div>
  );
}

/**
 * The placeholder shown from the moment a navigation is CLICKED until the
 * destination takes over.
 *
 * Deliberately one flat busy region — a page header and a body slab, no nested
 * regions — because it hands over to whichever route skeleton the destination
 * defines, and those are a single region too. A composed placeholder (stat row
 * plus cards) changes shape at the handover, which reads as a second loader
 * rather than as the same wait continuing.
 *
 * It cannot know the destination's silhouette, so it does not pretend to: it
 * says "this page is changing" and gets out of the way.
 */
export function PageChangeSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-0 flex-1 flex-col gap-6"
    >
      <span className="sr-only">Loading</span>
      <div aria-hidden className="flex min-h-0 flex-1 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-56 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        {/* Fills the page rather than a third of it. The destination's own,
            richer skeleton takes over a few hundred milliseconds later, and a
            slab that already occupies the content area means that handover
            adds detail in place instead of visibly growing. */}
        <Skeleton className="min-h-[60vh] w-full flex-1 rounded-[var(--radius)]" />
      </div>
    </div>
  );
}

export interface DetailBodySkeletonProps {
  /** Number of stacked content section cards. Defaults to 3. */
  sections?: number;
  /** Show a KPI stat row above the sections. Defaults to false. */
  withStats?: boolean;
}

/**
 * The BODY of a record-detail page — sections, optionally a stat row, and no
 * header. For a tabbed record whose chrome lives in a layout: the layout keeps
 * the header and tab strip painted, and only this swaps while the next tab
 * streams in.
 */
export function DetailBodySkeleton({
  sections = 3,
  withStats = false,
}: DetailBodySkeletonProps) {
  return (
    <BodySkeletonRoot>
      {withStats ? <StatRowSkeleton count={3} /> : null}
      {Array.from({ length: sections }).map((_, i) => (
        <BlockCardSkeleton key={i} lines={4} />
      ))}
    </BodySkeletonRoot>
  );
}

/** A folder-tab strip at rest: a row of tab-width bars sitting on the rule. */
function TabStripSkeleton({ tabs = 4 }: { tabs?: number }) {
  return (
    <div className="flex items-end gap-3 border-b border-border pb-2">
      {Array.from({ length: tabs }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-6"
          style={{ width: `${58 + (i % 3) * 22}px` }}
        />
      ))}
    </div>
  );
}

export interface DetailPageSkeletonProps {
  /** Number of stacked content section cards. Defaults to 3. */
  sections?: number;
  /** Show a KPI stat row beneath the header. Defaults to true. */
  withStats?: boolean;
  /** Header action buttons. Defaults to 2. */
  actions?: number;
  /**
   * Show a tab strip between the header and the body. Set it for a page whose
   * content sits behind tabs, so the strip does not pop in after the skeleton
   * clears. Pass the number of tabs when it is known.
   */
  withTabs?: boolean | number;
}

/** Record-detail page ([id], roster, onboarding): header, stats, sections. */
export function DetailPageSkeleton({
  sections = 3,
  withStats = true,
  actions = 2,
  withTabs = false,
}: DetailPageSkeletonProps) {
  return (
    <PageSkeletonRoot>
      <PageHeaderSkeleton actions={actions} />
      {withTabs ? (
        <TabStripSkeleton tabs={typeof withTabs === 'number' ? withTabs : 4} />
      ) : null}
      {withStats ? <StatRowSkeleton count={3} /> : null}
      {Array.from({ length: sections }).map((_, i) => (
        <BlockCardSkeleton key={i} lines={4} />
      ))}
    </PageSkeletonRoot>
  );
}
