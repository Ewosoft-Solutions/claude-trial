# Correcting the privileged-client assumption under ADR-004

Status: Stages 1–2 landed 2026-07-23. Stages 3–4 open.

## The contradiction

[`tenant-db.service.ts`](../apps/api/src/common/database/tenant-db.service.ts) states
the design premise directly: _"Auth / guards / platform code keep using the
privileged `DatabaseService` client — only tenant-data services should use
`TenantDbService.client`."_

"Privileged" there means RLS-bypassing. That holds in local dev and CI, where the
database owner is a superuser. It does **not** hold on managed Postgres. Render's
owner is an ordinary role, and every app table is `FORCE ROW LEVEL SECURITY`,
which applies to the table owner too. So on the demo environment the privileged
client is not privileged at all: it is a normal RLS-subject connection that
happens to have no tenant context set, and therefore sees nothing.

ADR-004 cannot be satisfied by making the owner bypass RLS — granting `BYPASSRLS`
requires superuser, which no managed provider hands out. The correction is to
stop relying on a bypass and give each privileged-client path an explicit,
exactly-sized RLS scope.

## Evidence

Against the demo database, as the owner:

```
-- no GUC set
select count(*) from profile.user_tenants;   ->  0
-- options=-c app.is_platform=on
select count(*) from profile.user_tenants;   -> 28
```

The rows exist. RLS hides them. The user-visible symptom was every login failing
with "This account is not linked to an active school or platform workspace",
which [`apps/web/app/api/auth/login/route.ts`](../apps/web/app/api/auth/login/route.ts)
emits when `/auth/login` returns an empty `schools` array.

## Inventory

31 files either take a `prisma` parameter or use `dbService.client` **and** touch
a table with `tenant_id`/`school_id` (i.e. an RLS-protected table). They fall
into four classes, and the class determines the fix — not the file.

| Class                      | Tables                                                                                         | Files | Correct scope                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------- |
| 1. Pre-auth identity       | `user_tenants`                                                                                 | 8     | User scope (`app.current_user_id`)                                                            |
| 2. Audit writes            | `audit_logs`                                                                                   | 13    | Write-only carve-out for global rows                                                          |
| 3. Catalog reads           | `roles`, `permission_pools`, `maker_checker_requests`                                          | 6     | **Already correct** — nullable-tenant policy makes `tenant_id IS NULL` rows globally readable |
| 4. Genuinely tenant-scoped | `school_security_policies`, `tenant_jwt_configs`, `class_teachers`, `enrollments`, `grades`, … | 9     | `TenantDbService.runScoped`                                                                   |

Class 3 needs no work: the nullable branch of the policy in
`20260622123000_rls_policies_and_runtime_role` already admits global rows with no
GUC set, which is why role and permission-pool lookups keep working on demo.

## Stage 1 — pre-auth identity (done)

The sign-in flow asks a question no existing scope covers: _which tenants does
this user belong to?_ There is no tenant yet — discovering them is the point — so
`app.current_tenant_id` cannot be set, and using the platform bypass would grant
cross-tenant visibility to answer a single-user question on a not-yet-fully-
authenticated path.

Migration `20260723090000_user_tenants_self_scope` adds a third disjunct to the
`tenant_isolation` policy on `profile.user_tenants`: a session that has proven
which user it is may read that user's own membership rows across tenants.
Deliberately **`USING` only, never `WITH CHECK`** — such a session can read its
own memberships but cannot create, move, or modify one.

`withUserScope(prisma, userId, fn)` in
[`packages/database/src/rls/tenant-context.ts`](../packages/database/src/rls/tenant-context.ts)
opens the transaction that holds the GUC. Wired into all three
`getAvailableSchools` call sites in `AuthenticationService` (password login, MFA
completion, passkey login) and the `/auth/me` call site in `AuthController`.

Works with either connection: the owner today, `app_runtime` after Stage 4.

## Stage 2 — audit writes (done)

