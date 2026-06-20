/* ============================================================
   SchoolWithEase — Chart contracts (Phase 2)

   Typed data shapes consumed by the reusable chart wrappers
   (TrendChart, CategoryBarChart, DonutChart) that sit on top of the
   shadcn `chart` primitive + recharts. The wrappers hold no product
   copy and confine recharts to `packages/ui`; the preview surface
   supplies the data + series/slice labels.
   ============================================================ */

/** One row of chart data — an x-axis key plus one numeric value per series. */
export type ChartDatum = Record<string, string | number>;

/** A single plotted series (one line / area band / bar group). */
export interface ChartSeries {
  /** Matches the data row key holding this series' values. */
  key: string;
  /** Human-readable name shown in the legend + tooltip. */
  label: string;
  /**
   * Fill / stroke colour. Defaults to a rotating `--chart-N` token
   * (1–5) based on the series' position when omitted.
   */
  color?: string;
}

/**
 * One slice of a part-to-whole chart (DonutChart). Unlike a series — which
 * spans many rows along an axis — a slice is a single labelled magnitude.
 */
export interface ChartSlice {
  /** Stable identity used to key the slice and its colour token. */
  key: string;
  /** Human-readable name shown in the legend + tooltip. */
  label: string;
  /** The slice magnitude. */
  value: number;
  /**
   * Slice colour. Defaults to a rotating `--chart-N` token (1–5) based on
   * the slice's position when omitted.
   */
  color?: string;
}
