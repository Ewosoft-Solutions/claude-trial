-- ============================================================
-- One primary contact per ward (WB1-4) — DB backstop
-- ============================================================
-- GuardianshipService enforces exactly-one-primary per ward in app code
-- (demote the previous primary before promoting a new one). Two CONCURRENT
-- primary-promotions on the same ward could still race to leave two active
-- primaries. This partial unique index is the hard backstop the app relies on;
-- with the service now demoting BEFORE promoting, the happy path never violates
-- it, and the loser of a real race gets a clean unique-violation instead of
-- corrupting the data.
--
-- First demote any pre-existing duplicate active primaries (keep the most
-- recently updated) so the index can build on populated databases. That DML
-- touches the RLS-forced table, so it runs under the audited platform GUC in a
-- DO block (per the "two statements silently update 0 rows" gotcha).
-- ============================================================

DO $dedup$
BEGIN
  PERFORM set_config('app.is_platform', 'on', true);

  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY tenant_id, ward_person_id
        ORDER BY updated_at DESC, created_at DESC, id DESC
      ) AS rn
    FROM "person"."guardian_relationships"
    WHERE is_primary = true AND effective_to IS NULL
  )
  UPDATE "person"."guardian_relationships" g
  SET is_primary = false, updated_at = now()
  FROM ranked
  WHERE g.id = ranked.id AND ranked.rn > 1;
END $dedup$;

CREATE UNIQUE INDEX IF NOT EXISTS "guardian_relationships_one_primary_per_ward"
  ON "person"."guardian_relationships" ("tenant_id", "ward_person_id")
  WHERE "is_primary" = true AND "effective_to" IS NULL;
