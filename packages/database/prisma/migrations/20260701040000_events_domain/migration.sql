-- ============================================================
-- Events domain — Step 8 of backend remediation
-- ============================================================
-- Creates school_events in the "events" schema.
-- Tenant-scoped (tenant_id NOT NULL). RLS applied explicitly so
-- db:rls:check passes from day one.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "events";

-- ---- school_events -------------------------------------------------

CREATE TABLE "events"."school_events" (
  "id"               TEXT NOT NULL,
  "tenant_id"        TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "description"      TEXT,
  "event_type"       TEXT,
  "location"         TEXT,
  "start_date"       TIMESTAMP(3) NOT NULL,
  "end_date"         TIMESTAMP(3),
  "status"           TEXT NOT NULL DEFAULT 'scheduled',
  "capacity"         INTEGER,
  "registered_count" INTEGER NOT NULL DEFAULT 0,
  "created_by"       TEXT,
  "updated_by"       TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "school_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "school_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "school_events_tenant_id_idx"
  ON "events"."school_events"("tenant_id");
CREATE INDEX "school_events_tenant_id_status_idx"
  ON "events"."school_events"("tenant_id", "status");
CREATE INDEX "school_events_tenant_id_start_date_idx"
  ON "events"."school_events"("tenant_id", "start_date");

-- ---- RLS: school_events -------------------------------------------------

ALTER TABLE "events"."school_events"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events"."school_events"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "events"."school_events"
  AS PERMISSIVE
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

-- ---- Grant events schema to app_runtime ---------------------------------

GRANT USAGE ON SCHEMA "events" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA "events" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "events"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
