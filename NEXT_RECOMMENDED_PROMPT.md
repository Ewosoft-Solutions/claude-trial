# Next Recommended Prompt

> Kick off the next session by saying **"Read NEXT_RECOMMENDED_PROMPT.md"**. This file is the
> single hand-off prompt; it is kept in sync at the end of each session.
> `AI_HANDOFF.md` holds the full status / history this summarizes.

Phase 2 in progress: nav model wired to a real `ViewerContext` driven by a
server `getSession()` seam + the Next router; `/overview` dashboard live; real
product surfaces built on the M6 layouts + shared data-display (`StatusBadge` /
`ScheduleGrid` / `Meter`) — the full Students area, Attendance
(`/attendance/daily`), the Classes area (timetable · subjects · gradebook), the
Finance area (invoices · payments · reports), the Settings area, and now the
**Reports** area (`/reports/academic` · `/reports/analytics`). Every M6 layout
pattern is exercised in-app, and the `[...slug]` placeholder no longer backs any
shipped section. See the Phase 2 session summaries in `AI_HANDOFF.md`.

Latest session (2026-06-27 — Finance/billing domain, Step 5):
`FeeInvoice` + `Payment` Prisma models in new `finance` schema (tenant_id NOT NULL),
migration `20260627200000_finance_domain` (tables + indexes + RLS policy on both tables;
`app_runtime` grants). `rls-coverage-check.sql` updated to include `finance` schema.
NestJS `FinanceModule`: DTOs, `FinanceService` (RLS-scoped; listInvoices, createInvoice,
updateInvoice, invoiceSummary, listPayments, recordPayment — the last auto-updates invoice
`amountPaid`+`status`), `FinanceController` (`@TenantScoped`; GET/POST/PATCH /finance/invoices,
GET /finance/invoices/summary, GET /finance/invoices/:id, GET/POST /finance/payments).
Frontend `/finance/invoices` and `/finance/payments` refactored into server components +
client islands (`InvoicesClient` / `PaymentsClient`); Route Handlers `/api/finance/invoices`
and `/api/finance/payments` proxy to NestJS with httpOnly cookie Bearer. Mock fallback retained.
Verification: api build ✅ · web type-check ✅ · web lint ✅ · web build ✅. Pushed to origin/claude / PR #1.

Prior session (2026-06-27 — Attendance domain, Step 4):
Added `AttendanceRecord` Prisma model (student-management schema, tenant_id NOT NULL),
migration `20260627100000_attendance_domain` (table + indexes + explicit RLS policy —
`db:rls:check` passes). NestJS `AttendanceModule`: `BulkMarkAttendanceDto`, `AttendanceService`
(RLS-scoped client getter), `AttendanceController` (`@TenantScoped`; GET /attendance, GET
/attendance/summary, POST /attendance/bulk). Frontend `/attendance/daily` refactored into
server component (fetches classes/students/records via `lib/server-api.ts`) + `DailyRegisterClient`
(interactive state + save); Route Handlers `/api/attendance` (GET+POST) and `/api/students`
proxy to NestJS with httpOnly cookie Bearer. Mock fallback retained. Verification: `db:rls:check`
✅ · api build ✅ · web type-check ✅ · web lint ✅ · web build ✅. Pushed to origin/claude / PR #1.

Prior session (2026-06-27 — frontend↔backend auth slice, Step 3):
Closed the biggest architectural gap — `apps/web` now has a real auth flow
backed by `apps/api`. Added `schoolType` column to Tenant (migration
`20260627000000_tenant_school_type`). Extended `UserSchoolProfile` with
`schoolType`. Added `GET /auth/me` to `AuthController` (full Session-compatible
payload). In `apps/web`: `lib/api-client.ts` (typed fetch wrapper),
`lib/auth-cookies.ts` (httpOnly cookie helpers), Route Handlers
(`/api/auth/login` · `/api/auth/logout` · `/api/auth/refresh`), login page
(`app/(auth)/login/page.tsx`), real `getSession()` (reads cookie → `/auth/me`,
mock fallback in dev when `NEXT_PUBLIC_API_URL` unset), `(app)` layout
redirects to `/login` on no-session, 8-case contract test
(`lib/session.contract.test.ts`). `turbo.json` declares `NODE_ENV` +
`NEXT_PUBLIC_API_URL` in `globalEnv`. Verification: web check-types ✅ ·
web lint ✅ · web 21/21 ✅ · web build ✅ · api build ✅.

