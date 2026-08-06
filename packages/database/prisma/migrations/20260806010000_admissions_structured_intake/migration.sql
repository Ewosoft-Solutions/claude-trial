-- ============================================================
-- WB3 · Admissions structured intake — clean data + staged requirements
-- ============================================================
-- Turns the free-text admission form into structured, system-sourced data and a
-- school-configurable, staged requirements engine:
--   • admission_applications gains the WB2-1 cascade (stage/year-level/stream)
--     and the applicant profile (DOB, gender, state, religion, health).
--   • admission_guardians                     — multi-guardian, phone + WhatsApp.
--   • admission_requirements                  — per-tenant configurable template
--       (field/document/measurement/fee, tagged to a collection stage).
--   • admission_application_requirements       — per-application fulfilment,
--       linking documents to the F4 document service.
--
-- Soft external refs (stage/year-level/stream/document) are DB-level FKs
-- validated in-service. RLS on the 3 NEW tables. Additive + idempotent.
-- ============================================================

-- ---- extend admission_applications --------------------------------------
ALTER TABLE "admissions"."admission_applications"
  ADD COLUMN IF NOT EXISTS "stage_id"        TEXT,
  ADD COLUMN IF NOT EXISTS "year_level_id"   TEXT,
  ADD COLUMN IF NOT EXISTS "stream_id"       TEXT,
  ADD COLUMN IF NOT EXISTS "date_of_birth"   DATE,
  ADD COLUMN IF NOT EXISTS "gender"          TEXT,
  ADD COLUMN IF NOT EXISTS "state_of_origin" TEXT,
  ADD COLUMN IF NOT EXISTS "religion"        TEXT,
  ADD COLUMN IF NOT EXISTS "health_notes"    TEXT;
CREATE INDEX IF NOT EXISTS "admission_applications_tenant_id_year_level_id_idx" ON "admissions"."admission_applications"("tenant_id", "year_level_id");

