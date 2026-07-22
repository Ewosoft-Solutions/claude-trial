# Platform (Cross-Tenant) Scope — Gap Analysis & Plan

> Analysis of the platform/Architect scope against its stated purpose, and a
> sequenced plan to make it a real platform manager. Created 2026-07-21.
>
> **Status (updated 2026-07-22): Phases 0, 0.5, and 1 implemented** (0.5.8
> deliberately deferred to Phase 3.2, below). Phase 0 = the audited cross-tenant
> seam. Phase 0.5 = Option D separation of duties (facet-split permissions,
> SuperAdmin-proposes/Architect-disposes approvals) + the privacy decisions
> (health-data encryption with searchable blind index, production key hard-fail,
> read-only DB role). Phase 1 = the honest platform console — a tenant-health
> `/overview`, its aggregation endpoint, dead-nav cleanup, and a facet-gated
> tenant detail page. Phases 2–3 (oversight, policy, cross-tenant insight, AI)
> remain to be built.
>
> Stated intent (product owner): *"The platform is meant to be a manager of all
> tenants, able to set them up, review them, see dashboard insights on them,
> manage them and their policies, be able to help them fix issues where needed…
> It's an entity scope different from being restricted to a tenant, meaning it
> should be able to aggregate from all tenants and use AI tools accordingly."*

## Headline finding

The platform scope is **an identity without an application**. Everything needed
to *recognise* a platform user is built and works: `scope: 'platform'` on
`/auth/me`, three platform roles at clearance 9–10, twelve seeded `platform.*`
permissions, a dedicated `PLATFORM_NAV`, route gating, and — importantly — a
**working, proven cross-tenant DB mechanism** (`TenantDbService.runPlatform`).

What is missing is almost everything that would *use* that identity. Concretely:

- **`runPlatform()` has zero production call sites.** Its only caller is
  `apps/api/test/rls-tenant-isolation.e2e-spec.ts:107`. The audited bypass that
  ADR-004 designed for exactly this purpose has never been wired to a feature.
- **Cross-tenant reads that do exist bypass RLS by a different route.**
  `TenantService` (`apps/api/src/tenant/services/tenant.service.ts:11`) injects
  the privileged `DatabaseService`, not `TenantDbService`. `GET /tenants` works
  across tenants because it runs on a connection RLS does not constrain — not
  because anything asserted platform scope. This is the single most important
  correctness/audit gap in the analysis.
- **13 of 18 platform nav destinations are 404s.** Only `/platform/tenants`,
  `/platform/tenants/all`, `/platform/tenants/onboarding` and
  `/platform/settings/security` exist.
- **`PlatformOversightService` is dead code.** Registered in `auth.module.ts`
  (lines 48/104/132), injected into nothing. Its one substantive method,
  `createPlatformOverrideContext`, carries a `TODO: Log platform override
  access for audit` (line 108) — i.e. the emergency-access path is both unused
  and, as written, unaudited.
- **10 of 12 `platform.*` permissions are unenforced.** Only `platform.security`
  appears in a `@RequirePermissions` guard (`security-policy.controller.ts`).
  Tenant management gates on `@RequireClearanceLevel(9)` instead, so the
  permission model and the enforcement model have diverged.
- **`/overview` has no scope branch at all.** It routes purely on
  `clearanceLevel`, so an Architect (10) falls into `clearanceLevel >= 7` and
  gets `AdminDashboard` — the school dashboard. This is the reported symptom;
  the cause is that no platform dashboard was ever written.

A useful way to hold this: the *isolation* work (ADR-004, `tenant-isolation-plan.md`)
was completed properly and the platform escape hatch was deliberately designed
into it. The *platform product* that was supposed to sit on top of that hatch
was scaffolded at the navigation layer and then not built.

## 1. Capability-by-capability assessment

Legend: **Real** = works end-to-end · **Scaffold** = shell/nav/route with no or
partial substance · **Missing** = does not exist.

### 1.1 Tenant lifecycle & setup

| Capability | State | Evidence |
|---|---|---|
| List all tenants | **Real** | `GET /tenants` + `/platform/tenants/all` — but see RLS note below |
| Activate / suspend tenant | **Real** | `PATCH /tenants/:id/status`, step-up gated (`TENANT_SUSPEND`) |
| Invite a tenant's first Owner | **Real** | `InviteUser` inline on the all-schools table |
| Register a tenant | **Partial** | `POST /tenants/register` + a single-form onboarding page |
| Guided onboarding wizard | **Scaffold** | Design specifies 6 steps; one form was built |
| Tenant configuration / features | **Partial** | API exists (`GET/PUT /tenants/:id/configuration`, `tenant-features.controller.ts`); no platform UI |
| Plans / billing / seats | **Missing** | Nav entry only; no API, no schema |

The onboarding gap is specific and worth naming. `design-export/Architect Flow.html`
specifies a six-step wizard — **1 Create · 2 Structure · 3 Invite · 4 Features ·
5 Roles · 6 Plan** — including institution type, branding colours, address/map,
org-structure tree with a "Scale-Down rule" verdict, feature toggles, role
presets with a maker-checker matrix, and a billing basis (per-seat/tier, cycle,
invoice preview). What exists at `/platform/tenants/onboarding` is a single
"Onboard a school" card. Steps 2, 4, 5 and 6 have no equivalent anywhere.

