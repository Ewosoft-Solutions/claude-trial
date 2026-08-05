-- ============================================================
-- WB2-1 · ADR-02 structured academic model (additive over legacy Class/Course)
-- ============================================================
-- Five new tenant-owned tables in the academic-structure schema that store the
-- class structure as DIMENSIONS (campus · stage · year · stream · section) +
-- offerings — never a parsed label:
--
--   stages → year_levels → class_sections (campus-scoped) ← streams
--   subject_offerings — an F6 curriculum_subjects row offered to a class_section
--     in an academic year/term (the WB2-2 anchor).
--
-- Tenanting (F6 convention): every table carries tenant_id NOT NULL with a
-- DB-level FK to tenant.tenants (no Prisma relation). campus_id → tenant.campuses
-- is the WB1-6 AccessScopeService scope target. curriculum_subject_id is a SOFT
-- reference to curriculum.curriculum_subjects (nullable-tenant / possibly shared
-- national content) validated in-service — no FK, mirroring CurriculumAdoption.
--
-- FK names for the Prisma-declared relations (year_levels.stage_id,
-- class_sections.year_level_id/stream_id, subject_offerings.class_section_id)
-- use Prisma's default `<table>_<column>_fkey` so the schema and DB agree.
--
-- All additive + idempotent (IF NOT EXISTS / guarded DO blocks). RLS: ENABLE +
-- FORCE + a PERMISSIVE tenant_isolation policy (own + platform) on each table —
-- the shape db:rls:check requires.
-- ============================================================

-- ---- 1. stages ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."stages" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "order"      INTEGER NOT NULL DEFAULT 0,
    "status"     TEXT NOT NULL DEFAULT 'active',
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "stages_tenant_id_code_key" ON "academic-structure"."stages"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "stages_tenant_id_idx" ON "academic-structure"."stages"("tenant_id");
CREATE INDEX IF NOT EXISTS "stages_status_idx" ON "academic-structure"."stages"("status");

-- ---- 2. year_levels -----------------------------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."year_levels" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "stage_id"   TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "order"      INTEGER NOT NULL DEFAULT 0,
    "status"     TEXT NOT NULL DEFAULT 'active',
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "year_levels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "year_levels_tenant_id_code_key" ON "academic-structure"."year_levels"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "year_levels_tenant_id_idx" ON "academic-structure"."year_levels"("tenant_id");
CREATE INDEX IF NOT EXISTS "year_levels_stage_id_idx" ON "academic-structure"."year_levels"("stage_id");
CREATE INDEX IF NOT EXISTS "year_levels_status_idx" ON "academic-structure"."year_levels"("status");

-- ---- 3. streams ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."streams" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "order"      INTEGER NOT NULL DEFAULT 0,
    "status"     TEXT NOT NULL DEFAULT 'active',
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "streams_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "streams_tenant_id_code_key" ON "academic-structure"."streams"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "streams_tenant_id_idx" ON "academic-structure"."streams"("tenant_id");
CREATE INDEX IF NOT EXISTS "streams_status_idx" ON "academic-structure"."streams"("status");

