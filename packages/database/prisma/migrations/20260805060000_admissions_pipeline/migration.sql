-- ============================================================
-- WB3-1/WB3-2 · Admissions pipeline + decision history + conversion hooks
-- ============================================================
-- Turns the flat page-first AdmissionApplication stub into a durable, Person-
-- linked pipeline:
--   • admission_applications gains a Person link, target placement (campus /
--     section / year), offer/accept/decision timestamps, a resulting-student
--     link, and a document checklist; the stage default moves to 'applied'.
--   • admission_reviews       — scored decision history (fixes "strings only").
--   • admission_stage_events  — effective-dated stage history (auditable).
--
-- Soft external refs (person / campus / section / year / student) are DB-level
-- FKs (no Prisma relation, WB2 convention), validated in-service. RLS on the two
-- NEW tables (admission_applications already has its policy). Additive + idempotent.
-- ============================================================

-- ---- extend admission_applications --------------------------------------
ALTER TABLE "admissions"."admission_applications"
  ADD COLUMN IF NOT EXISTS "person_id"               TEXT,
  ADD COLUMN IF NOT EXISTS "campus_id"               TEXT,
  ADD COLUMN IF NOT EXISTS "target_class_section_id" TEXT,
  ADD COLUMN IF NOT EXISTS "academic_year_id"        TEXT,
  ADD COLUMN IF NOT EXISTS "offered_at"              TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "accepted_at"             TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "decision_at"             TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resulting_student_id"    TEXT,
  ADD COLUMN IF NOT EXISTS "document_checklist"      JSONB;

ALTER TABLE "admissions"."admission_applications" ALTER COLUMN "stage" SET DEFAULT 'applied';
CREATE INDEX IF NOT EXISTS "admission_applications_resulting_student_id_idx" ON "admissions"."admission_applications"("resulting_student_id");

-- ---- admissions.admission_reviews ---------------------------------------
CREATE TABLE IF NOT EXISTS "admissions"."admission_reviews" (
    "id"             TEXT NOT NULL,
    "tenant_id"      TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "reviewer_id"    TEXT,
    "score"          INTEGER,
    "recommendation" TEXT NOT NULL,
    "note"           TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admission_reviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admission_reviews_tenant_id_idx" ON "admissions"."admission_reviews"("tenant_id");
CREATE INDEX IF NOT EXISTS "admission_reviews_application_id_idx" ON "admissions"."admission_reviews"("application_id");
CREATE INDEX IF NOT EXISTS "admission_reviews_tenant_id_application_id_idx" ON "admissions"."admission_reviews"("tenant_id", "application_id");

-- ---- admissions.admission_stage_events ----------------------------------
CREATE TABLE IF NOT EXISTS "admissions"."admission_stage_events" (
    "id"             TEXT NOT NULL,
    "tenant_id"      TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "from_stage"     TEXT,
    "to_stage"       TEXT NOT NULL,
    "note"           TEXT,
    "actor_id"       TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admission_stage_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admission_stage_events_tenant_id_idx" ON "admissions"."admission_stage_events"("tenant_id");
CREATE INDEX IF NOT EXISTS "admission_stage_events_application_id_idx" ON "admissions"."admission_stage_events"("application_id");
CREATE INDEX IF NOT EXISTS "admission_stage_events_tenant_id_application_id_idx" ON "admissions"."admission_stage_events"("tenant_id", "application_id");

-- ---- Foreign keys (idempotent) ------------------------------------------
DO $fks$
BEGIN
  -- application soft refs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_applications_person_id_fkey') THEN
    ALTER TABLE "admissions"."admission_applications" ADD CONSTRAINT "admission_applications_person_id_fkey"
      FOREIGN KEY ("person_id") REFERENCES "person"."persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_applications_campus_id_fkey') THEN
    ALTER TABLE "admissions"."admission_applications" ADD CONSTRAINT "admission_applications_campus_id_fkey"
      FOREIGN KEY ("campus_id") REFERENCES "tenant"."campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_applications_target_class_section_id_fkey') THEN
    ALTER TABLE "admissions"."admission_applications" ADD CONSTRAINT "admission_applications_target_class_section_id_fkey"
      FOREIGN KEY ("target_class_section_id") REFERENCES "academic-structure"."class_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_applications_academic_year_id_fkey') THEN
    ALTER TABLE "admissions"."admission_applications" ADD CONSTRAINT "admission_applications_academic_year_id_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "academic-structure"."academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_applications_resulting_student_id_fkey') THEN
    ALTER TABLE "admissions"."admission_applications" ADD CONSTRAINT "admission_applications_resulting_student_id_fkey"
      FOREIGN KEY ("resulting_student_id") REFERENCES "student-management"."students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- admission_reviews
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_reviews_tenant_id_fkey') THEN
    ALTER TABLE "admissions"."admission_reviews" ADD CONSTRAINT "admission_reviews_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_reviews_application_id_fkey') THEN
    ALTER TABLE "admissions"."admission_reviews" ADD CONSTRAINT "admission_reviews_application_id_fkey"
      FOREIGN KEY ("application_id") REFERENCES "admissions"."admission_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- admission_stage_events
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_stage_events_tenant_id_fkey') THEN
    ALTER TABLE "admissions"."admission_stage_events" ADD CONSTRAINT "admission_stage_events_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_stage_events_application_id_fkey') THEN
    ALTER TABLE "admissions"."admission_stage_events" ADD CONSTRAINT "admission_stage_events_application_id_fkey"
      FOREIGN KEY ("application_id") REFERENCES "admissions"."admission_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$fks$;

-- ---- RLS + grants on the two NEW tables (own + platform) ----------------
DO $rls$
DECLARE
  tables text[][] := ARRAY[
    ARRAY['admissions','admission_reviews'],
    ARRAY['admissions','admission_stage_events']
  ];
  i int;
  sch text;
  tbl text;
BEGIN
  FOR i IN 1 .. array_length(tables, 1) LOOP
    sch := tables[i][1];
    tbl := tables[i][2];
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', sch, tbl);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', sch, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I.%I', sch, tbl);
    EXECUTE format($p$
      CREATE POLICY "tenant_isolation" ON %I.%I
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          tenant_id = current_setting('app.current_tenant_id', true)
          OR current_setting('app.is_platform', true) = 'on'
        )
        WITH CHECK (
          tenant_id = current_setting('app.current_tenant_id', true)
          OR current_setting('app.is_platform', true) = 'on'
        )
    $p$, sch, tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.%I TO app_runtime', sch, tbl);
  END LOOP;
END
$rls$;
