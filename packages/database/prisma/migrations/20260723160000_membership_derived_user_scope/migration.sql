-- ============================================================
-- User-scope reads for membership-derived rows
-- ============================================================
-- Stage 1 (20260723090000) let a user-scoped session read its OWN rows in
-- `profile.user_tenants`. Two tables hang off those rows and need the same
-- treatment, for questions that are cross-tenant by nature but scoped to a
-- single user:
--
--   profile.user_tenant_roles
--     The role attached to each membership. `getAvailableSchools` reads
--     memberships under the user scope and includes the role; without a
--     matching grant the include comes back empty, so /auth/me reports every
--     profile as the 'Staff' fallback.
--
--   security-policy.school_security_policies
--     `assertCanRemovePasskey` and `getEffectiveBiometricEnrollmentPolicy` ask
--     "do ANY of this user's active schools require biometric sign-in?".
--     Passkeys are account credentials shared across a user's schools, so this
--     is deliberately account-wide: answering it under a single tenant's scope
--     would let a user switch to a permissive school and remove a passkey that
--     another school still requires. Fixing it by scoping to one tenant would
--     silently defeat the control.
--
-- Both grants say the same thing: a session that has proven WHICH user it is
-- may read rows derived from that user's own active memberships. Neither
-- widens tenant visibility — the `EXISTS` is anchored to `user_tenants` rows
-- the caller can already see, and that subquery is itself subject to
-- `user_tenants`' policy.
--
-- USING only, never WITH CHECK: read your own membership's role and your own
-- schools' policy posture; modify neither.
--
-- Idempotent: drops and recreates each policy by name.
-- ============================================================

-- ── profile.user_tenant_roles ───────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation ON "profile"."user_tenant_roles";

CREATE POLICY tenant_isolation ON "profile"."user_tenant_roles"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    current_setting('app.is_platform', true) = 'on'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR EXISTS (
      SELECT 1
      FROM "profile"."user_tenants" ut
      WHERE ut.id = "user_tenant_roles"."user_tenant_id"
        AND ut.user_id = NULLIF(current_setting('app.current_user_id', true), '')
    )
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'on'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

-- ── security-policy.school_security_policies ────────────────────────────────
-- Note this table keys on `school_id`, not `tenant_id` (they are the same id).
DROP POLICY IF EXISTS tenant_isolation ON "security-policy"."school_security_policies";

CREATE POLICY tenant_isolation ON "security-policy"."school_security_policies"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    current_setting('app.is_platform', true) = 'on'
    OR school_id = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR EXISTS (
      SELECT 1
      FROM "profile"."user_tenants" ut
      WHERE ut.tenant_id = "school_security_policies"."school_id"
        AND ut.user_id = NULLIF(current_setting('app.current_user_id', true), '')
        AND ut.status = 'active'
        AND ut.suspended = false
    )
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'on'
    OR school_id = NULLIF(current_setting('app.current_tenant_id', true), '')
  );
