/**
 * Text-size (font-scale) preference — the Appearance → "Text size" accessibility
 * control. Modelled on {@link ./page-size.ts}: a cookie (`pref_font_scale`) so
 * the SERVER can apply it first-paint (no flash, no hydration mismatch), plus a
 * best-effort account PATCH so the choice follows the user across devices.
 *
 * The value is a multiplier bound to the `--font-scale` CSS variable, which every
 * font-size token in ui `globals.css` is multiplied by. Spacing/padding never
 * reference it, so text scales as a group WITHOUT the layout zooming.
 *
 * Pure helpers here are isomorphic (safe in server components); the read/write/
 * apply helpers guard on `document`. Server components read the cookie via
 * `next/headers` and pass it through `normalizeFontScaleStep`.
 */

export const FONT_SCALE_COOKIE = 'pref_font_scale';

export interface FontScaleStep {
  /** The `--font-scale` multiplier. */
  value: number;
  /** `data-font-scale` attribute on <html> — the hook for the few layout
   *  reflow rules (e.g. a two-column grid folding to one at the largest step). */
  key: string;
  /** Human label shown in the Appearance control. */
  label: string;
}

/** Bounded, discrete steps — 90%–110% in 5% increments, 100% centered. */
export const FONT_SCALE_STEPS: readonly FontScaleStep[] = [
  { value: 0.9, key: '90', label: 'Smaller' },
  { value: 0.95, key: '95', label: 'Small' },
  { value: 1.0, key: '100', label: 'Default' },
  { value: 1.05, key: '105', label: 'Large' },
  { value: 1.1, key: '110', label: 'Larger' },
] as const;

/** The default step (multiplier 1.0). */
export const DEFAULT_FONT_SCALE_STEP: FontScaleStep = FONT_SCALE_STEPS.find(
  (s) => s.value === 1,
) ?? { value: 1, key: 'base', label: 'Default' };
export const DEFAULT_FONT_SCALE = DEFAULT_FONT_SCALE_STEP.value;

/** Snap any raw value to the nearest defined step (tolerant of float drift);
 *  falls back to the default step when unparseable. */
export function normalizeFontScaleStep(
  raw: string | number | null | undefined,
): FontScaleStep {
  const n = typeof raw === 'string' ? Number.parseFloat(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    return DEFAULT_FONT_SCALE_STEP;
  }
  return FONT_SCALE_STEPS.reduce(
    (best, step) =>
      Math.abs(step.value - n) < Math.abs(best.value - n) ? step : best,
    DEFAULT_FONT_SCALE_STEP,
  );
}

/** The multiplier for any raw value (snapped to the nearest step). */
export function normalizeFontScale(
  raw: string | number | null | undefined,
): number {
  return normalizeFontScaleStep(raw).value;
}

/** Client: the saved preference from `document.cookie`. */
export function readFontScalePreference(): number {
  if (typeof document === 'undefined') return DEFAULT_FONT_SCALE;
  const match = document.cookie.match(/(?:^|;\s*)pref_font_scale=([0-9.]+)/);
  return normalizeFontScale(match?.[1]);
}

/** Client: mirror the preference to a cookie (1 year, all paths). */
export function writeFontScalePreference(value: number): void {
  if (typeof document === 'undefined') return;
  const v = normalizeFontScale(value);
  document.cookie = `${FONT_SCALE_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`;
}

/** Client: apply a scale to <html> immediately — the CSS var (drives every font
 *  token) plus the `data-font-scale` reflow hook. */
export function applyFontScale(value: number): void {
  if (typeof document === 'undefined') return;
  const step = normalizeFontScaleStep(value);
  const el = document.documentElement;
  el.style.setProperty('--font-scale', String(step.value));
  el.dataset.fontScale = step.key;
}

/**
 * Client: save everywhere — apply live + cookie (instant, local) AND the
 * per-account record (durable, cross-device). The cookie write is synchronous
 * so the next SSR paint is correct; the account PATCH is best-effort (a failure
 * just means this browser keeps the cookie value).
 */
export function saveFontScalePreference(value: number): void {
  const v = normalizeFontScale(value);
  writeFontScalePreference(v);
  applyFontScale(v);
  void fetch('/api/auth/preferences', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fontScale: v }),
  }).catch(() => {
    /* best-effort: the cookie already holds the preference on this browser */
  });
}
