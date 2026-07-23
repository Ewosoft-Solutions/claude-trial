-- ============================================================
-- Backfill NULL user_tenant_roles.tenant_id from the parent user_tenant
-- ============================================================
-- `user_tenant_roles.tenant_id` is a denormalized copy of the parent
-- `user_tenants.tenant_id`, carried so the row can have a direct, strict
-- RLS policy (`tenant_id = current`). Every application insert path sets it —
-- but the seed's platform-bootstrap `userTenantRole` create omitted it, so the
-- Architect's role link was stored with `tenant_id = NULL`.
--
-- Under FORCE RLS on managed Postgres, a NULL there is invisible to a
-- tenant-scoped read (NULL = <tenant> is not true, and the policy is strict,
-- not nullable). The Architect's role therefore never loaded,
-- getUserPermissionContext returned null, and /auth/me answered "Session
-- context unavailable" — looping the platform login. The seed is fixed going
-- forward; this repairs rows already written.
--
-- The denormalization must equal the parent by definition, so any NULL is
-- simply wrong data. Backfill it, and (belt and braces) realign any row whose
-- denormalized value has drifted from its parent.
--
-- Runs under the audited platform scope: migrations execute as the database
-- owner, which does NOT bypass RLS on a managed database (see
-- docs/rls-privileged-client-plan.md), so without this the UPDATE would see no
-- rows and change nothing. `set_config(..., true)` is transaction-local and
-- Prisma runs the migration in one transaction, so it resets at the end.
--
-- Idempotent: re-running changes nothing once every row matches its parent.
-- ============================================================

SELECT set_config('app.is_platform', 'on', true);

UPDATE "profile"."user_tenant_roles" AS utr
SET tenant_id = ut.tenant_id
FROM "profile"."user_tenants" AS ut
WHERE utr.user_tenant_id = ut.id
  AND utr.tenant_id IS DISTINCT FROM ut.tenant_id;
