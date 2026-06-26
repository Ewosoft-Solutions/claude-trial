# Backend Remediation Plan — sequential steps

> **Goal: fix them ALL.** Work top to bottom, completing each step to its
> acceptance criteria before starting the next; this is the committed backlog, not
> a pick-one menu. Definition of done: Steps 1–7 complete (Step 8 is phased), every
> scorecard gap closed or explicitly deferred, `db:rls:check` + CI green.
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
8. **Other operational modules** (transport, library, health, HR, admissions,
   events) — unmodeled; intentionally phased, lowest priority.

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

### Step 7 — Backend tests + boundary/hygiene cleanup
**Do:** auth-flow e2e; in-app cross-tenant isolation test (using `app_runtime`);
document/realign `packages/api` vs `apps/api` ownership; stop tracking build
artifacts (`apps/api/dist`, `coverage`, compiled `.js`) — add to `.gitignore`.
**Acceptance:** e2e + isolation tests in CI; no build artifacts tracked; boundary documented.

### Step 8+ — Remaining operational modules (phased)
Transport, library, health, HR/payroll, admissions, events — model + API as the
roadmap reaches them. Each follows the RLS checklist.
