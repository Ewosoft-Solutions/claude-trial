-- ============================================================
-- WB2-2 · Enrollment + per-course registration + electives + teacher assignment
-- ============================================================
-- Five new tenant-owned tables over the WB2-1 structure, additive over the
-- legacy Enrollment(→ labeled-bag Class):
--
--   academic-structure.academic_profiles   — 'class' (K-12) vs 'course' (tertiary)
--   academic-structure.offering_teachers    — teacher(UserTenant) → SubjectOffering
--   student-management.section_enrollments   — Student → ClassSection (K-12)
--   student-management.course_registrations  — Student → SubjectOffering (tertiary)
--   student-management.student_subject_elections — Student → elective SubjectOffering
--
-- External references are DB-level FKs (no Prisma relation, F6 convention),
-- validated in-service. RLS: ENABLE + FORCE + PERMISSIVE tenant_isolation
-- (own + platform) on every table. All additive + idempotent.
-- ============================================================

-- ---- academic-structure.academic_profiles -------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."academic_profiles" (
    "id"               TEXT NOT NULL,
    "tenant_id"        TEXT NOT NULL,
    "campus_id"        TEXT,
    "name"             TEXT NOT NULL,
    "enrollment_model" TEXT NOT NULL,
    "is_default"       BOOLEAN NOT NULL DEFAULT false,
    "status"           TEXT NOT NULL DEFAULT 'active',
    "effective_from"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to"     TIMESTAMP(3),
    "created_by"       TEXT,
    "updated_by"       TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "academic_profiles_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "academic_profiles_tenant_id_idx" ON "academic-structure"."academic_profiles"("tenant_id");
CREATE INDEX IF NOT EXISTS "academic_profiles_tenant_id_campus_id_idx" ON "academic-structure"."academic_profiles"("tenant_id", "campus_id");
CREATE INDEX IF NOT EXISTS "academic_profiles_status_idx" ON "academic-structure"."academic_profiles"("status");

-- ---- academic-structure.offering_teachers -------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."offering_teachers" (
    "id"                  TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL,
    "subject_offering_id" TEXT NOT NULL,
    "user_tenant_id"      TEXT NOT NULL,
    "role"                TEXT NOT NULL DEFAULT 'teacher',
    "is_active"           BOOLEAN NOT NULL DEFAULT true,
    "assigned_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by"         TEXT,
    "unassigned_at"       TIMESTAMP(3),
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "offering_teachers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "offering_teachers_subject_offering_id_user_tenant_id_key" ON "academic-structure"."offering_teachers"("subject_offering_id", "user_tenant_id");
CREATE INDEX IF NOT EXISTS "offering_teachers_tenant_id_idx" ON "academic-structure"."offering_teachers"("tenant_id");
CREATE INDEX IF NOT EXISTS "offering_teachers_subject_offering_id_idx" ON "academic-structure"."offering_teachers"("subject_offering_id");
CREATE INDEX IF NOT EXISTS "offering_teachers_user_tenant_id_idx" ON "academic-structure"."offering_teachers"("user_tenant_id");
CREATE INDEX IF NOT EXISTS "offering_teachers_is_active_idx" ON "academic-structure"."offering_teachers"("is_active");

-- ---- student-management.section_enrollments -----------------------------
CREATE TABLE IF NOT EXISTS "student-management"."section_enrollments" (
    "id"               TEXT NOT NULL,
    "tenant_id"        TEXT NOT NULL,
    "student_id"       TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'active',
    "enrolled_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at"         TIMESTAMP(3),
    "end_reason"       TEXT,
    "created_by"       TEXT,
    "updated_by"       TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "section_enrollments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "section_enrollments_student_id_class_section_id_academic_year_id_key" ON "student-management"."section_enrollments"("student_id", "class_section_id", "academic_year_id");
CREATE INDEX IF NOT EXISTS "section_enrollments_tenant_id_idx" ON "student-management"."section_enrollments"("tenant_id");
CREATE INDEX IF NOT EXISTS "section_enrollments_student_id_idx" ON "student-management"."section_enrollments"("student_id");
CREATE INDEX IF NOT EXISTS "section_enrollments_class_section_id_idx" ON "student-management"."section_enrollments"("class_section_id");
CREATE INDEX IF NOT EXISTS "section_enrollments_status_idx" ON "student-management"."section_enrollments"("status");
CREATE INDEX IF NOT EXISTS "section_enrollments_tenant_id_class_section_id_idx" ON "student-management"."section_enrollments"("tenant_id", "class_section_id");

-- ---- student-management.course_registrations ----------------------------
CREATE TABLE IF NOT EXISTS "student-management"."course_registrations" (
    "id"                  TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL,
    "student_id"          TEXT NOT NULL,
    "subject_offering_id" TEXT NOT NULL,
    "status"              TEXT NOT NULL DEFAULT 'registered',
    "registered_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at"            TIMESTAMP(3),
    "created_by"          TEXT,
    "updated_by"          TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "course_registrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "course_registrations_student_id_subject_offering_id_key" ON "student-management"."course_registrations"("student_id", "subject_offering_id");
CREATE INDEX IF NOT EXISTS "course_registrations_tenant_id_idx" ON "student-management"."course_registrations"("tenant_id");
CREATE INDEX IF NOT EXISTS "course_registrations_student_id_idx" ON "student-management"."course_registrations"("student_id");
CREATE INDEX IF NOT EXISTS "course_registrations_subject_offering_id_idx" ON "student-management"."course_registrations"("subject_offering_id");
CREATE INDEX IF NOT EXISTS "course_registrations_status_idx" ON "student-management"."course_registrations"("status");

-- ---- student-management.student_subject_elections -----------------------
CREATE TABLE IF NOT EXISTS "student-management"."student_subject_elections" (
    "id"                  TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL,
    "student_id"          TEXT NOT NULL,
    "subject_offering_id" TEXT NOT NULL,
    "status"              TEXT NOT NULL DEFAULT 'elected',
    "elected_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by"          TEXT,
    "updated_by"          TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_subject_elections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "student_subject_elections_student_id_subject_offering_id_key" ON "student-management"."student_subject_elections"("student_id", "subject_offering_id");
CREATE INDEX IF NOT EXISTS "student_subject_elections_tenant_id_idx" ON "student-management"."student_subject_elections"("tenant_id");
CREATE INDEX IF NOT EXISTS "student_subject_elections_student_id_idx" ON "student-management"."student_subject_elections"("student_id");
CREATE INDEX IF NOT EXISTS "student_subject_elections_subject_offering_id_idx" ON "student-management"."student_subject_elections"("subject_offering_id");

-- ---- Foreign keys (idempotent) ------------------------------------------
DO $fks$
BEGIN
  -- tenant_id → tenant.tenants (all 5)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academic_profiles_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."academic_profiles" ADD CONSTRAINT "academic_profiles_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academic_profiles_campus_id_fkey') THEN
    ALTER TABLE "academic-structure"."academic_profiles" ADD CONSTRAINT "academic_profiles_campus_id_fkey"
      FOREIGN KEY ("campus_id") REFERENCES "tenant"."campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offering_teachers_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."offering_teachers" ADD CONSTRAINT "offering_teachers_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offering_teachers_subject_offering_id_fkey') THEN
    ALTER TABLE "academic-structure"."offering_teachers" ADD CONSTRAINT "offering_teachers_subject_offering_id_fkey"
      FOREIGN KEY ("subject_offering_id") REFERENCES "academic-structure"."subject_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offering_teachers_user_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."offering_teachers" ADD CONSTRAINT "offering_teachers_user_tenant_id_fkey"
      FOREIGN KEY ("user_tenant_id") REFERENCES "profile"."user_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'section_enrollments_tenant_id_fkey') THEN
    ALTER TABLE "student-management"."section_enrollments" ADD CONSTRAINT "section_enrollments_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'section_enrollments_student_id_fkey') THEN
    ALTER TABLE "student-management"."section_enrollments" ADD CONSTRAINT "section_enrollments_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "student-management"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'section_enrollments_class_section_id_fkey') THEN
    ALTER TABLE "student-management"."section_enrollments" ADD CONSTRAINT "section_enrollments_class_section_id_fkey"
      FOREIGN KEY ("class_section_id") REFERENCES "academic-structure"."class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'section_enrollments_academic_year_id_fkey') THEN
    ALTER TABLE "student-management"."section_enrollments" ADD CONSTRAINT "section_enrollments_academic_year_id_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "academic-structure"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_registrations_tenant_id_fkey') THEN
    ALTER TABLE "student-management"."course_registrations" ADD CONSTRAINT "course_registrations_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_registrations_student_id_fkey') THEN
    ALTER TABLE "student-management"."course_registrations" ADD CONSTRAINT "course_registrations_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "student-management"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_registrations_subject_offering_id_fkey') THEN
    ALTER TABLE "student-management"."course_registrations" ADD CONSTRAINT "course_registrations_subject_offering_id_fkey"
      FOREIGN KEY ("subject_offering_id") REFERENCES "academic-structure"."subject_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_subject_elections_tenant_id_fkey') THEN
    ALTER TABLE "student-management"."student_subject_elections" ADD CONSTRAINT "student_subject_elections_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_subject_elections_student_id_fkey') THEN
    ALTER TABLE "student-management"."student_subject_elections" ADD CONSTRAINT "student_subject_elections_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "student-management"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_subject_elections_subject_offering_id_fkey') THEN
    ALTER TABLE "student-management"."student_subject_elections" ADD CONSTRAINT "student_subject_elections_subject_offering_id_fkey"
      FOREIGN KEY ("subject_offering_id") REFERENCES "academic-structure"."subject_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$fks$;

-- ---- RLS + grants (own + platform tenant isolation) ---------------------
DO $rls$
DECLARE
  rec record;
  tables text[][] := ARRAY[
    ARRAY['academic-structure','academic_profiles'],
    ARRAY['academic-structure','offering_teachers'],
    ARRAY['student-management','section_enrollments'],
    ARRAY['student-management','course_registrations'],
    ARRAY['student-management','student_subject_elections']
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
