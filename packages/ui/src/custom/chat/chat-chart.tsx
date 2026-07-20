'use client';

/* ============================================================
   ChatChart — render a wire-format chart spec inside a message

   Takes the `visualization` member of the analytics chat envelope
   (see ChatChartSpec) and renders it with the existing chart
   wrappers: donut → DonutChart, bar → CategoryBarChart, trend →
   TrendChart. Holds no product copy — the optional title comes off
   the spec itself. Unknown/empty specs render nothing rather than
   an undefined surface (PRD A6).
   ============================================================ */

import * as React from 'react';

import { CategoryBarChart } from '@workspace/ui/custom/charts/category-bar-chart';
import { DonutChart } from '@workspace/ui/custom/charts/donut-chart';
import { TrendChart } from '@workspace/ui/custom/charts/trend-chart';
import { cn } from '@workspace/ui/lib/utils';
import type { ChatChartSpec } from '@workspace/ui/types/chat.types';

export interface ChatChartProps {
  spec: ChatChartSpec;
  /** Plot height in px. Defaults to 220 (compact, in-message). */
  height?: number;
  className?: string;
}

export function ChatChart({ spec, height = 220, className }: ChatChartProps) {
  const plot = React.useMemo(() => {
    if (spec.type === 'donut') {
      if (spec.slices.length === 0) return null;
      return (
        <DonutChart
          slices={spec.slices}
          height={height}
          aria-label={spec.title ?? 'Chart'}
        />
      );
    }
    if (spec.data.length === 0 || spec.series.length === 0) return null;
    if (spec.type === 'bar') {
      return (
        <CategoryBarChart
          data={spec.data}
          xKey={spec.xKey}
          series={spec.series}
          height={height}
          aria-label={spec.title ?? 'Chart'}
        />
      );
    }
    return (
      <TrendChart
        data={spec.data}
        xKey={spec.xKey}
        series={spec.series}
        height={height}
        aria-label={spec.title ?? 'Chart'}
      />
    );
  }, [spec, height]);

  if (!plot) return null;

  return (
    <figure
      className={cn(
        'rounded-[var(--radius-sm)] border border-border bg-card p-3',
        className,
      )}
    >
      {spec.title ? (
        <figcaption className="mb-2 text-xs font-semibold text-muted-foreground">
          {spec.title}
        </figcaption>
      ) : null}
      {plot}
    </figure>
  );
}
