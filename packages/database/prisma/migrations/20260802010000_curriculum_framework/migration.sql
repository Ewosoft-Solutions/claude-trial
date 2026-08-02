-- ============================================================
-- F6 · Curriculum — academic-profile + policy-version framework (ADR-03)
-- ============================================================
-- A versioned, effective-dated curriculum domain. Seven REFERENCE tables carry a
-- NULLABLE tenant_id (NULL = shared national content, immutable to tenants) and
-- three tenant-owned APPLICATION tables (Adoption/Overlay/Mapping) are NOT NULL.
--
-- RLS comes in two shapes, both PERMISSIVE + named `tenant_isolation` (so
-- db:rls:check passes):
--   * reference tables — READ own + national(NULL) + platform; WRITE own +
--     platform. National (NULL-tenant) rows are therefore immutable to any
--     tenant at the DB layer; tenant edits go through a TenantCurriculumOverlay.
--   * application tables — the standard own + platform isolation.
-- tenant_id is a DB-level FK to tenant.tenants (no Prisma relation), mirroring
-- the jobs/directory/communication infra convention.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "curriculum";

-- ---- Reference tables --------------------------------------------------
CREATE TABLE "curriculum"."curriculum_authorities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'national',
    "country" TEXT,
    "description" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "curriculum_authorities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "curriculum_authorities_tenant_id_code_key" ON "curriculum"."curriculum_authorities"("tenant_id", "code");
CREATE INDEX "curriculum_authorities_tenant_id_idx" ON "curriculum"."curriculum_authorities"("tenant_id");

CREATE TABLE "curriculum"."curriculum_frameworks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "authority_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "subject_area" TEXT,
    "description" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "curriculum_frameworks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "curriculum_frameworks_tenant_id_idx" ON "curriculum"."curriculum_frameworks"("tenant_id");
CREATE INDEX "curriculum_frameworks_authority_id_idx" ON "curriculum"."curriculum_frameworks"("authority_id");

CREATE TABLE "curriculum"."curriculum_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "framework_id" TEXT NOT NULL,
    "version_label" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "approval_state" TEXT NOT NULL DEFAULT 'draft',
    "is_national_immutable" BOOLEAN NOT NULL DEFAULT false,
    "provenance" JSONB,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "curriculum_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "curriculum_versions_framework_id_version_label_key" ON "curriculum"."curriculum_versions"("framework_id", "version_label");
CREATE INDEX "curriculum_versions_tenant_id_idx" ON "curriculum"."curriculum_versions"("tenant_id");
CREATE INDEX "curriculum_versions_framework_id_idx" ON "curriculum"."curriculum_versions"("framework_id");
CREATE INDEX "curriculum_versions_approval_state_idx" ON "curriculum"."curriculum_versions"("approval_state");
CREATE INDEX "curriculum_versions_effective_from_effective_to_idx" ON "curriculum"."curriculum_versions"("effective_from", "effective_to");

CREATE TABLE "curriculum"."curriculum_stages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "version_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level_code" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "curriculum_stages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "curriculum_stages_version_id_name_key" ON "curriculum"."curriculum_stages"("version_id", "name");
CREATE INDEX "curriculum_stages_tenant_id_idx" ON "curriculum"."curriculum_stages"("tenant_id");
CREATE INDEX "curriculum_stages_version_id_idx" ON "curriculum"."curriculum_stages"("version_id");

CREATE TABLE "curriculum"."curriculum_subjects" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "version_id" TEXT NOT NULL,
    "stage_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canonical_name" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "curriculum_subjects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "curriculum_subjects_version_id_code_key" ON "curriculum"."curriculum_subjects"("version_id", "code");
CREATE INDEX "curriculum_subjects_tenant_id_idx" ON "curriculum"."curriculum_subjects"("tenant_id");
CREATE INDEX "curriculum_subjects_version_id_idx" ON "curriculum"."curriculum_subjects"("version_id");
CREATE INDEX "curriculum_subjects_stage_id_idx" ON "curriculum"."curriculum_subjects"("stage_id");

CREATE TABLE "curriculum"."curriculum_nodes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "version_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'topic',
    "title" TEXT NOT NULL,
    "code" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "origin" TEXT NOT NULL DEFAULT 'authored',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "provenance" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "curriculum_nodes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "curriculum_nodes_tenant_id_idx" ON "curriculum"."curriculum_nodes"("tenant_id");
CREATE INDEX "curriculum_nodes_subject_id_idx" ON "curriculum"."curriculum_nodes"("subject_id");
CREATE INDEX "curriculum_nodes_parent_id_idx" ON "curriculum"."curriculum_nodes"("parent_id");
CREATE INDEX "curriculum_nodes_version_id_idx" ON "curriculum"."curriculum_nodes"("version_id");

CREATE TABLE "curriculum"."learning_outcomes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "node_id" TEXT NOT NULL,
    "code" TEXT,
    "statement" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "learning_outcomes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "learning_outcomes_tenant_id_idx" ON "curriculum"."learning_outcomes"("tenant_id");
CREATE INDEX "learning_outcomes_node_id_idx" ON "curriculum"."learning_outcomes"("node_id");

-- ---- Tenant-owned application tables -----------------------------------
CREATE TABLE "curriculum"."curriculum_adoptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campus_id" TEXT,
    "programme" TEXT,
    "version_id" TEXT NOT NULL,
    "entry_cohort" TEXT NOT NULL,
    "level_from" TEXT,
    "level_to" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "curriculum_adoptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "curriculum_adoptions_tenant_id_idx" ON "curriculum"."curriculum_adoptions"("tenant_id");
