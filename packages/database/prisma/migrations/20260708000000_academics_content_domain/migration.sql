-- ============================================================
-- Academics content domain — docs/academics-reuse-assessment.md §4
-- ============================================================
-- 1. Lessons/materials grow a review workflow (content is invisible
--    to students until approved) plus lesson-note body and material
--    categories (video/image/audio skip the extraction pipeline).
-- 2. Question bank (course-scoped) + question papers + student
--    submissions with server-side auto-marking:
--      questions              — reusable bank entries per course
--      assessment_questions   — ordered/weighted paper attachment
--      assessment_submissions — one row per student attempt
-- New tables are tenant-scoped (tenant_id NOT NULL) in the
-- "academic-structure" schema with RLS applied from day one.
-- ============================================================

-- ---- lessons: note body + review workflow ---------------------------

ALTER TABLE "learning"."lessons"
  ADD COLUMN "content"                 TEXT,
  ADD COLUMN "review_status"           TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN "submitted_for_review_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_by"             TEXT,
  ADD COLUMN "reviewed_at"             TIMESTAMP(3),
  ADD COLUMN "review_note"             TEXT;

CREATE INDEX "lessons_tenant_id_review_status_idx"
  ON "learning"."lessons"("tenant_id", "review_status");

-- ---- lesson_materials: category + review workflow -------------------

ALTER TABLE "learning"."lesson_materials"
  ADD COLUMN "category"      TEXT NOT NULL DEFAULT 'document',
  ADD COLUMN "review_status" TEXT NOT NULL DEFAULT 'pending_review',
  ADD COLUMN "reviewed_by"   TEXT,
  ADD COLUMN "reviewed_at"   TIMESTAMP(3),
  ADD COLUMN "review_note"   TEXT;

CREATE INDEX "lesson_materials_tenant_id_review_status_idx"
  ON "learning"."lesson_materials"("tenant_id", "review_status");

-- Pre-existing materials were uploaded before the approval gate existed;
-- they stay visible (grandfathered as approved).
UPDATE "learning"."lesson_materials" SET "review_status" = 'approved';

-- ---- assessments: online-taking rules --------------------------------

ALTER TABLE "academic-structure"."assessments"
  ADD COLUMN "duration_minutes" INTEGER,
  ADD COLUMN "max_attempts"     INTEGER NOT NULL DEFAULT 1;

-- ---- questions --------------------------------------------------------