### 1.2 Review & oversight

| Capability | State | Evidence |
|---|---|---|
| Per-tenant detail / drill-down view | **Missing** | No `/platform/tenants/[id]` route |
| Cross-tenant audit log view | **Missing** | `/platform/audit/*` 404; `audit-log.controller.ts` is tenant-scoped |
| Platform-wide security posture | **Partial** | `/platform/settings/security` is real (step-up policies, change requests) |
| Health / uptime / error monitoring | **Missing** | `platform.monitoring` seeded, unenforced, no surface |
| Support ticket queue | **Missing** | Nav entry only |

### 1.3 Cross-tenant insight

**Missing entirely.** There is no aggregation layer of any kind — no query, no
service, no materialised view, no endpoint. Every analytics path in the codebase
takes a `tenantId` parameter. This is the largest single body of new work and it
is blocked on the data-access decision in §2.

### 1.4 Policy management

Genuinely mixed, and the most confusing area for a reader of the code:

- **Real:** platform-wide step-up / sensitive-operation policy governance via
  `security-policy.controller.ts` (properly `platform.security`-gated) with a
  maker-checker change-request flow, surfaced at `/platform/settings/security`.
- **Partial:** per-tenant session policy has an API proxy route
  (`/api/platform/session-policy/[tenantId]`) with no page behind it.
- **Missing:** platform-authored *default* policy that tenants inherit;
  policy drift detection ("which tenants deviate from baseline"); bulk policy
  application. Today a platform admin cannot see, let alone manage, the security
  posture of a specific tenant from the platform console.

### 1.5 Assisted remediation / support

**Missing, with a designed-but-abandoned foundation.** `PlatformOversightService`
was clearly written to be the "act on behalf of a tenant" seam —
`createPlatformOverrideContext`, `hasEmergencyAccess` (Architect only),
`hasPlatformOverrideAccess` (9+). None of it is reachable. There is no
impersonation, no scoped support session, no "view as tenant" mode, and no audit
record type for platform override (`AUDIT_ACTION` has `TENANT_LIFECYCLE` and a
`SECURITY.BREACH.PLATFORM_WIDE_RESPONSE`, but nothing for cross-tenant access).

**This is the highest-risk gap.** The most privileged roles in the system have a
designed override path with an explicit unimplemented-audit TODO. Any work here
must land audit *first*.

### 1.6 AI

Platform-scoped AI does not exist and the current AI **will not generalise**.
`analytics-chat.service.ts` threads a single `params.tenantId` through every
tool call, opens short `runScoped(params.tenantId, …)` transactions per unit of
work, and injects `School (tenant) id: ${params.tenantId}` into the system
prompt. `docs/ai-integration-plan.md:223` states the assistant *"refuses
cross-tenant or out-of-scope asks"* — cross-tenant refusal is a designed
property, not an oversight.

A platform assistant therefore needs its own tool registry and its own
execution scope; it cannot be a flag on the existing one. See §5.

## 2. The central decision: cross-tenant data access

### 2.1 What actually exists

Three distinct mechanisms are in play today, and they are not equivalent:

1. **`TenantDbService.runScoped(tenantId, …)`** — `app_runtime` role, GUC set,
   RLS enforced. The correct default for tenant data.
2. **`TenantDbService.runPlatform(userId, …)`** — `app_runtime` role, sets
   `app.is_platform = 'on'` transaction-locally. Every policy carries an
   `OR current_setting('app.is_platform', true) = 'on'` branch. **Proven** by
   `rls-isolation-check.sql` [7], `verify-app-runtime.ts` [6], and the e2e spec.
   **Used by nothing in production.**
3. **`DatabaseService`** — the privileged client. RLS does not constrain it.
   This is what `TenantService` and the auth/guard layer use.

The docstring on `TenantDbService` sanctions (3) for "auth / guards / platform
code." That was a reasonable bootstrapping call, but it means the platform's
cross-tenant reads currently have **no scope assertion, no per-query audit
trail, and no distinction from ordinary privileged auth work**. As platform
features multiply, that becomes the vector by which an isolation bug ships
unnoticed.

### 2.2 Options

**Option A — keep using `DatabaseService` for platform features.**
Zero work. Rejected: it makes the escape hatch invisible and unauditable, and it
means the RLS guarantee `/readyz` asserts is decorative for exactly the
highest-privilege code paths.

**Option B — route all platform reads through `runPlatform()`.**
Uses the mechanism ADR-004 designed and proved. Scope assertion becomes explicit
and greppable; `rlsAls` already carries `isPlatform: true`, so an interceptor
can audit every such transaction centrally. Cost: migrating `TenantService` and
writing new aggregation services against `TenantDbService`.

**Option C — a separate read model / materialised cross-tenant aggregates.**
A `platform` schema of rollup tables refreshed on a schedule. Strong isolation
story (the platform console mostly never touches tenant rows) and better
dashboard latency at 1,000+ tenants. Cost: schema migration, refresh
infrastructure, staleness semantics.

**Option D — a dedicated Postgres role for platform reads.**
Maximum separation, but duplicates connection-pool management for a guarantee
`app.is_platform` already provides. Not worth it.

