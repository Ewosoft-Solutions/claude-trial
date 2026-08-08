-- ============================================================
-- WB4 follow-up · one ACTIVE FinancialHold per student (DB backstop)
-- ============================================================
-- FinancialHoldService.place() checks for an existing active hold before
-- creating one, but a check-then-create races under concurrency. This partial
-- unique index makes the "at most one active hold per (tenant, student)"
-- invariant a database guarantee; a released hold (status <> 'active') is
-- excluded, so a student can be held again after release. Additive + idempotent.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "financial_holds_one_active_per_student"
  ON "academic-structure"."financial_holds" ("tenant_id", "student_id")
  WHERE status = 'active';
