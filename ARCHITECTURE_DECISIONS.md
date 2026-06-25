# Architecture Decisions

## ADR-001

Decision:
PWA-first strategy.

Reason:
Reduce development cost and avoid App Store / Play Store dependencies during early growth.

Date:
2026-06-07

---

## ADR-002

Decision:
Multi-tenant shared database architecture.

Reason:
Lower infrastructure costs and simplify management.

Date:
2026-06-07

---

## ADR-003

Decision:
Reusable UI components live in packages/ui.

Reason:
Prevent duplication and support future expansion.

---

## ADR-004

Decision:
Enforce tenant isolation with Postgres Row-Level Security (RLS) as the source of
truth, backed by an application-level Prisma extension as a second layer. Shared
database + `tenant_id` column (no schema-per-tenant).

Reason (plain English):
Tenant isolation is the platform's #1 security requirement (no school may ever
see another's data). Relying on application code to remember a tenant filter on
every query is one mistake away from a leak — and an audit found exactly such
gaps. RLS makes the database itself refuse to return or modify another tenant's
rows, so isolation holds even if app code is wrong. It does not meaningfully slow
down as data grows — the policy adds the same `tenant_id` filter you'd write by
hand, and `tenant_id`-leading indexes keep each query scoped to one tenant's
slice. Schema-per-tenant was rejected as not scaling to "unlimited schools."

Technical summary:
- Every tenant-scoped table has `ENABLE`/`FORCE ROW LEVEL SECURITY` and a
  `tenant_isolation` policy: `USING`/`WITH CHECK` on
  `tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')`
  (text; ids are text). Nullable-tenant catalogs (roles, permission_pools,
  maker_checker_requests) also allow `tenant_id IS NULL` (global rows) on read.
- Cross-tenant access for platform roles (clearance 9-10) is an explicit,
  audited `current_setting('app.is_platform') = 'on'` branch in every policy.
- The context GUC is set transaction-locally via
  `set_config('app.current_tenant_id', $1, true)` (parameterized) inside a
  per-request transaction (`PrismaTransactionService.runInTransaction`).
- The app must connect as the non-superuser, non-BYPASSRLS `app_runtime` role
  for policies to bite; migrations/seed run as the owner (which bypasses RLS).
- Child tables (enrollments, grades, etc.) carry a denormalized `tenant_id`
  (backfilled from parents) so each has a direct, indexed policy.
- 23 tables are under RLS; isolation is proven by
  `packages/database/prisma/scripts/rls-isolation-check.sql` (cross-tenant
  read/insert/update/delete all blocked; platform bypass works).

Runtime cutover (remaining follow-up — see AI_HANDOFF):
The DB layer is enforced and proven, but the app still connects as `postgres`
(superuser → bypasses RLS), so runtime enforcement is not yet active. To activate:
(1) give `app_runtime` LOGIN + a password (secret); (2) point the runtime
`DATABASE_URL` at `app_runtime` while migrations keep using the owner via
`directUrl`; (3) ensure every tenant-scoped query runs through
`runInTransaction` (which sets the GUC) — adopt across services with e2e tests;
(4) set `app.is_platform='on'` only on authorized platform endpoints. Until then
isolation is enforced for any client using `app_runtime` (e.g. the test suite)
but not for the app, which still relies on app-level scoping.

Made durable (so new tables adhere automatically):
- CI guard `db:rls:check` (`rls-coverage-check.sql`) FAILS the build if any table
  with a `tenant_id`/`school_id` column lacks RLS + a `tenant_isolation` policy.
- `ALTER DEFAULT PRIVILEGES` auto-grants future tables to `app_runtime`.
- `enforce_tenant_rls()` (idempotent; `db:rls:enforce`) applies the strict policy
  to any tenant-scoped table missing one, without clobbering existing policies.
- Convention checklist in `docs/tenant-isolation-plan.md` + `packages/database/README.md`.

Date:
2026-06-20