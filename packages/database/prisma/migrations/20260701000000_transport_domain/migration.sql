-- ============================================================
-- Transport domain — Step 8 of backend remediation
-- ============================================================
-- Creates transport_assignments in the "transportation" schema.
-- Tenant-scoped (tenant_id NOT NULL). RLS applied explicitly so
-- db:rls:check passes from day one.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "transportation";

-- ---- transport_assignments ---------------------------------------------

CREATE TABLE "transportation"."transport_assignments" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "student_id"    TEXT NOT NULL,
  "route_name"    TEXT,
  "stop"          TEXT,
  "pickup_time"   TEXT,
  "vehicle_label" TEXT,
  "status"        TEXT NOT NULL DEFAULT 'unassigned',
  "created_by"    TEXT,
  "updated_by"    TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "transport_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_assignments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transport_assignments_student_id_fkey"
    FOREIGN KEY ("student_id")
    REFERENCES "student-management"."students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "transport_assignments_student_id_key"
  ON "transportation"."transport_assignments"("student_id");
CREATE INDEX "transport_assignments_tenant_id_idx"
  ON "transportation"."transport_assignments"("tenant_id");
CREATE INDEX "transport_assignments_tenant_id_status_idx"
  ON "transportation"."transport_assignments"("tenant_id", "status");
CREATE INDEX "transport_assignments_tenant_id_route_name_idx"
  ON "transportation"."transport_assignments"("tenant_id", "route_name");

-- ---- RLS: transport_assignments ----------------------------------------

ALTER TABLE "transportation"."transport_assignments"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transportation"."transport_assignments"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "transportation"."transport_assignments"
  AS RESTRICTIVE
  FOR ALL
  TO PUBLIC
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

-- ---- Grant transportation schema to app_runtime -------------------------

GRANT USAGE ON SCHEMA "transportation" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA "transportation" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "transportation"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