### 2.3 Recommendation

**Adopt B as the rule, and C additively for the dashboard.**

- Make `runPlatform()` the *only* sanctioned cross-tenant path. Add a
  `@PlatformScoped()` decorator mirroring `@TenantScoped()` that opens the
  scope, requires a `platform.*` permission, and emits an audit row.
- **Audit before access.** Add `AUDIT_ACTION.PLATFORM` with at minimum
  `PLATFORM_CROSS_TENANT_READ`, `PLATFORM_OVERRIDE_GRANTED`,
  `PLATFORM_TENANT_IMPERSONATION_START/END`. Resolve the
  `platform-oversight.service.ts:108` TODO as part of this, not after.
- Migrate `TenantService` off `DatabaseService` so the platform console's own
  tenant list is scope-asserted like everything else.
- Add a lint/CI guard: no new `DatabaseService` injection outside
  `auth/`, `common/`, and the bootstrap paths.
- Introduce rollups (C) only when the dashboard needs them — measure first.

**Isolation implications to accept deliberately:** `app.is_platform='on'` is
all-or-nothing across every table for the duration of the transaction. Keep
platform transactions short and single-purpose, never span an LLM round-trip
(the existing analytics service already models this discipline well), and never
set it on a path that also handles tenant-user input.

## 3. Proposal: what platform `/overview` presents

Landing on `/overview` is correct; it should branch on `viewer.scope` before it
branches on `clearanceLevel`. The design export already specifies this surface —
`role-data.js` `architect`, `hello: 'Platform overview'`, crumb `['Platform',
'Overview']` — and it should be the source of truth:

- **KPI row (6):** Total schools · Active schools · Total users · MRR ·
  Renewals due · Open tickets.
- **Needs attention:** schools near subscription expiry · stalled onboarding
  (no activity 14+ days) · critical support tickets · payment failures.
- **Quick actions:** Create School (primary) · Manage Plans · Broadcast
  Message · View Audit Logs.
- **Primary widget:** school growth, 12-month trend.
- **Secondary widget:** breakdown by institution type.
- **Deeper panel:** Schools, filterable by status/type/plan.

Two things follow from what's actually buildable today. MRR, renewals, payment
failures and tickets have **no backing data model** — billing and support don't
exist. So the honest first cut is a *tenant-health* overview built from what we
have (tenant counts by status and type, user counts, onboarding progress,
recent tenant-lifecycle audit events, growth from `createdAt`), with the
billing/support tiles added when those domains land. Better a truthful smaller
dashboard than six tiles of zeroes.

**Routing:** add the scope branch at the top of
`apps/web/app/(app)/overview/page.tsx` — `if (viewer.scope === 'platform')
return <PlatformDashboard … />` — as a sibling under `overview/dashboards/`.
No route changes, no redirect. `apps/web/lib/session.ts:76` already documents
`schools` as empty for a platform viewer, so the `schoolName` lookup the school
dashboards depend on is correctly bypassed rather than fed a fallback.

## 4. Misconceptions worth naming explicitly

1. **"Platform scope is a high clearance level."** It is an orthogonal axis.
   Modelling it as clearance 9–10 is why `/overview` misroutes and why tenant
   endpoints gate on `@RequireClearanceLevel(9)` instead of `platform.tenants`.
   Scope and clearance answer different questions: *which tenants* vs *how much
   within one*.
2. **"Platform users are tenant-bound, so tenant-scoped code just works."**
   The platform tenant (`slug: 'platform'`, `settings.isPlatformTenant`) is a
   real convenience for identity, but it makes every tenant-scoped query
   silently return *the platform tenant's* data rather than erroring. Platform
   features need explicit cross-tenant intent, not inherited tenant context.
3. **"Cross-tenant aggregation is blocked by RLS."** It isn't — the audited
   branch was built and proved. The blocker is that nothing calls it.
4. **"The AI just needs a wider scope."** It needs a different tool registry,
   different prompt, different scope discipline, and its own refusal rules.

## 5. Sequenced plan

Sizing: **S** ≈ ≤1 day · **M** ≈ 2–4 days · **L** ≈ 1–2 weeks.

### Phase 0 — Make the escape hatch safe (do first) — ✅ IMPLEMENTED 2026-07-21

| # | Work | Size | Status |
|---|---|---|---|
| 0.1 | `AUDIT_ACTION.PLATFORM` action group | S | ✅ 6 actions, schema-free |
| 0.2 | `@PlatformScoped()` decorator + `RlsPlatformInterceptor` | M | ✅ + 6 unit tests |
| 0.3 | Resolve the audit TODO in `platform-oversight.service.ts` | S | ✅ kept + fully audited (see below) |
| 0.4 | Migrate `TenantService` off `DatabaseService` onto `runPlatform` | M | ✅ all three methods |
| 0.5 | CI guard against new `DatabaseService` injections | S | ✅ ratchet, 29 grandfathered |

#### Design correction found during implementation

