-- Lets a user pin a preferred sign-in profile instead of login always
-- falling back to whichever profile the DB happens to return first.
ALTER TABLE "user-management"."users"
  ADD COLUMN "default_user_tenant_id" TEXT;

CREATE INDEX "users_default_user_tenant_id_idx"
  ON "user-management"."users"("default_user_tenant_id");

-- Cross-schema FK (user-management -> profile), same pattern already used
-- by user_tenants.user_id -> users.id in the other direction.
ALTER TABLE "user-management"."users"
  ADD CONSTRAINT "users_default_user_tenant_id_fkey"
  FOREIGN KEY ("default_user_tenant_id") REFERENCES "profile"."user_tenants"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
