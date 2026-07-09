/* ============================================================
   SchoolWithEase — Chat contracts (Phase 3, Analytics AI)

   Typed shapes consumed by the reusable chat components
   (ChatThread, ChatMessageBubble, ChatComposer, ChatChart) that
   back the AI assistant surfaces. `ChatChartSpec` mirrors the
   `visualization` member of the analytics chat envelope the API
   streams (see apps/api AnalyticsChartSpec) and reuses the chart
   vocabulary from chart.types.ts, so a spec taken straight off the
   wire renders with the existing chart wrappers.
   ============================================================ */

import type { ChartDatum, ChartSeries, ChartSlice } from './chart.types';

/** Who authored a chat message. */
export type ChatSender = 'user' | 'assistant';

/**
 * A chart embedded in an assistant message — the API's `visualization`
 * envelope member. `donut` carries slices (part-to-whole); `bar` and
 * `trend` carry rows + series over a category axis.
 */
export type ChatChartSpec =
  | {
      type: 'donut';
      title?: string;
      slices: ChartSlice[];
    }
  | {
      type: 'trend' | 'bar';
      title?: string;
      xKey: string;
      data: ChartDatum[];
      series: ChartSeries[];
    };