The first cut composed `@RequirePermissions` into `@PlatformScoped` and let
`PermissionGuard` do the authorization. Verifying against the live API showed
that produced a 403 with **no audit row**: Nest runs guards *before*
interceptors, so the denial returned before the audit path was ever reached.
Refused cross-tenant attempts are precisely what a platform audit trail most
needs, so the permission check was moved into `RlsPlatformInterceptor`, which
now owns clearance + permission checking and audits grants and denials on the
same path. It uses the same `PermissionService` logic — a relocation of the
check, not a weakening of it. Verified live: a denied request now writes
`platform_cross_tenant_access_denied` with reason `none_of_permissions_granted`.

#### 0.3 decision: kept, not deleted

`PlatformOversightService` remains unreferenced but is now fully audited
(grants *and* denials, via `PlatformAuditService.logOverride`), filed against
the tenant the override targets so that tenant's own trail shows it. Deleting it
would discard the designed impersonation seam while §6 Q3 is still open; leaving
it unaudited risked someone wiring it up later. Its docstring now says so.

#### ⚠️ Blocked: SuperAdmin cannot manage tenants

`GET /tenant` and `GET /tenant/:id` are now `@PlatformScoped(['platform.tenants'])`.
Verified against the seeded data, that makes them **Architect-only**:

| Role | Clearance | Platform permissions held |
|---|---|---|
| Architect | 10 | all 12 |
| SuperAdmin | 9 | `support`, `support.access`, `monitoring`, `audit.limited`, `maintenance.limited` |
| PlatformAdmin | — | **none** |

`platform.tenants` is `requiredClearanceLevel: 10`, and `checkPermission` treats
a permission's own clearance floor as authoritative — so a clearance-9 SuperAdmin
cannot hold it even via a direct profile grant (confirmed empirically). The old
gate was `@RequireClearanceLevel(9)`, so **this is a regression in SuperAdmin's
reach**, and the same already-shipped problem affects `/platform/settings/security`
(gated on `platform.security`, also level 10 — SuperAdmin cannot use that page today).

This contradicts the PRD, which describes Super Admin as *"Oversees all tenants,
security, compliance"* — but the PRD wording is itself the thing that was wrong.
See §7 for the resolution (Option D), decided with the product owner 2026-07-21.

## 7. Option D — separation of duties (decided)

The PRD frames platform roles as a seniority ladder: more clearance, strictly
more power. The intended model is not a ladder. SuperAdmin must be able to *do*
real operational work while being denied categories of information a ladder
position would automatically grant. The sensitive axis cuts **across** the
seniority axis, so the fix is to split permissions by sensitivity facet — not
merely to move clearance floors.

Stated intent: *"The architect wants to remain the sole authority over the system
and tenants, with access to very critical info like finance, audits, metrics and
privileges that a basic employee playing super-admin support role shouldn't have.
The superadmin should be able to support the architect in basic management
capacity without being able to query or manipulate the system."*

### 7.1 The platform as data processor — no consent model

Two earlier drafts of this plan proposed tenant-side consent, first for
control-plane actions and then for data access. **Both were wrong and are
dropped.** A platform that provisions and operates the database is the manager of
that data; asking a school to approve work performed on infrastructure the
platform owns is incoherent. The real line is *impersonation* — acting as one of
a tenant's users, inside their account — which this system does not do.

The accurate framing is **controller / processor**: each school is the data
controller, the platform is the processor. A processor may process on documented
instruction from the controller, with no per-access consent. What it owes instead
is **accountability** — defined purposes, adequate security, and the ability to
say what happened. That is a records obligation, not a permission-asking one, and
it matches how AWS/Heroku-style providers operate on customer accounts.

So the operative constraint on privileged access is **not** "ask first". It is:
deliberate rather than incidental, attributable after the fact, and narrow enough
that a mistake is recoverable.

#### What is and is not protected today

`EncryptionService` (AES-256-GCM) exists but is injected in exactly two places —
`mfa-webauthn.service.ts` and `ai-settings.service.ts`. It protects JWT secrets,
MFA secrets and AI API keys: infrastructure credentials.

In plaintext, by necessity (the school must display and query them):

- `HealthRecord.bloodType` / `.allergies` / `.conditions` / `.medications`
- `Student.healthInfo`, `.specialNeeds`, `.emergencyContacts`, `.personalInfo` (JSONB)

That is medical and special-educational-needs data about **minors** — the
highest-sensitivity category in most regimes. "Sensitive data is hashed" holds
for credentials and not for this. Protection here must come from access control,
not cryptography.

#### Privacy concerns that shape the build

1. **Cross-tenant AI is a change in kind, not degree.** A human with DB access is
   bounded by effort; an assistant with cross-tenant tools is not. Aggregation
   turns "data we hold" into "data we can synthesize" — correlations across
   tenants that never existed in the source. Platform AI tools must be registered
   **per facet** and checked at execution time, not at session start (§7.5).
2. **Plaintext minors' health data has no second line of defence.** Mitigation:
   apply the existing `EncryptionService` to the health / special-needs cluster
   so those fields require a deliberate decrypt rather than surfacing incidentally
   in a `SELECT *` or a platform aggregate. Cheap, and the one category where a
   mistake is unrecoverable.
3. **Direct DB access is outside the audit.** Phase 0 records every cross-tenant
   access through the API and nothing about `psql`. This is the honest boundary
   of the design, not a defect in it — but it means "who saw this school's data"
   is answerable for API paths only.