-- ---- 4. class_sections --------------------------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."class_sections" (
    "id"            TEXT NOT NULL,
    "tenant_id"     TEXT NOT NULL,
    "campus_id"     TEXT NOT NULL,
    "year_level_id" TEXT NOT NULL,
    "stream_id"     TEXT,
    "name"          TEXT NOT NULL,
    "display_label" TEXT NOT NULL,
    "capacity"      INTEGER NOT NULL DEFAULT 30,
    "status"        TEXT NOT NULL DEFAULT 'active',
    "created_by"    TEXT,
    "updated_by"    TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "class_sections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "class_sections_tenant_id_campus_id_year_level_id_stream_id_name_key"
  ON "academic-structure"."class_sections"("tenant_id", "campus_id", "year_level_id", "stream_id", "name");
CREATE INDEX IF NOT EXISTS "class_sections_tenant_id_idx" ON "academic-structure"."class_sections"("tenant_id");
CREATE INDEX IF NOT EXISTS "class_sections_campus_id_idx" ON "academic-structure"."class_sections"("campus_id");
CREATE INDEX IF NOT EXISTS "class_sections_year_level_id_idx" ON "academic-structure"."class_sections"("year_level_id");
CREATE INDEX IF NOT EXISTS "class_sections_stream_id_idx" ON "academic-structure"."class_sections"("stream_id");
CREATE INDEX IF NOT EXISTS "class_sections_status_idx" ON "academic-structure"."class_sections"("status");

-- ---- 5. subject_offerings -----------------------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."subject_offerings" (
    "id"                    TEXT NOT NULL,
    "tenant_id"             TEXT NOT NULL,
    "class_section_id"      TEXT NOT NULL,
    "academic_year_id"      TEXT NOT NULL,
    "term_id"               TEXT,
    "curriculum_subject_id" TEXT NOT NULL,
    "subject_label"         TEXT NOT NULL,
    "is_elective"           BOOLEAN NOT NULL DEFAULT false,
    "status"                TEXT NOT NULL DEFAULT 'active',
    "created_by"            TEXT,
    "updated_by"            TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subject_offerings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "subject_offerings_class_section_id_curriculum_subject_id_term_id_key"
  ON "academic-structure"."subject_offerings"("class_section_id", "curriculum_subject_id", "term_id");
CREATE INDEX IF NOT EXISTS "subject_offerings_tenant_id_idx" ON "academic-structure"."subject_offerings"("tenant_id");
CREATE INDEX IF NOT EXISTS "subject_offerings_class_section_id_idx" ON "academic-structure"."subject_offerings"("class_section_id");
CREATE INDEX IF NOT EXISTS "subject_offerings_academic_year_id_idx" ON "academic-structure"."subject_offerings"("academic_year_id");
CREATE INDEX IF NOT EXISTS "subject_offerings_curriculum_subject_id_idx" ON "academic-structure"."subject_offerings"("curriculum_subject_id");

-- ---- Foreign keys (idempotent) ------------------------------------------
DO $fks$
BEGIN
  -- tenant_id → tenant.tenants (DB-level; no Prisma relation, F6 convention)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stages_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."stages" ADD CONSTRAINT "stages_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'year_levels_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."year_levels" ADD CONSTRAINT "year_levels_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'streams_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."streams" ADD CONSTRAINT "streams_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_sections_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."class_sections" ADD CONSTRAINT "class_sections_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subject_offerings_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."subject_offerings" ADD CONSTRAINT "subject_offerings_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Prisma-declared relations (default fkey names).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'year_levels_stage_id_fkey') THEN
    ALTER TABLE "academic-structure"."year_levels" ADD CONSTRAINT "year_levels_stage_id_fkey"
      FOREIGN KEY ("stage_id") REFERENCES "academic-structure"."stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_sections_year_level_id_fkey') THEN
    ALTER TABLE "academic-structure"."class_sections" ADD CONSTRAINT "class_sections_year_level_id_fkey"
      FOREIGN KEY ("year_level_id") REFERENCES "academic-structure"."year_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_sections_stream_id_fkey') THEN
    ALTER TABLE "academic-structure"."class_sections" ADD CONSTRAINT "class_sections_stream_id_fkey"
      FOREIGN KEY ("stream_id") REFERENCES "academic-structure"."streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subject_offerings_class_section_id_fkey') THEN
    ALTER TABLE "academic-structure"."subject_offerings" ADD CONSTRAINT "subject_offerings_class_section_id_fkey"
      FOREIGN KEY ("class_section_id") REFERENCES "academic-structure"."class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- DB-level references (no Prisma relation).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_sections_campus_id_fkey') THEN
    ALTER TABLE "academic-structure"."class_sections" ADD CONSTRAINT "class_sections_campus_id_fkey"
      FOREIGN KEY ("campus_id") REFERENCES "tenant"."campuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subject_offerings_academic_year_id_fkey') THEN
    ALTER TABLE "academic-structure"."subject_offerings" ADD CONSTRAINT "subject_offerings_academic_year_id_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "academic-structure"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subject_offerings_term_id_fkey') THEN
    ALTER TABLE "academic-structure"."subject_offerings" ADD CONSTRAINT "subject_offerings_term_id_fkey"
      FOREIGN KEY ("term_id") REFERENCES "academic-structure"."terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$fks$;

-- ---- RLS + grants (own + platform tenant isolation) ---------------------
DO $rls$
DECLARE
  t text;
  tables text[] := ARRAY['stages','year_levels','streams','class_sections','subject_offerings'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'academic-structure', t);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', 'academic-structure', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I.%I', 'academic-structure', t);
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
    $p$, 'academic-structure', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.%I TO app_runtime', 'academic-structure', t);
  END LOOP;
END
$rls$;