CREATE INDEX "curriculum_adoptions_tenant_id_entry_cohort_idx" ON "curriculum"."curriculum_adoptions"("tenant_id", "entry_cohort");
CREATE INDEX "curriculum_adoptions_tenant_id_status_idx" ON "curriculum"."curriculum_adoptions"("tenant_id", "status");
CREATE INDEX "curriculum_adoptions_version_id_idx" ON "curriculum"."curriculum_adoptions"("version_id");

CREATE TABLE "curriculum"."tenant_curriculum_overlays" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "base_version_id" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_curriculum_overlays_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tenant_curriculum_overlays_tenant_id_idx" ON "curriculum"."tenant_curriculum_overlays"("tenant_id");
CREATE INDEX "tenant_curriculum_overlays_base_version_id_idx" ON "curriculum"."tenant_curriculum_overlays"("base_version_id");
CREATE INDEX "tenant_curriculum_overlays_tenant_id_status_idx" ON "curriculum"."tenant_curriculum_overlays"("tenant_id", "status");

CREATE TABLE "curriculum"."curriculum_mappings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "from_name" TEXT NOT NULL,
    "from_normalized" TEXT NOT NULL,
    "to_subject_id" TEXT,
    "to_canonical_name" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'alias',
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "curriculum_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "curriculum_mappings_tenant_id_from_normalized_key" ON "curriculum"."curriculum_mappings"("tenant_id", "from_normalized");
CREATE INDEX "curriculum_mappings_tenant_id_idx" ON "curriculum"."curriculum_mappings"("tenant_id");

-- ---- Foreign keys ------------------------------------------------------
-- tenant_id → tenant.tenants (nullable on reference tables; NULL = national).
ALTER TABLE "curriculum"."curriculum_authorities" ADD CONSTRAINT "curriculum_authorities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_frameworks" ADD CONSTRAINT "curriculum_frameworks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_frameworks" ADD CONSTRAINT "curriculum_frameworks_authority_id_fkey" FOREIGN KEY ("authority_id") REFERENCES "curriculum"."curriculum_authorities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_versions" ADD CONSTRAINT "curriculum_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_versions" ADD CONSTRAINT "curriculum_versions_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "curriculum"."curriculum_frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_stages" ADD CONSTRAINT "curriculum_stages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_stages" ADD CONSTRAINT "curriculum_stages_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "curriculum"."curriculum_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_subjects" ADD CONSTRAINT "curriculum_subjects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_subjects" ADD CONSTRAINT "curriculum_subjects_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "curriculum"."curriculum_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_subjects" ADD CONSTRAINT "curriculum_subjects_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "curriculum"."curriculum_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_nodes" ADD CONSTRAINT "curriculum_nodes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_nodes" ADD CONSTRAINT "curriculum_nodes_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "curriculum"."curriculum_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_nodes" ADD CONSTRAINT "curriculum_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "curriculum"."curriculum_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."learning_outcomes" ADD CONSTRAINT "learning_outcomes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."learning_outcomes" ADD CONSTRAINT "learning_outcomes_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "curriculum"."curriculum_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_adoptions" ADD CONSTRAINT "curriculum_adoptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_adoptions" ADD CONSTRAINT "curriculum_adoptions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "curriculum"."curriculum_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."tenant_curriculum_overlays" ADD CONSTRAINT "tenant_curriculum_overlays_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."tenant_curriculum_overlays" ADD CONSTRAINT "tenant_curriculum_overlays_base_version_id_fkey" FOREIGN KEY ("base_version_id") REFERENCES "curriculum"."curriculum_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum"."curriculum_mappings" ADD CONSTRAINT "curriculum_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- RLS + grants ------------------------------------------------------
-- Reference tables: READ own + national(NULL) + platform; WRITE own + platform.
DO $ref$
DECLARE
  t text;
  reference_tables text[] := ARRAY[
    'curriculum_authorities','curriculum_frameworks','curriculum_versions',
    'curriculum_stages','curriculum_subjects','curriculum_nodes','learning_outcomes'
  ];
BEGIN
  FOREACH t IN ARRAY reference_tables LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'curriculum', t);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', 'curriculum', t);
    EXECUTE format($p$
      CREATE POLICY "tenant_isolation" ON %I.%I
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          tenant_id IS NULL
          OR tenant_id = current_setting('app.current_tenant_id', true)
          OR current_setting('app.is_platform', true) = 'on'
        )
        WITH CHECK (
          tenant_id = current_setting('app.current_tenant_id', true)
          OR current_setting('app.is_platform', true) = 'on'
        )
    $p$, 'curriculum', t);
  END LOOP;
END
$ref$;

-- Application tables: the standard own + platform isolation.
DO $app$
DECLARE
  t text;
  app_tables text[] := ARRAY[
    'curriculum_adoptions','tenant_curriculum_overlays','curriculum_mappings'
  ];
BEGIN
  FOREACH t IN ARRAY app_tables LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'curriculum', t);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', 'curriculum', t);
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
    $p$, 'curriculum', t);
  END LOOP;
END
$app$;

-- app_runtime DML grants for the new schema (+ future tables/sequences).
GRANT USAGE ON SCHEMA "curriculum" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "curriculum" TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "curriculum" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "curriculum" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "curriculum" GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