4. **Purpose limitation.** Data collected to run a school, reused for
   platform-wide analytics or model training, is a different purpose. Aggregate
   and anonymised metrics are fine; per-pupil records leaving the school's context
   are the line. Decide deliberately before the analytics are built.

The blast radius of the single Architect account is deliberately *not* on this
list: the facet split (§7.2) plus existing step-up/MFA already address it.

The applicable regime (NDPA, GDPR, or both, depending on pupil location) changes
the details, not the shape, and warrants a lawyer's review rather than an
engineering judgement.

#### Decisions (2026-07-21)

**1. Cross-tenant AI → facet-gated tools + aggregate floor.** Every platform AI
tool declares a required facet, checked at *execution* time — a session that
starts in-facet can still reach for a tool that is not, so a session-start check
is insufficient. On top of that, platform AI may only return aggregates spanning
a threshold number of tenants; never per-tenant or per-pupil rows. See 0.5.8.

**2. Minors' health data → encrypt at rest, and keep it searchable.** Apply
`EncryptionService` to `HealthRecord.bloodType/.allergies/.conditions/.medications`
and `Student.healthInfo/.specialNeeds`. This does **not** trade away the
read-shape exclusion: the facet split (0.5.3) already keeps these fields out of
every platform read shape, so both protections land regardless. Encryption's real
value is the layer access control cannot reach — **backups**. Render automated
backups + PITR emit a full plaintext copy on a schedule today.

Three things make this cheaper than field encryption usually is, and one thing
makes it harder.

*Cheaper:* nothing in the codebase currently filters or searches these fields —
they are read and written whole — so no existing query breaks. AES-256-GCM with a
random IV is already implemented. And the sensitive narrative is the part with
real value to an attacker.

*Harder:* health data **must remain searchable** (product decision, 2026-07-21) —
e.g. "every pupil with a peanut allergy before the trip". GCM with a random IV
encrypts the same value differently every time, so `LIKE '%peanut%'` is
impossible against ciphertext.

##### Design: coded flags + blind index, encrypted narrative

Split the field by what is actually being queried. The real query is
**categorical**, not substring — nobody needs to grep prose, they need "which
pupils are in the peanut-allergy category".

- **Narrative** (`allergies`, `conditions`, `medications` free text, `healthInfo`,
  `specialNeeds`) → encrypted. Never searched; displayed to authorised school
  staff only.
- **Coded flags** → a controlled vocabulary (`allergy:peanut`, `condition:asthma`)
  in a `String[]` column, GIN-indexed. This is what queries hit.

Coding the flags is better product design independently of encryption. Free-text
allergy fields are a known safety hazard in school systems: "peanut" vs "peanuts"
vs "nut allergy" means a substring search silently *misses* a pupil before a
trip. A controlled vocabulary makes that query correct, not merely possible.

The flags are still medical data — they stay RLS-scoped and excluded from
platform read shapes like everything else. But they are coarse, and a leaked
backup containing them would reveal categories. Two options:

- **Plaintext flags** — simplest. A dump reveals "this pupil has a peanut
  allergy" but not the narrative. Search is ordinary SQL.
- **Blind index (recommended)** — store `HMAC(key, code)` per flag instead. An
  attacker with the dump alone cannot compute the HMAC of "peanut" without the
  key, so flags are opaque; the app searches by HMACing the search term. Residual
  leak is *equality* only (which pupils share an unknown flag). Costs: search must
  go through the app rather than ad-hoc SQL, and key rotation must re-index.

Recommended: blind index, because the whole point of decision 2 is that a leaked
backup is useless, and plaintext flags would undercut exactly that for the most
identifying bit.

##### Two gaps folded into this item

- **The dev fallback key is a production risk.** `EncryptionService` logs
  `ENCRYPTION_KEY not set. Using default key (NOT SECURE FOR PRODUCTION)` and
  continues with a constant-derived key. If it is ever unset in production,
  encryption silently becomes worthless — everything encrypts under an effectively
  public key. This must be a **hard startup failure** when `NODE_ENV=production`.
  Without it, the entire control can appear to work while providing nothing.
- **`sslmode=require` does not verify the certificate.** `deployment-runbook.md`
  uses `require` in three places and `verify-full` in the demo-DB line. `require`
  encrypts but accepts any certificate, so it does not stop an active
  man-in-the-middle. Standardise on `verify-full`.

Key management follows from all of this and is the real ongoing cost: lose
`ENCRYPTION_KEY` and the data is unrecoverable, so it needs backing up
**separately from the database** (a key stored in the same backup as the
ciphertext protects nothing). Rotation re-encrypts every row and re-indexes every
flag; build that migration path once, at the start.

**3. Direct DB access → least-privilege roles + native logging, not break-glass
checkout.** With a single Architect, a credential-checkout system is theatre:
they would be checking out credentials from themselves. The leverage is in
removing standing write access and making connections visible:

- Add an `app_readonly` role (non-superuser, SELECT-only), following the existing
  `app_runtime` pattern. Routine inspection cannot mutate.
- **No standing owner credentials outside CI.** Migrations already run through CI
  (`pnpm db:deploy` in `cd.yml`), so humans need no write credentials at all.
