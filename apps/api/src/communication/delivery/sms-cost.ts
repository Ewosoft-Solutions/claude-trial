import type { DeliveryChannel } from './delivery.types';

/**
 * Metered send cost — reproduces the legacy prepaid SMS-balance semantics
 * (C105) where the per-message cost differs by number type (C107):
 *   DND number   → 2.5 units
 *   Normal number→ 3   units
 * Email / push / in-app carry no metered unit cost in this model (0). The
 * DeliveryAttempt ledger stores the resulting `costUnits` + `dndFlag`, so the
 * SMS-balance / usage view reproduces purely by summing the ledger.
 *
 * Values are defaults; a tenant billing profile can override them later without
 * touching callers (cost is computed here, once, before the attempt is written).
 */
export const SMS_UNIT_COST = {
  dnd: 2.5,
  normal: 3,
} as const;

export interface DeliveryCost {
  costUnits: number;
  dndFlag: boolean;
}

/** Classify a send's metered cost + DND flag for the ledger. */
export function classifyDeliveryCost(
  channel: DeliveryChannel,
  isDnd: boolean,
): DeliveryCost {
  if (channel !== 'sms') {
    return { costUnits: 0, dndFlag: isDnd };
  }
  return {
    costUnits: isDnd ? SMS_UNIT_COST.dnd : SMS_UNIT_COST.normal,
    dndFlag: isDnd,
  };
}
