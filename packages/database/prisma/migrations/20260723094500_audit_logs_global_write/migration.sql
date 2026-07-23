-- ============================================================
-- Allow platform-level (tenant_id IS NULL) audit rows to be written
-- without a tenant context
-- ============================================================
-- `audit_logs.tenant_id` is NULLABLE — "Null for platform-level events", per the
-- model — but the table was registered in the STRICT branch of the policy loop
-- in 20260622123000_rls_policies_and_runtime_role, alongside tables whose tenant
-- column is NOT NULL. Its WITH CHECK therefore demands
-- `tenant_id = app.current_tenant_id`, which a global row can never satisfy:
-- NULL = anything is NULL, not true.
--
-- Consequence on managed Postgres, where the owner does not bypass FORCE RLS:
-- every platform-level audit write is rejected. Silently — all these call sites
-- wrap the write in try/catch so that auditing can never take down the request,
-- which means the failure surfaced as nothing at all. Authentication events
-- (login, MFA verified, password reset) are exactly the events written with a
-- NULL tenant, so the deployed audit trail for them was empty.
--
-- The fix is asymmetric, and only in the safe direction:
--
--   WITH CHECK  gains `OR tenant_id IS NULL` — writing a global audit row
--               requires no context. Appending a row that is attributed to no
--               tenant discloses nothing to anyone.
--   USING       is UNCHANGED — global rows remain readable only under the
--               audited platform bypass. Read access is where cross-tenant
--               disclosure would actually happen, so it stays shut.
--
-- Note this does NOT make tenant-scoped audit writes work without a tenant
-- context, and deliberately so: those rows carry a real tenant_id and must be
-- written inside that tenant's scope. Their call sites move onto
-- TenantDbService.runScoped in Stage 3 (docs/rls-privileged-client-plan.md).
--
-- Postgres detail that shapes the writer: INSERT ... RETURNING is additionally
-- checked against USING, and Prisma's `create()` always emits RETURNING. A
-- global insert would therefore still fail on the way out, even with the
-- WITH CHECK above. Global audit rows are written by `writeAuditLog`
-- (apps/api/src/common/audit/audit-writer.ts), which issues a plain INSERT with
-- no RETURNING for that reason.
--
-- Idempotent: drops and recreates the policy by name.
-- ============================================================

DROP POLICY IF EXISTS tenant_isolation ON "audit-logging"."audit_logs";

CREATE POLICY tenant_isolation ON "audit-logging"."audit_logs"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    current_setting('app.is_platform', true) = 'on'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'on'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR tenant_id IS NULL
  );
