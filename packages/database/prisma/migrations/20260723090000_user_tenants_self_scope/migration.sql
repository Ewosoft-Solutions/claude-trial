-- ============================================================
-- Self-scope read access on profile.user_tenants (pre-auth identity lookup)
-- ============================================================
-- The sign-in flow has a genuine need that neither existing RLS scope covers:
-- between "password verified" and "school selected" there IS no tenant yet, so
-- `app.current_tenant_id` cannot be set — the whole point of the query is to
-- discover which tenants the user belongs to. Under ADR-004 that left exactly
-- two options at the call site, and both are wrong:
--
--   * run it on the owner connection and rely on the owner bypassing RLS —
--     which holds locally and in CI (superuser) but NOT on managed Postgres,
--     where the owner is a normal role and these tables are FORCE RLS. There
--     the query returns zero rows and every login fails with "not linked to an
--     active school or platform workspace".
--   * open the audited platform bypass (`app.is_platform`) on a path the caller
--     has not finished authenticating — cross-tenant visibility to solve a
--     single-user question.
--
-- So this adds a third, exactly-sized scope: a session that has proven WHICH
-- user it is (`app.current_user_id`) may read that user's OWN membership rows,
-- across tenants, and nothing else. Set it with `withUserScope` in
-- packages/database/src/rls/tenant-context.ts.
--
-- Deliberately asymmetric: the disjunct is added to USING only, never to
-- WITH CHECK. A user-scoped session can therefore READ its own memberships but
-- cannot create, move, or modify one — writes still require a tenant scope or
-- the audited platform bypass. Note that `user_tenants` is the one table this
-- applies to; the pre-auth path touches nothing else that is tenant-scoped.
--
-- Idempotent: drops and recreates the policy by name.
-- ============================================================

DROP POLICY IF EXISTS tenant_isolation ON "profile"."user_tenants";

CREATE POLICY tenant_isolation ON "profile"."user_tenants"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    current_setting('app.is_platform', true) = 'on'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR user_id = NULLIF(current_setting('app.current_user_id', true), '')
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'on'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
  );
