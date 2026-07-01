# Backend Remediation Plan — sequential steps

> **Goal: fix them ALL.** Work top to bottom, completing each step to its
> acceptance criteria before starting the next; this is the committed backlog, not
> a pick-one menu. Definition of done: Steps 1–8 complete (✅ as of 2026-07-01 —
> all 6 operational modules built), every scorecard gap closed or explicitly
> deferred, `db:rls:check` + CI green.
>
> Created 2026-06-20. Captures the gaps from the deep backend assessment and
> orders them into steps that can be picked up one at a time. Companion docs:
> `docs/requirement-pillar-scorecard.md` (where we are vs requirements),
> `docs/tenant-isolation-plan.md` + `ARCHITECTURE_DECISIONS.md` ADR-004 (isolation),
> `docs/project-audit.md` (older 2026-06-08 automated audit).

## Assessment summary (what the audit found)

The backend (`apps/api`, NestJS, DB-backed) is a credible **auth + academic
core**: full login/MFA/select-school/refresh, RBAC + maker-checker + audit, tenant
lifecycle, academic structure, students/enrollment, communication. Strengths are
real. The gaps, in priority order, are below.

Resolved this session:
- **Tenant data isolation** — was *not* enforced (RLS dead code, inconsistent
  app-level scoping). Now enforced at the DB via RLS on 23 tables + restricted
  `app_runtime` role + audited platform bypass, proven by
  `rls-isolation-check.sql`, and made a **standard** (CI guard `db:rls:check`,
  `ALTER DEFAULT PRIVILEGES`, `enforce_tenant_rls()`). See ADR-004.

## Open gaps (priority order)

1. RLS **runtime cutover** not done — DB enforces, but the app still connects as
   superuser `postgres` (bypasses RLS). (= checklist task T5.)
2. **No CI** — `db:rls:check`, type-check, lint, build, tests are not gated
   anywhere (`.github/workflows/` absent). The new isolation standard is only as
   good as a CI job that runs it.
3. **Frontend ↔ backend not wired** — `apps/web` imports neither `@workspace/api`
   nor `@workspace/database`; `getSession()` is a mock. Biggest architectural gap.
4. **Attendance** — no model/API at all, yet the frontend ships
   `/attendance/daily` + `/students/attendance`. Core academic gap.
5. **Finance/billing** — no model/API, yet the frontend ships `/finance/*`.
6. **Polymorphism not realized server-side** — `schoolType` modeled but unused;
   no feature-toggle backing (`/settings/features` is mock).
7. **Thin backend tests + boundary debt** — no auth e2e, no in-app isolation
   tests; `packages/api` vs `apps/api` ownership is blurry; build artifacts
   (`apps/api/dist`, `coverage`, compiled `.js`) tracked in git.
8. ✅ **Other operational modules** (transport, library, health, HR, admissions,
   events) — RESOLVED 2026-07-01, see Step 8 below.

---

## Sequential steps (pick up one at a time)

### Step 1 — RLS runtime cutover (finish isolation) — IN PROGRESS (T5)
**Why:** activates the isolation enforcement already proven at the DB.
**Do:** per ADR-004 runbook — give `app_runtime` LOGIN + password (secret);
point runtime `DATABASE_URL` at `app_runtime`, keep migrations on the owner via
`directUrl`; run every tenant-scoped query through
`PrismaTransactionService.runInTransaction` (sets the GUC); set `app.is_platform`
only on authorized platform endpoints.
**Acceptance:** app boots and serves as `app_runtime`; an integration test shows
a request for tenant A cannot read/write tenant B; platform endpoints still work;
`db:rls:check` green.

**Status (2026-06-20): mechanism COMPLETE + proven; breadth rollout in progress.**
- ✅ **Two-client wiring** (`database.module.ts`, `TENANT_PRISMA_CLIENT_TOKEN`):
  a tenant client connects as `app_runtime` when `APP_RUNTIME_DATABASE_URL` is set
  (falls back to the privileged URL otherwise — no regression).
