-- ============================================================
-- Role templates + role scope (WB1-5)
-- ============================================================
-- Adds the permission-management UX the engine has been missing:
--   • role_templates — named presets (clearance + inherited pools + category)
--     a custom role is built from, instead of 305 checkboxes.
--   • roles.scope / roles.template_key — the scope descriptor the editor
--     captures (EXPLAINED by the effective-access evaluator; ENFORCED in WB1-6)
--     and the template a role was built from (provenance for the preview).
--
-- role_templates follows the SAME nullable-tenant shared-read RLS as `roles` and
-- `permission_pools`: a system template (tenant_id NULL) is readable by every
-- tenant; a tenant's own template is private to it; writes are own-tenant only.
-- ============================================================

-- ---- roles: scope + template provenance (additive) ----------------------
ALTER TABLE "roles-permissions"."roles"
  ADD COLUMN IF NOT EXISTS "scope"        JSONB,
  ADD COLUMN IF NOT EXISTS "template_key" TEXT;

-- ---- role_templates (new table) -----------------------------------------
CREATE TABLE IF NOT EXISTS "roles-permissions"."role_templates" (
    "id"                    TEXT NOT NULL,
    "tenant_id"             TEXT,
    "key"                   TEXT NOT NULL,
    "name"                  TEXT NOT NULL,
    "description"           TEXT,
    "category"              TEXT,
    "clearance_level"       INTEGER NOT NULL,
    "permission_pool_names" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sensitive"             BOOLEAN NOT NULL DEFAULT false,
    "is_system_template"    BOOLEAN NOT NULL DEFAULT true,
    "created_by"            TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_templates_pkey" PRIMARY KEY ("id")
);

-- Name unique per scope. NULLs are distinct, so multiple tenants can each hold a
-- template with the same key; system templates (tenant_id NULL) are unique among
-- themselves by key at the application layer (mirrors roles/permission_pools).
CREATE UNIQUE INDEX IF NOT EXISTS "role_templates_tenant_id_key_key"
  ON "roles-permissions"."role_templates"("tenant_id", "key");
CREATE INDEX IF NOT EXISTS "role_templates_tenant_id_idx"
  ON "roles-permissions"."role_templates"("tenant_id");
CREATE INDEX IF NOT EXISTS "role_templates_category_idx"
  ON "roles-permissions"."role_templates"("category");

-- Nullable-tenant shared-read RLS: SELECT own + shared(NULL) + platform; the
-- PERMISSIVE policy is named `tenant_isolation` so db:rls:check is satisfied.
ALTER TABLE "roles-permissions"."role_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles-permissions"."role_templates" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "roles-permissions"."role_templates"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    tenant_id IS NULL
    OR tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    -- A tenant can only WRITE its own rows (or the platform bypass); it can read
    -- shared system templates but never mutate them.
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

-- roles-permissions already grants app_runtime (20260622130000); re-grant on the
-- new table explicitly.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON "roles-permissions"."role_templates" TO app_runtime;
