-- ============================================================
-- AI foundation — Step 1 of docs/ai-integration-plan.md
-- ============================================================
-- Creates chat_sessions and chat_messages in the "ai" schema
-- (chat persistence shared by the Analytics AI and the Academic
-- AI tutor). Tenant-scoped (tenant_id NOT NULL). RLS applied
-- explicitly so db:rls:check passes from day one.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "ai";

-- ---- chat_sessions -------------------------------------------------

CREATE TABLE "ai"."chat_sessions" (
  "id"             TEXT NOT NULL,
  "tenant_id"      TEXT NOT NULL,
  "user_tenant_id" TEXT NOT NULL,
  "type"           TEXT NOT NULL,
  "lesson_id"      TEXT,
  "title"          TEXT,
  "status"         TEXT NOT NULL DEFAULT 'active',
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_sessions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "chat_sessions_tenant_id_idx"
  ON "ai"."chat_sessions"("tenant_id");
CREATE INDEX "chat_sessions_tenant_id_user_tenant_id_idx"
  ON "ai"."chat_sessions"("tenant_id", "user_tenant_id");
CREATE INDEX "chat_sessions_tenant_id_type_status_idx"
  ON "ai"."chat_sessions"("tenant_id", "type", "status");

-- ---- chat_messages -------------------------------------------------

CREATE TABLE "ai"."chat_messages" (
  "id"         TEXT NOT NULL,
  "tenant_id"  TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "sender"     TEXT NOT NULL,
  "content"    TEXT NOT NULL,
  "metadata"   JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_messages_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_messages_session_id_fkey"
    FOREIGN KEY ("session_id")
    REFERENCES "ai"."chat_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "chat_messages_tenant_id_idx"
  ON "ai"."chat_messages"("tenant_id");
CREATE INDEX "chat_messages_session_id_created_at_idx"
  ON "ai"."chat_messages"("session_id", "created_at");

-- ---- RLS: chat_sessions --------------------------------------------

ALTER TABLE "ai"."chat_sessions"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai"."chat_sessions"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "ai"."chat_sessions"
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

-- ---- RLS: chat_messages --------------------------------------------

ALTER TABLE "ai"."chat_messages"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai"."chat_messages"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "ai"."chat_messages"
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

-- ---- Grant ai schema to app_runtime ---------------------------------

GRANT USAGE ON SCHEMA "ai" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA "ai" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "ai"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
