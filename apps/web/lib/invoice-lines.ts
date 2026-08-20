/**
 * Invoice line arithmetic, kept pure and away from the components.
 *
 * The screen updates before the server answers, so this logic decides what the
 * bursar sees. It lives here rather than inside a click handler because that is
 * where it can be tested — the one regression this module exists to prevent was
 * invisible in a screenshot and only showed up under a real burst of clicks.
 */

/** The least a line has to be for any of this to apply. */
export interface QuantifiedLine {
  id: string;
  amount: number;
  quantity: number;
}

/** The billed side, plus what the server says about discounts and payments. */
export interface ServerSideTotals {
  discounts: number;
  paid: number;
  credited?: number;
}

export interface DerivedTotals {
  gross: number;
  discounts: number;
  net: number;
  paid: number;
  credited?: number;
  balance: number;
  overpaid: number;
}

/** A quantity is a whole count of things: at least one, never a fraction. */
export const MIN_QUANTITY = 1;

/**
 * Move one line's quantity by `delta`, relative to what the list holds NOW.
 *
 * Relative, not absolute, for a reason worth keeping: React props do not change
 * between two clicks in the same frame, so a handler that computed
 * `line.quantity + 1` from its prop gave every click in a burst the same target
 * and four taps moved the count by one. Deriving from the current list is what
 * makes a burst accumulate.
 */
export function stepQuantity<T extends QuantifiedLine>(
  lines: T[],
  lineId: string,
  delta: number,
): T[] {
  return lines.map((line) =>
    line.id === lineId
      ? { ...line, quantity: Math.max(MIN_QUANTITY, line.quantity + delta) }
      : line,
  );
}

/**
 * Parse a typed quantity. Null means "not a quantity" — blank, fractional,
 * negative or plain nonsense — and the caller decides what to do about it.
 * Deliberately strict: `parseInt` would read "3 bags" as 3, and an invoice is
 * not the place to guess what someone meant.
 */
export function parseQuantity(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n) || n < MIN_QUANTITY) return null;
  return n;
}

/**
 * What is owed, derived from the lines on screen.
 *
 * Mirrors the API's `computeFinancials` so the optimistic view and the server
 * never disagree about the arithmetic. Discounts and payments are not affected
 * by editing lines, so they pass through untouched — only the billed side is
 * recomputed here.
 */
export function deriveFinancials(
  lines: QuantifiedLine[],
  server: ServerSideTotals,
): DerivedTotals {
  const gross = lines.reduce(
    (sum, line) => sum + line.amount * line.quantity,
    0,
  );
  const net = Math.max(0, gross - server.discounts);
  return {
    gross,
    discounts: server.discounts,
    net,
    paid: server.paid,
    credited: server.credited,
    balance: Math.max(0, net - server.paid),
    overpaid: Math.max(0, server.paid - net),
  };
}
