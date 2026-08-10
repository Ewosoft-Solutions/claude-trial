-- ============================================================
-- WB3-3 + WB3-4 · School-authored versioned application form + typed responses,
--                 and interview / exam scheduling with an inline admission quiz.
-- ============================================================
--   • admission_form_versions   — per-tenant, versioned, school-authored form
--       (draft → published → archived; a published version is immutable, a new
--        draft supersedes it on publish). Ordered typed field defs in JSONB.
--   • admission_form_responses  — an application's answers to one form version,
--       snapshotting the version number + field defs so a later edit never
--       rewrites captured answers (form_version_id FK is RESTRICT).
--   • admission_interviews      — a scheduled interview / exam / screening with a
--       structured outcome; an 'exam' may carry an inline question paper (the
--       admission quiz, auto-marked server-side).
--
-- Additive + idempotent. RLS on all 3 NEW tables (own + platform), mirroring the
-- structured-intake migration so db:rls:check passes from day one.
-- ============================================================

-- ---- admissions.admission_form_versions ---------------------------------
CREATE TABLE IF NOT EXISTS "admissions"."admission_form_versions" (
    "id"           TEXT NOT NULL,
    "tenant_id"    TEXT NOT NULL,
    "version"      INTEGER NOT NULL,
    "title"        TEXT NOT NULL,
    "description"  TEXT,
    "status"       TEXT NOT NULL DEFAULT 'draft',
    "fields"       JSONB NOT NULL,
    "published_at" TIMESTAMP(3),
    "published_by" TEXT,
    "created_by"   TEXT,
    "updated_by"   TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admission_form_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "admission_form_versions_tenant_id_version_key" ON "admissions"."admission_form_versions"("tenant_id", "version");
CREATE INDEX IF NOT EXISTS "admission_form_versions_tenant_id_idx" ON "admissions"."admission_form_versions"("tenant_id");
CREATE INDEX IF NOT EXISTS "admission_form_versions_tenant_id_status_idx" ON "admissions"."admission_form_versions"("tenant_id", "status");

-- ---- admissions.admission_form_responses --------------------------------
CREATE TABLE IF NOT EXISTS "admissions"."admission_form_responses" (
    "id"              TEXT NOT NULL,
    "tenant_id"       TEXT NOT NULL,
    "application_id"  TEXT NOT NULL,
    "form_version_id" TEXT NOT NULL,
    "form_version"    INTEGER NOT NULL,
    "fields_snapshot" JSONB NOT NULL,
    "answers"         JSONB NOT NULL,
    "submitted_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_by"    TEXT,
    "updated_at"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admission_form_responses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "admission_form_responses_application_id_form_version_id_key" ON "admissions"."admission_form_responses"("application_id", "form_version_id");
CREATE INDEX IF NOT EXISTS "admission_form_responses_tenant_id_idx" ON "admissions"."admission_form_responses"("tenant_id");
CREATE INDEX IF NOT EXISTS "admission_form_responses_application_id_idx" ON "admissions"."admission_form_responses"("application_id");
CREATE INDEX IF NOT EXISTS "admission_form_responses_tenant_id_application_id_idx" ON "admissions"."admission_form_responses"("tenant_id", "application_id");
CREATE INDEX IF NOT EXISTS "admission_form_responses_form_version_id_idx" ON "admissions"."admission_form_responses"("form_version_id");

-- ---- admissions.admission_interviews ------------------------------------
CREATE TABLE IF NOT EXISTS "admissions"."admission_interviews" (
    "id"                   TEXT NOT NULL,
    "tenant_id"            TEXT NOT NULL,
    "application_id"       TEXT NOT NULL,
    "kind"                 TEXT NOT NULL,
    "title"                TEXT,
    "mode"                 TEXT NOT NULL DEFAULT 'in_person',
    "location"             TEXT,
    "scheduled_for"        TIMESTAMP(3),
    "duration_minutes"     INTEGER,
    "interviewer_id"       TEXT,
    "status"               TEXT NOT NULL DEFAULT 'scheduled',
    "outcome"              TEXT,
    "score"                INTEGER,
    "max_score"            INTEGER,
    "notes"                TEXT,
    "questions"            JSONB,
    "answers"              JSONB,
    "auto_marked"          BOOLEAN NOT NULL DEFAULT false,
    "needs_manual_grading" BOOLEAN NOT NULL DEFAULT false,
    "completed_at"         TIMESTAMP(3),
    "created_by"           TEXT,
    "updated_by"           TEXT,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admission_interviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admission_interviews_tenant_id_idx" ON "admissions"."admission_interviews"("tenant_id");
CREATE INDEX IF NOT EXISTS "admission_interviews_application_id_idx" ON "admissions"."admission_interviews"("application_id");
CREATE INDEX IF NOT EXISTS "admission_interviews_tenant_id_application_id_idx" ON "admissions"."admission_interviews"("tenant_id", "application_id");
CREATE INDEX IF NOT EXISTS "admission_interviews_tenant_id_status_idx" ON "admissions"."admission_interviews"("tenant_id", "status");

-- ---- Foreign keys (idempotent) ------------------------------------------
DO $fks$
BEGIN
  -- admission_form_versions
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_form_versions_tenant_id_fkey') THEN
    ALTER TABLE "admissions"."admission_form_versions" ADD CONSTRAINT "admission_form_versions_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- admission_form_responses
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_form_responses_tenant_id_fkey') THEN
    ALTER TABLE "admissions"."admission_form_responses" ADD CONSTRAINT "admission_form_responses_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_form_responses_application_id_fkey') THEN
    ALTER TABLE "admissions"."admission_form_responses" ADD CONSTRAINT "admission_form_responses_application_id_fkey"
      FOREIGN KEY ("application_id") REFERENCES "admissions"."admission_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- RESTRICT: a response SNAPSHOTS a version, so a published version referenced by
  -- any response must never be hard-deleted (versions are archived, not removed).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_form_responses_form_version_id_fkey') THEN
    ALTER TABLE "admissions"."admission_form_responses" ADD CONSTRAINT "admission_form_responses_form_version_id_fkey"
      FOREIGN KEY ("form_version_id") REFERENCES "admissions"."admission_form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- admission_interviews
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_interviews_tenant_id_fkey') THEN
    ALTER TABLE "admissions"."admission_interviews" ADD CONSTRAINT "admission_interviews_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_interviews_application_id_fkey') THEN
    ALTER TABLE "admissions"."admission_interviews" ADD CONSTRAINT "admission_interviews_application_id_fkey"
      FOREIGN KEY ("application_id") REFERENCES "admissions"."admission_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$fks$;

-- ---- RLS + grants on the 3 NEW tables (own + platform) ------------------
DO $rls$
DECLARE
  tables text[][] := ARRAY[
    ARRAY['admissions','admission_form_versions'],
    ARRAY['admissions','admission_form_responses'],
    ARRAY['admissions','admission_interviews']
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