- Enable `log_connections`, `log_disconnections`, `log_statement='ddl'` — plain
  Postgres configuration, no extension, works on managed Postgres. Yields
  who-connected-when plus every schema change.
- Enable `pgaudit` **if** Render's managed Postgres offers it; verify at deploy
  time, do not block on it.
- Restrict who can download or restore backups.

The last point is the important one. Render automated backups + PITR (per
`deployment-plan.md`) means a full copy of the database leaves it on a schedule.
That is a larger leak surface than `psql`, and it is not something DB auditing
would catch — which is precisely why decision 2 (encryption at rest) carries more
weight than it first appears. See 0.5.9.

**4. Purpose limitation → aggregates only.** Platform analytics and AI build on
rollups (counts, rates, distributions). Per-person records never leave tenant
context.

This converges with Option C from §2.2 (materialised cross-tenant aggregates):
the same rollup layer delivers purpose limitation *and* the dashboard performance
needed at 1,000+ tenants. It also makes decision 1's aggregate floor
**structural rather than policy** — if the rollups the platform AI reads contain
no per-person rows, no tool bug can leak one. Two independent controls collapsing
into one piece of architecture is the strongest outcome available here, and it
promotes rollups from "measure first" (§2.3) to a planned Phase 3 deliverable.

### 7.2 Permission facets

`platform.tenants` today bundles three different powers — list, inspect, and
mutate. `getTenant` returns `jwtConfig` and `securityPolicy` in the same payload
as name and status, so anyone who can activate a school can also read its JWT
rotation state. That bundling is what has to break.

| Permission | Level | SuperAdmin | Architect |
|---|---|---|---|
| `platform.tenants.read` — list, status, onboarding progress | 9 | ✅ | ✅ |
| `platform.tenants.act` — activate/suspend, invite owner, advance onboarding | 9 | ✅ **approval-gated** | ✅ direct |
| `platform.tenants.inspect` — configuration, security policy, JWT state | 10 | ❌ | ✅ |
| `platform.finance.*` — billing, MRR, invoices, payouts | 10 | ❌ | ✅ |
| `platform.audit.read` — cross-tenant audit trail | 10 | ❌ (own actions only) | ✅ |
| `platform.metrics.*` — cross-tenant analytics and aggregation | 10 | ❌ | ✅ |
| `platform.privileges.*` — roles, permissions, clearance | 10 | ❌ | ✅ |
| `platform.support.*` — tickets, communication | 9 | ✅ | ✅ |
| `platform.approvals.override` — decide or overturn any request | 10 | ❌ | ✅ |

The operative principle is **act without seeing**: action permissions and
status-level reads for SuperAdmin, deep reads for Architect only. "Cannot query
or manipulate the system" maps to the three denials — no `metrics` (cannot
aggregate), no `privileges` (cannot manipulate), no `inspect` (cannot see
internals).

Consequence for endpoints: `GET /tenant/:id` must return **different shapes per
facet** rather than one payload behind one permission. Facet-gated response
shaping, not just facet-gated routes.

### 7.3 Approval model

SuperAdmin proposes; Architect disposes. `platform.tenants.act` is
approval-gated for clearance 9 and direct for clearance 10.

There is **one Architect today**, so a two-person Architect rule is not
available — and a subordinate approving a superior is not a check. The approval
model is therefore built as **policy, not hardcoding**, so that the intended
future shape drops in without rework:

- Approval requirement is keyed by *operation* → required approver clearance and
  count, resolved at runtime. Today `platform.tenants.act` → `{ level: 10, count: 1 }`.
  Future expansion (e.g. two level-9 managers approving a support-ticket action)
  is a policy row, not a code change.
- The Architect holds `platform.approvals.override` and can decide or overturn
  **any** request at any level — the standing top of the chain.
- Emergency/break-glass remains available to the Architect alone, unilateral by
  definition, and is the loudest thing in the audit trail.

This fits the existing infrastructure rather than adding to it. `MakerCheckerRequest`
already carries `makerId`/`checkerId` with clearance levels; `ApprovalLevel`
already has `PLATFORM` and `EMERGENCY`; `maker-checker.service.ts` already
exposes `createApprovalRequest`/`approveRequest`/`rejectRequest` with a
config-driven `requiresApproval(operation)`. What is missing is **platform
operations registered into it** — `STEP_UP_OPERATION` has no platform entries
beyond tenant provision/suspend.

### 7.4 Audit model — and a correction to Phase 0

Platform actions are system activity and are filed in the **platform's** audit
trail, keyed to the platform tenant, with `targetTenantId` in metadata. Because
audit rows are tenant-scoped by RLS, filing them under the platform tenant means
a tenant cannot see them through its own scoped queries — the desired behaviour
falls out of existing isolation rather than needing new rules.

`PlatformAuditService.logCrossTenantAccess` already does this correctly.
**`logOverride` does not**: it files against `targetTenantId`, on the explicit
reasoning that "the tenant's own audit trail shows when the platform reached into
it." That reasoning is now overturned — it puts system activity into the tenant's
user-facing audit. It must be changed to file against the platform tenant with
`targetTenantId` in metadata, matching `logCrossTenantAccess`.

