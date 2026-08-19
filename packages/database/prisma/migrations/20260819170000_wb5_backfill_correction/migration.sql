-- ============================================================
-- WB5 · Correct what the receipts backfill got wrong
-- ============================================================
-- Two defects in the backfill inside `20260819120000`, found in review. That
-- migration has already been applied, and an applied migration is never edited
-- (AGENTS.md §7: changing its checksum breaks `migrate deploy` on every
-- environment that recorded it) — so the correction comes forward, here, where
-- it also repairs the environments that already ran the original.
--
--   1. It allocated EVERY payment carrying an invoice id, whatever its status.
--      The app only ever wrote 'completed', so this is latent rather than live,
--      but a hand-edited or imported row would silently mark its invoice
--      settled — an allocation is a claim that money arrived.
--
--   2. It stamped the invoice's `student_name` into `payer_name`. The old model
--      recorded who was BILLED, not who paid; a child's name would then appear
--      as the payer on every reprinted historical receipt.
--
-- Both corrections are idempotent and safe to re-run.
-- ============================================================

-- 1 · an allocation only represents money that actually arrived
DELETE FROM "finance"."payment_allocations" a
USING "finance"."payments" p
WHERE a."payment_id" = p."id"
  AND p."status" <> 'completed';

-- 2 · the billed child is not the payer. Only clears the value where it was
--     borrowed from the invoice, so a payer named since is left alone.
UPDATE "finance"."payments" p
SET "payer_name" = NULL
FROM "finance"."payment_allocations" a
JOIN "finance"."fee_invoices" i ON i."id" = a."invoice_id"
WHERE a."payment_id" = p."id"
  AND p."payer_name" IS NOT NULL
  AND p."payer_name" = i."student_name";

-- The invoices whose allocations were just removed need their cached
-- `amount_paid` and status re-derived from the rows that remain. The cache is
-- only ever a summary of the allocation + credit rows; this brings it back in
-- line with them.
UPDATE "finance"."fee_invoices" i
SET "amount_paid" = COALESCE(settled."total", 0),
    "status" = CASE
      WHEN i."status" IN ('draft', 'cancelled') THEN i."status"
      WHEN COALESCE(settled."total", 0) >= GREATEST(i."amount_due", 0) THEN 'paid'
      WHEN COALESCE(settled."total", 0) > 0 THEN 'partial'
      WHEN i."due_date" IS NOT NULL AND i."due_date" < CURRENT_DATE THEN 'overdue'
      ELSE 'issued'
    END
FROM (
  SELECT i2."id" AS invoice_id,
         COALESCE(SUM(a."amount"), 0) + COALESCE(SUM(c."amount"), 0) AS total
  FROM "finance"."fee_invoices" i2
  LEFT JOIN "finance"."payment_allocations" a ON a."invoice_id" = i2."id"
  LEFT JOIN "finance"."credit_applications" c ON c."invoice_id" = i2."id"
  GROUP BY i2."id"
) settled
WHERE settled."invoice_id" = i."id"
  AND i."amount_paid" <> COALESCE(settled."total", 0);
