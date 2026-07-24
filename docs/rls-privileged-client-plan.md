# Correcting the privileged-client assumption under ADR-004

Status: Stages 1–4 landed 2026-07-23. Every tenant-scoped read in `apps/api`
now carries a scope — the unscoped-read baseline is empty. The one documented
exception, `respondToProfileBreach`, was converted to the audited
`@PlatformScoped` cross-tenant scope on 2026-07-24 (see Stage 3, "One deliberate
exception"); there are no remaining unscoped reads.

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

**Done: every path a request must traverse.** Verifying Stages 1–2 on demo
walked the dominoes one at a time — picker, then select-school, then the auth
guard — so the remaining work was traced ahead of deployment rather than
discovered one failed login at a time.

Scoped, by the scope each question actually needs:

| Path                                                           | Scope                | Why that one                                                                                                                                                                                        |
| -------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getUserTenantProfile` (every authorization decision)          | tenant               | `tenantId` is now a **required** parameter, so an unscoped call is a compile error rather than a silent empty result                                                                                |
| `PermissionService` context checks (`own_classes`, `children`) | tenant               | Only the two DB-backed branches open a scope; `own`/`department` touch no tables and stay out of it, since this runs on every authorization decision                                                |
| `getTenantJWTSecretInternal`                                   | tenant               | Backs the auth guard — one fix covers guard validation, signing and refresh                                                                                                                         |
| `selectSchool`, `switchProfile`                                | claimed tenant       | Reveals only the claimed tenant's rows; the caller's ownership check still gates the outcome                                                                                                        |
| `validateUserAccess`, `validateUserRole`                       | tenant               | Both already receive the tenant                                                                                                                                                                     |
| `getAvailableProfiles`, `hasMultipleProfiles`                  | tenant               | Within one school by definition                                                                                                                                                                     |
| `validatePasswordAgainstAllSchools`                            | user                 | Cross-tenant by nature, about one user, on a path with no tenant selected                                                                                                                           |
| `SecurityPolicyService`, `SessionPolicyService`                | tenant (`school_id`) | Guard-path and `/auth/me`; one scope covers read, write and the `RETURNING` on create                                                                                                               |
| Biometric enrolment policy checks                              | **user**             | Deliberately account-wide — passkeys are account credentials, so answering under one tenant's scope would let a user switch to a permissive school and drop a passkey another school still requires |
| `AuditLogController` (4 handlers)                              | tenant               | Found by the new CI gate: `@PlatformScoped` opens the scope on the `app_runtime` connection, but the controller read via `dbService.client` — a _different_ connection with no GUC                  |

A second defect surfaced while scoping `PermissionService`:
`resolveClassIdFromContext` matched `enrollment` / `assessment` / `grade` on
**id alone, with no tenant filter**, on ids supplied by the caller. RLS was
silently carrying the correctness of an authorization check. Those lookups now
filter `tenantId` explicitly as well — belt and braces, because this decides
access.

Migration `20260723160000_membership_derived_user_scope` adds user-scope read
grants to `user_tenant_roles` (fixing the `/auth/me` "Staff" caption
degradation) and `school_security_policies` (making the account-wide biometric
check answerable). Both are `USING`-only and anchored by `EXISTS` against
`user_tenants` rows the caller can already see.

**The admin-tier tail is now done too.** All nine files scoped; the
unscoped-read baseline is empty. Several of them turned out to hide a worse
defect than "returns nothing":

| Site                                                     | Latent defect                                                                                                                                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RoleService.validateCustomRoleCreation`                 | `Math.max(...[])` is `-Infinity`, so an unresolvable permission pool **passed** the clearance gate. Now fails closed when any requested pool does not resolve.                                                                                               |
| `PermissionPoolService.validatePermissionPoolAssignment` | Same fail-open shape, same fix.                                                                                                                                                                                                                              |
| `RoleService.updateRoleClearance`                        | Invisible `rolePools` make `conflictingRoles` empty, lowering a role's clearance while over-clearance pools stay attached.                                                                                                                                   |
| `PermissionPoolService.updatePoolClearance`              | Mirror image: raising a pool's clearance above roles that still reference it.                                                                                                                                                                                |
| Role-name and one-profile-per-role uniqueness checks     | An unscoped read finds nothing and reports the name/role as free — a uniqueness check that silently permits duplicates.                                                                                                                                      |
| `TenantRegistrationService`                              | The requester's role id resolves to a name for `canRegisterTenant`. Unscoped it returns null and the UUID fallback is rejected — fail-closed, but it locks out exactly the clearance-8 school Owners the endpoint exists for. Now takes `requesterTenantId`. |

Several multi-step writes were folded into a single scope, which makes them
atomic as a side effect: role creation + pool assignment + approval request;
profile creation + role assignment; the role-swap in `updateUserProfile`, which
deletes before it creates and could previously leave a profile with no role.

Migration `20260723180000_invitation_token_scope` adds the last scope kind: the
invitation-acceptance flow is unauthenticated (the account has no password until
it succeeds) and pre-tenant (discovering the tenant from the token IS the
operation), so neither existing scope can be formed. Possession of the
high-entropy, single-use, time-limited token authorises reading exactly the row
that token belongs to — `USING` only, so the write that accepts it runs under
the tenant scope discovered from that row.

**One deliberate exception — resolved 2026-07-24.**
`BreachResponseService.respondToProfileBreach` was `@RequireClearanceLevel(9)` —
platform-admin-only and genuinely cross-tenant (the profile can be in any
tenant), so the correct scope is the audited platform bypass, not a single-tenant
scope. It was deferred because the conversion is an auth-model change (clearance
gate → permission gate) needing a seeded permission, not a mechanical scope wrap,
and getting it wrong risks locking out incident response.

The `@Post('profile')` handler now runs under `@PlatformScoped(['platform.breach'])`:
the `RlsPlatformInterceptor` enforces the permission + clearance and audits the
attempt, then opens `app.is_platform='on'` on the `TenantDbService` client, so the
handler reads/writes through `tenantDb.client` and the cross-tenant `user_tenants`
read works under FORCE RLS. A new `platform.breach` permission was seeded at
clearance **9** (not `platform.security`, which is level-10 / Architect-only), so
the endpoint keeps its current SuperAdmin + Architect reach and stays coherent
with the school-level breach path (also clearance 9). The audit write alone stays
on the privileged client (via `writeAuditLog`), so it lands outside the platform
transaction and survives a rollback — matching `PlatformAuditService`.

The school-level breach paths, which carry a `schoolId`, remain clearance-gated:
their tenant reads already self-scope with `withTenantScope(schoolId)`, and their
writes touch non-RLS tables (`tenants`, `users`) or self-scope, so they were never
part of this gap. The platform-wide handler (`@RequireClearanceLevel(10)`) is
likewise unchanged.

Also still dead code, and worth deleting rather than scoping:
`ProfileSuspensionService` (no callers) and
`TenantValidationService.validateProfile` (no callers, given a required
`tenantId` so a future caller cannot inherit the bug).

## Stage 4 — retire the bypass assumption (done)

1. **ADR-004 amended.** The assumption that broke here was never written down,
   which is why it survived to production. The amendment states plainly that no
   runtime connection bypasses RLS, that "privileged client" means "owns the
   pool" and never "sees everything", and that a pre-tenant path needs a
   _different_ scope rather than no scope. It also corrects the original text's
   claim that the owner "bypasses RLS".

2. **The CI gate now catches this class.** A gate already existed —
   `apps/api/scripts/check-privileged-db-usage.mjs` — but it encoded the very
   assumption that failed, in its own docstring, and allowlisted `src/auth/` and
   `src/common/` wholesale on the grounds that they "run before a tenant context
   exists". That allowlist is exactly why nothing flagged the broken login path.

   It now runs a second, narrower check: a file that reads a tenant-scoped model
   with no visible scope marker fails the build. Comments are stripped first, so
   doc comments and commented-out calls do not produce noise — the fastest way
   to get a gate disabled is to make it cry wolf. Model list is generated from
   the Prisma schema (`tenant-scoped-models.json`, 46 models). It found the
   `AuditLogController` bug on its first run.

   Deliberately file-level and heuristic: proving a given read is scoped needs
   real dataflow analysis, and a check that is easy to reason about but
   occasionally coarse is worth more than a precise one nobody trusts.

3. **Unit tests pin the primitive** (`apps/api/src/common/database/rls-scope.spec.ts`).
   They assert what actually makes a scope work: the GUC is set _inside_ the
   transaction, _before_ the callback runs, and the callback receives the
   transaction client — a query on the outer client would run on a different
   pooled connection where the GUC was never set. Also covers scope inheritance
   when handed a `TransactionClient`, where nesting is impossible.

**Remaining for a later pass:** repointing auth/guard paths at `app_runtime` so
`DATABASE_URL` is used only by migrations and seeds. Now unblocked — no path
reads tenant data unscoped any more — but it is a runtime-topology change that
wants its own deploy and its own verification, not a rider on this one. Do it
after demo confirms the scoping work, and note the boot-time
`RlsEnforcementService` probe already fail-closes if that connection turns out
to be privileged.

## Local-vs-deployed divergence

The root cause of the whole class: **local and CI cannot reproduce it**, because
their owner is a superuser and bypasses RLS. Every one of these bugs is invisible
until the code runs on managed Postgres.

Worth closing separately, and the highest-value remaining item: run CI's
integration suite as a non-superuser role against a FORCE-RLS database, so the
deployed topology is what gets tested. The new gate catches unscoped reads
statically, but only topology parity catches the next variant of this — a scope
that is opened on the wrong connection, or a policy that does not mean what its
author thought.
