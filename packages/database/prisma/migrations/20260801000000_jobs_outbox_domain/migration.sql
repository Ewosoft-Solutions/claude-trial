-- ============================================================
-- Jobs & Outbox (F3) — durable background work — ADR-06
-- ============================================================
-- Adds the "jobs" schema with two tables:
--   jobs.jobs           — durable, retryable, exactly-once background jobs
--   jobs.outbox_events  — transactional-outbox side-effect intents
-- Both are tenant-scoped with platform-level rows (tenant_id nullable, like
-- audit_logs). RLS is applied explicitly so db:rls:check passes from day one;
-- the worker manages the global queue through the audited `app.is_platform`
-- branch and drops to per-job tenant context for handler work.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "jobs";

-- ---- jobs.jobs ------------------------------------------------------

CREATE TABLE "jobs"."jobs" (
  "id"                   TEXT NOT NULL,
  "tenant_id"            TEXT,
  "type"                 TEXT NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'queued',
  "idempotency_key"      TEXT,
  "payload"              JSONB,
  "progress"             INTEGER NOT NULL DEFAULT 0,
  "row_counts"           JSONB,
  "attempts"             INTEGER NOT NULL DEFAULT 0,
  "max_attempts"         INTEGER NOT NULL DEFAULT 5,
  "actor_id"             TEXT,
  "result_artifact_id"   TEXT,
  "error"                TEXT,
  "run_after"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduled_at"         TIMESTAMP(3),
  "locked_at"            TIMESTAMP(3),
  "locked_by"            TEXT,
  "started_at"           TIMESTAMP(3),
  "finished_at"          TIMESTAMP(3),
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "jobs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Idempotency: a re-enqueue with the same (tenant, key) is a no-op. NULL keys
-- are distinct in Postgres, so unkeyed jobs never collide.
CREATE UNIQUE INDEX "jobs_tenant_id_idempotency_key_key"
  ON "jobs"."jobs"("tenant_id", "idempotency_key");
CREATE INDEX "jobs_tenant_id_idx"
  ON "jobs"."jobs"("tenant_id");
-- Claim query: WHERE status='queued' AND run_after <= now() ORDER BY run_after.
CREATE INDEX "jobs_status_run_after_idx"
  ON "jobs"."jobs"("status", "run_after");

-- ---- jobs.outbox_events --------------------------------------------

CREATE TABLE "jobs"."outbox_events" (
  "id"           TEXT NOT NULL,
  "tenant_id"    TEXT,
  "aggregate"    TEXT NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "type"         TEXT NOT NULL,
  "payload"      JSONB,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3),

  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "outbox_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "outbox_events_tenant_id_idx"
  ON "jobs"."outbox_events"("tenant_id");
-- Relay scan: unpublished events first (partial index keeps it small).
CREATE INDEX "outbox_events_published_at_idx"
  ON "jobs"."outbox_events"("published_at");

-- ---- RLS: jobs.jobs -------------------------------------------------

ALTER TABLE "jobs"."jobs"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jobs"."jobs"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "jobs"."jobs"
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

-- ---- RLS: jobs.outbox_events ---------------------------------------

ALTER TABLE "jobs"."outbox_events"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jobs"."outbox_events"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "jobs"."outbox_events"
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

-- ---- Grant jobs schema to app_runtime ------------------------------

GRANT USAGE ON SCHEMA "jobs" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA "jobs" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "jobs"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