- ✅ **`TenantDbService.runScoped(tenantId, userId, fn)`** — one tx on the
  `app_runtime` client with the GUC set, ALS-propagated tx client; `runPlatform()`
  = audited `app.is_platform` bypass.
- ✅ **`RlsTenantInterceptor` (global) + `@TenantScoped`** — opens the per-request
  scope after the guards (so `tenantId` is known); no-op for non-scoped/auth/platform
  routes. Services use a `client` getter (`isScoped ? tenant tx : privileged`) so a
  migration is safe before its route is scoped.
- ✅ **Communication module migrated** (Announcement + Message controllers
  `@TenantScoped`; `CommunicationService` on the `client` getter) as the reference.
- ✅ **Proven**: `test/rls-tenant-isolation.e2e-spec.ts` (DI, 6/6) +
  `test/rls-http-isolation.e2e-spec.ts` (real HTTP through the interceptor, 4/4) —
  tenant A reads only A, 404 for B's row, cross-tenant write rejected, platform
  bypass works. `db:rls:check` green. `nest build` green. Both specs skip without
  `APP_RUNTIME_DATABASE_URL`.
- ✅ `env.*.template` document `APP_RUNTIME_DATABASE_URL`.

**Closeout checklist:**
1. ✅ **DONE** — all tenant-data services migrated (communication, students,
   academic-structure, assessment-grading, reporting-analytics): scoped-or-
   privileged `client` getter + `this.client`; all 9 controllers `@TenantScoped`.
   `PrismaTransactionService.runInTransaction` reuses the request RLS scope so
   transactional writes are RLS-enforced too. Auth/tenant-admin/platform stay
   privileged by design. Proven: DI 6/6 + HTTP 5/5 (announcements + academic-years).
2. ⏳ **Deploy step** — set `APP_RUNTIME_DATABASE_URL` (the `app_runtime` role) in
   each env so the app runs RLS-enforced. (`app_runtime` is created NOLOGIN by
   migration; grant LOGIN + a secret password at deploy.) Documented in `env.*.template`.
3. → **Step 2** — wire `db:rls:check` + `db:rls:proof` + both e2e specs into CI.

