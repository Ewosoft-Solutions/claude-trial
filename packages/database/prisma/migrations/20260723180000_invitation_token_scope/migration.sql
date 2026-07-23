-- ============================================================
-- Invitation-token scope for accepting an invitation
-- ============================================================
-- Accepting an invitation is the one flow that must find a `user_tenants` row
-- when NOTHING about the caller is known yet: the request is unauthenticated
-- (that is the point — the account does not have a password until this
-- succeeds), and the tenant cannot be supplied because discovering it from the
-- token is the whole operation.
--
-- Neither existing scope fits:
--   * a tenant scope needs the answer before it can be asked;
--   * the user scope needs an authenticated user, and there is none;
--   * the platform bypass would grant unrestricted cross-tenant read on an
--     UNAUTHENTICATED endpoint — wildly disproportionate to reading one row.
--
-- So: possession of the invitation token authorises reading exactly the row
-- that token belongs to, and nothing else. The token is high-entropy, generated
-- by `UserInvitationService.generateInvitationToken`, single-use (cleared on
-- acceptance) and time-limited, which is precisely what makes it usable as the
-- proof here — the same reasoning as the single-use Architect setup token.
--
-- Set it with `withInvitationTokenScope` in
-- packages/database/src/rls/tenant-context.ts.
--
-- Scope of the grant, deliberately tight:
--   * USING only — a token holder may READ their invitation row. The write that
--     accepts it runs under the tenant scope discovered from that row, so this
--     grant cannot be used to modify anything.
--   * Equality against a single token, not a pattern — it can match at most the
--     one row that already carries that exact value.
--   * `NULLIF(..., '')` so an unset GUC is NULL and matches nothing. Note
--     `invitation_token` is nullable, and `NULL = NULL` is NULL in SQL, so rows
--     with no token can never match an empty setting either.
--
-- `user_tenants(invitation_token)` is already indexed (init migration), so the
-- added predicate does not change the lookup's plan.
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
    OR invitation_token = NULLIF(current_setting('app.invitation_token', true), '')
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'on'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
  );
