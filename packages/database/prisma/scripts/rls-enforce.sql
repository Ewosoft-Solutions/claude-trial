-- Apply the strict tenant_isolation policy to any tenant-scoped table that is
-- missing one (idempotent; never clobbers existing policies). See the
-- enforce_tenant_rls() definition in migration 20260622130000_tenant_rls_standard.
SELECT public.enforce_tenant_rls();
