-- ============================================================
-- Form Engine (P1) — a generic, reusable form subsystem.
--   • forms.forms          — a polymorphically-owned (owner_type/owner_id),
--                            purpose-named form.
--   • forms.form_versions  — versioned definition (draft → published → archived;
--                            a published version is immutable). Definition JSONB.
--   • forms.form_responses — a SUBJECT's (subject_type/subject_id) answers to one
--                            version, snapshotting the definition + version
--                            (form_version_id FK is RESTRICT).
--
-- Additive + idempotent. New `forms` schema. RLS on all 3 tables (own + platform)
-- so db:rls:check passes from day one. See docs/form-engine-plan.md.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "forms";

-- ---- forms.forms --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "forms"."forms" (
    "id"          TEXT NOT NULL,
    "tenant_id"   TEXT NOT NULL,
    "owner_type"  TEXT NOT NULL,
    "owner_id"    TEXT NOT NULL,
    "purpose"     TEXT NOT NULL,
    "key"         TEXT,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "created_by"  TEXT,
    "updated_by"  TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "forms_tenant_id_idx" ON "forms"."forms"("tenant_id");
CREATE INDEX IF NOT EXISTS "forms_tenant_id_owner_type_owner_id_idx" ON "forms"."forms"("tenant_id", "owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "forms_tenant_id_purpose_idx" ON "forms"."forms"("tenant_id", "purpose");

-- ---- forms.form_versions ------------------------------------------------
CREATE TABLE IF NOT EXISTS "forms"."form_versions" (
    "id"           TEXT NOT NULL,
    "tenant_id"    TEXT NOT NULL,
    "form_id"      TEXT NOT NULL,
    "version"      INTEGER NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'draft',
    "definition"   JSONB NOT NULL,
    "published_at" TIMESTAMP(3),
    "published_by" TEXT,
    "created_by"   TEXT,
    "updated_by"   TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "form_versions_form_id_version_key" ON "forms"."form_versions"("form_id", "version");
CREATE INDEX IF NOT EXISTS "form_versions_tenant_id_idx" ON "forms"."form_versions"("tenant_id");
CREATE INDEX IF NOT EXISTS "form_versions_tenant_id_form_id_idx" ON "forms"."form_versions"("tenant_id", "form_id");
CREATE INDEX IF NOT EXISTS "form_versions_tenant_id_status_idx" ON "forms"."form_versions"("tenant_id", "status");

-- ---- forms.form_responses -----------------------------------------------
CREATE TABLE IF NOT EXISTS "forms"."form_responses" (
    "id"                  TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL,
    "form_version_id"     TEXT NOT NULL,
    "subject_type"        TEXT NOT NULL,
    "subject_id"          TEXT NOT NULL,
    "version"             INTEGER NOT NULL,
    "definition_snapshot" JSONB NOT NULL,
    "answers"             JSONB NOT NULL,
    "submitted_by"        TEXT,
    "submitted_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "form_responses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "form_responses_form_version_id_subject_type_subject_id_key" ON "forms"."form_responses"("form_version_id", "subject_type", "subject_id");
CREATE INDEX IF NOT EXISTS "form_responses_tenant_id_idx" ON "forms"."form_responses"("tenant_id");
CREATE INDEX IF NOT EXISTS "form_responses_tenant_id_subject_type_subject_id_idx" ON "forms"."form_responses"("tenant_id", "subject_type", "subject_id");
CREATE INDEX IF NOT EXISTS "form_responses_form_version_id_idx" ON "forms"."form_responses"("form_version_id");

-- ---- Foreign keys (idempotent) ------------------------------------------
DO $fks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forms_tenant_id_fkey') THEN
    ALTER TABLE "forms"."forms" ADD CONSTRAINT "forms_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_versions_tenant_id_fkey') THEN
    ALTER TABLE "forms"."form_versions" ADD CONSTRAINT "form_versions_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_versions_form_id_fkey') THEN
    ALTER TABLE "forms"."form_versions" ADD CONSTRAINT "form_versions_form_id_fkey"
      FOREIGN KEY ("form_id") REFERENCES "forms"."forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_responses_tenant_id_fkey') THEN
    ALTER TABLE "forms"."form_responses" ADD CONSTRAINT "form_responses_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- RESTRICT: a response SNAPSHOTS a version, so a published version referenced by
  -- any response must never be hard-deleted (versions are archived, not removed).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_responses_form_version_id_fkey') THEN
    ALTER TABLE "forms"."form_responses" ADD CONSTRAINT "form_responses_form_version_id_fkey"
      FOREIGN KEY ("form_version_id") REFERENCES "forms"."form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$fks$;

-- ---- RLS on the 3 tables (own + platform) -------------------------------
DO $rls$
DECLARE
  tables text[][] := ARRAY[
    ARRAY['forms','forms'],
    ARRAY['forms','form_versions'],
    ARRAY['forms','form_responses']
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
  END LOOP;
END
$rls$;

-- ---- Grant the forms schema to app_runtime ------------------------------
GRANT USAGE ON SCHEMA "forms" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA "forms" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "forms"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
