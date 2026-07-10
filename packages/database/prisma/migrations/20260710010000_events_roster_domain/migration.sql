-- ============================================================
-- Events roster domain — Step 8 sub-surface follow-up
-- ============================================================
-- Adds event_attendees to the existing "events" schema.
-- Tenant-scoped (tenant_id NOT NULL). RLS applied explicitly so
-- db:rls:check passes from day one.
-- ============================================================

CREATE TABLE "events"."event_attendees" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "event_id"      TEXT NOT NULL,
  "attendee_name" TEXT NOT NULL,
  "attendee_type" TEXT NOT NULL,
  "email"         TEXT,
  "status"        TEXT NOT NULL DEFAULT 'registered',
  "created_by"    TEXT,
  "updated_by"    TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "event_attendees_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_attendees_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "event_attendees_event_id_fkey"
    FOREIGN KEY ("event_id")
    REFERENCES "events"."school_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "event_attendees_tenant_id_idx"
  ON "events"."event_attendees"("tenant_id");
CREATE INDEX "event_attendees_tenant_id_event_id_idx"
  ON "events"."event_attendees"("tenant_id", "event_id");
CREATE INDEX "event_attendees_event_id_status_idx"
  ON "events"."event_attendees"("event_id", "status");

-- ---- RLS: event_attendees -----------------------------------------------

ALTER TABLE "events"."event_attendees"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events"."event_attendees"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "events"."event_attendees"
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

-- ---- Grant new table to app_runtime -------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE
  ON "events"."event_attendees" TO app_runtime;
