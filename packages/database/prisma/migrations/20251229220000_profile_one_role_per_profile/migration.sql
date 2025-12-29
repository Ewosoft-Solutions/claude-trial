-- Drop unique constraint that limited one profile per user+tenant
ALTER TABLE "profile"."user_tenants"
  DROP CONSTRAINT IF EXISTS "user_tenants_user_id_tenant_id_key";

-- Ensure supporting index for lookups by user+tenant
CREATE INDEX IF NOT EXISTS "user_tenants_user_id_tenant_id_idx"
  ON "profile"."user_tenants" ("user_id", "tenant_id");

-- Drop multi-role-per-profile unique and enforce one role per profile
ALTER TABLE "profile"."user_tenant_roles"
  DROP CONSTRAINT IF EXISTS "user_tenant_roles_user_tenant_id_role_id_key";

ALTER TABLE "profile"."user_tenant_roles"
  ADD CONSTRAINT "user_tenant_roles_user_tenant_id_key" UNIQUE ("user_tenant_id");