### 7.5 AI consequence

A platform assistant inherits its operator's facets. A SuperAdmin's assistant
must not be able to aggregate finance or metrics across tenants — otherwise
tool-use becomes a bypass of the facet split. Platform AI tools must be
registered *per facet* and checked at execution time, not at session start.

### 7.6 Sequencing (Phase 0.5, before Phase 1)

| # | Work | Size | Notes |
|---|---|---|---|
| 0.5.1 | Fix `logOverride` to file platform-plane (§7.4) | S | ✅ done |
| 0.5.2 | Split `platform.tenants` into `.read`/`.act`/`.inspect`; add `metrics`/`privileges`/`approvals.override` | M | ✅ done — 17 platform permissions, reseeded |
| 0.5.3 | Regate `GET /tenant` → `.read`; shape `GET /tenant/:id` per facet | M | ✅ done — SuperAdmin regression fixed, verified live |
| 0.5.4 | Register platform operations into maker-checker; policy-driven approver level+count | M | ✅ done — `tenant.act` gated; also fixed a self-approval bug (below) |
| 0.5.5 | Approval queue UI (`/platform/tenants/approvals`) + proxy routes | M | ✅ done — API live-verified; page verified by compile + nav tests |
| 0.5.6 | Give `PlatformAdmin` a defined facet set, or remove the role | S | currently inert — holds no permissions at all |
| 0.5.7a | Hard-fail startup on missing `ENCRYPTION_KEY` in production; standardise `sslmode=verify-full` | S | ✅ done — also closed a silent key-stretching hole |
| 0.5.7b | Coded health-flag vocabulary + blind index (`String[]`, GIN) | M | ✅ done — migration `20260721120000_health_flag_blind_index` |
| 0.5.7c | Encrypt health/special-needs **narrative** + backfill migration | M | ✅ done — envelope `enc:v1:`, backfill script, verified live round-trip |
| 0.5.7d | Key-rotation path (re-encrypt + re-index) | M | ✅ done — re-keys narrative + flag digests; safety rail; verified via round-trip |
| 0.5.8 | Facet-gated AI tool registry + aggregate floor | M | ⏸️ **deferred to Phase 3.2 — deliberately, see below** |
| 0.5.9 | `app_readonly` role; drop standing owner creds; Postgres connection/DDL logging | S–M | ✅ done — runbook Step 4c; SQL validated live (rolled back) |

#### 0.5.8 deferred deliberately (not skipped)

There is **no platform AI service to gate today** — the only AI is tenant-scoped
(`analytics-chat.service.ts`, single `tenantId`), and there are no platform AI
tools. Building the facet-gated registry now would be infrastructure with no
caller: speculative dead code until Phase 3.2 actually builds platform AI. That
is the kind of thing this codebase is right to avoid.

What matters is that the constraint cannot be *forgotten* when Phase 3.2 arrives.
It is recorded as a hard gate: decision 1 (§7.1) requires platform AI tools to be
**facet-gated at execution time** and bounded by the **aggregate floor**, and the
cleanest form of the floor is structural — build platform AI on the cross-tenant
rollups (Phase 3.1 / Option C), which contain no per-person rows, so no tool bug
can leak one. Phase 3.2 must not ship a platform assistant that reads per-pupil
data directly. Doing 0.5.8 before 3.1/3.2 would invert that dependency.

Requires a seed change and reseed (0.5.2). 0.5.7 needs a data migration
(encrypt-in-place). Nothing here changes RLS.

> **Seed gotchas hit during 0.5.2, for whoever changes permissions next.**
> `EXPECTED_PERMISSION_COUNTS` in `seed.ts` asserts both the per-array and total
> permission counts and aborts the seed on a mismatch — update it in the same
> commit as any permission change (it is a useful guard, not an obstacle; it
> caught this change before it touched a single row). And the seed **upserts
> without pruning**: removing a permission from the catalog leaves the old row
> in the database, still attached to its pools. `platform.tenants` had to be
> deleted by hand after the reseed. Anything that enumerates permissions for
> audit or UI should not assume the table matches the catalog.

Decision 4 (aggregates only) is not a Phase 0.5 item — it is a constraint on
Phase 3.1, which it promotes from "evaluate rollups" to "build rollups".

### Phase 1 — Make the console honest — ✅ IMPLEMENTED 2026-07-22

| # | Work | Size | Status |
|---|---|---|---|
| 1.1 | Platform `/overview` dashboard (tenant-health cut, §3) | M | ✅ scope-branched in `overview/page.tsx`; SWR dashboard |
| 1.2 | `GET /platform/overview` aggregation endpoint | M | ✅ new `PlatformModule`; live-verified real cross-tenant data + audit |
| 1.3 | ~~Enforce `platform.tenants` on tenant endpoints~~ | S | ✅ done in 0.5.2/0.5.3 — facet permissions enforced |
| 1.4 | Remove the dead nav links | S | ✅ 14 → 0 dead platform links; sections re-add per feature |
| 1.5 | Tenant detail page `/platform/tenants/[id]` | M | ✅ facet-gated (identity vs internals); verified live |

#### Notes from implementation

