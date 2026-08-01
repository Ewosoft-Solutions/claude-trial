-- ============================================================
-- Import & migration platform (F2) — ADR-09
-- ============================================================
-- New "imports" schema. No back-fill (a new domain). Every table is
-- tenant-scoped (tenant_id non-null) with RLS enabled + forced + a permissive
-- tenant_isolation policy, and granted to app_runtime — same posture as the
-- jobs/person/documents schemas.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "imports";

-- ---- imports.import_definitions -------------------------------------

CREATE TABLE "imports"."import_definitions" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "key"           TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "target_domain" TEXT NOT NULL,
  "spec"          JSONB,
  "active"        BOOLEAN NOT NULL DEFAULT true,
  "created_by"    TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "import_definitions_tenant_key_key" ON "imports"."import_definitions"("tenant_id", "key");
CREATE INDEX "import_definitions_tenant_id_idx" ON "imports"."import_definitions"("tenant_id");

-- ---- imports.import_jobs --------------------------------------------

CREATE TABLE "imports"."import_jobs" (
  "id"                TEXT NOT NULL,
  "tenant_id"         TEXT NOT NULL,
  "definition_id"     TEXT NOT NULL,
  "source_system"     TEXT NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'draft',
  "job_id"            TEXT,
  "requires_approval" BOOLEAN NOT NULL DEFAULT false,
  "approved_by"       TEXT,
  "approved_at"       TIMESTAMP(3),
  "rows_total"        INTEGER NOT NULL DEFAULT 0,
  "rows_valid"        INTEGER NOT NULL DEFAULT 0,
  "rows_invalid"      INTEGER NOT NULL DEFAULT 0,
  "rows_committed"    INTEGER NOT NULL DEFAULT 0,
  "rows_skipped"      INTEGER NOT NULL DEFAULT 0,
  "error"             TEXT,
  "created_by"        TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "import_jobs_tenant_id_idx" ON "imports"."import_jobs"("tenant_id");
CREATE INDEX "import_jobs_tenant_status_idx" ON "imports"."import_jobs"("tenant_id", "status");
CREATE INDEX "import_jobs_definition_id_idx" ON "imports"."import_jobs"("definition_id");

-- ---- imports.source_files -------------------------------------------

CREATE TABLE "imports"."source_files" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "import_job_id" TEXT NOT NULL,
  "document_id"   TEXT,
  "filename"      TEXT NOT NULL,
  "checksum"      TEXT NOT NULL,
  "mime"          TEXT NOT NULL,
  "size"          INTEGER NOT NULL,
  "row_count"     INTEGER NOT NULL DEFAULT 0,
  "scan_status"   TEXT NOT NULL DEFAULT 'pending',
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "source_files_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "source_files_tenant_id_idx" ON "imports"."source_files"("tenant_id");
CREATE INDEX "source_files_import_job_id_idx" ON "imports"."source_files"("import_job_id");

-- ---- imports.transform_rules ----------------------------------------

CREATE TABLE "imports"."transform_rules" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "definition_id" TEXT,
  "name"          TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "config"        JSONB,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transform_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "transform_rules_tenant_id_idx" ON "imports"."transform_rules"("tenant_id");
CREATE INDEX "transform_rules_definition_id_idx" ON "imports"."transform_rules"("definition_id");

-- ---- imports.column_mappings ----------------------------------------

CREATE TABLE "imports"."column_mappings" (
  "id"                TEXT NOT NULL,
  "tenant_id"         TEXT NOT NULL,
  "import_job_id"     TEXT NOT NULL,
  "source_column"     TEXT NOT NULL,
  "target_field"      TEXT NOT NULL,
  "transform_rule_id" TEXT,
  "required"          BOOLEAN NOT NULL DEFAULT false,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "column_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "column_mappings_job_target_key" ON "imports"."column_mappings"("import_job_id", "target_field");
CREATE INDEX "column_mappings_tenant_id_idx" ON "imports"."column_mappings"("tenant_id");
CREATE INDEX "column_mappings_import_job_id_idx" ON "imports"."column_mappings"("import_job_id");

-- ---- imports.import_rows --------------------------------------------

CREATE TABLE "imports"."import_rows" (
  "id"              TEXT NOT NULL,
  "tenant_id"       TEXT NOT NULL,
  "import_job_id"   TEXT NOT NULL,
  "row_number"      INTEGER NOT NULL,
  "source_id"       TEXT,
  "raw_data"        JSONB NOT NULL,
  "normalized_data" JSONB,
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "target_type"     TEXT,
  "target_id"       TEXT,
  "target_created"  BOOLEAN NOT NULL DEFAULT false,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "import_rows_job_rownum_key" ON "imports"."import_rows"("import_job_id", "row_number");
CREATE INDEX "import_rows_tenant_id_idx" ON "imports"."import_rows"("tenant_id");
CREATE INDEX "import_rows_job_status_idx" ON "imports"."import_rows"("import_job_id", "status");
CREATE INDEX "import_rows_job_source_idx" ON "imports"."import_rows"("import_job_id", "source_id");

-- ---- imports.validation_issues --------------------------------------

CREATE TABLE "imports"."validation_issues" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "import_row_id" TEXT NOT NULL,
  "field"         TEXT,
  "severity"      TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "message"       TEXT NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "validation_issues_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "validation_issues_tenant_id_idx" ON "imports"."validation_issues"("tenant_id");
CREATE INDEX "validation_issues_import_row_id_idx" ON "imports"."validation_issues"("import_row_id");

-- ---- imports.duplicate_candidates -----------------------------------

CREATE TABLE "imports"."duplicate_candidates" (
  "id"                  TEXT NOT NULL,
  "tenant_id"           TEXT NOT NULL,
  "import_row_id"       TEXT NOT NULL,
  "matched_entity_type" TEXT NOT NULL,
  "matched_entity_id"   TEXT NOT NULL,
  "score"               DOUBLE PRECISION,
  "resolution"          TEXT NOT NULL DEFAULT 'pending',
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "duplicate_candidates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "duplicate_candidates_tenant_id_idx" ON "imports"."duplicate_candidates"("tenant_id");
CREATE INDEX "duplicate_candidates_import_row_id_idx" ON "imports"."duplicate_candidates"("import_row_id");

-- ---- imports.import_commits -----------------------------------------

CREATE TABLE "imports"."import_commits" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "import_job_id" TEXT NOT NULL,
  "created_count" INTEGER NOT NULL DEFAULT 0,
  "updated_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "committed_by"  TEXT,
  "committed_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversed_at"   TIMESTAMP(3),
  "reversed_by"   TEXT,
  CONSTRAINT "import_commits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "import_commits_import_job_id_key" ON "imports"."import_commits"("import_job_id");
CREATE INDEX "import_commits_tenant_id_idx" ON "imports"."import_commits"("tenant_id");

-- ---- imports.reconciliation_rules -----------------------------------

CREATE TABLE "imports"."reconciliation_rules" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "definition_id" TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "kind"          TEXT NOT NULL,
  "config"        JSONB,
  "tolerance"     TEXT NOT NULL DEFAULT '0',
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reconciliation_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reconciliation_rules_tenant_id_idx" ON "imports"."reconciliation_rules"("tenant_id");
CREATE INDEX "reconciliation_rules_definition_id_idx" ON "imports"."reconciliation_rules"("definition_id");

-- ---- imports.reconciliation_results ---------------------------------

CREATE TABLE "imports"."reconciliation_results" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "import_job_id" TEXT NOT NULL,
  "rule_id"       TEXT NOT NULL,
  "expected"      TEXT,
  "actual"        TEXT,
  "passed"        BOOLEAN NOT NULL,
  "detail"        JSONB,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reconciliation_results_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reconciliation_results_tenant_id_idx" ON "imports"."reconciliation_results"("tenant_id");
CREATE INDEX "reconciliation_results_import_job_id_idx" ON "imports"."reconciliation_results"("import_job_id");

-- ---- Foreign keys ---------------------------------------------------

ALTER TABLE "imports"."import_definitions" ADD CONSTRAINT "import_definitions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "imports"."import_jobs" ADD CONSTRAINT "import_jobs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imports"."import_jobs" ADD CONSTRAINT "import_jobs_definition_id_fkey"
  FOREIGN KEY ("definition_id") REFERENCES "imports"."import_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "imports"."source_files" ADD CONSTRAINT "source_files_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imports"."source_files" ADD CONSTRAINT "source_files_import_job_id_fkey"
  FOREIGN KEY ("import_job_id") REFERENCES "imports"."import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "imports"."transform_rules" ADD CONSTRAINT "transform_rules_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imports"."transform_rules" ADD CONSTRAINT "transform_rules_definition_id_fkey"
  FOREIGN KEY ("definition_id") REFERENCES "imports"."import_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "imports"."column_mappings" ADD CONSTRAINT "column_mappings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imports"."column_mappings" ADD CONSTRAINT "column_mappings_import_job_id_fkey"
  FOREIGN KEY ("import_job_id") REFERENCES "imports"."import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imports"."column_mappings" ADD CONSTRAINT "column_mappings_transform_rule_id_fkey"
  FOREIGN KEY ("transform_rule_id") REFERENCES "imports"."transform_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "imports"."import_rows" ADD CONSTRAINT "import_rows_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imports"."import_rows" ADD CONSTRAINT "import_rows_import_job_id_fkey"
  FOREIGN KEY ("import_job_id") REFERENCES "imports"."import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "imports"."validation_issues" ADD CONSTRAINT "validation_issues_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imports"."validation_issues" ADD CONSTRAINT "validation_issues_import_row_id_fkey"
  FOREIGN KEY ("import_row_id") REFERENCES "imports"."import_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "imports"."duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imports"."duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_import_row_id_fkey"
  FOREIGN KEY ("import_row_id") REFERENCES "imports"."import_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "imports"."import_commits" ADD CONSTRAINT "import_commits_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imports"."import_commits" ADD CONSTRAINT "import_commits_import_job_id_fkey"
  FOREIGN KEY ("import_job_id") REFERENCES "imports"."import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "imports"."reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imports"."reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_definition_id_fkey"
  FOREIGN KEY ("definition_id") REFERENCES "imports"."import_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "imports"."reconciliation_results" ADD CONSTRAINT "reconciliation_results_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imports"."reconciliation_results" ADD CONSTRAINT "reconciliation_results_import_job_id_fkey"
  FOREIGN KEY ("import_job_id") REFERENCES "imports"."import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imports"."reconciliation_results" ADD CONSTRAINT "reconciliation_results_rule_id_fkey"
  FOREIGN KEY ("rule_id") REFERENCES "imports"."reconciliation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- RLS + grants ---------------------------------------------------

DO $rls$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'import_definitions', 'import_jobs', 'source_files', 'transform_rules',
    'column_mappings', 'import_rows', 'validation_issues',
    'duplicate_candidates', 'import_commits', 'reconciliation_rules',
    'reconciliation_results'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'imports', t);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', 'imports', t);
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
        )$p$, 'imports', t);
  END LOOP;
END
$rls$;

GRANT USAGE ON SCHEMA "imports" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "imports" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "imports"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