`audit_logs.tenant_id` is nullable ("Null for platform-level events") but the
table was registered in the **strict** branch of the policy loop, so its
`WITH CHECK` demanded `tenant_id = app.current_tenant_id` — which a global row
can never satisfy, since `NULL = anything` is NULL. And tenant-scoped audit rows
were no better off: written through the privileged client with no GUC set, they
failed the same check.

So on demo **every audit write was being rejected**, global and tenant-scoped
alike — silently, because each call site wrapped the write in `try/catch` and
logged to console rather than failing the request. The deployed audit trail was
empty and nothing surfaced it. A security finding in its own right, independent
of the login bug.

Two parts to the fix, because the policy alone is not enough:

**Migration `20260723094500_audit_logs_global_write`.** `WITH CHECK` gains
`OR tenant_id IS NULL`, so a global row needs no context to write. `USING` is
unchanged — global rows stay readable only under the audited platform bypass.
Appending a row attributed to no tenant discloses nothing; reading across tenants
would, so only the write side opens.

**`writeAuditLog` (`apps/api/src/common/audit/audit-writer.ts`).** Verified
against a local FORCE-RLS table: a plain `INSERT` of a global row succeeds, but
`INSERT ... RETURNING` fails, because RETURNING is checked against `USING` as
well. Prisma's `create()` always emits RETURNING, so the policy change alone
would not have been enough. The writer issues a raw INSERT with no RETURNING, and
sets `app.current_tenant_id` itself for tenant-scoped rows so they satisfy
WITH CHECK from any call site.

All 16 call sites across 12 files now go through it. It returns whether the row
landed rather than throwing, so auditing still cannot take down the request it is
recording — but the failure log names the action that went unrecorded, and
`PlatformAuditService` escalates a dropped cross-tenant record explicitly.

Left for later: four `auditLog.create` calls sit **commented out** in
`mfa-audit.service.ts`, `password-reset.service.ts` (×2) and
`security-policy.service.ts`. Those events are not being audited at all —
unrelated to RLS, but worth a decision on whether they should be.

## Stage 3 — genuinely tenant-scoped reads

The nine Class-4 files read real tenant data through the privileged client:
`SecurityPolicyService`, `SessionPolicyService`, `SensitiveOperationPolicyService`,
`JWTSecretService`, `PermissionService` (`class_teachers`, `enrollments`,
`grades`, `assessments`, `student_guardians` for context checks),
`ProfileSuspensionService`, `TenantValidationService`, `TenantQueriesService`,
`UserManagementService`.

These all run **after** school selection, so a tenant context exists — they
should move onto `TenantDbService.runScoped(tenantId, userId, …)`, which is what
ADR-004 intended for them. Mostly mechanical, but each needs its guard/interceptor
ordering checked: the scope must be open before the query, and guards currently
run outside it.

Note `PermissionService` is on the hot path for every authorization decision, so
it wants care and its own tests.

## Stage 4 — retire the bypass assumption

Once Stages 1–3 land, no path depends on the privileged client bypassing RLS.
At that point:

1. Repoint the auth/guard paths at `app_runtime` too, so `DATABASE_URL` is used
   only by migrations and seeds — the state ADR-004 describes.
2. Add a CI gate that fails if a privileged-client call site touches a
   tenant-scoped table, so this cannot silently regress. The inventory query used
   to build the table above is the basis for it.
3. Amend ADR-004 to say explicitly that no runtime connection bypasses RLS, and
   that FORCE RLS applies to the owner — the assumption that broke here was never
   written down, which is why it survived to production.

## Local-vs-deployed divergence

The root cause of the whole class: **local and CI cannot reproduce it**, because
their owner is a superuser and bypasses RLS. Every one of these bugs is invisible
until the code runs on managed Postgres.

Worth closing separately — run CI's integration suite as a non-superuser role
against a FORCE-RLS database, so the deployed topology is what gets tested.
