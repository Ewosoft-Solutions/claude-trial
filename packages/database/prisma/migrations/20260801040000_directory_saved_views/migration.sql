-- ============================================================
-- F7 · Governed directory pattern — SavedView
-- ============================================================
-- Tenant-owned, per-profile persisted "directory" views: a named, replayable
-- snapshot of a governed list's URL state (search + filters + sort + page size).
-- Stores NO record data, only the view definition. Still tenant-scoped with a
-- PERMISSIVE tenant_isolation policy (db:rls:check gates CI) + app_runtime
-- grants; the tenant_id FK cascades on tenant delete (mirrors the F3 jobs
-- migration — infra tables carry a DB FK, not a Prisma relation).
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "directory";

CREATE TABLE "directory"."saved_views" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "owner_user_tenant_id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "saved_views_tenant_id_idx" ON "directory"."saved_views"("tenant_id");
CREATE INDEX "saved_views_tenant_id_resource_idx" ON "directory"."saved_views"("tenant_id", "resource");
CREATE INDEX "saved_views_tenant_owner_resource_idx" ON "directory"."saved_views"("tenant_id", "owner_user_tenant_id", "resource");

ALTER TABLE "directory"."saved_views"
  ADD CONSTRAINT "saved_views_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- RLS + grants -----------------------------------------------------
-- tenant_id is NON-NULL (a saved view always belongs to a tenant): a row is
-- visible only to its tenant, or under the audited platform bypass. Mirrors
-- the person / jobs policies exactly.

ALTER TABLE "directory"."saved_views" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "directory"."saved_views" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "directory"."saved_views"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

GRANT USAGE ON SCHEMA "directory" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "directory" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "directory"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