Prior session (2026-06-27 — CI pipeline, Step 2):
Added `.github/workflows/ci.yml` (Step 2). Pipeline: Postgres 16 service →
`migrate deploy` → `app_runtime` LOGIN grant → `db:rls:check` (gate fails on
unguarded tenant table) → type-check (`packages/database` / `apps/api` /
`apps/web`) → lint (`apps/api` / `apps/web`) → build (all three) → tests
(`packages/ui` vitest Node 22, `apps/web` vitest, `apps/api` jest unit +
e2e RLS isolation). RLS e2e specs run for real in CI (`APP_RUNTIME_DATABASE_URL`
wired); skip in envs without it. Node 22 satisfies `engines ≥20.19`. Committed
and pushed to `origin/claude`; lands in PR #1 automatically.

Prior session (2026-06-20 pt.3 — backend assessment + tenant isolation enforced):
Did a deep backend assessment (`apps/api` NestJS is a real auth/RBAC/academic
core) and **fixed the #1 gap — tenant data isolation was not actually enforced**.
Now enforced at the DB via **Postgres RLS on 23 tables** + a restricted
`app_runtime` role + an audited `app.is_platform` bypass, **proven** by
`packages/database/prisma/scripts/rls-isolation-check.sql` (cross-tenant
read/insert/update/delete all blocked). Also denormalized `tenant_id` onto child
tables (+ backfill), added tenant-leading composite indexes, parameterized the
RLS setter, hardened the `withTenant` extension (+11 unit tests), and made it a
**self-enforcing standard**: CI guard `db:rls:check` (fails the build on an
unguarded tenant table), `ALTER DEFAULT PRIVILEGES`, and `enforce_tenant_rls()`.
See `ARCHITECTURE_DECISIONS.md` ADR-004, `docs/tenant-isolation-plan.md`, and the
ordered **`docs/backend-remediation-plan.md`**.

Prior session (2026-06-20 pt.2 — chart-wrapper tests + DonutChart 2nd surface + StatGrid tests):
**(1)** Tested the last untested `packages/ui` family, the recharts chart
wrappers. Added a shared jsdom stub `packages/ui/src/test/recharts-mock.tsx`
(`withFixedResponsiveContainer` swaps recharts' `ResponsiveContainer` — which
measures via `ResizeObserver`, absent in jsdom — for a fixed 800×400 passthrough);
each chart test applies it via `vi.mock('recharts', …)`. New suites:
`donut-chart.test.tsx` (5), `trend-chart.test.tsx` (6), `category-bar-chart.test.tsx`
(5). **(2)** Gave `DonutChart` a **second** consumer: `/reports/analytics` now
shows an enrolment-by-level split; the page bottom was restructured (funnel
full-width, then a 2-col row of donut + capacity `Meter`). **(3)** Added
`custom/layouts/stat-grid.test.tsx` (8 — tile count, `minTileWidth`, div/link/button
render modes + `onSelect` click, `hint`, delta tone by intent + by direction).
UI now **72 tests** / 8 files.

> ⚠ The jsdom (component) suite requires **Node ≥20.19** — the same threshold the
> repo `engines` + the `@workspace/database` build already need. Run UI tests
> under `nvm` v22; the resolver + web suites still pass on the default 20.18.

