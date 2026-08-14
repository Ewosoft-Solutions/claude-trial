/**
 * WB3-5 · admission fee pricing resolution.
 *
 * A `fee`-type admission requirement carries its pricing in the (free-form)
 * requirement `config`:
 *
 *   config = {
 *     currency: 'NGN',
 *     amount?:        <default kobo>,          // the default price
 *     classPrices?:   { [yearLevelId]: kobo }, // per-class override
 *     sectionPrices?: { [sectionId]:  kobo },  // per-section override
 *   }
 *
 * Resolution precedence (owner-specified): a CLASS override wins over a SECTION
 * override, which wins over the default:
 *
 *   classPrices[yearLevelId] ?? sectionPrices[sectionId] ?? amount
 *
 * A resolved value that is unset or `0` means the fee is **not applicable** — no
 * invoice is billed and the deposit gate does not block on it — so this returns
 * `null` for both. An explicit override of `0` for a class therefore reads as
 * "this class pays no fee" and does NOT fall through to the default.
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

/** A positive integer amount, or null (treats 0 / non-numbers as "no amount"). */
function asAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Resolve a fee requirement's price (in kobo) for an application's scope.
 * Returns `null` when the fee is not applicable (unset, or resolves to 0).
 */
export function resolveAdmissionFeeKobo(
  config: unknown,
  scope: { yearLevelId?: string | null; sectionId?: string | null },
): number | null {
  const c = asRecord(config);
  const classPrices = asRecord(c['classPrices']);
  const sectionPrices = asRecord(c['sectionPrices']);

  // A PRESENT override wins even when it is 0 — a class priced at 0 is "free"
  // and must not inherit the section/default price. Class supersedes section.
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
