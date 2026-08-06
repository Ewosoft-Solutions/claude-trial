-- ============================================================
-- Denormalized studentName snapshot on fee invoices
-- ============================================================
-- Finance is decoupled from the student schema (no relation, per the
-- "not a custodian" ADR), so the invoices list cannot search/sort a student's
-- name via a join. Capture it on the invoice instead. Additive + idempotent.

ALTER TABLE finance.fee_invoices
  ADD COLUMN IF NOT EXISTS student_name TEXT;

-- Backfill existing rows from the student's current name (student_id →
-- student-management.students → profile.user_tenants → user-management.users).
UPDATE finance.fee_invoices fi
SET student_name = NULLIF(
  TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')),
  ''
)
FROM "student-management".students s
JOIN profile.user_tenants ut ON ut.id = s.user_tenant_id
JOIN "user-management".users u ON u.id = ut.user_id
WHERE fi.student_id = s.id
  AND fi.student_name IS NULL;
