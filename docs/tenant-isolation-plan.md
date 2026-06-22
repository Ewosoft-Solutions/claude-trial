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
| 2 | Denormalize tenant_id onto child/join tables | schema authorable; migration **[pending DB]** |
| 3 | Composite tenant-leading indexes | schema authorable; apply **[pending DB]** |
| 4 | Parameterized, tx-local RLS setter | ✅ code (no DB) |
| 5 | Route queries through per-request RLS tx + global interceptor | code authorable; behavior **[pending DB]** |
| 6 | Harden withTenant extension | ✅ code + unit test (no DB) |
| 7 | RLS policies + restricted role migration | author SQL; apply/verify **[pending DB]** |
| 8 | Audited platform cross-tenant bypass | code authorable; verify **[pending DB]** |
| 9 | Isolation test suite | author; execute **[pending DB]** |
| 10 | ADR + apply & verify on live DB | **[pending DB]** |
