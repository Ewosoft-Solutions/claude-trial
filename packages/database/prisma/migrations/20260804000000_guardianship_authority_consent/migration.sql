-- ============================================================
-- Guardianship authority / priority / consent (WB1-4)
-- ============================================================
-- Extends person.guardian_relationships (F1) with real-world caregiver depth so
-- a school can model authority, per-category contact consent, and verification —
-- and target results/fee comms by relationship + consent instead of a gender
-- label (the C049 "Father/Mother/Both" limitation). Purely ADDITIVE: every new
-- column is nullable or has a default, so existing rows are unchanged and RLS
-- (already enabled + FORCE on this table from migration 20260801010000) needs no
-- change. No new tables → no new RLS policies.
-- ============================================================

ALTER TABLE "person"."guardian_relationships"
  -- Authority: what this caregiver is permitted to do for the ward.
  ADD COLUMN IF NOT EXISTS "custody_type"           TEXT,
  ADD COLUMN IF NOT EXISTS "can_pickup"             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "can_authorize_medical"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_emergency_contact"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_billing_contact"     BOOLEAN NOT NULL DEFAULT false,
  -- Per-category contact consent (operational categories opt-IN by default for a
  -- caregiver; emergency comms always reach an emergency contact regardless).
  ADD COLUMN IF NOT EXISTS "consent_results"        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "consent_finance"        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "consent_attendance"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "consent_general"        BOOLEAN NOT NULL DEFAULT true,
  -- Verification: proof of the caregiver claim.
  ADD COLUMN IF NOT EXISTS "verified_at"            TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verified_by"            TEXT,
  ADD COLUMN IF NOT EXISTS "verification_method"    TEXT;

-- Audience-resolution reads guardians for a ward filtered to active
-- (effective_to IS NULL) relationships; index that access path.
CREATE INDEX IF NOT EXISTS "guardian_relationships_ward_active_idx"
  ON "person"."guardian_relationships"("ward_person_id", "effective_to");
