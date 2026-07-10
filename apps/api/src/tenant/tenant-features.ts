/**
 * Tenant feature toggles.
 *
 * The catalog of optional operational modules a tenant can switch on/off, plus
 * the resolution rules. Toggles live in `tenant.settings.features` as a
 * `{ [key]: boolean }` map. A feature is enabled UNLESS explicitly set to
 * `false`, so a tenant with no saved features has everything on (matching
 * pre-toggle behaviour). Mirrors `FEATURE_KEYS` in
 * `packages/ui/src/types/access.types.ts`.
 */
export const FEATURE_KEYS = [
  'messaging',
  'transport',
  'cafeteria',
  'library',
  'health',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

function rawFeatures(settings: unknown): Record<string, boolean> {
  const features = (settings as { features?: unknown } | null)?.features;
  return features && typeof features === 'object'
    ? (features as Record<string, boolean>)
    : {};
}

/** The full on/off map for every known feature (default-on). */
export function resolveFeatureMap(settings: unknown): Record<FeatureKey, boolean> {
  const raw = rawFeatures(settings);
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, raw[key] !== false]),
  ) as Record<FeatureKey, boolean>;
}

/** Just the enabled feature keys (for the nav viewer / auth me payload). */
export function resolveEnabledFeatures(settings: unknown): FeatureKey[] {
  const raw = rawFeatures(settings);
  return FEATURE_KEYS.filter((key) => raw[key] !== false);
}
