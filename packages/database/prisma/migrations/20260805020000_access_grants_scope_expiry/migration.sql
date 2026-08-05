-- ============================================================
-- Time-boxed + scoped access grants + shared-catalog RLS tightening (WB1-6)
-- ============================================================
-- Three additive concerns, all idempotent:
--
--   1. profile.user_tenant_roles gains scope / expires_at / grant_reason — the
--      GRANT becomes time-boxed + scoped. The live per-request authz path
--      (PermissionService.getUserPermissionContext) stops honouring an expired
--      grant, so a 5-day substitute role auto-expires with no token
--      invalidation. `scope` is the descriptor AccessScopeService ENFORCES.
--
--   2. tenant.campuses (new) — the concrete target an access grant is scoped to
--      (ADR-11 Option A: campuses are organizations WITHIN a tenant). Standard
--      own + platform tenant isolation.
--
--   3. Shared-catalog RLS tightening (WB1-5 review follow-up) — roles /
--      permission_pools / role_templates carry a nullable tenant_id (NULL =
--      shared system content). Their single `tenant_isolation` FOR ALL policy
--      exposes those shared rows to UPDATE/DELETE by any tenant (USING matches
--      tenant_id IS NULL). Split into the two-policy shared-read shape (same as
--      F6 curriculum reference tables):
--        * tenant_isolation FOR SELECT — shared read (own + NULL + platform);
--          the PERMISSIVE tenant_isolation policy db:rls:check requires.
--        * tenant_write      FOR ALL   — own + platform only (no NULL); governs
--          INSERT/UPDATE/DELETE so a tenant can never mutate/delete a shared row.
-- ============================================================

-- ---- 1. user_tenant_roles: time-boxed + scoped grant (additive) ----------
ALTER TABLE "profile"."user_tenant_roles"
  ADD COLUMN IF NOT EXISTS "scope"        JSONB,
  ADD COLUMN IF NOT EXISTS "expires_at"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "grant_reason" TEXT;

CREATE INDEX IF NOT EXISTS "user_tenant_roles_expires_at_idx"
  ON "profile"."user_tenant_roles"("expires_at");

-- ---- 2. tenant.campuses (new table) -------------------------------------
CREATE TABLE IF NOT EXISTS "tenant"."campuses" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'active',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "address"    TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "campuses_tenant_id_code_key"
  ON "tenant"."campuses"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "campuses_tenant_id_idx"
  ON "tenant"."campuses"("tenant_id");
CREATE INDEX IF NOT EXISTS "campuses_status_idx"
  ON "tenant"."campuses"("status");

-- FK to the owning tenant (cascade with the tenant).
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campuses_tenant_id_fkey'
  ) THEN
    ALTER TABLE "tenant"."campuses"
      ADD CONSTRAINT "campuses_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$fk$;

-- Standard own + platform tenant isolation.
ALTER TABLE "tenant"."campuses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant"."campuses" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "tenant"."campuses";
CREATE POLICY "tenant_isolation" ON "tenant"."campuses"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

-- `tenant` schema already grants app_runtime broadly; re-grant explicitly on
-- the new table so a fresh DB is covered regardless of default-privilege timing.
GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant"."campuses" TO app_runtime;

-- ---- 3. Shared-catalog RLS tightening: two-policy shared-read -------------
-- roles / permission_pools / role_templates: NULL tenant_id = shared system
-- content. Replace the FOR ALL policy (which exposed shared rows to
-- UPDATE/DELETE) with SELECT-shared-read + own-write.
DO $catalog$
DECLARE
  t text;
  shared_read_tables text[] := ARRAY['roles','permission_pools','role_templates'];
BEGIN
  FOREACH t IN ARRAY shared_read_tables LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'roles-permissions', t);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', 'roles-permissions', t);
    -- Drop whatever single policy currently governs the table (its name is
    -- tenant_isolation on all three), then recreate as the two-policy shape.
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I.%I', 'roles-permissions', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_write" ON %I.%I', 'roles-permissions', t);
    EXECUTE format($p$
      CREATE POLICY "tenant_isolation" ON %I.%I
        AS PERMISSIVE FOR SELECT TO PUBLIC
        USING (
          tenant_id IS NULL
          OR tenant_id = current_setting('app.current_tenant_id', true)
          OR current_setting('app.is_platform', true) = 'on'
        )
    $p$, 'roles-permissions', t);
    EXECUTE format($p$
      CREATE POLICY "tenant_write" ON %I.%I
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          tenant_id = current_setting('app.current_tenant_id', true)
          OR current_setting('app.is_platform', true) = 'on'
        )
        WITH CHECK (
          tenant_id = current_setting('app.current_tenant_id', true)
          OR current_setting('app.is_platform', true) = 'on'
        )
    $p$, 'roles-permissions', t);
  END LOOP;
END
$catalog$;
