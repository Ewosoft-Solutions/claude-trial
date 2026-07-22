-- Searchable health-flag layer (docs/platform-scope-plan.md §7.1, item 0.5.7b)
--
-- Health narrative fields are being encrypted at rest, which makes them
-- unsearchable (AES-GCM with a random IV yields different ciphertext each time).
-- Schools must still be able to answer "which pupils have a peanut allergy
-- before the trip", so search moves to a controlled vocabulary carried in two
-- new columns:
--
--   health_flags_enc  - encrypted JSON array of vocabulary codes (display copy)
--   health_flag_index - keyed HMAC-SHA256 per code (searchable copy)
--
-- The index is opaque in a database dump: the digest is keyed and the key lives
-- in the application, so an attacker holding only the dump cannot compute the
-- digest for "peanut" to look it up. Residual leakage is equality only — which
-- rows share some unknown flag.
--
-- Purely additive: both columns are nullable/defaulted, so existing rows are
-- valid untouched and no backfill is required.

ALTER TABLE "health"."health_records"
  ADD COLUMN IF NOT EXISTS "health_flags_enc" TEXT,
  ADD COLUMN IF NOT EXISTS "health_flag_index" TEXT[] NOT NULL DEFAULT '{}';

-- GIN supports the array-containment operators (@>, &&) the flag search uses.
-- Without it, "who has flag X" degrades to a sequential scan of every health
-- record in the tenant.
CREATE INDEX IF NOT EXISTS "health_records_health_flag_index_idx"
  ON "health"."health_records" USING GIN ("health_flag_index");

-- No RLS changes: the existing health_records policy is table-wide and already
-- covers these columns. db:rls:check should stay green.