**Git state:** branch `claude` is on `origin`
(`https://github.com/Ewosoft-Solutions/claude-trial.git`, HTTPS). All accumulated
Phase 2 work is **committed and pushed** to `origin/claude`. **PR #1 is OPEN**
(`claude` → `main`, https://github.com/Ewosoft-Solutions/claude-trial/pull/1) and
tracks the whole branch — its title/body were refreshed 2026-06-20 to cover the
Reports area, chart wrappers, DonutChart consumers, and the test suite. Push new
work to `claude` and it lands in PR #1 automatically; keep the PR body current.

Read first:

- AI_CONTEXT.md · AI_HANDOFF.md · CURRENT_PHASE.md (Phase 2)
- implementation-roadmap.md + requirements/ docs for the target area
- packages/ui/README.md (how to consume the foundation + Known Gaps)
- **`apps/api`** — the real NestJS backend (auth / RBAC / MFA / maker-checker /
  audit / tenant), DB-backed via `packages/database` (Prisma). The frontend does
  not consume it yet. (`packages/api` is a separate service *library* — not the
  HTTP app.)
- **`docs/backend-remediation-plan.md`** — the ordered backend steps (START HERE).
- **`ARCHITECTURE_DECISIONS.md` ADR-004** + `docs/tenant-isolation-plan.md` —
  tenant isolation design, the RLS standard, and the runtime-cutover runbook.

> ⚠ **Phase numbering is overloaded.** The internal roadmap / `CURRENT_PHASE.md`
> use Phase 1 = design-system foundation, Phase 2 = dashboard infra (where we are).
> The product `requirements/PRD.md` §11 uses different numbers (Phase 1 = core
> platform, Phase 2 = PWA/ops, Phase 3 = AI). Same word, different scales — say
> which when it matters.

Next tasks — work through **ALL** of `docs/backend-remediation-plan.md` in order.
This is the committed backend backlog, **not a pick-one menu**: complete each step
to its acceptance criteria, commit, then move to the next, until every gap is
closed. It is a multi-session effort — do not stop after one step.

1. ✅ **RLS runtime cutover (Step 1) — COMPLETE in code.** Two-client design
   (`TenantDbService.runScoped` on the app_runtime client + GUC + ALS), global
   `RlsTenantInterceptor` + `@TenantScoped`, scoped-or-privileged `client` getter;
   `PrismaTransactionService` reuses the request scope so transactional writes are
   RLS-enforced too. **All tenant-data services migrated** (communication,
   students, academic-structure, assessment-grading, reporting-analytics) + 9
   controllers `@TenantScoped`. Proven: DI 6/6 + HTTP 5/5; `db:rls:check` + build
   green. **Only remaining**: set `APP_RUNTIME_DATABASE_URL` (app_runtime role) in
   each deploy env — operational, documented in `env.*.template`.
2. ✅ **CI pipeline (Step 2) — COMPLETE.** `.github/workflows/ci.yml` added
   (Postgres 16 service, `migrate deploy`, `db:rls:check` gate, type-check / lint /
   build / tests for all three apps including e2e RLS isolation). Pushed to
   `origin/claude` / PR #1.
3. ✅ **Frontend↔backend auth slice (Step 3) — COMPLETE.** `GET /auth/me` added
   to api; Route Handlers + login page + real `getSession()` in web; contract
   test 8/8 ✅. Dev fallback mock retained when `NEXT_PUBLIC_API_URL` unset.
4. ✅ **Attendance domain (Step 4) — COMPLETE.** `AttendanceRecord` model + migration + RLS +
   `AttendanceModule` (NestJS) + `/attendance/daily` wired to real API (server component +
   client island + Route Handlers `/api/attendance` + `/api/students`). `db:rls:check` ✅.
5. ✅ **Finance/billing domain (Step 5) — COMPLETE.** `FeeInvoice` + `Payment` models + migration
   + RLS + `FinanceModule` (NestJS) + `/finance/invoices` and `/finance/payments` wired to real
   API (server components + client islands + Route Handlers). `db:rls:check` guard includes
   `finance` schema.
6. **Realize polymorphism (Step 6)** — `schoolType`-driven nav + feature-toggle backing.
7. **Backend tests + hygiene (Step 7)** — auth e2e, in-app isolation test,
   `packages/api`↔`apps/api` boundary, stop tracking build artifacts.
8. **Remaining operational modules (Step 8)** — transport/library/health/HR/
   admissions/events, phased; each follows the RLS checklist.

> ▶ **Next session: Step 6** — Realize polymorphism: `schoolType`-driven nav + feature-toggle
> backing. The `schoolType` column was added to `Tenant` in Step 3 migration
> `20260627000000_tenant_school_type` and is in `UserSchoolProfile`. Wire it into the nav
> visibility model so sections like Transport, HR, Library are shown/hidden per school type.

Definition of done for this backlog: Steps 1–7 complete (8 is phased), every gap
in the scorecard closed or explicitly deferred, `db:rls:check` + CI green.

Also ongoing: **keep PR #1 current** (`claude` → `main`, open, tracks the branch)
and refresh its body when you push notable work.

Parallel/independent UI option (not backend): more `packages/ui` coverage —
page-level resolution in `apps/web` or shell/layout components (`PageHeader`,
`AppShell`, `SettingsLayout`, `DashboardLayout`); reuse the jsdom recharts stub
`packages/ui/src/test/recharts-mock.tsx`.

Requirements:

- Reuse `packages/ui` components; build new shared UI in `packages/ui` first.
- Pass type-check, lint, and build before considering complete.
- Update `AI_HANDOFF.md` when done, and refresh this `NEXT_RECOMMENDED_PROMPT.md`.

Note: the preview launcher is blocked by macOS TCC (see Known Issues). The
default `web` launch config serves a self-contained build from `/tmp` on **port
3013**; after editing source, rebuild + re-copy to `/tmp` and restart
`preview_start web` (steps in Known Issues), or grant Documents access and use
`web-pnpm`. Infra caveats that persist and are NOT from this work:
`pnpm --filter @workspace/ui lint` fails on a stale `eslint` symlink
(`eslint@9.39.1` linked but `9.39.4` installed — UI source is covered by `tsc`);
and `pnpm build` (turbo, whole repo) fails on `@workspace/database` (Prisma
`ERR_REQUIRE_ESM` under Node 20.18 < required 20.19) — build `apps/web` directly
instead. **Run tests under Node ≥20.19** (e.g. `nvm` v22): the `@workspace/ui`
jsdom suite needs it (so does the repo `engines`); the one `apps/api` Jest
failure (`permission.service.spec.ts`) is pre-existing and unrelated.
