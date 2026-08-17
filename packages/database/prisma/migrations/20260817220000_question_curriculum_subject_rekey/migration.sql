-- ============================================================
-- Re-key the question bank onto the curriculum subject (step 4)
-- ============================================================
-- The last thing holding the legacy `Course` up on the assessment path. Once
-- assessments moved onto `SubjectOffering`, a structured assessment had no
-- course — and the bank is keyed on one — so its question paper could not be
-- built at all. An offering names a `CurriculumSubject`; there is no bridge
-- from that to a `Course`, so the bank has to move rather than be looked up
-- through one.
--
--   questions.curriculum_subject_id  — the structured anchor. A bank belongs to
--                                      a SUBJECT: it outlives any one course,
--                                      class or section, which is the whole
--                                      point of having a bank.
--
-- Soft reference, NO foreign key — deliberately, and the same convention
-- `subject_offerings.curriculum_subject_id` already follows: curriculum_subjects
-- carries a NULLABLE tenant_id because rows may be shared national content, so
-- a cross-schema FK from a tenant-owned table would be wrong. Validated in
-- service code instead.
--
-- Additive and nullable, legacy column KEPT and merely relaxed, exactly as the
-- assessment/grade re-key was staged: this deploys with zero downtime and no
-- data loss, old rows keep working while the backfill moves them, and the
-- legacy column is dropped in a later migration once nothing reads it.
-- ============================================================

ALTER TABLE "academic-structure"."questions"
  ADD COLUMN IF NOT EXISTS "curriculum_subject_id" TEXT;

-- A new entry keys on the subject and need not fabricate a Course.
ALTER TABLE "academic-structure"."questions"
  ALTER COLUMN "course_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "questions_tenant_id_curriculum_subject_id_idx"
  ON "academic-structure"."questions" ("tenant_id", "curriculum_subject_id");

-- No RLS change: `questions` already carries tenant_id and its existing
-- tenant_isolation policy covers this column.