CREATE TABLE "academic-structure"."questions" (
  "id"             TEXT NOT NULL,
  "tenant_id"      TEXT NOT NULL,
  "course_id"      TEXT NOT NULL,
  "style"          TEXT NOT NULL DEFAULT 'mcq',
  "instruction"    TEXT,
  "text"           TEXT NOT NULL,
  "image_key"      TEXT,
  "options"        JSONB,
  "correct_answer" TEXT,
  "solution"       TEXT,
  "difficulty"     TEXT,
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "created_by"     TEXT,
  "updated_by"     TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "questions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "questions_course_id_fkey"
    FOREIGN KEY ("course_id")
    REFERENCES "academic-structure"."courses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "questions_tenant_id_idx"
  ON "academic-structure"."questions"("tenant_id");
CREATE INDEX "questions_tenant_id_course_id_idx"
  ON "academic-structure"."questions"("tenant_id", "course_id");
CREATE INDEX "questions_tenant_id_style_idx"
  ON "academic-structure"."questions"("tenant_id", "style");
CREATE INDEX "questions_tenant_id_is_active_idx"
  ON "academic-structure"."questions"("tenant_id", "is_active");

-- ---- assessment_questions --------------------------------------------

CREATE TABLE "academic-structure"."assessment_questions" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "assessment_id" TEXT NOT NULL,
  "question_id"   TEXT NOT NULL,
  "order"         INTEGER NOT NULL DEFAULT 0,
  "points"        DECIMAL(65,30) NOT NULL DEFAULT 1,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assessment_questions_assessment_id_fkey"
    FOREIGN KEY ("assessment_id")
    REFERENCES "academic-structure"."assessments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assessment_questions_question_id_fkey"
    FOREIGN KEY ("question_id")
    REFERENCES "academic-structure"."questions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "assessment_questions_assessment_id_question_id_key"
  ON "academic-structure"."assessment_questions"("assessment_id", "question_id");
CREATE INDEX "assessment_questions_assessment_id_idx"
  ON "academic-structure"."assessment_questions"("assessment_id");
CREATE INDEX "assessment_questions_question_id_idx"
  ON "academic-structure"."assessment_questions"("question_id");
CREATE INDEX "assessment_questions_tenant_id_idx"
  ON "academic-structure"."assessment_questions"("tenant_id");
CREATE INDEX "assessment_questions_tenant_id_assessment_id_idx"
  ON "academic-structure"."assessment_questions"("tenant_id", "assessment_id");

-- ---- assessment_submissions -------------------------------------------

CREATE TABLE "academic-structure"."assessment_submissions" (
  "id"                   TEXT NOT NULL,
  "tenant_id"            TEXT NOT NULL,
  "assessment_id"        TEXT NOT NULL,
  "enrollment_id"        TEXT NOT NULL,
  "attempt"              INTEGER NOT NULL DEFAULT 1,
  "answers"              JSONB NOT NULL,
  "points_earned"        DECIMAL(65,30),
  "max_points"           DECIMAL(65,30),
  "percentage"           DECIMAL(65,30),
  "needs_manual_grading" BOOLEAN NOT NULL DEFAULT false,
  "status"               TEXT NOT NULL DEFAULT 'submitted',
  "started_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at"         TIMESTAMP(3),
  "graded_at"            TIMESTAMP(3),
  "graded_by"            TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "assessment_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assessment_submissions_assessment_id_fkey"
    FOREIGN KEY ("assessment_id")
    REFERENCES "academic-structure"."assessments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assessment_submissions_enrollment_id_fkey"
    FOREIGN KEY ("enrollment_id")
    REFERENCES "student-management"."enrollments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "assessment_submissions_assessment_id_enrollment_id_attempt_key"
  ON "academic-structure"."assessment_submissions"("assessment_id", "enrollment_id", "attempt");
CREATE INDEX "assessment_submissions_assessment_id_idx"
  ON "academic-structure"."assessment_submissions"("assessment_id");
CREATE INDEX "assessment_submissions_enrollment_id_idx"
  ON "academic-structure"."assessment_submissions"("enrollment_id");
CREATE INDEX "assessment_submissions_tenant_id_idx"
  ON "academic-structure"."assessment_submissions"("tenant_id");
CREATE INDEX "assessment_submissions_tenant_id_assessment_id_idx"
  ON "academic-structure"."assessment_submissions"("tenant_id", "assessment_id");
CREATE INDEX "assessment_submissions_tenant_id_status_idx"
  ON "academic-structure"."assessment_submissions"("tenant_id", "status");

-- ---- RLS: questions ---------------------------------------------------

ALTER TABLE "academic-structure"."questions"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic-structure"."questions"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "academic-structure"."questions"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

-- ---- RLS: assessment_questions ----------------------------------------

ALTER TABLE "academic-structure"."assessment_questions"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic-structure"."assessment_questions"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "academic-structure"."assessment_questions"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

-- ---- RLS: assessment_submissions ---------------------------------------

ALTER TABLE "academic-structure"."assessment_submissions"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic-structure"."assessment_submissions"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "academic-structure"."assessment_submissions"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

-- ---- Grants (new tables in an existing schema) -------------------------

GRANT SELECT, INSERT, UPDATE, DELETE
  ON "academic-structure"."questions",
     "academic-structure"."assessment_questions",
     "academic-structure"."assessment_submissions"
  TO app_runtime;
