'use client';

/* ============================================================
   CategoryBarChart — grouped/stacked bar chart over a category axis

   Data-driven wrapper over the shadcn `chart` primitive + recharts,
   sibling to TrendChart. Supports vertical columns (default) or
   horizontal bars, single or multiple series, grouped or stacked.
   Holds no product copy — the preview surface supplies the data,
   the category key, and the series. Keeps recharts in `packages/ui`.
   ============================================================ */

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@workspace/ui/components/chart';
import { cn } from '@workspace/ui/lib/utils';
import type { ChartDatum, ChartSeries } from '@workspace/ui/types/chart.types';

/** Rotating fallback palette (maps to the `--chart-N` theme tokens). */
const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

/** Build the primitive's colour config from the series list. */
function toConfig(series: readonly ChartSeries[]): ChartConfig {
  return Object.fromEntries(
    series.map((s, i) => [
      s.key,
      { label: s.label, color: s.color ?? PALETTE[i % PALETTE.length] },
    ]),
  );
}

export interface CategoryBarChartProps {
  /** Data rows; each holds `xKey` plus one numeric value per series. */
  data: ChartDatum[];
  /** Row key for the category axis, e.g. `'grade'`. */
  xKey: string;
  /** Series to plot. */
  series: readonly ChartSeries[];
  /** Bar direction: `column` (vertical, default) or `bar` (horizontal). */
  orientation?: 'column' | 'bar';
  /** Stack series instead of grouping them side-by-side. */
  stacked?: boolean;
  /** Show the series legend beneath the plot. Defaults to multi-series. */
  showLegend?: boolean;
  /** Plot height in px. Defaults to 240. */
  height?: number;
  /** Format a category-axis tick value for display. */
  categoryFormatter?: (value: string) => string;
  className?: string;
  /** Accessible name for the chart region. */
  'aria-label'?: string;
}

export function CategoryBarChart({
  data,
  xKey,
  series,
  orientation = 'column',
  stacked = false,
  showLegend,
  height = 240,
  categoryFormatter,
  className,
  'aria-label': ariaLabel,
}: CategoryBarChartProps) {
  const config = React.useMemo(() => toConfig(series), [series]);
  const withLegend = showLegend ?? series.length > 1;
  const horizontal = orientation === 'bar';
  const stackId = stacked ? 'a' : undefined;
  // Round the outer end of each bar; for stacks recharts only honours the
  // radius on the last segment, so a uniform small radius reads cleanly.
  const radius = stacked ? 2 : 4;

  return (
    <ChartContainer
      config={config}
      className={cn('aspect-auto w-full', className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ left: 4, right: 4, top: 4 }}
      >
        <CartesianGrid horizontal={!horizontal} vertical={horizontal} />
        {/* Axes must be DIRECT children of BarChart — recharts discovers them
            by type and does not look through React fragments. The category axis
            (x for columns, y for bars) carries the dataKey + formatter. */}
        <XAxis
          type={horizontal ? 'number' : 'category'}
          dataKey={horizontal ? undefined : xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={horizontal ? undefined : categoryFormatter}
        />
        <YAxis
          type={horizontal ? 'category' : 'number'}
          dataKey={horizontal ? xKey : undefined}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={horizontal ? 72 : 32}
          tickFormatter={horizontal ? categoryFormatter : undefined}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={<ChartTooltipContent />}
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={`var(--color-${s.key})`}
            stackId={stackId}
            radius={radius}
            isAnimationActive={false}
          />
        ))}
        {withLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
      </BarChart>
    </ChartContainer>
  );
}
