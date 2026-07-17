-- The catalog is readable by tenant contexts but mutable only while the
-- request has been elevated into platform context.
ALTER TABLE "security-policy"."sensitive_operation_policies"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "security-policy"."sensitive_operation_policies"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "sensitive_operation_policy_read"
  ON "security-policy"."sensitive_operation_policies"
  AS PERMISSIVE
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "sensitive_operation_policy_write"
  ON "security-policy"."sensitive_operation_policies"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (current_setting('app.is_platform', true) = 'on')
  WITH CHECK (current_setting('app.is_platform', true) = 'on');

-- Tenant requests are visible and writable only inside their own tenant
-- context. Platform review is allowed through the platform GUC.
ALTER TABLE "security-policy"."sensitive_operation_policy_change_requests"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "security-policy"."sensitive_operation_policy_change_requests"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "security-policy"."sensitive_operation_policy_change_requests"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

GRANT USAGE ON SCHEMA "security-policy" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON "security-policy"."sensitive_operation_policies",
     "security-policy"."sensitive_operation_policy_change_requests"
  TO app_runtime;
