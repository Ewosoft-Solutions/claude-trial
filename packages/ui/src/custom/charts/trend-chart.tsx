'use client';

/* ============================================================
   TrendChart — multi-series area/line chart over a category axis

   A thin, data-driven wrapper over the shadcn `chart` primitive +
   recharts. Holds no product copy: the preview surface supplies the
   data rows, the x-axis key, and the series (key + label + optional
   colour). Keeps recharts confined to `packages/ui` so app pages
   consume a typed component instead of importing recharts directly.
   ============================================================ */

import * as React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
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
import { formatCompactNumber } from '@workspace/ui/lib/format';
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

export interface TrendChartProps {
  /** Data rows; each holds `xKey` plus one numeric value per series. */
  data: ChartDatum[];
  /** Row key for the category (x) axis, e.g. `'month'`. */
  xKey: string;
  /** Series to plot. */
  series: readonly ChartSeries[];
  /** Render filled bands (`area`, default) or plain lines (`line`). */
  variant?: 'area' | 'line';
  /** Stack series on top of each other (area variant). */
  stacked?: boolean;
  /** Show the series legend beneath the plot. Defaults to multi-series. */
  showLegend?: boolean;
  /** Plot height in px. Defaults to 240. */
  height?: number;
  /** Format an x-axis tick value for display. */
  xTickFormatter?: (value: string) => string;
  /** Format a numeric y-axis tick. Defaults to compact notation (565K, 1.2M). */
  valueFormatter?: (value: number) => string;
  className?: string;
  /** Accessible name for the chart region. */
  'aria-label'?: string;
}

export function TrendChart({
  data,
  xKey,
  series,
  variant = 'area',
  stacked = false,
  showLegend,
  height = 240,
  xTickFormatter,
  valueFormatter = formatCompactNumber,
  className,
  'aria-label': ariaLabel,
}: TrendChartProps) {
  const config = React.useMemo(() => toConfig(series), [series]);
  const gid = React.useId().replace(/:/g, '');
  const withLegend = showLegend ?? series.length > 1;

  return (
    <ChartContainer
      config={config}
      className={cn('aspect-auto w-full', className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      {variant === 'area' ? (
        <AreaChart data={data} margin={{ left: 4, right: 4, top: 4 }}>
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`${gid}-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={`var(--color-${s.key})`}
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor={`var(--color-${s.key})`}
                  stopOpacity={0.04}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={xTickFormatter}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={44}
            tickFormatter={valueFormatter}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          {series.map((s) => (
            <Area
              key={s.key}
              dataKey={s.key}
              type="natural"
              fill={`url(#${gid}-${s.key})`}
              stroke={`var(--color-${s.key})`}
              strokeWidth={2}
              stackId={stacked ? 'a' : undefined}
              isAnimationActive={false}
            />
          ))}
          {withLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
        </AreaChart>
      ) : (
        <LineChart data={data} margin={{ left: 4, right: 4, top: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={xTickFormatter}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={44}
            tickFormatter={valueFormatter}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              type="natural"
              stroke={`var(--color-${s.key})`}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
          {withLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
        </LineChart>
      )}
    </ChartContainer>
  );
}
