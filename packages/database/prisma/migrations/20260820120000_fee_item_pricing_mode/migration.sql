-- FeeItem.pricingMode — how a fee item is priced, the way a till prices stock.
--
-- 'fixed' means the price lives on the item and is pulled onto an invoice line
-- read-only; 'open' means the line carries the price (damages, miscellaneous),
-- where typing an amount is the point rather than an override.
--
-- Additive and defaulted, so every existing item keeps working: they all become
-- 'fixed', which is what they already were in practice. Items with no
-- default_amount are then unpriced-and-fixed, which the catalogue surfaces as a
-- configuration error rather than silently billing zero.
ALTER TABLE "finance"."fee_items"
  ADD COLUMN IF NOT EXISTS "pricing_mode" TEXT NOT NULL DEFAULT 'fixed';
