'use client';

/* ============================================================
   StatGrid + StatCard — KPI / metric tile row

   The compact Aurora stat tile (`.ins-stat` / dashboard KPIs):
   label · big value · optional trend delta. StatGrid lays the tiles
   out in a responsive auto-fitting grid that never shifts the
   surrounding layout. Used by DashboardLayout but reusable anywhere.
   Data-driven (StatItem[]); no embedded copy.
   ============================================================ */

import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import type { StatDelta, StatItem } from '@workspace/ui/types/layout.types';

/** Resolve a delta's colour from its intent (falling back to direction). */
function deltaToneClass(delta: StatDelta): string {
  const intent =
    delta.intent ??
    (delta.direction === 'up'
      ? 'positive'
      : delta.direction === 'down'
        ? 'negative'
        : 'neutral');
  if (intent === 'positive') return 'text-success';
  if (intent === 'negative') return 'text-destructive';
  return 'text-muted-foreground';
}

function DeltaGlyph({ direction }: { direction: StatDelta['direction'] }) {
  const Icon =
    direction === 'up'
      ? ArrowUpRight
      : direction === 'down'
        ? ArrowDownRight
        : Minus;
  return <Icon aria-hidden className="size-3.5" />;
}

export interface StatCardProps {
  item: StatItem;
  className?: string;
}

export function StatCard({ item, className }: StatCardProps) {
  const interactive = Boolean(item.href || item.onSelect);

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[11.5px]">
          {item.label}
        </span>
        {item.icon ? (
          <span aria-hidden className="text-muted-foreground [&_svg]:size-4">
            {item.icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-[22px] font-extrabold leading-none tracking-[-0.01em] text-foreground tabular-nums sm:text-[26px]">
        {item.value}
      </div>
      {item.delta || item.hint ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] sm:text-[12px]">
          {item.delta ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold',
                deltaToneClass(item.delta),
              )}
            >
              <DeltaGlyph direction={item.delta.direction} />
              {item.delta.label}
            </span>
          ) : null}
          {item.hint ? (
            <span className="text-muted-foreground">{item.hint}</span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const base = cn(
    'min-w-0 min-h-[7.5rem] rounded-[var(--radius)] border border-border bg-card p-3 text-left shadow-xs sm:min-h-0 sm:p-4',
    interactive &&
      'outline-none transition-colors hover:border-ring/60 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50',
    className,
  );

  if (item.href) {
    return (
      <a href={item.href} onClick={item.onSelect} className={base}>
        {body}
      </a>
    );
  }
  if (item.onSelect) {
    return (
      <button type="button" onClick={item.onSelect} className={base}>
        {body}
      </button>
    );
  }
  return <div className={base}>{body}</div>;
}

export interface StatGridProps {
  items: StatItem[];
  /**
   * Minimum tile width before wrapping (auto-fit grid). Smaller values
   * pack more per row. Defaults to 200px.
   */
  minTileWidth?: number;
  className?: string;
}

export function StatGrid({
  items,
  minTileWidth = 200,
  className,
}: StatGridProps) {
  return (
    <div
      data-slot="stat-grid"
      className={cn('grid gap-3 sm:gap-3.5', className)}
      style={
        {
          gridTemplateColumns: `repeat(auto-fit, minmax(min(${minTileWidth}px, 100%), 1fr))`,
        } as React.CSSProperties
      }
    >
      {items.map((item) => (
        <StatCard key={item.key} item={item} />
      ))}
    </div>
  );
}
