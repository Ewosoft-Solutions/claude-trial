-- ============================================================
-- Backfill NULL user_tenant_roles.tenant_id — atomic retry
-- ============================================================
-- Supersedes 20260723200000, which did NOT work. That migration set the
-- audited platform GUC and ran the UPDATE as two separate statements:
--
--     SELECT set_config('app.is_platform', 'on', true);
--     UPDATE ...;
--
-- `set_config(..., true)` is TRANSACTION-local, and the migration engine ran
-- each statement in its own autocommit transaction — so the GUC was gone by
-- the time the UPDATE ran. Under FORCE RLS, the RLS-subject migration owner
-- then saw zero rows and updated nothing. The migration still recorded as
-- applied, so the Architect's tenant_id stayed NULL and the platform login
-- kept looping. Reproduced exactly against a local FORCE-RLS table via
-- SET ROLE to a non-superuser owner: two-statement form → 0 rows; the DO block
-- below → 1 row.
--
-- The fix is atomicity. A DO block executes as a single statement, hence in a
-- single transaction even under autocommit, so the transaction-local
-- `set_config` and the UPDATE share one transaction and the GUC holds for the
-- UPDATE. RAISE NOTICE reports the count so the CD migrate log shows whether it
-- actually did anything.
--
-- Idempotent: once every row equals its parent, the UPDATE matches nothing.
-- ============================================================

DO $backfill$
DECLARE
  updated integer;
BEGIN
  PERFORM set_config('app.is_platform', 'on', true);

  UPDATE "profile"."user_tenant_roles" AS utr
  SET tenant_id = ut.tenant_id
  FROM "profile"."user_tenants" AS ut
  WHERE utr.user_tenant_id = ut.id
    AND utr.tenant_id IS DISTINCT FROM ut.tenant_id;

  GET DIAGNOSTICS updated = ROW_COUNT;
  RAISE NOTICE 'backfill_user_tenant_role_tenant_id_v2: aligned % row(s)', updated;
END
$backfill$;
