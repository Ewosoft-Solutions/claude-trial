/* ============================================================
   Detail primitives — shared building blocks for detail drawers + panes

   The small, pure layout pieces a drill-in drawer or a profile pane is
   built from: a titled `Section` with a hairline divider, a two-column
   `DetailGrid` of labelled `Field`s, and a row of metric `StatTiles`.
   Promoted out of the People directory so any surface (People, Admissions,
   …) reads with the same hierarchy — a Section title is bold/foreground,
   a Field label is small + muted, and the two never look like the same
   level.

   Presentational + server-safe (no hooks). Copy is consumer-supplied.
   `StatTiles` grids to three across on a `@container/tiles` ancestor.
   ============================================================ */
import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';
import type { StateTone } from '@workspace/ui/types/states.types';

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">{children}</div>;
}

export function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[calc(10.5px*var(--font-scale))] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="break-words text-sm text-foreground">
        {value ?? <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

export interface StatTileItem {
  key: string;
  label: string;
  value: React.ReactNode;
  tone?: StateTone;
}

export function StatTiles({ items }: { items: StatTileItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2.5 @md/tiles:grid-cols-3">
      {items.map((it) => (
        <div
          key={it.key}
          // Matches a page stat card cell (StatGrid) exactly: the opaque card
          // fill rather than a 40% wash that picks up the ground's warmth and
          // reads cream, the shared --radius rather than a tighter rounded-lg,
          // and the same shadow so the tile lifts off the canvas the way a page
          // card does. Padding stays p-3 — a drawer tile is narrower than a
          // full-page one, and StatGrid's sm:p-4 would crowd it.
          className="rounded-[var(--radius)] border border-border bg-card p-3 shadow-xs"
        >
          <div className="text-[calc(10.5px*var(--font-scale))] font-medium uppercase tracking-wide text-muted-foreground">
            {it.label}
          </div>
          <div
            className={cn(
              'mt-1 text-lg font-bold tabular-nums text-foreground',
              it.tone === 'destructive' && 'text-destructive',
              it.tone === 'warning' && 'text-amber-500',
            )}
          >
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}
