-- ============================================================
-- WB5 · Receipt idempotency, a true one-sided rule, and a correct re-derive
-- ============================================================
-- Three things, all consequences of an independent review:
--
--   1. `payments.idempotency_key` — recording money had no retry protection.
--      A lost response on a prepayment (no allocations, so nothing to refuse a
--      duplicate) let a bursar click "Record payment" again and take the same
--      family's money twice, leaving two credits behind one banked amount.
--      DoD §5 names retry/idempotency; this is what it needs to be testable.
--
--   2. `journal_lines_one_sided` admitted `debit = 0 AND credit = 0`. The rule
--      the docs state is that a line IS one side or the other, so it is now an
--      exclusive-or.
--
--   3. The invoice-cache re-derive in `20260819170000` joined allocations and
--      credit applications off the same parent, which fans out and doubles both
--      sums for an invoice that has more than one of each — and it compared the
--      total against the legacy GROSS cache instead of net. Neither fires on a
--      clean deploy (credit applications do not exist yet at that point), but a
--      hand re-run of that file — a normal operation in this repo — would. That
--      migration is already applied, so it is not edited; this supersedes it.
--
-- Additive and idempotent throughout.
-- ============================================================

-- ---- 1 · idempotency ------------------------------------------------------
ALTER TABLE "finance"."payments" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

-- Partial: most receipts carry no key (an off-app cash receipt keyed by hand
-- has nothing to retry), and NULLs must not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS "payments_tenant_id_idempotency_key"
  ON "finance"."payments" ("tenant_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

-- ---- 2 · a journal line is one side or the other --------------------------
DO $one_sided$
BEGIN
  ALTER TABLE "finance"."journal_lines" DROP CONSTRAINT IF EXISTS "journal_lines_one_sided";
  ALTER TABLE "finance"."journal_lines"
    ADD CONSTRAINT "journal_lines_one_sided"
    CHECK ("debit" >= 0 AND "credit" >= 0 AND (("debit" > 0) <> ("credit" > 0)));
END
$one_sided$;

-- ---- 3 · re-derive the invoice caches, correctly ---------------------------
-- Scalar subqueries (no fan-out), and status from NET — gross less applied
-- adjustments — matching `deriveInvoiceStatus`, including overdue outranking
-- partial.
UPDATE "finance"."fee_invoices" i
SET "amount_paid" = settled."total",
    "status" = CASE
      WHEN i."status" IN ('draft', 'cancelled') THEN i."status"
      WHEN settled."total" >= settled."net" THEN 'paid'
      WHEN i."due_date" IS NOT NULL AND i."due_date" < CURRENT_DATE THEN 'overdue'
      WHEN settled."total" > 0 THEN 'partial'
      ELSE 'issued'
    END
FROM (
  SELECT i2."id" AS invoice_id,
         (SELECT COALESCE(SUM(a."amount"), 0)
            FROM "finance"."payment_allocations" a
           WHERE a."invoice_id" = i2."id")
         + (SELECT COALESCE(SUM(c."amount"), 0)
              FROM "finance"."credit_applications" c
             WHERE c."invoice_id" = i2."id") AS total,
         GREATEST(
           (SELECT COALESCE(SUM(l."amount" * l."quantity"), 0)
              FROM "finance"."fee_invoice_lines" l
             WHERE l."invoice_id" = i2."id")
           - (SELECT COALESCE(SUM(adj."amount"), 0)
                FROM "finance"."fee_adjustments" adj
               WHERE adj."invoice_id" = i2."id" AND adj."status" = 'applied'),
           0
         ) AS net
    FROM "finance"."fee_invoices" i2
) settled
WHERE settled."invoice_id" = i."id"
  AND i."amount_paid" <> settled."total";
