# Tenant Isolation & DB Performance — Plan & Table Classification

> Working plan for the tenant-isolation + performance checklist. Created
> 2026-06-20. The DB was unreachable from the implementation environment
> (Postgres.app auth dialog could not be shown), so items needing a live DB are
> marked **[pending DB]** — author now, apply/verify on a machine with DB access.

## Approach (decided)

Defense-in-depth: **Postgres Row-Level Security (RLS) is the enforced source of
truth**, with the `withTenant` Prisma extension kept as an ergonomic second
layer. RLS context is set with a **parameterized, transaction-local GUC**
(`set_config('app.current_tenant_id', $1, true)`) inside a per-request
transaction; the app connects with a **non-owner, non-BYPASSRLS role** so
policies actually bite. Shared DB + `tenant_id` column (no schema-per-tenant).

See `ARCHITECTURE_DECISIONS.md` for the plain-English rationale (to be added in
T10).

## Table classification (T1)

The schema uses Prisma multi-schema. 35 models fall into three buckets:

### A. Tenant-scoped — get a strict RLS policy `tenant_id = current GUC`

Already have a direct `tenant_id`:
`AcademicYear`, `Course`, `GradingSystem`, `AuditLog`, `Announcement`,
`Message`, `TenantJWTConfig`, `UserTenant`, `Student`, `StudentGuardian`.

Need `tenant_id` **denormalized in** (T2) — currently scoped only via a parent:
`Term`, `Class`, `ClassTeacher`, `Assessment`, `Grade`, `Enrollment`,
`MessageReadReceipt`, `UserTenantRole`, `UserTenantPermission`,
`SchoolSecurityPolicy`.

> Denormalization fits the existing pattern — `Class`/`Assessment` already carry
> a denormalized `academic_year_id`/`term_id` "for easier queries."

### B. Tenant-scoped with NULL = global — policy `tenant_id IS NULL OR tenant_id = current GUC`

These hold both system/platform rows (`tenant_id` NULL, visible to everyone) and
per-tenant custom rows:
`Role`, `PermissionPool`, `MakerCheckerRequest`.

> Writes must still be constrained: a tenant may only INSERT/UPDATE rows with its
> own `tenant_id` (or NULL only via the platform path). `WITH CHECK` =
> `tenant_id = current GUC` (NULL writes only through the platform bypass).

### C. Global / identity — NO naive tenant RLS

Identity spans tenants (a `User` can belong to many schools) or is a global
catalog:
`User`, `PasswordHistory`, `LoginAttempt`, `Session`, `MfaMethod`,
`MfaChallenge`, `MfaRecoveryCode`, `Permission` (catalog), `Tenant` (the tenant
registry itself).

> These are protected by ownership checks in the auth layer, not tenant RLS.
> Applying `tenant_id` RLS here would break multi-tenant login. Leave RLS off;
> revisit per-table with dedicated policies later if needed.

### D. Join tables — scope follows the parent

`RolePermission`, `PermissionPoolPermission`, `RolePermissionPool` link
roles/pools (bucket B) to the global `Permission` catalog. A row is tenant data
iff its parent role/pool is a custom (tenant) row. Options:
1. **Denormalize `tenant_id`** from the parent role/pool (consistent with T2,
   simplest policy + index), or
2. Policy via subquery against the parent (no column, slower).

Decision: **denormalize** for the custom-role join rows; system-role join rows
carry NULL and use the bucket-B policy. (Folded into T2.)

## Performance (T3)

Add composite indexes that **lead with `tenant_id`** for the hot access paths,
e.g.:
- `Student(tenant_id, enrollment_status)`, `Student(tenant_id, user_tenant_id)`
- `Enrollment(tenant_id, class_id)`, `Enrollment(tenant_id, student_id)`
- `Grade(tenant_id, assessment_id)`, `Assessment(tenant_id, class_id)`
- `Message(tenant_id, created_at)`, `Announcement(tenant_id, status)`

Single-column `@@index([tenantId])` already exists on most bucket-A tables; the
composites cover the common `WHERE tenant_id = ? AND <filter>` queries so a large
table only ever touches one tenant's slice. (`AuditLog(tenant_id, timestamp)`
already exists — good precedent.)

## Status snapshot

| # | Task | State |
|---|---|---|
| 1 | Classify tables | ✅ this doc |
| 2 | Denormalize tenant_id onto child/join tables | ✅ applied (migration 20260622123141) + backfilled + verified |
| 3 | Composite tenant-leading indexes | ✅ applied (55 tenant indexes); schema validates |
| 4 | Parameterized, tx-local RLS setter | ✅ code |
| 5 | Route queries through per-request RLS tx | ◑ primitives done; **runtime cutover is the follow-up** (ADR-004 runbook) |
| 6 | Harden withTenant extension | ✅ code + 11 unit tests |
| 7 | RLS policies + restricted role migration | ✅ applied (23 tables ENABLE/FORCE + policy; app_runtime role) |
| 8 | Audited platform cross-tenant bypass | ✅ app.is_platform GUC branch in policies; proven |
| 9 | Isolation test suite | ✅ rls-isolation-check.sql — 7 checks pass as app_runtime |
| 10 | ADR + apply & verify on live DB | ✅ ADR-004; migrations applied + proven (cutover pending, documented) |

## Making it a standard (so new tables adhere automatically)

The fix is not a one-off list — three mechanisms keep new models compliant:

1. **CI guard (the enforcement):** `pnpm --filter @workspace/database db:rls:check`
   runs `prisma/scripts/rls-coverage-check.sql`, which **fails (non-zero exit)** if
   any table with a `tenant_id`/`school_id` column lacks `ENABLE`/`FORCE` RLS + a
   `tenant_isolation` policy. Wire this into CI (after `migrate deploy`). Proven to
   fail on an unguarded table and pass when all are covered.
2. **Auto-grant:** `ALTER DEFAULT PRIVILEGES` means any future table created by
   the migration owner is automatically granted CRUD to `app_runtime` — no manual
   GRANT needed.
3. **Auto-apply helper:** `enforce_tenant_rls()` (idempotent) applies the strict
   policy to any tenant-scoped table missing one, without clobbering the existing
   nullable-catalog policies. Run via `db:rls:enforce` or call it from a migration.

### Checklist — adding a tenant-scoped table/model

- Add `tenantId String? @map("tenant_id")` (+ `@@index([tenantId])` and a
  `@@index([tenantId, <hotFilter>])` composite) to the Prisma model.
- In the migration, either call `SELECT enforce_tenant_rls();` (strict policy,
  safe default) **or** hand-write the policy if the table needs the nullable
  "global rows" semantics (like `roles`/`permission_pools`).
- Backfill `tenant_id` for existing rows from the parent.
- Add the model to `STRICT_TENANT_MODELS` in
  `apps/api/src/common/database/tenant-prisma.extension.ts` (app-layer scoping).
- Ensure `db:rls:check` passes. CI will block the merge if it doesn't.

## Outcome

Tenant isolation is now **enforced at the database** (RLS on 23 tables) and
**proven** via the isolation script run as the restricted `app_runtime` role:
cross-tenant read/insert/update/delete are all blocked, and the platform bypass
works. The one remaining piece is the **runtime cutover** (connect the app as
`app_runtime` + run every tenant query through `runInTransaction`), tracked in
ADR-004 — until then the app connects as the superuser `postgres` (RLS-bypassing)
and relies on app-level scoping, so there is no regression while the cutover is
sequenced with e2e tests.
