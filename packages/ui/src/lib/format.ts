/* ============================================================
   Number formatting helpers shared by the chart wrappers.

   `formatCompactNumber` keeps numeric axis ticks short so large
   values (e.g. naira amounts in kobo-derived figures) don't clip
   against the fixed-width y-axis: 565000 → "565K", 1_200_000 →
   "1.2M". Small values pass through unchanged (60 → "60").
   ============================================================ */

const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * Format a numeric axis tick compactly. Non-finite values (and the
 * strings recharts can hand a category axis) are returned as-is so the
 * formatter is safe to use as a default `tickFormatter`.
 */
export function formatCompactNumber(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value == null ? '' : String(value);
  }
  // Leave small magnitudes untouched — compact notation only helps past 1k.
  if (Math.abs(value) < 1000) return String(value);
  return compact.format(value);
}
