-- ============================================================
-- WB3-5 · Admission fee/deposit → link Finance
-- ============================================================
-- Admission fees (application/acceptance fee) become real Finance AR records,
-- billed to an APPLICATION before it has a student. That needs finance to accept
-- a not-yet-a-student payer:
--   • fee_invoices.student_id  → NULLABLE (an admission invoice has no student
--       until conversion; convert-to-student re-keys it to the new student id).
--   • fee_invoices.admission_application_id → the owning application (nullable;
--       set only for admission-fee invoices) so the admissions detail page + the
--       AR list can find/badge them and convert can re-key them in one pass.
--   • payments.student_id      → NULLABLE (mirror: an admission payment settles a
--       studentless invoice; re-keyed on conversion).
-- Additive + backward compatible: existing student invoices/payments keep their
-- student_id. RLS policies key off tenant_id only, so no policy change is needed.
-- ============================================================

ALTER TABLE "finance"."fee_invoices" ALTER COLUMN "student_id" DROP NOT NULL;

ALTER TABLE "finance"."fee_invoices" ADD COLUMN "admission_application_id" TEXT;

CREATE INDEX "fee_invoices_tenant_id_admission_application_id_idx"
  ON "finance"."fee_invoices" ("tenant_id", "admission_application_id");

ALTER TABLE "finance"."payments" ALTER COLUMN "student_id" DROP NOT NULL;
