-- ============================================================
-- WB4 · Results parity / ResultCycle (ADR-04)
-- ============================================================
-- Ten new tenant-owned tables in the academic-structure schema, the immutable
-- result-publication layer on top of the day-to-day gradebook:
--
--   result_cycles              — a term's result run for a set of class sections
--   result_components          — configurable CA/EXAM components of a cycle
--   result_cycle_sections      — class sections included in a cycle's scope
--   result_entries             — one component score per (student · offering)
--   remark_rule_sets           — structured band→comment rule sets (typed)
--   remark_rules               — the bands within a rule set
--   result_publications        — immutable snapshot + checksum (anchor-ready)
--   published_student_results  — the per-student snapshot + report-card artifact
--   result_amendments          — a post-publication correction (maker-checker)
--   financial_holds            — an audited hold on result visibility
--
-- External references are DB-level FKs (no Prisma relation, F6 convention),
-- validated in-service. RLS: ENABLE + FORCE + PERMISSIVE tenant_isolation
-- (own + platform) on every table. All additive + idempotent.
-- ============================================================

-- ---- academic-structure.result_cycles -----------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."result_cycles" (
    "id"                             TEXT NOT NULL,
    "tenant_id"                      TEXT NOT NULL,
    "campus_id"                      TEXT,
    "name"                           TEXT NOT NULL,
    "academic_year_id"               TEXT NOT NULL,
    "term_id"                        TEXT,
    "year_level_id"                  TEXT,
    "grading_system_id"              TEXT,
    "subject_remark_rule_set_id"     TEXT,
    "principal_remark_rule_set_id"   TEXT,
    "promotion_policy"               JSONB,
    "ranking_enabled"                BOOLEAN NOT NULL DEFAULT false,
    "status"                         TEXT NOT NULL DEFAULT 'draft',
    "approval_request_id"            TEXT,
    "entry_opened_at"                TIMESTAMP(3),
    "entry_closed_at"                TIMESTAMP(3),
    "published_at"                   TIMESTAMP(3),
    "created_by"                     TEXT,
    "updated_by"                     TEXT,
    "created_at"                     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "result_cycles_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "result_cycles_tenant_id_idx" ON "academic-structure"."result_cycles"("tenant_id");
CREATE INDEX IF NOT EXISTS "result_cycles_tenant_id_status_idx" ON "academic-structure"."result_cycles"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "result_cycles_campus_id_idx" ON "academic-structure"."result_cycles"("campus_id");
CREATE INDEX IF NOT EXISTS "result_cycles_academic_year_id_idx" ON "academic-structure"."result_cycles"("academic_year_id");

-- ---- academic-structure.result_components -------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."result_components" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "cycle_id"   TEXT NOT NULL,
    "key"        TEXT NOT NULL,
    "label"      TEXT NOT NULL,
    "max_score"  DECIMAL(65,30) NOT NULL,
    "weight"     DECIMAL(65,30),
    "order"      INTEGER NOT NULL DEFAULT 0,
    "is_exam"    BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "result_components_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "result_components_cycle_id_key_key" ON "academic-structure"."result_components"("cycle_id", "key");
CREATE INDEX IF NOT EXISTS "result_components_tenant_id_idx" ON "academic-structure"."result_components"("tenant_id");
CREATE INDEX IF NOT EXISTS "result_components_cycle_id_idx" ON "academic-structure"."result_components"("cycle_id");

-- ---- academic-structure.result_cycle_sections ---------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."result_cycle_sections" (
    "id"               TEXT NOT NULL,
    "tenant_id"        TEXT NOT NULL,
    "cycle_id"         TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "result_cycle_sections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "result_cycle_sections_cycle_id_class_section_id_key" ON "academic-structure"."result_cycle_sections"("cycle_id", "class_section_id");
CREATE INDEX IF NOT EXISTS "result_cycle_sections_tenant_id_idx" ON "academic-structure"."result_cycle_sections"("tenant_id");
CREATE INDEX IF NOT EXISTS "result_cycle_sections_cycle_id_idx" ON "academic-structure"."result_cycle_sections"("cycle_id");
CREATE INDEX IF NOT EXISTS "result_cycle_sections_class_section_id_idx" ON "academic-structure"."result_cycle_sections"("class_section_id");

-- ---- academic-structure.result_entries ----------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."result_entries" (
    "id"                  TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL,
    "cycle_id"            TEXT NOT NULL,
    "component_id"        TEXT NOT NULL,
    "student_id"          TEXT NOT NULL,
    "subject_offering_id" TEXT NOT NULL,
    "score"               DECIMAL(65,30),
    "is_absent"           BOOLEAN NOT NULL DEFAULT false,
    "is_exempt"           BOOLEAN NOT NULL DEFAULT false,
    "entered_by"          TEXT,
    "entered_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "result_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "result_entries_cycle_id_student_id_subject_offering_id_compo_key" ON "academic-structure"."result_entries"("cycle_id", "student_id", "subject_offering_id", "component_id");
CREATE INDEX IF NOT EXISTS "result_entries_tenant_id_idx" ON "academic-structure"."result_entries"("tenant_id");
CREATE INDEX IF NOT EXISTS "result_entries_cycle_id_idx" ON "academic-structure"."result_entries"("cycle_id");
CREATE INDEX IF NOT EXISTS "result_entries_cycle_id_subject_offering_id_idx" ON "academic-structure"."result_entries"("cycle_id", "subject_offering_id");
CREATE INDEX IF NOT EXISTS "result_entries_cycle_id_student_id_idx" ON "academic-structure"."result_entries"("cycle_id", "student_id");
CREATE INDEX IF NOT EXISTS "result_entries_student_id_idx" ON "academic-structure"."result_entries"("student_id");

-- ---- academic-structure.remark_rule_sets --------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."remark_rule_sets" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "kind"       TEXT NOT NULL DEFAULT 'subject',
    "status"     TEXT NOT NULL DEFAULT 'active',
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "remark_rule_sets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "remark_rule_sets_tenant_id_name_key" ON "academic-structure"."remark_rule_sets"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "remark_rule_sets_tenant_id_idx" ON "academic-structure"."remark_rule_sets"("tenant_id");
CREATE INDEX IF NOT EXISTS "remark_rule_sets_tenant_id_kind_idx" ON "academic-structure"."remark_rule_sets"("tenant_id", "kind");

-- ---- academic-structure.remark_rules ------------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."remark_rules" (
    "id"             TEXT NOT NULL,
    "tenant_id"      TEXT NOT NULL,
    "rule_set_id"    TEXT NOT NULL,
    "min_percentage" DECIMAL(65,30) NOT NULL,
    "max_percentage" DECIMAL(65,30) NOT NULL,
    "comment"        TEXT NOT NULL,
    "order"          INTEGER NOT NULL DEFAULT 0,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "remark_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "remark_rules_tenant_id_idx" ON "academic-structure"."remark_rules"("tenant_id");
CREATE INDEX IF NOT EXISTS "remark_rules_rule_set_id_idx" ON "academic-structure"."remark_rules"("rule_set_id");

-- ---- academic-structure.result_publications -----------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."result_publications" (
    "id"                     TEXT NOT NULL,
    "tenant_id"              TEXT NOT NULL,
    "cycle_id"               TEXT NOT NULL,
    "version"                INTEGER NOT NULL DEFAULT 1,
    "status"                 TEXT NOT NULL DEFAULT 'published',
    "snapshot"               JSONB NOT NULL,
    "checksum"               TEXT NOT NULL,
    "approval_request_id"    TEXT,
    "amendment_reason"       TEXT,
    "superseded_by_id"       TEXT,
    "superseded_at"          TIMESTAMP(3),
    "broadsheet_document_id" TEXT,
    "published_by"           TEXT,
    "published_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "result_publications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "result_publications_cycle_id_version_key" ON "academic-structure"."result_publications"("cycle_id", "version");
CREATE INDEX IF NOT EXISTS "result_publications_tenant_id_idx" ON "academic-structure"."result_publications"("tenant_id");
CREATE INDEX IF NOT EXISTS "result_publications_cycle_id_idx" ON "academic-structure"."result_publications"("cycle_id");
CREATE INDEX IF NOT EXISTS "result_publications_tenant_id_status_idx" ON "academic-structure"."result_publications"("tenant_id", "status");

-- ---- academic-structure.published_student_results -----------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."published_student_results" (
    "id"                        TEXT NOT NULL,
    "tenant_id"                 TEXT NOT NULL,
    "publication_id"            TEXT NOT NULL,
    "cycle_id"                  TEXT NOT NULL,
    "student_id"                TEXT NOT NULL,
    "student_number"            TEXT,
    "student_name"              TEXT,
    "class_section_id"          TEXT,
    "section_label"             TEXT,
    "subjects"                  JSONB NOT NULL,
    "overall_total"             DECIMAL(65,30),
    "overall_max"               DECIMAL(65,30),
    "average"                   DECIMAL(65,30),
    "overall_grade"             TEXT,
    "position"                  INTEGER,
    "promotion_recommendation"  TEXT,
    "promotion_reason"          TEXT,
    "report_card_document_id"   TEXT,
    "checksum"                  TEXT NOT NULL,
    "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "published_student_results_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "published_student_results_publication_id_student_id_key" ON "academic-structure"."published_student_results"("publication_id", "student_id");
CREATE INDEX IF NOT EXISTS "published_student_results_tenant_id_idx" ON "academic-structure"."published_student_results"("tenant_id");
CREATE INDEX IF NOT EXISTS "published_student_results_publication_id_idx" ON "academic-structure"."published_student_results"("publication_id");
CREATE INDEX IF NOT EXISTS "published_student_results_cycle_id_idx" ON "academic-structure"."published_student_results"("cycle_id");
CREATE INDEX IF NOT EXISTS "published_student_results_tenant_id_student_id_idx" ON "academic-structure"."published_student_results"("tenant_id", "student_id");

-- ---- academic-structure.result_amendments -------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."result_amendments" (
    "id"                        TEXT NOT NULL,
    "tenant_id"                 TEXT NOT NULL,
    "cycle_id"                  TEXT NOT NULL,
    "publication_id"            TEXT NOT NULL,
    "status"                    TEXT NOT NULL DEFAULT 'pending_approval',
    "reason"                    TEXT NOT NULL,
    "changes"                   JSONB NOT NULL,
    "approval_request_id"       TEXT,
    "resulting_publication_id"  TEXT,
    "requested_by"              TEXT,
    "approved_by"               TEXT,
    "applied_at"                TIMESTAMP(3),
    "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                TIMESTAMP(3) NOT NULL,
    CONSTRAINT "result_amendments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "result_amendments_tenant_id_idx" ON "academic-structure"."result_amendments"("tenant_id");
CREATE INDEX IF NOT EXISTS "result_amendments_cycle_id_idx" ON "academic-structure"."result_amendments"("cycle_id");
CREATE INDEX IF NOT EXISTS "result_amendments_publication_id_idx" ON "academic-structure"."result_amendments"("publication_id");
CREATE INDEX IF NOT EXISTS "result_amendments_tenant_id_status_idx" ON "academic-structure"."result_amendments"("tenant_id", "status");

-- ---- academic-structure.financial_holds ---------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."financial_holds" (
    "id"             TEXT NOT NULL,
    "tenant_id"      TEXT NOT NULL,
    "student_id"     TEXT NOT NULL,
    "campus_id"      TEXT,
    "status"         TEXT NOT NULL DEFAULT 'active',
    "reason"         TEXT NOT NULL,
    "placed_by"      TEXT,
    "placed_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_by"    TEXT,
    "released_at"    TIMESTAMP(3),
    "release_reason" TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financial_holds_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "financial_holds_tenant_id_idx" ON "academic-structure"."financial_holds"("tenant_id");
CREATE INDEX IF NOT EXISTS "financial_holds_tenant_id_student_id_status_idx" ON "academic-structure"."financial_holds"("tenant_id", "student_id", "status");
CREATE INDEX IF NOT EXISTS "financial_holds_student_id_idx" ON "academic-structure"."financial_holds"("student_id");
CREATE INDEX IF NOT EXISTS "financial_holds_campus_id_idx" ON "academic-structure"."financial_holds"("campus_id");

-- ---- Foreign keys (idempotent) ------------------------------------------
DO $fks$
BEGIN
  -- result_cycles
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_cycles_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_cycles" ADD CONSTRAINT "result_cycles_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_cycles_campus_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_cycles" ADD CONSTRAINT "result_cycles_campus_id_fkey"
      FOREIGN KEY ("campus_id") REFERENCES "tenant"."campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_cycles_academic_year_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_cycles" ADD CONSTRAINT "result_cycles_academic_year_id_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "academic-structure"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_cycles_term_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_cycles" ADD CONSTRAINT "result_cycles_term_id_fkey"
      FOREIGN KEY ("term_id") REFERENCES "academic-structure"."terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_cycles_year_level_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_cycles" ADD CONSTRAINT "result_cycles_year_level_id_fkey"
      FOREIGN KEY ("year_level_id") REFERENCES "academic-structure"."year_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_cycles_grading_system_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_cycles" ADD CONSTRAINT "result_cycles_grading_system_id_fkey"
      FOREIGN KEY ("grading_system_id") REFERENCES "academic-structure"."grading_systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_cycles_subject_remark_rule_set_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_cycles" ADD CONSTRAINT "result_cycles_subject_remark_rule_set_id_fkey"
      FOREIGN KEY ("subject_remark_rule_set_id") REFERENCES "academic-structure"."remark_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_cycles_principal_remark_rule_set_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_cycles" ADD CONSTRAINT "result_cycles_principal_remark_rule_set_id_fkey"
      FOREIGN KEY ("principal_remark_rule_set_id") REFERENCES "academic-structure"."remark_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- result_components
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_components_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_components" ADD CONSTRAINT "result_components_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_components_cycle_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_components" ADD CONSTRAINT "result_components_cycle_id_fkey"
      FOREIGN KEY ("cycle_id") REFERENCES "academic-structure"."result_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- result_cycle_sections
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_cycle_sections_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_cycle_sections" ADD CONSTRAINT "result_cycle_sections_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_cycle_sections_cycle_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_cycle_sections" ADD CONSTRAINT "result_cycle_sections_cycle_id_fkey"
      FOREIGN KEY ("cycle_id") REFERENCES "academic-structure"."result_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_cycle_sections_class_section_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_cycle_sections" ADD CONSTRAINT "result_cycle_sections_class_section_id_fkey"
      FOREIGN KEY ("class_section_id") REFERENCES "academic-structure"."class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- result_entries
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_entries_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_entries" ADD CONSTRAINT "result_entries_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_entries_cycle_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_entries" ADD CONSTRAINT "result_entries_cycle_id_fkey"
      FOREIGN KEY ("cycle_id") REFERENCES "academic-structure"."result_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_entries_component_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_entries" ADD CONSTRAINT "result_entries_component_id_fkey"
      FOREIGN KEY ("component_id") REFERENCES "academic-structure"."result_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_entries_student_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_entries" ADD CONSTRAINT "result_entries_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "student-management"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_entries_subject_offering_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_entries" ADD CONSTRAINT "result_entries_subject_offering_id_fkey"
      FOREIGN KEY ("subject_offering_id") REFERENCES "academic-structure"."subject_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- remark_rule_sets
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'remark_rule_sets_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."remark_rule_sets" ADD CONSTRAINT "remark_rule_sets_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- remark_rules
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'remark_rules_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."remark_rules" ADD CONSTRAINT "remark_rules_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'remark_rules_rule_set_id_fkey') THEN
    ALTER TABLE "academic-structure"."remark_rules" ADD CONSTRAINT "remark_rules_rule_set_id_fkey"
      FOREIGN KEY ("rule_set_id") REFERENCES "academic-structure"."remark_rule_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- result_publications
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_publications_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_publications" ADD CONSTRAINT "result_publications_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_publications_cycle_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_publications" ADD CONSTRAINT "result_publications_cycle_id_fkey"
      FOREIGN KEY ("cycle_id") REFERENCES "academic-structure"."result_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- published_student_results
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'published_student_results_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."published_student_results" ADD CONSTRAINT "published_student_results_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'published_student_results_publication_id_fkey') THEN
    ALTER TABLE "academic-structure"."published_student_results" ADD CONSTRAINT "published_student_results_publication_id_fkey"
      FOREIGN KEY ("publication_id") REFERENCES "academic-structure"."result_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'published_student_results_cycle_id_fkey') THEN
    ALTER TABLE "academic-structure"."published_student_results" ADD CONSTRAINT "published_student_results_cycle_id_fkey"
      FOREIGN KEY ("cycle_id") REFERENCES "academic-structure"."result_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'published_student_results_student_id_fkey') THEN
    ALTER TABLE "academic-structure"."published_student_results" ADD CONSTRAINT "published_student_results_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "student-management"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- result_amendments
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_amendments_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_amendments" ADD CONSTRAINT "result_amendments_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_amendments_cycle_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_amendments" ADD CONSTRAINT "result_amendments_cycle_id_fkey"
      FOREIGN KEY ("cycle_id") REFERENCES "academic-structure"."result_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_amendments_publication_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_amendments" ADD CONSTRAINT "result_amendments_publication_id_fkey"
      FOREIGN KEY ("publication_id") REFERENCES "academic-structure"."result_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- financial_holds
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_holds_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."financial_holds" ADD CONSTRAINT "financial_holds_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_holds_student_id_fkey') THEN
    ALTER TABLE "academic-structure"."financial_holds" ADD CONSTRAINT "financial_holds_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "student-management"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_holds_campus_id_fkey') THEN
    ALTER TABLE "academic-structure"."financial_holds" ADD CONSTRAINT "financial_holds_campus_id_fkey"
      FOREIGN KEY ("campus_id") REFERENCES "tenant"."campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$fks$;

-- ---- RLS + grants (own + platform tenant isolation) ---------------------
DO $rls$
DECLARE
  tables text[][] := ARRAY[
    ARRAY['academic-structure','result_cycles'],
    ARRAY['academic-structure','result_components'],
    ARRAY['academic-structure','result_cycle_sections'],
    ARRAY['academic-structure','result_entries'],
    ARRAY['academic-structure','remark_rule_sets'],
    ARRAY['academic-structure','remark_rules'],
    ARRAY['academic-structure','result_publications'],
    ARRAY['academic-structure','published_student_results'],
    ARRAY['academic-structure','result_amendments'],
    ARRAY['academic-structure','financial_holds']
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