- **1.1/1.2 — the honest cut, as designed.** The overview shows only what the
  schema supports: tenant counts/status/type, user totals, stalled onboarding,
  12-month growth, recent tenant-lifecycle audit. No MRR/renewals/tickets tiles
  (no billing/support domains yet). Gated on `platform.tenants.read`, so a
  SuperAdmin support role gets the operational view, not just Architects. First
  real consumer of `@PlatformScoped` beyond the tenant list.
- **1.4 — removed, not stubbed.** Analytics/Audit/Support/Billing sections and
  the Help / Settings-Maintenance footer items all 404'd; removed with a comment
  pointing to the re-add pattern (as Tenants→Approvals was added). A
  `platform.monitoring`-holding SuperAdmin was being shown an Analytics entry to
  nowhere — now every visible platform link resolves.
- **1.5 — a users/audit tab was deliberately NOT wired.** The existing
  `GET /tenant/:id/users` is gated on `@RequireClearanceLevel(7)`, not
  `@PlatformScoped` — pointing the platform detail page at it would be an
  *unaudited* cross-tenant read, the exact anti-pattern this plan exists to fix.
  The detail page shows the facet-gated `GET /tenant/:id` (identity for `.read`,
  internals for `.inspect`). A per-tenant users/audit view needs its own
  `@PlatformScoped` endpoint — folded into Phase 2 (2.1 audit view).

#### Security bug found and fixed during 0.5.4

`MakerCheckerService.approveRequest` had **no self-approval check** and gated the
checker on the *maker's* clearance floor. So any maker could approve their own
request, and the "checker" needed no more standing than the maker — the workflow
was decorative. This affected the existing school operations (roles, deletions,
financial), not just the new platform ones.

Fixed: a maker can never approve their own request (an `override` does **not**
lift this — it only lifts the clearance floor); and `tenant.act` carries a
distinct `requiredCheckerClearanceLevel: 10`, so a SuperAdmin proposes and only
an Architect — who is not the maker — disposes. `platform.approvals.override`
lets a delegated approver clear the floor without being the Architect, but still
never self-approve. Covered by unit tests on both services; verified live that
the endpoints resolve, the pending queue reads end-to-end through the platform
scope, and a mutation attempt is blocked (by step-up) before any state change.

### Phase 2 — Oversight & policy

| # | Work | Size | Notes |
|---|---|---|---|
| 2.1 | Cross-tenant audit log view `/platform/audit/log` | M | |
| 2.2 | Per-tenant policy view + platform baseline defaults | L | may need schema for baseline |
| 2.3 | Policy drift detection across tenants | M | depends on 2.2 |
| 2.4 | Onboarding wizard steps 2/4/5/6 per `Architect Flow.html` | L | step 6 blocked on billing schema |

### Phase 3 — Insight & AI

| # | Work | Size | Notes |
|---|---|---|---|
| 3.1 | Cross-tenant analytics endpoints | L | evaluate rollups (Option C) here |
| 3.2 | Platform AI tool registry + `PlatformAnalyticsChatService` | L | separate from tenant assistant |
| 3.3 | At-risk / misconfigured tenant detection | M | strong AI fit; depends on 3.1 |

**Phase 3.2 hard gate — carried over from 0.5.8 (deferred deliberately).** Before
any platform AI ships, these are non-negotiable (decision 1, §7.1):

- [ ] Every platform AI tool declares a required **facet** and is checked at
      **execution time**, not session start — a SuperAdmin's assistant must be
      unable to *call* a `metrics`/`inspect`/`finance` tool it lacks.
- [ ] Platform AI reads only **cross-tenant rollups** (Phase 3.1 / Option C),
      never per-pupil rows — the aggregate floor made structural, so no tool bug
      can leak an individual.
- [ ] The floor is enforced in the tool layer, not the prompt (a prompt
      instruction is not a control).
- [ ] Build 3.1 (rollups) *before* 3.2 (assistant); doing 3.2 first inverts the
      dependency and there is nothing safe to read.

### Requires schema migration

- Billing / plans / seats (Phase 2.4, and the MRR tiles in §3) — new domain.
- Support tickets — new domain.
- Policy baseline table, if drift detection is in scope (2.2).
- Cross-tenant rollup tables, *if* Option C is adopted (3.1).

### Requires RLS changes

**None.** The `app.is_platform` branch already exists in every policy. New
tables must keep including it — that is the existing migration convention, not
new work. Any rollup tables under Option C would be platform-only and need
policies denying `app_runtime` without `is_platform`.

## 6. Open questions for the product owner

1. **Billing** — real domain to build, or does the platform integrate an
   external billing system? Determines whether §3's MRR tiles are Phase 1 or far
   later.
2. **Support** — in-app ticket queue, or link out to an existing helpdesk?
3. ~~**Impersonation**~~ — ✅ **answered 2026-07-21: out of scope.** The platform
   does not act as a tenant's users inside their account. Platform work is
   system-plane operation on tenant data and configuration (§7.1). This is the
   distinction that makes a consent model unnecessary; if impersonation is ever
   introduced, that conclusion has to be revisited, not inherited.
4. **PlatformAdmin (clearance 8?)** — the third platform role has no
   differentiated capability anywhere. What should it be able to do that
   SuperAdmin can, and what not? (Tracked as 0.5.6.)
