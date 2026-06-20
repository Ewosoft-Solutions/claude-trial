'use client';

/* ============================================================
   DonutChart — part-to-whole composition over labelled slices

   The composition sibling to TrendChart (time) and CategoryBarChart
   (comparison): a pie / donut for share-of-total displays (fee-status
   split, enrolment by level). Each slice is a single labelled
   magnitude (see `ChartSlice`), not a series spanning an axis. Holds
   no product copy — the preview surface supplies the slices. Keeps
   recharts confined to `packages/ui`.
   ============================================================ */

import * as React from 'react';
import { Cell, Pie, PieChart } from 'recharts';

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@workspace/ui/components/chart';
import { cn } from '@workspace/ui/lib/utils';
import type { ChartSlice } from '@workspace/ui/types/chart.types';

/** Rotating fallback palette (maps to the `--chart-N` theme tokens). */
const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

/** Build the primitive's colour config, keyed by each slice's `key`. */
function toConfig(slices: readonly ChartSlice[]): ChartConfig {
  return Object.fromEntries(
    slices.map((s, i) => [
      s.key,
      { label: s.label, color: s.color ?? PALETTE[i % PALETTE.length] },
    ]),
  );
}

export interface DonutChartProps {
  /** The slices to plot. */
  slices: readonly ChartSlice[];
  /** `donut` (hollow centre, default) or `pie` (solid). */
  variant?: 'donut' | 'pie';
  /** Show the slice legend beneath the plot. Defaults to `true`. */
  showLegend?: boolean;
  /** Plot height in px. Defaults to 240. */
  height?: number;
  className?: string;
  /** Accessible name for the chart region. */
  'aria-label'?: string;
}

export function DonutChart({
  slices,
  variant = 'donut',
  showLegend = true,
  height = 240,
  className,
  'aria-label': ariaLabel,
}: DonutChartProps) {
  const config = React.useMemo(() => toConfig(slices), [slices]);

  return (
    <ChartContainer
      config={config}
      className={cn('mx-auto aspect-square', className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <PieChart>
        {/* `nameKey="key"` resolves each slice's colour + label from the
            config (keyed by slice key); `dataKey="value"` drives the angle. */}
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent nameKey="key" hideLabel />}
        />
        <Pie
          data={slices as ChartSlice[]}
          dataKey="value"
          nameKey="key"
          innerRadius={variant === 'donut' ? '55%' : 0}
          strokeWidth={2}
          isAnimationActive={false}
        >
          {slices.map((s) => (
            <Cell key={s.key} fill={`var(--color-${s.key})`} />
          ))}
        </Pie>
        {showLegend ? (
          <ChartLegend content={<ChartLegendContent nameKey="key" />} />
        ) : null}
      </PieChart>
    </ChartContainer>
  );
}