-- ---- admissions.admission_guardians -------------------------------------
CREATE TABLE IF NOT EXISTS "admissions"."admission_guardians" (
    "id"                     TEXT NOT NULL,
    "tenant_id"              TEXT NOT NULL,
    "application_id"         TEXT NOT NULL,
    "full_name"              TEXT NOT NULL,
    "relationship"           TEXT NOT NULL,
    "email"                  TEXT,
    "address"                TEXT,
    "phone_country_code"     TEXT NOT NULL DEFAULT '+234',
    "phone_number"           TEXT NOT NULL,
    "whatsapp_same_as_phone" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp_country_code"  TEXT,
    "whatsapp_number"        TEXT,
    "is_primary"             BOOLEAN NOT NULL DEFAULT false,
    "created_by"             TEXT,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admission_guardians_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admission_guardians_tenant_id_idx" ON "admissions"."admission_guardians"("tenant_id");
CREATE INDEX IF NOT EXISTS "admission_guardians_application_id_idx" ON "admissions"."admission_guardians"("application_id");
CREATE INDEX IF NOT EXISTS "admission_guardians_tenant_id_application_id_idx" ON "admissions"."admission_guardians"("tenant_id", "application_id");

-- ---- admissions.admission_requirements ----------------------------------
CREATE TABLE IF NOT EXISTS "admissions"."admission_requirements" (
    "id"            TEXT NOT NULL,
    "tenant_id"     TEXT NOT NULL,
    "key"           TEXT NOT NULL,
    "label"         TEXT NOT NULL,
    "type"          TEXT NOT NULL,
    "collect_stage" TEXT NOT NULL,
    "required"      BOOLEAN NOT NULL DEFAULT true,
    "active"        BOOLEAN NOT NULL DEFAULT true,
    "order"         INTEGER NOT NULL DEFAULT 0,
    "config"        JSONB,
    "created_by"    TEXT,
    "updated_by"    TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admission_requirements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "admission_requirements_tenant_id_key_key" ON "admissions"."admission_requirements"("tenant_id", "key");
CREATE INDEX IF NOT EXISTS "admission_requirements_tenant_id_idx" ON "admissions"."admission_requirements"("tenant_id");
CREATE INDEX IF NOT EXISTS "admission_requirements_tenant_id_collect_stage_idx" ON "admissions"."admission_requirements"("tenant_id", "collect_stage");
CREATE INDEX IF NOT EXISTS "admission_requirements_tenant_id_active_idx" ON "admissions"."admission_requirements"("tenant_id", "active");

-- ---- admissions.admission_application_requirements ----------------------
CREATE TABLE IF NOT EXISTS "admissions"."admission_application_requirements" (
    "id"             TEXT NOT NULL,
    "tenant_id"      TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "label"          TEXT NOT NULL,
    "type"           TEXT NOT NULL,
    "collect_stage"  TEXT NOT NULL,
    "required"       BOOLEAN NOT NULL DEFAULT true,
    "status"         TEXT NOT NULL DEFAULT 'pending',
    "value"          JSONB,
    "document_id"    TEXT,
    "provided_at"    TIMESTAMP(3),
    "provided_by"    TEXT,
    "waived_reason"  TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admission_application_requirements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "admission_application_requirements_application_id_requirement_id_key" ON "admissions"."admission_application_requirements"("application_id", "requirement_id");
CREATE INDEX IF NOT EXISTS "admission_application_requirements_tenant_id_idx" ON "admissions"."admission_application_requirements"("tenant_id");
CREATE INDEX IF NOT EXISTS "admission_application_requirements_application_id_idx" ON "admissions"."admission_application_requirements"("application_id");
CREATE INDEX IF NOT EXISTS "admission_application_requirements_tenant_id_application_id_idx" ON "admissions"."admission_application_requirements"("tenant_id", "application_id");
CREATE INDEX IF NOT EXISTS "admission_application_requirements_requirement_id_idx" ON "admissions"."admission_application_requirements"("requirement_id");

-- ---- Foreign keys (idempotent) ------------------------------------------
DO $fks$
BEGIN
  -- admission_applications structured cascade
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_applications_stage_id_fkey') THEN
    ALTER TABLE "admissions"."admission_applications" ADD CONSTRAINT "admission_applications_stage_id_fkey"
      FOREIGN KEY ("stage_id") REFERENCES "academic-structure"."stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_applications_year_level_id_fkey') THEN
    ALTER TABLE "admissions"."admission_applications" ADD CONSTRAINT "admission_applications_year_level_id_fkey"
      FOREIGN KEY ("year_level_id") REFERENCES "academic-structure"."year_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_applications_stream_id_fkey') THEN
    ALTER TABLE "admissions"."admission_applications" ADD CONSTRAINT "admission_applications_stream_id_fkey"
      FOREIGN KEY ("stream_id") REFERENCES "academic-structure"."streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- admission_guardians
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_guardians_tenant_id_fkey') THEN
    ALTER TABLE "admissions"."admission_guardians" ADD CONSTRAINT "admission_guardians_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_guardians_application_id_fkey') THEN
    ALTER TABLE "admissions"."admission_guardians" ADD CONSTRAINT "admission_guardians_application_id_fkey"
      FOREIGN KEY ("application_id") REFERENCES "admissions"."admission_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- admission_requirements
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_requirements_tenant_id_fkey') THEN
    ALTER TABLE "admissions"."admission_requirements" ADD CONSTRAINT "admission_requirements_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- admission_application_requirements
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_application_requirements_tenant_id_fkey') THEN
    ALTER TABLE "admissions"."admission_application_requirements" ADD CONSTRAINT "admission_application_requirements_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_application_requirements_application_id_fkey') THEN
    ALTER TABLE "admissions"."admission_application_requirements" ADD CONSTRAINT "admission_application_requirements_application_id_fkey"
      FOREIGN KEY ("application_id") REFERENCES "admissions"."admission_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_application_requirements_requirement_id_fkey') THEN
    ALTER TABLE "admissions"."admission_application_requirements" ADD CONSTRAINT "admission_application_requirements_requirement_id_fkey"
      FOREIGN KEY ("requirement_id") REFERENCES "admissions"."admission_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admission_application_requirements_document_id_fkey') THEN
    ALTER TABLE "admissions"."admission_application_requirements" ADD CONSTRAINT "admission_application_requirements_document_id_fkey"
      FOREIGN KEY ("document_id") REFERENCES "documents"."documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$fks$;

-- ---- RLS + grants on the 3 NEW tables (own + platform) ------------------
DO $rls$
DECLARE
  tables text[][] := ARRAY[
    ARRAY['admissions','admission_guardians'],
    ARRAY['admissions','admission_requirements'],
    ARRAY['admissions','admission_application_requirements']
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
