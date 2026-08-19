-- ============================================================
-- WB5 · Prune allocations the integrity constraints will reject
-- ============================================================
-- Ordered BEFORE `20260819160000` (which adds `payment_allocations_amount_positive`)
-- deliberately. The receipts backfill in `20260819120000` copies each legacy
-- payment's amount into an allocation with no filter, so an environment holding
-- a zero-amount or non-`completed` payment would reach the CHECK with a row it
-- cannot accept — and `migrate deploy` would abort mid-upgrade, leaving the
-- schema half-applied.
--
-- On a database with clean data this is a no-op. It is deliberately separate
-- from the later correction migration so that the constraint never meets a row
-- it has to refuse.
-- ============================================================

-- An allocation is a claim that money arrived and settled something. Neither is
-- true of a pending/failed/refunded payment, or of a zero.
DELETE FROM "finance"."payment_allocations" a
USING "finance"."payments" p
WHERE a."payment_id" = p."id"
  AND (p."status" <> 'completed' OR a."amount" <= 0);
