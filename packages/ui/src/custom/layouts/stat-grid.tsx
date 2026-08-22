'use client';

/* ============================================================
   StatGrid + StatCard — KPI / metric tile row

   The compact Aurora stat tile (`.ins-stat` / dashboard KPIs):
   label · big value · optional trend delta. StatGrid lays the tiles
   out in a responsive, row-balanced grid that never shifts the
   surrounding layout. Used by DashboardLayout but reusable anywhere.
   Data-driven (StatItem[]); no embedded copy.
   ============================================================ */

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { neonAvatarColor } from '@workspace/ui/lib/avatar-color';
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

/**
 * Grid classes for a KPI stat row — shared by StatGrid AND its skeleton so they
 * lay out identically (no column shift when data replaces the skeleton). Driven
 * by which cells hold a long (`wide`) value.
 *
 * When NO cell is wide: the dense short-value layout (2 columns on mobile → 3/4
 * on desktop).
 *
 * When SOME cells are wide (a full money amount — e.g. ₦100,000,000,000.00 is
 * ~257px on a phone / 304px on desktop at the largest text size, far more than a
 * ~150–170px 2-up phone tile): a 2-column mobile grid where the wide cells span
 * BOTH columns (money 1-up, full width) and the short cells pair up 2-across and
 * flow around them (`grid-flow-dense` fills the gaps) — so space is still used
 * well. On very wide desktops (@6xl) it's 3 columns and, via
 * {@link statCellSpanClass}, wide cells drop back to one column at @3xl where a
 * single column is already wide enough.
 */
export function statGridClass(wideCells: readonly boolean[]): string {
  const count = wideCells.length;
  if (count <= 1) return 'grid-cols-1';
  if (!wideCells.some(Boolean)) {
    if (count === 2) return 'grid-cols-2';
    if (count === 3 || count === 5 || count === 6)
      return 'grid-cols-2 @2xl/main:grid-cols-3';
    return 'grid-cols-2 @4xl/main:grid-cols-4';
  }
  return 'grid-flow-dense grid-cols-2 @6xl/main:grid-cols-3';
}

/** Per-cell span for a wide (long-value) cell in a {@link statGridClass} grid:
 *  full width on phones, back to one column at @3xl (~768px) where a single
 *  column is already wide enough for a full money amount at 110%. */
export function statCellSpanClass(wide: boolean): string {
  return wide ? 'col-span-2 @3xl/main:col-span-1' : '';
}

/**
 * Whether a stat value needs a full-width ("wide") cell. Explicit `item.wide`
 * always wins; otherwise a money amount is treated as wide automatically — a
 * full `₦…` value (always produced by formatNaira) is long enough to clip a
 * 2-up tile, especially at the largest text size. Keeps every money stat row
 * money-safe without hand-tagging each one.
 */
export function isWideStat(item: StatItem): boolean {
  if (item.wide != null) return item.wide;
  return (
    typeof item.value === 'string' && item.value.trimStart().startsWith('₦')
  );
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
        <span className="text-[calc(10px*var(--font-scale))] font-semibold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[calc(11.5px*var(--font-scale))]">
          {item.label}
        </span>
        {item.icon ? (
          <span
            aria-hidden
            className="[&_svg]:size-4"
            style={{ color: neonAvatarColor(item.key) }}
          >
            {item.icon}
          </span>
        ) : null}
      </div>
      {/* Stat value in the dedicated stat face (--font-stat, set in ui
          globals.css). font-stat is the single knob for every KPI. Long values
          (full money) are given room by a `wide` item taking a full-width cell
          on narrow screens — see statGridClass / statCellSpanClass. */}
      <div className="mt-2 font-stat text-[calc(22px*var(--font-scale))] font-bold leading-none text-foreground tabular-nums sm:text-[calc(26px*var(--font-scale))]">
        {item.value}
      </div>
      {/* The footnote line is ALWAYS laid out, even with nothing to say.

          Only some tiles carry a delta or a hint, so rendering the line
          conditionally left a row of tiles at two different heights — and the
          loading placeholder, which never drew it, shorter than either. A
          reserved empty line costs one line of whitespace and buys a row that
          does not reflow when the data lands. */}
      {item.delta || item.hint ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[calc(11px*var(--font-scale))] sm:text-[calc(12px*var(--font-scale))]">
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
      ) : (
        <div
          aria-hidden
          className="mt-2 text-[calc(11px*var(--font-scale))] sm:text-[calc(12px*var(--font-scale))]"
        >
          &nbsp;
        </div>
      )}
    </>
  );

  const base = cn(
    'min-w-0 rounded-[var(--radius)] border border-border bg-card p-3 text-left shadow-xs sm:p-4',
    interactive &&
      'outline-none transition-colors hover:border-ring/60 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50',
    item.active && 'border-ring bg-accent/50 ring-1 ring-ring',
    className,
  );
  const current = item.active ? ('true' as const) : undefined;

  if (item.href) {
    return (
      <a
        href={item.href}
        onClick={item.onSelect}
        className={base}
        aria-current={current}
      >
        {body}
      </a>
    );
  }
  if (item.onSelect) {
    return (
      <button
        type="button"
        onClick={item.onSelect}
        className={base}
        aria-pressed={item.active}
      >
        {body}
      </button>
    );
  }
  return <div className={base}>{body}</div>;
}

export interface StatGridProps {
  items: StatItem[];
  /** @deprecated No longer affects layout — a tile's width is content-driven by
   *  its own `wide` flag (StatItem.wide). Accepted only so existing call sites
   *  keep type-checking. */
  minTileWidth?: number;
  className?: string;
}

export function StatGrid({ items, className }: StatGridProps) {
  const wideCells = items.map(isWideStat);
  return (
    <div
      data-slot="stat-grid"
      className={cn(
        'grid gap-3 sm:gap-3.5',
        statGridClass(wideCells),
        className,
      )}
    >
      {items.map((item) => (
        <StatCard
          key={item.key}
          item={item}
          className={statCellSpanClass(isWideStat(item))}
        />
      ))}
    </div>
  );
}
