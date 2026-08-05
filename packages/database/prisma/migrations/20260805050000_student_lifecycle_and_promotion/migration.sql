-- ============================================================
-- WB2-3 · Student lifecycle + WB2-4 · Promotion workbench
-- ============================================================
-- Three new tenant-owned tables, additive over the WB2-1/WB2-2 structure:
--
--   student-management.student_placement_history — durable, effective-dated
--       ledger of the SPANS a student sat in a (campus, section, year). A
--       transfer closes one span and opens another; both survive with dates.
--   student-management.promotion_runs            — a year-rollover operation
--       (from/to academic year + year level), maker-checker-gated commit.
--   student-management.promotion_run_items       — per-student proposal +
--       exception (promote / repeat / withhold / manual) within a run.
--
-- External references are DB-level FKs (no Prisma relation, F6 convention),
-- validated in-service. RLS: ENABLE + FORCE + PERMISSIVE tenant_isolation
-- (own + platform) on every table. All additive + idempotent.
-- ============================================================

-- ---- student-management.student_placement_history -----------------------
CREATE TABLE IF NOT EXISTS "student-management"."student_placement_history" (
    "id"                    TEXT NOT NULL,
    "tenant_id"             TEXT NOT NULL,
    "student_id"            TEXT NOT NULL,
    "campus_id"             TEXT NOT NULL,
    "class_section_id"      TEXT,
    "academic_year_id"      TEXT,
    "event_type"            TEXT NOT NULL,
    "status"                TEXT NOT NULL DEFAULT 'active',
    "effective_from"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to"          TIMESTAMP(3),
    "reason"                TEXT,
    "section_enrollment_id" TEXT,
    "created_by"            TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_placement_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "student_placement_history_tenant_id_idx" ON "student-management"."student_placement_history"("tenant_id");
CREATE INDEX IF NOT EXISTS "student_placement_history_student_id_idx" ON "student-management"."student_placement_history"("student_id");
CREATE INDEX IF NOT EXISTS "student_placement_history_tenant_id_student_id_idx" ON "student-management"."student_placement_history"("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "student_placement_history_class_section_id_idx" ON "student-management"."student_placement_history"("class_section_id");
CREATE INDEX IF NOT EXISTS "student_placement_history_campus_id_idx" ON "student-management"."student_placement_history"("campus_id");
CREATE INDEX IF NOT EXISTS "student_placement_history_status_idx" ON "student-management"."student_placement_history"("status");
CREATE INDEX IF NOT EXISTS "student_placement_history_tenant_id_student_id_status_idx" ON "student-management"."student_placement_history"("tenant_id", "student_id", "status");

-- ---- student-management.promotion_runs ----------------------------------
CREATE TABLE IF NOT EXISTS "student-management"."promotion_runs" (
    "id"                    TEXT NOT NULL,
    "tenant_id"             TEXT NOT NULL,
    "campus_id"             TEXT,
    "name"                  TEXT NOT NULL,
    "from_academic_year_id" TEXT NOT NULL,
    "to_academic_year_id"   TEXT NOT NULL,
    "from_year_level_id"    TEXT NOT NULL,
    "to_year_level_id"      TEXT NOT NULL,
    "status"                TEXT NOT NULL DEFAULT 'draft',
    "approval_request_id"   TEXT,
    "previewed_at"          TIMESTAMP(3),
    "committed_at"          TIMESTAMP(3),
    "committed_by"          TEXT,
    "created_by"            TEXT,
    "updated_by"            TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promotion_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "promotion_runs_tenant_id_idx" ON "student-management"."promotion_runs"("tenant_id");
CREATE INDEX IF NOT EXISTS "promotion_runs_tenant_id_status_idx" ON "student-management"."promotion_runs"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "promotion_runs_campus_id_idx" ON "student-management"."promotion_runs"("campus_id");

-- ---- student-management.promotion_run_items -----------------------------
CREATE TABLE IF NOT EXISTS "student-management"."promotion_run_items" (
    "id"                        TEXT NOT NULL,
    "tenant_id"                 TEXT NOT NULL,
    "run_id"                    TEXT NOT NULL,
    "student_id"                TEXT NOT NULL,
    "from_class_section_id"     TEXT,
    "proposed_class_section_id" TEXT,
    "decision"                  TEXT NOT NULL DEFAULT 'promote',
    "status"                    TEXT NOT NULL DEFAULT 'pending',
    "exception_reason"          TEXT,
    "resulting_enrollment_id"   TEXT,
    "created_by"                TEXT,
    "updated_by"                TEXT,
    "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promotion_run_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "promotion_run_items_run_id_student_id_key" ON "student-management"."promotion_run_items"("run_id", "student_id");
CREATE INDEX IF NOT EXISTS "promotion_run_items_tenant_id_idx" ON "student-management"."promotion_run_items"("tenant_id");
CREATE INDEX IF NOT EXISTS "promotion_run_items_run_id_idx" ON "student-management"."promotion_run_items"("run_id");
CREATE INDEX IF NOT EXISTS "promotion_run_items_student_id_idx" ON "student-management"."promotion_run_items"("student_id");
CREATE INDEX IF NOT EXISTS "promotion_run_items_tenant_id_run_id_idx" ON "student-management"."promotion_run_items"("tenant_id", "run_id");

-- ---- Foreign keys (idempotent) ------------------------------------------
DO $fks$
BEGIN
  -- student_placement_history
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_placement_history_tenant_id_fkey') THEN
    ALTER TABLE "student-management"."student_placement_history" ADD CONSTRAINT "student_placement_history_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_placement_history_student_id_fkey') THEN
    ALTER TABLE "student-management"."student_placement_history" ADD CONSTRAINT "student_placement_history_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "student-management"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_placement_history_campus_id_fkey') THEN
    ALTER TABLE "student-management"."student_placement_history" ADD CONSTRAINT "student_placement_history_campus_id_fkey"
      FOREIGN KEY ("campus_id") REFERENCES "tenant"."campuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_placement_history_class_section_id_fkey') THEN
    ALTER TABLE "student-management"."student_placement_history" ADD CONSTRAINT "student_placement_history_class_section_id_fkey"
      FOREIGN KEY ("class_section_id") REFERENCES "academic-structure"."class_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_placement_history_academic_year_id_fkey') THEN
    ALTER TABLE "student-management"."student_placement_history" ADD CONSTRAINT "student_placement_history_academic_year_id_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "academic-structure"."academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- promotion_runs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_runs_tenant_id_fkey') THEN
    ALTER TABLE "student-management"."promotion_runs" ADD CONSTRAINT "promotion_runs_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_runs_campus_id_fkey') THEN
    ALTER TABLE "student-management"."promotion_runs" ADD CONSTRAINT "promotion_runs_campus_id_fkey"
      FOREIGN KEY ("campus_id") REFERENCES "tenant"."campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_runs_from_academic_year_id_fkey') THEN
    ALTER TABLE "student-management"."promotion_runs" ADD CONSTRAINT "promotion_runs_from_academic_year_id_fkey"
      FOREIGN KEY ("from_academic_year_id") REFERENCES "academic-structure"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_runs_to_academic_year_id_fkey') THEN
    ALTER TABLE "student-management"."promotion_runs" ADD CONSTRAINT "promotion_runs_to_academic_year_id_fkey"
      FOREIGN KEY ("to_academic_year_id") REFERENCES "academic-structure"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_runs_from_year_level_id_fkey') THEN
    ALTER TABLE "student-management"."promotion_runs" ADD CONSTRAINT "promotion_runs_from_year_level_id_fkey"
      FOREIGN KEY ("from_year_level_id") REFERENCES "academic-structure"."year_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_runs_to_year_level_id_fkey') THEN
    ALTER TABLE "student-management"."promotion_runs" ADD CONSTRAINT "promotion_runs_to_year_level_id_fkey"
      FOREIGN KEY ("to_year_level_id") REFERENCES "academic-structure"."year_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- promotion_run_items
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_run_items_tenant_id_fkey') THEN
    ALTER TABLE "student-management"."promotion_run_items" ADD CONSTRAINT "promotion_run_items_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_run_items_run_id_fkey') THEN
    ALTER TABLE "student-management"."promotion_run_items" ADD CONSTRAINT "promotion_run_items_run_id_fkey"
      FOREIGN KEY ("run_id") REFERENCES "student-management"."promotion_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_run_items_student_id_fkey') THEN
    ALTER TABLE "student-management"."promotion_run_items" ADD CONSTRAINT "promotion_run_items_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "student-management"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_run_items_from_class_section_id_fkey') THEN
    ALTER TABLE "student-management"."promotion_run_items" ADD CONSTRAINT "promotion_run_items_from_class_section_id_fkey"
      FOREIGN KEY ("from_class_section_id") REFERENCES "academic-structure"."class_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_run_items_proposed_class_section_id_fkey') THEN
    ALTER TABLE "student-management"."promotion_run_items" ADD CONSTRAINT "promotion_run_items_proposed_class_section_id_fkey"
      FOREIGN KEY ("proposed_class_section_id") REFERENCES "academic-structure"."class_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$fks$;

-- ---- RLS + grants (own + platform tenant isolation) ---------------------
DO $rls$
DECLARE
  tables text[][] := ARRAY[
    ARRAY['student-management','student_placement_history'],
    ARRAY['student-management','promotion_runs'],
    ARRAY['student-management','promotion_run_items']
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
