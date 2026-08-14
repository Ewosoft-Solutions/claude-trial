/**
 * Web mirror of the API's admission fee-price resolver
 * (`apps/api/src/admissions/admission-fee-pricing.ts`) — kept in lock-step.
 *
 * A `fee` requirement's price lives in its `config`:
 *   { amount?, classPrices?: {[yearLevelId]: kobo}, sectionPrices?: {[sectionId]: kobo} }
 * Precedence: class override → section override → default. A present override of
 * `0` (or an unset/0 default) resolves to `null` = the fee is not applicable.
 */

export interface FeePricingConfig {
  currency?: string;
  amount?: number | null;
  classPrices?: Record<string, number>;
  sectionPrices?: Record<string, number>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Resolved fee amount in kobo, or `null` when the fee is not applicable. */
export function resolveAdmissionFeeKobo(
  config: unknown,
  scope: { yearLevelId?: string | null; sectionId?: string | null },
): number | null {
  const c = asRecord(config);
  const classPrices = asRecord(c['classPrices']);
  const sectionPrices = asRecord(c['sectionPrices']);

  let resolved: number | null;
  if (scope.yearLevelId && scope.yearLevelId in classPrices) {
    resolved = asAmount(classPrices[scope.yearLevelId]);
  } else if (scope.sectionId && scope.sectionId in sectionPrices) {
    resolved = asAmount(sectionPrices[scope.sectionId]);
  } else {
    resolved = asAmount(c['amount']);
  }
  return resolved != null && resolved > 0 ? resolved : null;
}