**Step 1 status: COMPLETE in code** (mechanism + full service rollout + proof).
Only the deploy-time env flip (#2, operational) and CI wiring (Step 2) remain.
- ✅ **Keystone proven** — `pnpm --filter @workspace/database db:rls:proof`
  (`rls-prisma-proof.ts`) connects as `app_runtime` through the REAL stack
  (Prisma 7 + `@prisma/adapter-pg`) and confirms an interactive `$transaction`
  keeps the `app.current_tenant_id` GUC on one pooled connection: cross-tenant
  read/write/update all blocked. So the runtime DB machinery enforces RLS.
- ✅ `app_runtime` LOGIN enabled on the **local** dev DB (`ALTER ROLE app_runtime
  LOGIN PASSWORD '…'`; uncommitted — prod uses a secret). App **builds** (`nest build`).
- ✅ Assets for the e2e exist: `apps/api/test/multi-tenant-isolation.e2e-spec.ts`
  + harness (`jest-e2e.json`, `setup-env.ts`); seed creds
  `architect@schoolwithease.com` / `Architect@2025!`.

**Remaining (the invasive part — do as a focused unit, verify by booting):**
1. Make ALL runtime DB access RLS-context-aware. The app has 3 patterns:
   `DatabaseService.client`, direct `PRISMA_CLIENT_TOKEN` injection, and
   `PrismaTransactionService.client`. Cleanest: an AsyncLocalStorage holding the
   per-request tx client + a Prisma client `$extends`/proxy (or route everything
   through one accessor) so a request's queries use the tx with the GUC. A global
   interceptor opens `runInTransaction` for authenticated tenant requests (skip
   login/pre-auth; set `app.is_platform` for platform scope).
2. Point `apps/api` runtime `DATABASE_URL` at `app_runtime` (migrations stay on
   the owner via `packages/database/.env`); update `env.*.template`.
3. Get `multi-tenant-isolation.e2e-spec.ts` green **with the app connected as
   `app_runtime`** (that's the real proof) + `db:rls:check` green.
> Risk: wrapping requests in one tx + a non-bypass role means any query path that
> escapes the ALS context returns nothing — so this must be verified by booting
> the app and running the e2e suite, iterating to green.

**Findings from a deeper dig (2026-06-20) — Step 1 is bigger than the runbook assumed:**
- **Guard-ordering problem (the real blocker).** NestJS runs **middleware → guards
  → interceptors → handler**. Guards already hit the DB for authz (permission /
  tenant-context guards read `user_tenants`/`roles`). Under `app_runtime`, those
  reads need the RLS context **already set** — but an *interceptor* that opens
  `runInTransaction` runs **after** guards, so guard queries would see nothing and
  every request 403s. ⇒ The "interceptor wraps handler in a tx" approach is
  **insufficient**. The context must be established before guards and span the
  whole request.
- **Interactive-tx-per-request doesn't fit the lifecycle.** A Prisma interactive
  `$transaction(fn)` can't cleanly stay open across middleware→guards→handler.
  The robust pattern is **per-request connection pinning**: in middleware, check
  out one `pg` connection, `SET app.current_tenant_id` (session-level) on it, bind
  all of the request's Prisma queries to that connection via AsyncLocalStorage,
  then reset + release at request end. Auth/pre-tenant/platform routes set
  `app.is_platform='on'` instead. This is a real piece of connection-management
  architecture, not a wiring task.
- **The existing e2e is a stub.** `apps/api/test/multi-tenant-isolation.e2e-spec.ts`
  hits `GET/POST /api/resources` (no such endpoint → 404) with hardcoded fake
  tokens (`Bearer user1-token`). It never worked. A **real** isolation e2e must be
  written: log in via `/auth/login` (seed creds), select a school, hit a real
  tenant-scoped endpoint (e.g. `/students`), assert tenant B's data is invisible.

**Recommended approach for Step 1 going forward:**
1. Build a request-scoped RLS connection manager (pin a `pg` connection per
   request, session GUC, ALS propagation; set in middleware so it covers guards).
   Make `DatabaseService.client` + the raw `PRISMA_CLIENT_TOKEN` resolve to it.
2. Classify routes: tenant-scoped (set `app.current_tenant_id`) vs auth/platform
   (`app.is_platform='on'`); a decorator + sensible default.
3. Write a real login-based isolation e2e; flip `apps/api` `DATABASE_URL` to
   `app_runtime`; iterate to green; `db:rls:check` green.

Note: the **DB-level enforcement already shipped is a real security gain** — any
client that connects as `app_runtime` (reporting tools, future services, the app
post-cutover) cannot cross tenants. The remaining work flips the primary NestJS
app onto that role, which is a deliberate architectural task.

**Two more constraints found (2026-06-20), and a simpler design that beats them:**
- `@prisma/adapter-pg` (v7) binds to a `pg.Pool`, **not a single `PoolClient`** —
  so clean per-request *connection pinning* isn't directly supported. The
  Prisma-native option is an interactive `$transaction` whose callback spans the
  request (awkward) — OR the two-client design below.
- The JWT uses **per-tenant secrets in `tenant_jwt_configs`** (RLS-protected), so
  decoding a token to learn its tenant needs a privileged read first → a circular
  dependency if the whole app runs as a single `app_runtime` role from middleware.

**Recommended (revised) design — two clients, avoids both problems:**
- **Privileged client** (owner / RLS-bypass) used by auth services, the guards,
  and platform endpoints. The auth flow + per-tenant-secret lookup work exactly as
  today (no circularity); guards' authz reads work (no guard-ordering problem).
- **`app_runtime` client** used only by **tenant-data services** (students,
  academic, communication, …). A global **interceptor runs after the guards**, so
  `request.user.tenantId` is known; it wraps the handler in
  `runInTransaction(tenantId)` (sets the GUC) and exposes the tx client to those
  services via AsyncLocalStorage. Tenant DATA is RLS-enforced; trusted auth/
  platform code stays privileged.
- Verify with a **real** login-based e2e (architect seed creds → select school →
  hit `/students` for tenant A → assert tenant B invisible), app's tenant client
  on `app_runtime`. This is a focused build best done in a session where the API
  can be run/iterated interactively; it is NOT a quick wiring.

### Step 2 — CI pipeline
**Why:** makes the isolation standard (and "must compile/lint/type-check") actually
enforced; nothing gates merges today.
**Do:** add `.github/workflows/ci.yml` — Postgres service, `pnpm install`,
`migrate deploy`, then `db:rls:check`, type-check, lint, build, and tests
(UI vitest under Node ≥20.19, api jest, web vitest).
**Acceptance:** CI fails on an unguarded tenant table, a type error, or a failing
test; green on `main`/PR.

### Step 3 — Frontend↔backend vertical slice (auth)
**Why:** closes the integration debt; validates the access-control contract end to end.
**Do:** replace mock `getSession()` (`apps/web/lib/session.ts`) with a real call to
`apps/api` `/auth/login` → `/select-school` → `/refresh`; map the response to the
`Session` shape; add a login surface; contract-test the payload vs `Session`.
**Acceptance:** a real login drives the nav/viewer; token refresh works; types
shared, no shape drift.

### Step 4 — Attendance domain
**Why:** core academic requirement; frontend already assumes it.
**Do:** Prisma model(s) (tenant-scoped — follow the RLS checklist), API endpoints,
wire `/attendance/daily` + `/students/attendance` to real data.
**Acceptance:** mark/list attendance per class/day; RLS-covered (`db:rls:check`
green); frontend surfaces read/write real data.

### Step 5 — Finance/billing domain
**Why:** core admin requirement; frontend ships mock finance.
**Do:** model fees/invoices/payments (tenant-scoped + RLS), API, wire `/finance/*`.
Or explicitly defer and stop presenting mock finance as backed.
**Acceptance:** invoices/payments persist + report; RLS-covered.

### Step 6 — Realize polymorphism
**Why:** the product's central differentiator; modeled but not demonstrated.
**Do:** drive nav/feature visibility from `schoolType` + a feature-toggle model;
make `/settings/features` real.
**Acceptance:** two school types render materially different nav/features from config.

### Step 7 — Backend tests + boundary/hygiene cleanup ✅ DONE (2026-06-29)
**Do:** auth-flow e2e; in-app cross-tenant isolation test (using `app_runtime`);
document/realign `packages/api` vs `apps/api` ownership; stop tracking build
artifacts (`apps/api/dist`, `coverage`, compiled `.js`) — add to `.gitignore`.
**Acceptance:** e2e + isolation tests in CI; no build artifacts tracked; boundary documented.
**Delivered:** `test/auth.e2e-spec.ts` (real JWT flow, 6 tests), `test/multi-tenant-isolation.e2e-spec.ts`
(real JWT + RLS, 5 tests), all e2e specs stabilised (unique slugs/emails, afterEach cleanup,
`isVerified: true` on seeded users). CI green on PR #1.

### Step 8 — Remaining operational modules (phased) ✅ DONE (2026-07-01)
Transport, library, health, HR/payroll, admissions, events — each got a Prisma
model + migration + explicit RLS policy + NestJS module (`@TenantScoped`
controller, permission-gated) + a real frontend surface (server component +
client island + Route Handler), replacing mock data or filling a nav stub.
Admissions landed first (2026-07-01 AM session); transport/library/health/
hr-payroll/events landed together the same day. `hr.view`/`payroll.view`/
`payroll.process` were added to the permission seed catalog (274 → 277) since
the Step 6 nav/layout already referenced `hr.view` but it didn't exist. This
closes the backend remediation plan — see `AI_HANDOFF.md`'s 2026-07-01 entries
for full detail per module.
