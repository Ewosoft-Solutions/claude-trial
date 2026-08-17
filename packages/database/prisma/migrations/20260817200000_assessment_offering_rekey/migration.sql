-- ============================================================
-- Re-key the day-to-day gradebook onto the structured spine (step 3)
-- ============================================================
-- The legacy assessment spine is what keeps `Class`, `Course`, `Enrollment`,
-- `ClassTeacher` and the Course-catalogue page alive: assessments hang off a
-- labelled-bag Class, and grades off an Enrollment row. WB2/WB4 moved everything
-- else onto ClassSection / SubjectOffering years ago.
--
--   assessments.subject_offering_id  — the structured anchor (section × subject
--                                      × year/term) new assessments key on.
--   grades.student_id                — a grade belongs to the STUDENT, the same
--   assessment_submissions.student_id  choice WB4's ResultEntry makes. An
--                                      enrolment can end, transfer or be
--                                      corrected; the mark a child earned has
--                                      to outlive all of it.
--
-- Every new column is NULLABLE and every legacy column is KEPT, so this deploys
-- with zero downtime and no data loss: old rows keep working while the backfill
-- moves them. The legacy columns are dropped in a later migration, once the
-- backfill has run everywhere and nothing reads them — dropping them here would
-- make the deploy irreversible.
--
-- The legacy pointers also become nullable so a NEW row need not fabricate a
-- Class or an Enrollment just to satisfy a constraint it no longer believes in.
-- ============================================================

-- ---- assessments ---------------------------------------------------------
ALTER TABLE "academic-structure"."assessments"
  ADD COLUMN IF NOT EXISTS "subject_offering_id" TEXT;

ALTER TABLE "academic-structure"."assessments"
  ALTER COLUMN "class_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "assessments_tenant_id_subject_offering_id_idx"
  ON "academic-structure"."assessments" ("tenant_id", "subject_offering_id");

-- ---- grades --------------------------------------------------------------
ALTER TABLE "academic-structure"."grades"
  ADD COLUMN IF NOT EXISTS "student_id" TEXT;

ALTER TABLE "academic-structure"."grades"
  ALTER COLUMN "enrollment_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "grades_tenant_id_student_id_idx"
  ON "academic-structure"."grades" ("tenant_id", "student_id");

-- ---- assessment_submissions ---------------------------------------------
ALTER TABLE "academic-structure"."assessment_submissions"
  ADD COLUMN IF NOT EXISTS "student_id" TEXT;

ALTER TABLE "academic-structure"."assessment_submissions"
  ALTER COLUMN "enrollment_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "assessment_submissions_tenant_id_student_id_idx"
  ON "academic-structure"."assessment_submissions" ("tenant_id", "student_id");

-- ---- foreign keys --------------------------------------------------------
DO $fks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessments_subject_offering_id_fkey') THEN
    ALTER TABLE "academic-structure"."assessments" ADD CONSTRAINT "assessments_subject_offering_id_fkey"
      FOREIGN KEY ("subject_offering_id") REFERENCES "academic-structure"."subject_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grades_student_id_fkey') THEN
    ALTER TABLE "academic-structure"."grades" ADD CONSTRAINT "grades_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "student-management"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessment_submissions_student_id_fkey') THEN
    ALTER TABLE "academic-structure"."assessment_submissions" ADD CONSTRAINT "assessment_submissions_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "student-management"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$fks$;

-- No RLS change: all three tables already carry tenant_id and their existing
-- tenant_isolation policies cover these columns.
