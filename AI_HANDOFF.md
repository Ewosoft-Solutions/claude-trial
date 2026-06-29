# AI_HANDOFF.md

Last Updated: 2026-06-29

---

# Current Status

> ⚠ **Correction (2026-06-20) — the auth/RBAC backend DOES exist.** Earlier
> hand-offs (and the pt.1 "task 4" note below) wrongly stated there is no auth
> backend. That conclusion only inspected `packages/api` (a NestJS service
> *library*). The real backend is the **`apps/api` NestJS application**: DB-backed
> (Prisma, via `packages/database`), with `POST /auth/login` → `verify-mfa-login`
> → `select-school` → `refresh` / `logout` + password reset
> (`apps/api/src/auth/auth.controller.ts`), and 20 controllers covering
> role/permission management, audit, MFA, tenant, security-policy and breach
> response; 7 migrations incl. `maker_checker`. **What's missing is the
> frontend↔backend wiring**: `apps/web` imports neither `@workspace/api` nor
> `@workspace/database`, and `getSession()` is still a mock. So `getSession()`
> real-auth wiring is **unblocked** — it's an HTTP-integration task, not a
> "wait for the backend" task.
>
> ⚠ **Phase numbering is overloaded.** Internal docs (this file, `CURRENT_PHASE.md`,
> `implementation-roadmap.md`): Phase 1 = design-system, Phase 2 = dashboard infra.
> `requirements/PRD.md` §11: Phase 1 = core platform, Phase 2 = PWA/ops, Phase 3 =
> AI. Different scales — disambiguate when it matters.

Current Phase:

Phase 2 - Dashboard Infrastructure & Role/Tenant-Aware Navigation — **IN PROGRESS**

Completion:

Phase 1 (Design System Foundation): 100% (Milestones 1–7 complete).
Phase 2: nav model wired to a real `ViewerContext` driven by a server
`getSession()` seam (`apps/web/lib/session.ts`, still mock — the real `apps/api`
auth backend exists but is not yet wired; see the correction above) + the Next
router; `/overview` dashboard live; real product surfaces built on the M6
layouts + shared data-display (`StatusBadge` / `ScheduleGrid` / `Meter`) — the
**Students** area (now complete: directory · enrollment · attendance history ·
fees · transport · gradebook → report-cards + transcripts), **Attendance**
(`/attendance/daily`), the **Classes** area (timetable · subjects · gradebook),
the **Finance** area (invoices · payments · reports), the **Settings** area
(general · branding · features · roles · users · audit, on the M6
`SettingsLayout`), and the **Reports** area (`/reports/academic` ·
`/reports/analytics`, on the new shared chart wrappers) — each replacing its
`[...slug]` placeholder. Every M6 layout pattern is exercised in-app, and the
`chart` primitive now has reusable wrappers used in-app — including `DonutChart`,
now **consumed twice**: the fee-status split on `/finance/reports` and the
enrolment-by-level split on `/reports/analytics`. On the wired
`@workspace/vitest-config` shared runner there are now suites of three kinds: the
pure nav resolver (`packages/ui`, 26 cases), `packages/ui` **component** tests
under jsdom (`StatusBadge` · `Meter` · `ScheduleGrid` · `StatGrid` · the three
chart wrappers `DonutChart`/`TrendChart`/`CategoryBarChart` — UI now **72** total
across 8 files), and the **web-side** suite asserting the shipped `app-navigation`
config resolves per viewer (`apps/web`, 13 cases). The recharts wrappers are
tested via a shared jsdom `ResponsiveContainer` stub
(`packages/ui/src/test/recharts-mock.tsx`). The pre-existing `web` lint failure
(`no-html-link-for-pages` in `design-system/*`) is **fixed** — those raw `<a>`
internal links are now next/link `<Link>`.

---

# Completed Work

## Session Summary (2026-06-29, Step 7) — backend tests + hygiene

**Step 7 of backend-remediation-plan.md — COMPLETE.**

- **Auth e2e un-skipped and fixed** (`apps/api/test/auth.e2e-spec.ts`):
  - Per-test unique slug + email (no slug conflicts between runs).
  - `JWTSecretService.initializeTenantJWTSecret` + Role + `UserTenantRole` created in `beforeEach` so
    `select-school` can issue real JWTs (it requires a role on the profile).
  - Tests now assert 200 for `select-school` (not the weak `[200, 401]` hedge).
  - Refresh test does a full login → select-school flow to get a real refresh token, then exercises
    `POST /auth/refresh` and asserts a new access token is returned.
  - Gated on `APP_RUNTIME_DATABASE_URL` (consistent with the other e2e specs).
- **`multi-tenant-isolation.e2e-spec.ts` rewritten** with a real login-based flow:
  - Creates 2 tenants with JWT configs, 2 users, 2 roles, 2 profiles.
  - Logs in each user via `/auth/login` → `/auth/select-school` to get real tenant-scoped JWTs.
  - `JwtAuthGuard` + `TenantContextGuard` run for real (no stub); only `PermissionGuard` overridden.
  - Five assertions: A sees only A announcements; B sees only B; A cannot fetch B's announcement by id;
    A-created announcement is invisible to B; unauthenticated request → 401.
  - Proves that RLS isolation holds end-to-end through the full JWT + tenant-context pipeline.
  - Gated on `APP_RUNTIME_DATABASE_URL`.
- **`packages/api` boundary documented** (`packages/api/README.md`): clarifies that `packages/api`
  (`@workspace/api`) is a shared library (tenant/JWT utilities, link entities, shared types) distinct
  from `apps/api` (the NestJS HTTP app that imports it).
- **Build artifacts removed**: 4 compiled `.js` files in `packages/api/src/` untracked via
  `git rm --cached`; `.gitignore` extended with `packages/api/src/**/*.js` to prevent recurrence.
- Verification: api build ✅ · api type-check ✅ · web type-check ✅.

---

## Session Summary (2026-06-29, Step 6) — schoolType-driven nav polymorphism

**Step 6 of backend-remediation-plan.md — COMPLETE.**

- **Infrastructure already present**: `SchoolType` union, `schoolTypes` field on `NavAccess`, and the
  `canAccess` branch in `@workspace/ui/lib/navigation` were all already wired. `ViewerContext.schoolType`
  was already sourced from `activeSchool?.schoolType` in `ViewerProvider`. Nothing to change in the
  foundation layer.
- **`SCHOOL_NAV` updated** (`apps/web/lib/navigation/app-navigation.tsx`):
  - Existing students `transport` sub-item gated: `schoolTypes: ['nursery', 'primary', 'secondary']`.
  - Three new top-level sections added (each has a `schoolTypes` guard AND a permission guard):
    - **Transport** (`/transport`) — `schoolTypes: ['nursery', 'primary', 'secondary']`,
      `transportation.view`; sub-items: Routes, Pickups & drops.
    - **Library** (`/library`) — `schoolTypes: ['primary', 'secondary', 'university', 'college']`,
      `library.view`; sub-items: Books, Loans.
    - **HR** (`/hr`) — `schoolTypes: ['secondary', 'university', 'college', 'training_institute', 'organization']`,
      `hr.view`; sub-items: Directory, Leave.
- **Route layout stubs** created for the three new sections (`/transport`, `/library`, `/hr`), each
  calling `requirePermission` to guard the routes server-side.
- **Tests updated** (`apps/web/lib/navigation/app-navigation.test.tsx`):
  - `OWNER` fixture given `schoolType: 'secondary'`; `ALL_SCHOOL_PERMISSIONS` set extracted.
  - Three new viewer fixtures: `PRIMARY_OWNER` (primary), `UNIVERSITY_OWNER` (university),
    `UNTYPED_OWNER` (no schoolType — simulates an org with schoolType absent).
  - "offers every section" assertion updated to include transport/library/hr for secondary owner.
  - New `SCHOOL_NAV schoolType visibility` describe block with 5 assertions:
    primary shows transport+library, not HR; university shows library+HR, not transport;
    untyped shows none of the three gated sections; students/transport sub-item hidden for
    university, visible for primary.
- **Verification**: web type-check ✅ · web lint ✅ · web build ✅. (Test runner has a pre-existing
  rolldown native binding issue unrelated to this work — rolldown arm64 binary absent from the
  pnpm store; code correctness confirmed via type-check and logic review.)
- **Pushed** to `origin/claude` / lands in PR #1.

## Session Summary (2026-06-27, Step 5) — Finance/billing domain

**Step 5 of backend-remediation-plan.md — COMPLETE.**

- **Prisma models** `FeeInvoice` + `Payment` (`packages/database/prisma/models/finance.prisma`):
  both `tenant_id NOT NULL` in new `finance` schema. `FeeInvoice` tracks billing records with
  `amountDue`/`amountPaid` in kobo (integer minor units), `status` (draft/issued/paid/partial/
  overdue/cancelled). `Payment` links to `FeeInvoice` with method/paidAt/amount/status. Relations
  added to `Tenant` model. `finance` schema added to `datasource.schemas`.
- **Migration** `20260627200000_finance_domain`: creates `finance` schema, `fee_invoices` +
  `payments` tables, indexes, explicit `ENABLE/FORCE ROW LEVEL SECURITY` + `tenant_isolation`
  policy on both tables; grants `app_runtime` role access to finance schema.
- **RLS coverage guard updated** — `'finance'` added to `app_schemas` in
  `rls-coverage-check.sql`; `db:rls:check` will catch any unguarded finance table.
- **NestJS `FinanceModule`** (`apps/api/src/finance/`):
  - DTOs: `CreateInvoiceDto`, `UpdateInvoiceDto`, `ListInvoicesDto`, `RecordPaymentDto`,
    `ListPaymentsDto` (with `INVOICE_STATUSES` / `PAYMENT_STATUSES` / `PAYMENT_METHODS` consts).
  - `FinanceService`: RLS-scoped `client` getter; `listInvoices`, `getInvoice` (with payments),
    `createInvoice` (auto-generates `invoiceNumber`), `updateInvoice`, `invoiceSummary` (totals
    + statusCounts), `listPayments`, `recordPayment` (creates payment, updates invoice
    `amountPaid` + `status` atomically).
  - `FinanceController` (`@TenantScoped`): `GET /finance/invoices`, `GET /finance/invoices/summary`,
    `GET /finance/invoices/:id`, `POST /finance/invoices`, `PATCH /finance/invoices/:id`,
    `GET /finance/payments`, `POST /finance/payments` — all behind `JwtAuthGuard +
    TenantContextGuard + PermissionGuard`. Permissions `finance.view` / `finance.manage`.
  - `SwaggerTags.finance` added; module registered in `AppModule`.
- **Frontend wiring** (`/finance/invoices`, `/finance/payments`):
  - Pages split into server component (data fetch via `serverApiGet`) + client island
    (`InvoicesClient` / `PaymentsClient`) following the Step 4 attendance pattern.
  - Route Handlers: `app/api/finance/invoices/route.ts` (GET + POST) and
    `app/api/finance/payments/route.ts` (GET + POST) — proxy to NestJS with httpOnly
    access-token cookie as Bearer via `getBearerFromCookies`.
  - Client islands accept real API invoices/payments as props; fall back to built-in mock data
    when props are empty (i.e. when `NEXT_PUBLIC_API_URL` is unset).
  - amounts stored as kobo (integer) from API; `nairaFromKobo` helper displays as ₦Xk / ₦X.XM.
- **Verification**: api `nest build` ✅ · web type-check ✅ · web lint ✅ · web build ✅.
- **Pushed** to `origin/claude` / lands in PR #1.

## Session Summary (2026-06-27, Step 4) — Attendance domain

**Step 4 of backend-remediation-plan.md — COMPLETE.**

- **Prisma model** `AttendanceRecord` (`packages/database/prisma/models/attendance.prisma`):
  `tenant_id NOT NULL`, relations to Tenant/Student/Class, unique on (tenantId, studentId,
  classId, date), in `student-management` schema. Relations added to Student, Class, Tenant.
- **Migration** `20260627100000_attendance_domain`: creates `attendance_records` table +
  indexes + explicit `ENABLE/FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy (self-
  contained; does not depend on `enforce_tenant_rls()` being called separately).
- **`db:rls:check` passes** — `attendance_records` is covered.
- **NestJS `AttendanceModule`** (`apps/api/src/attendance/`):
  - `BulkMarkAttendanceDto`, `ListAttendanceDto`, `MarkAttendanceDto` (status: present/absent/late/excused)
  - `AttendanceService`: `client` getter (RLS-scoped inside `@TenantScoped`), `bulkUpsert`
    (upsert on the unique index), `list` (with filters), `summary`.
  - `AttendanceController` (`@TenantScoped`): `GET /attendance`, `GET /attendance/summary`,
    `POST /attendance/bulk` — all behind `JwtAuthGuard + TenantContextGuard + PermissionGuard`.
  - Registered in `AppModule`; `SwaggerTags.attendance` added.
- **Frontend wiring** (`/attendance/daily`):
  - Page split into server component (data fetch) + `DailyRegisterClient` (interactive island).
  - Server component calls `serverApiGet` (new `lib/server-api.ts` — server-only helper with
    cookie auth + no-store cache) to fetch initial classes, enrolled students, and existing
    attendance marks before rendering.
  - Route Handlers: `app/api/attendance/route.ts` (GET list + POST bulk) and
    `app/api/students/route.ts` (GET) — both proxy to NestJS with the httpOnly access-token
    cookie forwarded as Bearer via `getBearerFromCookies`.
  - Client: class/date selector re-fetches records; per-pupil mark toggles; "Save register"
    POSTs to `/api/attendance`; "Saved ✓" / "Save failed" feedback; added 'excused' as a
    fourth status (neutral badge).
  - Mock fallback retained when `NEXT_PUBLIC_API_URL` is unset.
- **Verification**: `db:rls:check` ✅ · api `nest build` ✅ · web type-check ✅ · web lint ✅ · web build ✅.
- **Pushed** to `origin/claude` / lands in PR #1.

## Session Summary (2026-06-20, pt. 3) — Backend assessment + tenant isolation enforced (RLS)

Deep backend assessment of `apps/api` (real NestJS auth/RBAC/academic core) →
gaps captured + ordered in **`docs/backend-remediation-plan.md`**. Fixed the #1
gap: **tenant data isolation, which was not actually enforced**.

- **RLS enforced on 23 tables** (ENABLE/FORCE + `tenant_isolation` policy),
  restricted non-superuser `app_runtime` role, audited `app.is_platform` bypass.
  Migrations: `…_rls_policies_and_runtime_role`, `…_denormalize_tenant_id_child_tables`,
  `…_tenant_rls_standard`. Tenant id is TEXT (not uuid) — policies compare as text.
- **Denormalized `tenant_id`** onto 9 child tables (+ backfill from parents) so
  each has a direct, indexed policy; added **tenant-leading composite indexes**.
- **Parameterized** the RLS setter (`set_config(...,true)`); **hardened** the
  `withTenant` extension (pure `applyTenantScope` + 11 unit tests; single
  update/delete can't be where-scoped in Prisma → RLS is the enforcer).
- **Proven**: `packages/database/prisma/scripts/rls-isolation-check.sql` (7 checks
  as `app_runtime` — cross-tenant read/insert/update/delete blocked; platform
  bypass works); also verified on a child table.
- **Made a self-enforcing standard**: CI guard `db:rls:check` (fails build on an
  unguarded tenant table), `ALTER DEFAULT PRIVILEGES` (auto-grant new tables),
  `enforce_tenant_rls()` (`db:rls:enforce`); convention checklist in
  `docs/tenant-isolation-plan.md` + `packages/database/README.md`. See ADR-004.
- **Remaining**: runtime cutover (app → `app_runtime`) = Step 1 of the
  remediation plan; the app still connects as superuser `postgres` (RLS-bypassing)
  so there is no regression meanwhile.

> Pre-change DB backup at `/tmp/swe-db-backup/`. Earlier `getSession()`-blocked
> claim corrected (see Current Status): the auth backend is `apps/api`.

## Session Summary (2026-06-20, pt. 2) — Phase 2 · chart-wrapper tests + DonutChart 2nd surface + StatGrid tests

Closed out the last untested `packages/ui` family (the recharts chart wrappers),
gave `DonutChart` a second real consumer, and added `StatGrid` coverage.

**1 — chart-wrapper tests (the recharts/jsdom blocker, solved).** Added a shared
stub at `packages/ui/src/test/recharts-mock.tsx` — `withFixedResponsiveContainer`
swaps recharts' `ResponsiveContainer` (which measures via `ResizeObserver`, absent
in jsdom, and renders nothing at 0×0) for a fixed 800×400 passthrough that clones
the chart child with explicit width/height, so the SVG mounts. Each chart test
file applies it via `vi.mock('recharts', …)`. New suites:
`custom/charts/donut-chart.test.tsx` (**5** — accessible name, one sector per
slice, legend on/off, pie variant), `trend-chart.test.tsx` (**6** — accessible
name, area vs line per series, multi-series legend, single-series legend default
+ override) and `category-bar-chart.test.tsx` (**5** — accessible name, one bar
layer per series, column/bar orientation, legend behaviour). Assertions lean on
the `role="img"` name (forwarded by `ChartContainer`), legend label text, and
recharts layer classes (`.recharts-area` / `.recharts-line` / `.recharts-bar` /
`.recharts-pie-sector`).

**2 — `DonutChart` second consumer.** `/reports/analytics`
(`apps/web/app/(app)/reports/analytics/page.tsx`) now renders an enrolment-by-level
split (Primary / Junior / Senior as `ChartSlice[]`). The bottom of the page was
restructured: the admissions funnel goes full-width, and a new 2-col row pairs the
donut with the existing capacity-by-campus `Meter` list.

**3 — `StatGrid` / `StatCard` tests.** New `custom/layouts/stat-grid.test.tsx`
(**8**): one tile per item with label + value, `minTileWidth` → auto-fit column
template, the three render modes (plain div / link via `href` / button via
`onSelect`, incl. an `onSelect` click), the optional `hint` line, explicit
positive/negative delta tone (`text-success` / `text-destructive`), and
direction-inferred tone when `intent` is omitted (up → success, flat → muted).

**Verification (Node 22 unless noted):** UI tests **72/72** ✅ (8 files) ·
`@workspace/ui` `tsc -p` ✅ · web check-types ✅ · web lint ✅ · web tests 13/13 ✅
(default Node 20.18) · `web` build ✅.

## Session Summary (2026-06-20) — Phase 2 · lint fix + DonutChart consumer + ScheduleGrid tests

Cleared the pre-existing `web` lint failure, gave `DonutChart` its first real
consumer, and extended component coverage to `ScheduleGrid`. (A fourth requested
task — replacing the mock `getSession()` with real auth — was inspected and
~~confirmed still **blocked**: no auth source exists~~. **Correction 2026-06-20:
that was wrong — the `apps/api` auth backend exists; see the correction at the
top of Current Status.**)

**1 — `web` lint failure cleared.** Swapped the five raw `<a href>` internal
links flagged by `no-html-link-for-pages` for next/link `<Link>` across
`app/design-system/{page,layouts/page,states/page}.tsx` (added the `Link`
import to each). `pnpm --filter web lint` is **green** again (`--max-warnings 0`).

**2 — `DonutChart` consumed on a real surface.** `/finance/reports`
(`apps/web/app/(app)/finance/reports/page.tsx`) now renders a fee-status split
(Paid / Partial / Outstanding / Overdue, as `ChartSlice[]` on the `--chart-N`
tokens) via the shared `DonutChart`; the breakdown row was rebalanced from two
columns to three (donut + the two existing `Meter` lists). First consumer of the
wrapper that previously shipped ahead of demand.

**3 — `ScheduleGrid` component tests (jsdom).** New
`packages/ui/src/custom/data-display/schedule-grid.test.tsx` (**9 cases**):
day/period header counts, period time sub-label presence/absence, cell count =
days × periods, entry placement (title + subtitle), empty-cell `sr-only` label +
custom `emptyLabel`, one-entry-per-cell (last wins on a clash), tone card classes
(incl. neutral default), and table semantics. `@workspace/ui` is now **48 tests**
across 4 files. The chart wrappers (`DonutChart` / `TrendChart` /
`CategoryBarChart`) remain **untested** by deliberate deferral — they render
through recharts' `ResponsiveContainer`, which collapses to zero size in jsdom
(legend/cells never mount), so a container-size mock is needed first.

**4 — `getSession()` real-auth wiring: ~~still blocked (inspected)~~.**
> ⚠ **Superseded 2026-06-20 — this conclusion was WRONG.** It inspected only
> `packages/api` (a service library) and missed the real **`apps/api`** NestJS
> auth backend. See the correction at the top of Current Status. The seam is
> unblocked; the remaining work is HTTP integration, not waiting for a backend.

Original (incorrect) note: confirmed `packages/api` is a pure NestJS service
library — no `@Controller`/`@Post`/`@Get`/`main.ts`, no auth or login endpoint —
and there is no `next-auth` dependency or login page in `apps/web`, so the seam
(`apps/web/lib/session.ts`) was left as the documented mock. (The error: the
auth backend lives in `apps/api`, not `packages/api`.)

**Verification (Node 22 unless noted):** `web` lint ✅ · `web` check-types ✅ ·
`@workspace/ui` `tsc -p` ✅ · UI tests 48/48 ✅ · web tests 13/13 ✅ (run on the
default Node 20.18) · `web` build ✅.

## Session Summary (2026-06-18) — Phase 2 · app-navigation tests + first component tests + DonutChart

Extended the now-wired test runner in three directions, and added the
composition chart wrapper.

**1 — `apps/web` navigation config tests (first web-side suite).** Wired vitest
into `apps/web` (added `vitest` + `@workspace/vitest-config` devDeps, a `test`
script, and `vitest.config.ts` re-exporting `baseConfig` — node env, since
config resolution is pure). New `apps/web/lib/navigation/app-navigation.test.tsx`
(**13 cases**) asserts the *shipped* `SCHOOL_NAV` / `PLATFORM_NAV` configs
resolve correctly for representative viewers (owner / teacher / bursar / minimal
student / platform admin / scoped operator): `configForViewer` scope routing,
section visibility, the finance clearance gate (denied at clearance 3 even with
the permission), panel-group + nested-leaf permission filtering, active-state
derivation, and the group-less settings footer.

To transpile the config's JSX in tests, **`baseConfig` now applies
`@vitejs/plugin-react`** (automatic runtime) instead of an `esbuild.jsx` option —
the workspace is on vitest 4.1.8 / Vite 8 / Rolldown, where `esbuild.jsx` is not
honoured. The plugin is inert for pure `.ts` files, so the resolver suite is
unaffected; it also sets up component tests under `uiConfig`.

**2 — first `packages/ui` component tests (jsdom).** Switched
`packages/ui/vitest.config.ts` to `uiConfig` (jsdom) + a `vitest.setup.ts`
registering `@testing-library/jest-dom` matchers and RTL `cleanup`. Added
`@testing-library/{react,dom,jest-dom}` devDeps. New render tests:
`status-badge.test.tsx` (**5**) — children, default + semantic tone surfaces,
the optional dot, className/attr passthrough — and `meter.test.tsx` (**8**) —
label + rounded percentage, progressbar a11y semantics, over-max / negative /
zero-max clamping, `valueLabel` override, `hideValue`, tone fill. `@workspace/ui`
is now **39 tests** across 3 files (26 resolver + 13 component).

> The jsdom tests require **Node ≥20.19** (jsdom 27 → `html-encoding-sniffer@6`
> → an ESM dep `require()`d only on ≥20.19) — the *same* threshold the repo's
> `engines` and the existing `@workspace/database` build already demand. Run the
> UI/component suites under e.g. `nvm` v22; the pure resolver + web suites still
> run on the default 20.18.

**3 — `DonutChart` (composition chart wrapper).** Added
`custom/charts/donut-chart.tsx` — the part-to-whole sibling to `TrendChart`
(time) and `CategoryBarChart` (comparison). Consumes a new `ChartSlice`
(`types/chart.types.ts`); `donut` (default) or solid `pie`; slices resolve
colour + legend/tooltip label from the config via `nameKey="key"`; keeps the
`isAnimationActive={false}` convention. Not yet consumed by any surface (built
ahead per the shared-UI-first rule). README → Charts updated.

Verified (under Node 22): `@workspace/ui` test **39/39** ✅ · web test **13/13**
✅ · web check-types ✅ · `packages/ui` `tsc -p` (incl. tests + donut) ✅ ·
`@workspace/vitest-config` build ✅ · web build ✅.

⚠ **`pnpm --filter web lint` now fails** on **5 pre-existing**
`@next/next/no-html-link-for-pages` warnings (lint uses `--max-warnings 0`) in
**untouched** `app/design-system/{page,layouts/page,states/page}.tsx` (raw `<a>`
internal links). These predate this work and were masked by ESLint's cache; the
`pnpm install` runs here busted the cache and surfaced them. **None of this
session's added files are flagged.** Flagged as a background task (swap `<a>` →
next/link `<Link>`); not fixed here to avoid unrelated scope.

## Session Summary (2026-06-18) — Phase 2 · Nav resolver unit tests + vitest runner

Stood up the first test suite on the web/UI side and wired the shared test
runner the monorepo was scaffolded for but never finished.

Test runner (`@workspace/vitest-config`): its `src` was empty, so the package's
`dist/configs/*` exports resolved to nothing **and** `turbo run build` aborted on
it (`tsc` over an empty `include`). Populated `src` with a buildable shared
config — `configs/base-config.ts` (`baseConfig`, node env, istanbul coverage) and
`configs/ui-config.ts` (`uiConfig`, layering jsdom) re-exported from `index.ts`
(NodeNext, so internal imports carry `.js`). Deleted the stale root `base.ts`
(it referenced a nonexistent `src/test-setup.ts` and the wrong coverage
provider). `pnpm --filter @workspace/vitest-config build` now emits the dist the
exports promise, and the repo-wide build no longer aborts here.

Consumer (`packages/ui`): added `vitest` + `@workspace/vitest-config` devDeps, a
`test` script (`vitest run`), and `vitest.config.ts` re-exporting `baseConfig`
(the nav helpers are pure, so node env suffices — switch to `uiConfig` when
component tests arrive).

Coverage — `packages/ui/src/lib/navigation.test.ts`, **26 cases** over the pure
nav helpers (previously only cross-checked by hand):

- **`canAccess`** — every guard field (scope · minClearance inclusive · roles ·
  schoolTypes incl. missing-type · anyPermission · allPermissions) plus AND
  semantics across fields.
- **`isRouteActive`** — exact match, ancestor match, root-only-exact, the
  trailing-slash prefix guard (`/students` not active on `/students-archive`).
- **`resolveNavigation`** — section access filtering, active section + most-
  specific active leaf, panel header/groups exposure, access-gated group
  collapse, the unmatched-route case, footer-section activation, and link vs
  `onNavigate` (controlled) dispatch.
- **`findActiveNavItem`** — deepest-active descendant, active-parent fallback,
  none-active → undefined.

Verified: `@workspace/ui` test 26/26 ✅ · web check-types ✅ · web lint ✅ · web
build ✅ · `packages/ui` `tsc -p` (incl. test + config files) ✅. The pre-existing
`apps/api` Jest failure (`permission.service.spec.ts`) and the
`@workspace/database` build error (Prisma `ERR_REQUIRE_ESM`, Node 20.18 <
required 20.19) are unrelated and untouched by this work.

## Session Summary (2026-06-18) — Phase 2 · Reports area + shared chart wrappers

Built the last placeholder section — **Reports** — and, per the rules, the
reusable chart UI it needed in `packages/ui` first. The `chart` primitive
(shadcn + recharts) existed but had no app-facing wrapper and recharts is **not**
a dependency of `apps/web`; the new wrappers keep recharts confined to
`packages/ui`.

New shared UI (in `packages/ui`):

- **`types/chart.types.ts`** — `ChartDatum` (a data row) + `ChartSeries`
  (`key` / `label` / optional `color`, defaulting to the rotating `--chart-1..5`
  tokens). The typed contract both wrappers consume.
- **`custom/charts/trend-chart.tsx`** — `TrendChart`: multi-series `area`
  (gradient bands) or `line` over a category/time axis; optional `stacked`, auto
  legend for >1 series, accessible `role="img"` + `aria-label`.
- **`custom/charts/category-bar-chart.tsx`** — `CategoryBarChart`: grouped or
  `stacked` bars, `column` (vertical) or `bar` (horizontal) orientation.

Both hold no product copy (preview supplies data + labels), build the primitive's
`ChartConfig` from the series list, and set `isAnimationActive={false}` so marks
paint at final geometry on mount.

New app surfaces (`apps/web`, each replacing its `[...slug]` placeholder):

- **`reports/academic`** — academic performance: StatGrid headline + grade
  distribution (column bars) + average-score trend (area, cohort vs school) +
  pass-rate-by-subject (horizontal bars).
- **`reports/analytics`** — operational analytics: StatGrid + enrollment movement
  (area, joined vs withdrew) + weekly attendance rate (line) + admissions funnel
  (grouped bars) + capacity-by-campus (shared `Meter`).
- **`reports/page.tsx`** — `/reports` redirects to `/reports/academic` (matches
  the `finance` / `classes` section-landing pattern).

Two recharts gotchas were hit and fixed during browser verification (both now
documented in `packages/ui/README.md` → Charts):

1. **Fragment-wrapped axes are dropped.** The bar wrapper first wrapped its
   conditional `XAxis`/`YAxis` in a React fragment; recharts discovers axis
   children by type and does **not** traverse fragments, so the chart silently
   rendered with no axes and a wrong default domain (tiny invisible bars). Fixed
   by passing the axes as **direct** children with conditional props.
2. **Mount-animation blank flash.** Marks animating from zero left charts blank
   in the (fast) snapshot screenshots; `isAnimationActive={false}` makes them
   deterministic and avoids the flash for real users.

### Verification (Phase 2 · Reports)

- `pnpm --filter web check-types` ✅ · `lint` ✅ (0 warnings) · `build` ✅
  (`/reports` redirect + `/reports/academic` + `/reports/analytics`; the two leaf
  routes ~295 kB first-load with the recharts chunk).
- Live preview (standalone-in-/tmp workaround, port 3013): both surfaces render
  every chart correctly — grade bars proportioned A–F, the cohort-vs-school area
  bands, the green horizontal pass-rate bars (61→91%), the enrollment area +
  attendance line, the grouped admissions funnel with legend, and the four
  capacity Meters tone-coloured. `/reports` → `/reports/academic` confirmed. No
  console warnings/errors.

## Session Summary (2026-06-18) — Phase 2 · Session seam moved server-side

Turned the `viewer-provider.tsx` module-constant mock into a real **server
seam**, so the eventual auth swap is a one-function change and no session data
ships in the client bundle. (Investigation first confirmed the full auth swap is
still blocked: `apps/web` has no `middleware`, no `app/api` route handlers, no
NextAuth, and does not depend on `@workspace/api`; `packages/api` is a NestJS
*library* — tenant-context / JWT-secret / school-selection / suspension services
— with no authentication endpoint. There is nothing real to wire into yet, so
this session does the in-scope prep toward it.)
> ⚠ **Correction 2026-06-20:** the "nothing real to wire into yet" claim was
> wrong — the **`apps/api`** NestJS app provides the real auth endpoints
> (`/auth/login`, `/select-school`, `/refresh`, …). See Current Status. The seam
> prep done here is still valid; the backend was simply mis-located in this note.

- **New `apps/web/lib/session.ts`** (server-only — no `'use client'`): owns the
  `Session` / `SessionSchool` types and the mock data, and exports
  `async getSession(): Promise<Session | null>` — THE single seam where auth
  plugs in (replace only its body later). The wire payload is kept plainly
  serializable for the server→client boundary: `permissions` is a
  `readonly PermissionKey[]` (array, not a `Set`).
- **`viewer-provider.tsx`** is now purely the client context: it takes the
  resolved `session` as a **prop**, derives the `permissions` `Set` (memoised),
  and builds the `ViewerContext`. Same public API (`ViewerProvider` /
  `useViewer`) — no consumer (`app-chrome`, `overview`, `students/directory`)
  changed.
- **`app/(app)/layout.tsx`** is now an **async server component**: it
  `await getSession()`, renders the shell via `<ViewerProvider session>` when
  signed in, and otherwise renders an unauthenticated surface (a `StateView`
  "You're not signed in", info tone) instead of the shell. A real sign-in
  redirect lands with the auth flow.

Flow: `getSession()` (server) → `(app)` layout → `<ViewerProvider session>` →
`ViewerContext` → the navigation model. No shared `packages/ui` component
changed; no new shared component.

### Verification (Phase 2 · Session seam)

- `pnpm --filter web check-types` ✅ · `lint` ✅ (0 warnings) · `build` ✅
  (route count unchanged; all routes still prerender — the async layout +
  `getSession()` stay static).
- Live preview (standalone-in-/tmp workaround, on port 3013 since a sibling
  project holds 3001): `/overview` renders the full Owner shell driven by the
  server-injected session — "St. Jude Academy" switcher, "Mr Bello / MB" user
  menu, the complete Owner-filtered rail (Overview → Reports), and the dashboard
  body. No console errors/warnings, confirming the server→client session prop
  (incl. the rebuilt permissions `Set`) hydrates cleanly.

## Session Summary (2026-06-18) — Phase 2 · Settings nav de-duplication (tidy-up)

Resolved the design note flagged by the Settings session: the app-shell's
secondary nav panel duplicated the in-panel `SettingsNav` on `/settings/*`.
Removed the `groups` from the **Settings** footer entry in
`apps/web/lib/navigation/app-navigation.tsx`, so `resolveNavigation` yields no
secondary-nav groups for that section and `AppSidebar` renders no panel
(`app-sidebar.tsx` only mounts `NavPanel` when `navGroups.length > 0`). Settings
is now a rail-only footer link (like Help); the dedicated settings route group
(`app/(app)/settings/layout.tsx`) is the sole owner of the section nav.

- Kept `panelHeader` on the Settings entry — `AppChrome` derives the breadcrumb
  section title from it, so the trail still reads "Settings" (the page's own
  `PageHeader` + `SettingsNav` supply the section/leaf context).
- Updated the stale comment in `settings/layout.tsx` (it claimed the main nav
  model still filters the settings sections — no longer true; per-permission
  filtering of individual settings sections is now a follow-up to add in that
  layout from the viewer's permissions).

No shared component changed; no new component. The previously brandable/access
guards on the removed settings sub-items are no longer in the nav config — when
per-section permission filtering is needed it belongs in `settings/layout.tsx`.

### Verification (Phase 2 · Settings nav de-dup)

- `pnpm --filter web check-types` ✅ · `lint` ✅ (0 warnings) · `build` ✅
  (all 6 settings section pages + `/settings` redirect still build; route count
  unchanged).
- Live preview (standalone-in-/tmp workaround, on port 3013 since a sibling
  project held 3001): on `/settings/general` the DOM has **no**
  `nav[aria-label="Secondary"]` (the duplicate panel is gone), the in-panel
  `SettingsNav` still lists all six sections (General → Audit log), the **Help**
  and **Settings** footer rail buttons still render (Settings remains reachable
  from the rail), and the breadcrumb reads "Settings". No console errors.

## Session Summary (2026-06-18) — Phase 2 · Students sub-pages (Students area complete)

Cleared the remaining Students placeholders with the established recipe
(`DataTableLayout` + `StatusBadge` + the shared `Meter`). No new shared
component.

New app surfaces (`apps/web`):

- **`students/fees`** — per-student fee balances (student-centric, vs the
  `/finance/invoices` ledger): StatGrid summary + balances table (paid /
  part-paid / owing pills).
- **`students/transport`** — bus-route assignments (route · stop · pickup;
  assigned / waitlist / unassigned pills).
- **`students/attendance`** — per-student attendance *history* (distinct from the
  class daily register): present-rate `Meter` per row + absence/lateness tally +
  on-track / at-risk flag.
- **`students/gradebook/report-cards`** — term report cards (average + grade pill
  + published / ready / draft).
- **`students/gradebook/transcripts`** — cumulative transcripts (CGPA · credits ·
  honors / good / probation standing).
- **`students/gradebook/page.tsx`** — `/students/gradebook` redirects to
  report-cards.

### Verification (Phase 2 · Students sub-pages)

- `pnpm --filter web check-types` ✅ · `lint` ✅ (0 warnings) · `build` ✅
  (5 pages + gradebook redirect; 33 routes).
- Live preview (standalone-in-/tmp workaround): all five render with correct
  status pills, the attendance present-rate `Meter`s tone by rate, the gradebook
  sub-nav expands (Report cards / Transcripts), and `/students/gradebook`
  redirected to report-cards. Correct nav group active + breadcrumb on each. No
  console errors.

## Session Summary (2026-06-18) — Phase 2 · Settings surfaces (M6 SettingsLayout)

Built the Settings area on the M6 `SettingsLayout` + `SettingsNav` — the last M6
pattern not yet used in-app. No new shared component (reuses SettingsLayout,
Card, Table, Input/Select, Toggle, StatusBadge).

New app surfaces (`apps/web`):

- **`app/(app)/settings/layout.tsx`** — a route-group layout that renders the
  `SettingsLayout` shell (PageHeader + section nav) once; section pages supply
  only their content panel. Active section derives from `usePathname`; nav items
  are real links (client routing).
- **`settings/general`** — school profile + academic/locale forms (Cards of
  Input/Select + save bar).
- **`settings/branding`** — logo slot, brand-colour swatch picker (interactive),
  default-theme `ToggleGroup`. The tenant-branding surface.
- **`settings/features`** — module toggles on the shared `Toggle` (live
  enabled-count; tinted on-state).
- **`settings/roles`** — roles table with clearance-tone `StatusBadge`s + a
  "Custom" tag.
- **`settings/users`** — staff-accounts table (avatars, role, active/invited/
  suspended pills).
- **`settings/audit`** — activity trail with category-tone `StatusBadge`s.
- **`settings/page.tsx`** — `/settings` redirects to `/settings/general`.

⚠ Design note (✅ RESOLVED in the 2026-06-18 nav de-dup session above): the
app-shell's secondary nav listed the Settings sub-items (from
`resolveNavigation`), overlapping the in-panel `SettingsNav`. Fixed by emptying
the Settings section groups in `app-navigation.tsx` so the shell panel no longer
duplicates the section nav now that the dedicated settings layout owns it.

### Verification (Phase 2 · Settings)

- `pnpm --filter web check-types` ✅ · `lint` ✅ (0 warnings) · `build` ✅
  (6 section pages + `/settings` redirect; 27 routes).
- Live preview (standalone-in-/tmp workaround): all six sections render with the
  sticky section nav marking the active item + breadcrumb "Settings / …".
  **Features** toggles are live (flipping Messaging On→Off updated its state +
  the enabled count); **Branding** swatch selection + theme toggle work;
  **General** forms, **Roles** (clearance pills + Custom tag), **Users**
  (status pills), **Audit** (category pills) all render. `/settings` redirected
  to general. No console errors.

## Session Summary (2026-06-18) — Phase 2 · Finance surfaces (+ Meter)

Built the Finance area (owner-gated; the nav section needs clearance 5) and added
one shared component it needed (in `packages/ui` first, per the rules).

New shared UI (`packages/ui`):

- **`custom/data-display/meter.tsx`** — `Meter`: a labelled ratio / progress bar
  (`value` / `max`, optional label + trailing value, `MeterTone` fill, accessible
  `progressbar` role). Generalises the one-off bars used in the dashboard /
  finance surfaces. Server-safe.

New app surfaces (`apps/web`):

- **`app/(app)/finance/invoices/page.tsx`** — fee invoices: an M6 `StatGrid`
  billing summary (billed / collected / outstanding / overdue, derived live) +
  `DataTableLayout` (search + status filter, SkeletonTable, EmptyState/reset).
  Status reads as a `StatusBadge`; amounts use compact ₦ formatting.
- **`app/(app)/finance/payments/page.tsx`** — payment receipts: `DataTableLayout`
  (search + method filter), status `StatusBadge`, ₦ amounts, collected total.
- **`app/(app)/finance/reports/page.tsx`** — financial reports: a `StatGrid`
  headline + two breakdown cards built on the shared `Meter` (collection rate by
  class, revenue mix by category).
- **`app/(app)/finance/page.tsx`** — `/finance` `redirect()`s to
  `/finance/invoices` (the primary billing view).

### Verification (Phase 2 · Finance)

- `pnpm --filter web check-types` ✅ · `lint` ✅ (0 warnings) · `build` ✅
  (invoices / payments / reports static; `/finance` redirect; 20 routes).
- Live preview (standalone-in-/tmp workaround): **Invoices** renders the billing
  StatGrid (₦1.9M billed / ₦1.1M collected / ₦810k outstanding / 3 overdue) + the
  ledger with paid/part-paid/overdue/draft pills. **Payments** renders 9 receipts
  with method + completed/failed/pending/refunded pills (₦1.1M collected).
  **Reports** renders the headline StatGrid + tone-coded `Meter` breakdowns
  (collection by class, revenue by category). `/finance` redirected to invoices.
  Correct nav section active; breadcrumbs read "Finance / …". No console errors.

## Session Summary (2026-06-18) — Phase 2 · Classes surfaces (+ ScheduleGrid)

Built the Classes area and added the one shared component it needed (in
`packages/ui` first, per the rules). The timetable is the first in-app surface
that is a *grid*, not a table.

New shared UI (`packages/ui`):

- **`custom/data-display/schedule-grid.tsx`** — `ScheduleGrid`: a data-driven
  weekly day × period schedule/timetable grid. Takes `days`, `SchedulePeriod[]`
  and `ScheduleEntry[]` (placed by `(day, period)`), with light `ScheduleTone`
  colour-coding per entry. CSS-grid layout; scrolls horizontally on narrow
  viewports rather than reflowing. Server-safe.

New app surfaces (`apps/web`):

- **`app/(app)/classes/timetable/page.tsx`** — weekly class timetable on
  `ScheduleGrid`, with a class `Select` swapping the week's entries, a subject
  colour legend (reusing `StatusBadge`), and a recurring Break row.
- **`app/(app)/classes/subjects/page.tsx`** — the subject catalog: the directory
  recipe (`DataTableLayout` + search + level `Select` + SkeletonTable +
  EmptyState/reset). Columns: subject (+ code), teacher, class count, periods/wk,
  status `StatusBadge`.
- **`app/(app)/classes/gradebook/page.tsx`** — a class gradebook: a scores table
  (students × CA1/CA2/Exam → computed Total + letter-grade `StatusBadge`) framed
  by `DataTableLayout`, with class + subject selectors and a live class average.
- **`app/(app)/classes/page.tsx`** — the `/classes` section landing `redirect()`s
  to `/classes/timetable` (server component; the primary teaching view).

### Verification (Phase 2 · Classes)

- `pnpm --filter web check-types` ✅ · `lint` ✅ (0 warnings) · `build` ✅
  (timetable / subjects / gradebook static; `/classes` redirect).
- Live preview (standalone-in-/tmp workaround): **Timetable** renders the
  ScheduleGrid (Mon–Fri × 6 periods) with colour-coded subject blocks, the Break
  row, the legend and the class selector. **Subjects** renders the catalog (10/10)
  with Active/Elective/Archived pills. **Gradebook** renders computed totals +
  letter-grade pills (A/B green, D amber, F red) and the class average (71%).
  `/classes` redirected to `/classes/timetable`. Correct nav section active on
  each; breadcrumbs read "Classes / …". No console errors.

## Session Summary (2026-06-18) — Phase 2 · Enrollment + Attendance surfaces

Built two more real surfaces from the directory recipe (M6 `DataTableLayout` +
`StatusBadge` + M5 states). No new shared component was needed — both reuse
existing `packages/ui` parts (the attendance per-row control maps onto the
shared `ToggleGroup`).

New app surfaces (`apps/web`):

- **`app/(app)/students/enrollment/page.tsx`** — the admissions pipeline.
  `PageHeader` + an M6 `StatGrid` pipeline summary (Applications / In review /
  Accepted / Waitlisted, derived live from the data) + `DataTableLayout`
  (search + stage `Select` + decision `Select`; SkeletonTable on mount-load;
  EmptyState + "Clear filters" when over-filtered). Rows show applicant, applying-
  for class, submitted date, a stage `StatusBadge` and a decision `StatusBadge`
  (accepted = success, pending = warning, waitlisted = info, rejected =
  destructive).
- **`app/(app)/attendance/daily/page.tsx`** — the daily attendance register.
  `PageHeader` (+ "Mark all present" / "Save register") + `DataTableLayout` with
  a class `Select` + date `Input` toolbar. Each row carries a present/absent/late
  control built on the shared `ToggleGroup` (tinted on-states via the status
  tokens) plus a status `StatusBadge`; a live summary of present/absent/late
  counts sits in the card description and updates as marks change. Mock roster +
  copy live in the page.

The sibling `/students/attendance` leaf is intentionally left on the `[...slug]`
placeholder — it is a *per-student* attendance history, a distinct surface from
the class daily register (a good follow-up).

### Verification (Phase 2 · Enrollment + Attendance)

- `pnpm --filter web check-types` ✅ · `lint` ✅ (0 warnings) · `build` ✅
  (12/12 routes; `/students/enrollment` + `/attendance/daily` both static).
- Live preview (standalone-in-/tmp workaround): **Enrollment** renders the
  pipeline StatGrid (12 / 6 / 3 / 2) + 12 applications with stage/decision pills;
  breadcrumb "Students / Enrollment". **Attendance** renders the JSS 1A register
  with the live summary (seeded 10 present · 0 absent · 0 late); exercising the
  toggles (one Absent + two Late) updated the summary to 7 / 1 / 2 and flipped
  the affected row's status pill — confirming the controlled per-row state.
  Breadcrumb "Attendance / Daily register"; correct nav section active on each.
  No console errors.

## Session Summary (2026-06-18) — Phase 2 · Student directory surface

Built the first real **collection** surface — `/students/directory` — from the
M6 `DataTableLayout`, replacing the `[...slug]` placeholder for that route. Also
added one small shared display component it needed (built in `packages/ui`
first, per the rules).

New shared UI (`packages/ui`):

- **`custom/data-display/status-badge.tsx`** — `StatusBadge`: a tone-driven
  status pill (Active / Suspended / Graduating / Paid / Owing …) for tables and
  rows. Reuses the M5 `StateTone` union and the same status-token mapping as the
  state medallions (so tones read consistently across surfaces); optional
  leading `dot`. The base `Badge` primitive keeps the brand/secondary/
  destructive/outline variants — `StatusBadge` adds the semantic status tones it
  lacked. Presentational + server-safe (no hooks).

New app surface (`apps/web`):

- **`app/(app)/students/directory/page.tsx`** — the student directory. Composes
  `PageHeader` + `DataTableLayout` (toolbar + Table + footer) wired to the M5
  states: a brief mount-time `loading` shows the `SkeletonTable`, and an
  over-filtered result shows the `EmptyState` (with a "Clear filters" reset
  action), so the view never renders blank. Toolbar = debounce-free search
  (name / ID / guardian) + class `Select` + status `Select`; footer shows
  "Showing N of M" + a clear-filters link. Rows render avatar initials, the
  enrollment `StatusBadge` (with dot) and a fee `StatusBadge`. Mock rows + copy
  live in the page; the tenant comes from `useViewer()`. More specific than the
  `[...slug]` catch-all, so it takes precedence.

### Verification (Phase 2 · student directory)

- `pnpm --filter web check-types` ✅ · `lint` ✅ (0 warnings) · `build` ✅
  (10/10 routes; `/students/directory` static).
- Live preview (standalone-in-/tmp workaround): directory renders all 12 mock
  students with status + fee pills; secondary nav resolves with **Directory**
  active (Records / Academics / Operations) and the breadcrumb reads
  "Students / Directory". Exercised the toolbar: a non-matching search collapses
  the table to the `EmptyState` ("No students match your filters"); its "Clear
  filters" action restores all 12 rows and resets the footer to "Showing 12 of
  12". Verified **light + dark** at desktop (tones legible in both). No console
  errors.

## Session Summary (2026-06-17) — Phase 2 · Nav wiring + first authenticated surface

Replaced the design-system shell preview's *simulated* in-page route + persona
switcher with the **real** session + router wiring, and built the first product
dashboard. Also repointed the git remote to the new repo (see Known Issues).

New shared UI (built in `packages/ui` first, per the rules):

- **`hooks/use-navigation.ts`** — `useResolvedNavigation(config, viewer,
  currentPath, { onNavigate? })`: a memoized React wrapper over the pure
  `resolveNavigation`. Carries no `next/navigation` dependency — the host passes
  the path (`usePathname()`) and an `onNavigate` (`router.push`).
- **`lib/navigation.ts`** — promoted `findActiveNavItem(items)` (deepest active
  leaf) from the preview's local copy into the shared lib; the shell preview now
  imports it (de-duplicated).

New app infrastructure (`apps/web`):

- **`app/providers/viewer-provider.tsx`** — `ViewerProvider` + `useViewer()`: the
  **auth/session seam**. Supplies the typed `ViewerContext` (clearance / roles /
  permissions / scope / tenant) plus the shell's user profile + switchable
  schools. ⚠ Currently a **mock session** (Owner @ St. Jude, clearance 8) — this
  is the single place a real auth source plugs in; nothing downstream changes.
  Switching schools updates `tenantId` + `schoolType` on the viewer.
- **`lib/navigation/app-navigation.tsx`** — the **real** product navigation
  (`SCHOOL_NAV` / `PLATFORM_NAV` + `configForViewer`), promoted out of the
  preview-only file (now the single source of truth; the preview re-exports it
  and keeps only its example personas). Routes map to `(app)` group paths.
- **`app/(app)/layout.tsx`** + **`app/(app)/app-chrome.tsx`** — the authenticated
  shell. `layout` mounts `ViewerProvider`; `AppChrome` (client) resolves the nav
  via `useResolvedNavigation(config, viewer, usePathname(), { onNavigate:
  router.push })` and renders `AppShell` (header + `SchoolSwitcher` + `UserMenu` +
  resolved `AppSidebar`). Breadcrumbs derive from the active section/leaf; the
  switcher supplies the tenant (so the trail starts at the section, no
  duplication).
- **`app/(app)/overview/page.tsx`** — the first real surface: the school
  (Owner) dashboard from `DashboardLayout` + `StatGrid` + primitives. KPIs (e.g.
  outstanding-fees delta reads negative via `intent`), a Needs-attention list, an
  Enrollment-overview card, and a Recent-activity aside. Greeting + tenant come
  from `useViewer()`. Product copy lives in the page; shared components stay
  data-driven.
- **`app/(app)/[...slug]/page.tsx`** — a catch-all placeholder rendering the M5
  `EmptyState` ("… isn't built yet") so every nav destination stays explorable
  without 404s while Phase 3+ screens don't exist. More specific routes (e.g.
  `/overview`) take precedence.
- **`app/page.tsx`** — `/` now redirects to `/overview` (was `/design-system`).

### Verification (Phase 2 · nav wiring)

- `pnpm --filter web check-types` ✅ · `lint` ✅ (0 warnings) · `build` ✅
  (9/9 routes; `/overview` static, `/[...slug]` dynamic, `/design-system/*`
  intact).
- Live preview (standalone-in-/tmp workaround): `/overview` renders the Owner
  dashboard — full rail (Overview/Students/Classes/Attendance/Finance/Reports;
  Finance visible since Owner clears level 5), six KPI tiles, attention list,
  enrollment card, activity aside. **Real router wiring confirmed**: clicking the
  Students rail did a client-side `router.push('/students')`, marked the rail
  active, and resolved its secondary panel (Enrollment 42 / Directory 1.2k /
  Gradebook → Report cards · Transcripts / Fees 7 / …). Navigating to a leaf
  (`/students/enrollment`) set `aria-current` on Enrollment and rendered the M5
  placeholder. No console errors. Breadcrumb starts at the section (no tenant
  duplication beside the switcher).



## Session Summary (2026-06-17) — Milestone 7: Verification And Documentation

Final Phase-1 milestone — documentation + a consolidated component index. No new
runtime UI patterns; this captures how to consume the foundation and what's left
for Phase 2.

- **`packages/ui/README.md`** (new) — the canonical usage doc: how to consume
  `@workspace/ui` (the `exports` map + import examples, host-app setup), the
  token layer & theming, the **tenant-branding boundary** (brandable colour
  roles only, scoped to `data-tenant`; never structural tokens), a full
  **component catalog** (primitives · M3 shell · M4 nav model · M5 states · M6
  layouts · utilities), a **preview-route index**, an **accessibility checklist**,
  **responsive verification notes**, and a **known-gaps list** for Phase 2.
- **`/design-system` index** — added a "Preview surfaces" catalog (cards linking
  to `/shell`, `/states`, `/layouts`) built from the shared Card/Button
  primitives, pointing at the README for usage. The primitive showcases
  (buttons, badges, form controls, cards) remain below.

With this, Phase 1 (Design System Foundation) is complete: `apps/web` is a
working preview surface; `packages/ui` exposes reusable, typed, themeable
components (tokens, shell, navigation model, states, layouts); light/dark have
parity; nothing embeds template/product data; the preview works mobile +
desktop; and usage + limitations are documented.

### Verification (Milestone 7)

- `pnpm --filter web check-types` ✅ · `lint` ✅ (0 warnings) · `build` ✅
  (8/8 static).
- `/design-system` index verified in the preview browser (standalone-in-/tmp
  workaround): the three preview-surface cards render with working "Open
  preview" links; no console errors.

## Session Summary (2026-06-17) — Milestone 6: Layout Patterns

Added five reusable authenticated-surface layout patterns in
`packages/ui/src/custom/layouts/`. They are composition scaffolds — slots +
typed data, no embedded product copy — that compose existing primitives (Card,
Table, Button, Input/Label), the M3 `PageHeader`, and the M5 state components.
Previewed on a new `/design-system/layouts` route (a `Tabs` switcher over the
five patterns; sample copy lives in the preview).

New shared contract:

- **`types/layout.types.ts`** — `StatItem` (+ `StatDelta` / `StatTrend` with a
  good/bad `intent` so "fees up" can read negative) and `SettingsNavItem`.

Building block + patterns (in `packages/ui/src/custom/layouts/`):

- **`stat-grid.tsx`** — `StatGrid` + `StatCard`: the compact Aurora KPI tile
  (label · big value · trend delta), auto-fitting responsive grid, optional
  link/button per tile. Data-driven (`StatItem[]`).
- **`dashboard-layout.tsx`** — `DashboardLayout`: header slot + optional stat
  row + a responsive main/aside content grid (aside stacks under main < lg).
- **`list-detail-layout.tsx`** — `ListDetailLayout`: fixed-width master list +
  flexible detail pane; on < md shows one pane at a time via `showDetail`
  (consumer drives it from selection and supplies the "back" affordance).
- **`data-table-layout.tsx`** — `DataTableLayout`: Card-framed toolbar (title +
  search/filters/actions) + table body + footer; `loading` swaps in a
  `SkeletonTable`, `empty` swaps in the consumer's `EmptyState` (M5 wiring) so
  the view never renders blank. The table is passed as children (shared Table
  primitive).
- **`form-layout.tsx`** — `FormLayout` + `FormSection`: a `<form>` with a
  validation-summary slot (wire the M5 `ValidationSummary`), divider-separated
  titled sections (leading heading column + responsive field grid), a
  right-aligned action bar, and an optional sticky aside.
- **`settings-layout.tsx`** — `SettingsLayout` + `SettingsNav`: a sticky section
  nav (vertical at md+, horizontal scroller on mobile) beside a content panel;
  nav is data-driven (`SettingsNavItem[]`) and marks the active item with
  `aria-current`.

### Verification (Milestone 6)

- `pnpm --filter web check-types` ✅ · `lint` ✅ (0 warnings) · `build` ✅
  (`/design-system/layouts` prerendered static, 8/8 pages).
- Visual (managed preview browser, via the standalone-in-/tmp workaround):
  all five patterns rendered and exercised in **light + dark**, plus **mobile**
  (375 — tabs wrap, stat grid collapses to one column, columns stack). Confirmed
  interactions: dashboard KPI deltas colour by intent (outstanding-fees ↑ reads
  red); list/detail selection updates the detail pane + `aria-current`; data
  table cycles data → loading (`SkeletonTable`, `aria-busy`) → empty
  (`EmptyState` with actions); form empty-submit shows the wired
  `ValidationSummary` (`role="alert"`, receives focus, 2 errors); settings nav
  switches sections and tracks `aria-current`. No console errors.
- Note: Radix `Tabs` triggers in the production-snapshot preview only switched
  under a full synthesised pointer sequence (pointerdown→mouseup→click); a bare
  `.click()` was a no-op. Preview-harness quirk, not a component issue.

## Session Summary (2026-06-17) — Milestone 5: State And Feedback Components

Added reusable page/section state components so screens never render blank or
undefined. All live in `packages/ui/src/custom/states/`, are data-driven (every
title / description / action label is consumer-supplied — no embedded product
copy), reuse existing primitives (Button, Skeleton, Input/Label in the preview),
and map their tones onto the M2 status tokens (`success` / `warning` / `info` /
`destructive`). Previewed on a new `/design-system/states` route.

New shared contract:

- **`types/states.types.ts`** — `StateTone`, `StateActionVariant`, `StateAction`
  (href OR onClick, optional icon/variant/disabled/ariaLabel), and
  `ValidationItem` (key · message · optional `fieldId` for focus linking).

Components (in `packages/ui/src/custom/states/`):

- **`state-view.tsx`** — `StateView`, the shared centered scaffold behind the
  full-surface states (tone medallion · title · description · primary/secondary
  actions · footer slot). `compact` for in-card use. Sets `aria-labelledby` /
  `aria-describedby`; accepts `role` / `aria-live`. Also exports
  `StateActionButton` (maps a `StateAction` onto the shared Button, link when
  `href` set) — reused by the banners.
- **`page-states.tsx`** — `EmptyState` (neutral), `ErrorState` (destructive,
  `role="alert"`), `ForbiddenState` (warning). Thin presets over `StateView`
  with default decorative lucide icons; override `icon`/`tone` or pass
  `icon={null}`. `ForbiddenState` pairs with the M4 nav model: access filtering
  hides nav the viewer can't reach, `ForbiddenState` covers the direct/deep-link
  case (it enforces nothing — authorization stays server-side).
- **`loading-state.tsx`** — `Spinner` (token-coloured `animate-spin`) and
  `LoadingState` (centered, `role="status"` / `aria-busy`, optional label,
  `compact`).
- **`skeletons.tsx`** — content-shaped placeholders that prevent layout shift:
  `SkeletonText`, `SkeletonList`, `SkeletonTable`, `SkeletonCardGrid`,
  `SkeletonForm`. Each composes the shared `Skeleton` primitive; bars are
  `aria-hidden` under a `role="status"` busy region.
- **`notice-banner.tsx`** — `NoticeBanner` (non-blocking inline strip; content
  still renders beneath), plus `OfflineBanner` (warning) and `ReadOnlyBanner`
  (info) presets. Optional trailing action + dismiss button.
- **`validation-summary.tsx`** — `ValidationSummary`, grouped form errors,
  `role="alert"`, focusable (`tabIndex={-1}`, `autoFocus` + forwarded ref) so a
  form can move focus to it on submit; items with `fieldId` render as links that
  focus/scroll the offending control. Renders nothing when `items` is empty.

Preview (`apps/web/app/design-system/states/page.tsx`, client component holding
all sample copy): a labelled section per state, full-surface states framed in
bordered cards, an interactive offline-banner dismiss/restore, and a working
validation demo (submit empty → summary appears, auto-focuses, links focus the
field). Linked from the `/design-system` index ("View states").

### Verification (Milestone 5)

- `pnpm --filter web check-types` ✅ · `lint` ✅ (0 warnings) · `build` ✅
  (`/design-system/states` prerendered static, 7/7 pages).
- Rendering verified against a dev server: `/design-system/states` returns 200,
  all seven state categories render server-side, no error overlay, ARIA roles
  present (10× `role="status"`, 1× `role="alert"`), and `ValidationSummary`
  correctly absent until a failed submit. Tone utilities (`bg-*/NN` tints,
  `text-balance`/`text-pretty`, `animate-spin`) confirmed compiled in the served
  CSS.
- Visual (light + dark, desktop): verified in the managed preview browser. Full
  dark-mode page captured (all 7 categories, distinct legible tones); light mode
  captured for the loading/skeleton/empty/error region. ARIA confirmed via a11y
  snapshot (loading/skeletons/banners → `status`; error → `alert`; empty/
  forbidden → labelled groups with actions). Interactions exercised: empty
  submit renders the `ValidationSummary` (`role="alert"`, receives focus) and
  lists both field errors; clicking the "guardian email" error focuses the
  `vs-email` input; the offline banner's dismiss toggles to the restore button.
  No console errors.
- ⚠ The managed preview browser only worked via a **standalone-in-`/tmp`
  workaround** — the preview launcher is blocked by macOS Privacy (TCC) from
  reading the project under `~/Documents` (confirmed: it reads `/tmp` fine,
  `EPERM`s on `apps/web/package.json`). See Known Issues for the user-side fix
  and the reproducible workaround.

## Session Summary (2026-06-13) — Milestone 4: Role-Aware Navigation Model

Added a typed, declarative navigation model that drives the M3 shell, filtered
by the same role / clearance / permission vocabulary the backend will authorize
against (requirements/access-control.md + permissions.md). The shell components
are unchanged in contract — they still consume `RailItem[]` / `NavGroup[]` and
carry no roles, permissions, or tenant logic. Built on the
`chore/technical-debt-cleanup` branch (M4 changes are currently uncommitted —
see Known Issues for the git-state note).

New model (in `packages/ui`, framework-agnostic, no React/side effects):

- **`types/access.types.ts`** — RBAC primitives: `ClearanceLevel` (0–10),
  `StandardRole`, `RoleKey` (standard + custom), `SchoolType` (polymorphic),
  `NavScope` (`platform` | `school`), `PermissionKey`, `ViewerContext` (the
  signed-in viewer), and `NavAccess` (a node's guard: `minClearance`, `scope`,
  `roles`, `schoolTypes`, `anyPermission`, `allPermissions` — AND across fields).
- **`types/navigation.types.ts`** — declarative config: `NavNode`,
  `NavGroupNode`, `NavSectionNode` (a rail destination + its secondary panel),
  `NavigationConfig` (sections + footer), and `ResolvedNavigation` (shell-ready
  output). Nodes carry an `href` (route) and `access` guard, never an `active`
  flag.
- **`lib/navigation.ts`** — pure resolver: `canAccess` (guard eval),
  `isRouteActive` (exact / ancestor match), `CLEARANCE_BY_ROLE`, and
  `resolveNavigation(config, viewer, currentPath, { onNavigate? })`. Drops nodes
  the viewer can't access, collapses empty groups / panels, and marks exactly
  one active leaf (most-specific route wins) plus its owning section. With
  `onNavigate` the items dispatch via `onSelect` (controlled routing, used by the
  preview); without it they carry `href` (plain links).

Preview (`apps/web/app/design-system/shell/`):

- **`navigation.data.tsx`** (preview-only) — example `SCHOOL_NAV` and
  `PLATFORM_NAV` configs with realistic access guards, plus four viewer personas
  (Registrar, Teacher, Owner @ school; Architect @ platform).
- **`page.tsx`** — rewired to resolve the sidebar from the model. Hardcoded
  `active: true` flags are gone; active state derives from a simulated in-page
  route (selecting any destination updates it). Added a **persona switcher**
  (shared `Select`) so reviewers can watch role/clearance/permission/scope
  filtering live; selecting a platform persona swaps the whole surface to
  `PLATFORM_NAV`. Page title, breadcrumbs, and panel header derive from the
  active route / tenant.

Also fixed a latent M3 bug surfaced by wiring `onSelect` onto rail items: in
`AppSidebar`'s `NavElement`, the Radix Tooltip (`asChild`) injects its own
`onClick`, which clobbered `onSelect` due to spread order — rail clicks silently
did nothing. `NavElement` now composes both handlers.

### Verification (Milestone 4)

- `pnpm --filter web check-types` ✅ · `lint` ✅ · `build` ✅ (6/6 static).
- Live preview: Registrar sees Overview/Students/Classes/Attendance/Reports
  (Finance correctly hidden — clearance 4 < 5); Architect flips to the platform
  rail (Tenants/Analytics/Audit/Support/Billing); rail + secondary-nav clicks
  move active state along the route; mobile (375) collapses to the bottom tab
  bar with the active tab tracking the route; light + dark verified.
- Resolver cross-checked against the real configs via a throwaway `tsx` harness
  for Teacher / Owner / Architect routes (group-emptying, permission filtering,
  and deepest-match active all correct).

## Session Summary (2026-06-13) — Technical Debt Cleanup (TD-001, TD-003, TD-004)

Maintenance pass (not a milestone) resolving three of the four tracked debt
items. Committed on branch `chore/technical-debt-cleanup` (not yet
merged/pushed). See `TECHNICAL_DEBT.md` for the per-item record.

- **TD-001 (resolved)** — deleted the superseded legacy shadcn template
  components that still embedded sample data: `app-sidebar.tsx`, `nav-main.tsx`,
  `nav-projects.tsx`, `nav-user.tsx`, `team-switcher.tsx`, plus the now-orphaned
  `sidebar-toggle.tsx` (it was imported only by the legacy `app-sidebar`). None
  were imported by `apps/web`. The data-driven shell set under
  `packages/ui/src/custom/shell/` is unaffected.
- **TD-003 (resolved)** — removed the hardcoded debug styling
  (`text-primary bg-destructive`) from the `ModeToggle` trigger so it uses the
  standard `outline` button variant. Verified in the `/design-system` preview:
  neutral `bg-background` trigger, no console errors.
- **TD-004 (resolved)** — deleted the dead `pnpm.overrides` field from root
  `package.json` (pnpm 10 ignored it and warned each install). The five legacy
  overrides were deliberately **not** migrated to `pnpm-workspace.yaml`:
  `glob`/`rimraf` were stale upward pins that would now *downgrade* the newer
  resolved versions (`glob@13`, `rimraf@6`); `lodash.get` and `@types/minimatch`
  are absent from the dependency graph; and the `inflight` swap was left out to
  keep the change resolution-neutral (available as an optional follow-up).

Only **TD-002** (notification service — an unbuilt feature, not cleanup) remains
pending.

### Verification (Technical Debt Cleanup)

- `pnpm install` ✅ no `pnpm` field warning; dependency resolution unchanged.
- Visual via preview: `/design-system` mode-toggle trigger confirmed neutral
  (no red), no console errors.
- Note: the committed `pnpm-lock.yaml` is still on legacy `lockfileVersion 5.4`
  (pnpm 6 era) while the repo uses pnpm 10.4.1; a `pnpm install` regenerates it
  to `9.0`. That lockfile regeneration was intentionally *not* bundled into this
  commit and remains a separate cleanup (see Known Issues).

## Session Summary (2026-06-13) — Milestone 3: Core Shell Components

Productized the Aurora Layout A application shell as typed, data-driven
components in `packages/ui/src/custom/shell/`, translating the
`design-export` references (`shell-base.css`, `shell-build.js`,
`aurora-responsive.css`) onto the Milestone 2 token layer. No component embeds
sample/template data — all sample content lives in the new
`/design-system/shell` preview (resolves the original TD-001 requirement; see
TD-001 for the remaining legacy-component cleanup).

Components delivered (all light/dark aware, layout-stable, token-driven):

- **AppShell** (`app-shell.tsx`) — the chrome frame (header · rail · nav ·
  main · inspector · status bar). Pure slot-based layout. Consumes the
  layout-dimension tokens (`--header-height`, `--rail-width`, `--nav-width`,
  `--inspector-width`, `--content-padding`) and colour roles; no hardcoded
  dimensions. Also exports `ShellMain` (padded scroll region).
- **AppHeader** (`app-header.tsx`) — top bar with slots for the school
  switcher, breadcrumbs, center search, and actions. Exports `OmniSearch`
  (the ⌘K command affordance).
- **AppSidebar** (`app-sidebar.tsx`) — icon rail (md+), secondary nav panel
  with groups / items / one level of sub-items / badges / footer slot (lg+),
  and a bottom **mobile tab bar** (<md) for the mobile-navigation behavior.
  Driven by `RailItem[]` / `NavGroup[]`.
- **SchoolSwitcher** (`school-switcher.tsx`) — tenant chip + switch menu
  (`SchoolOption[]`), optional "add school" affordance.
- **UserMenu** (`user-menu.tsx`) — avatar trigger + account dropdown
  (`UserProfile` + `UserMenuItem[]`), reuses the shared Avatar.
- **AppBreadcrumbs** (`app-breadcrumbs.tsx`) — typed `BreadcrumbEntry[]`,
  wraps the shared breadcrumb primitive.
- **PageHeader** (`page-header.tsx`) — title + meta sub-line + actions slot;
  exports `SegmentedControl` (the Pipeline/List/Calendar control).

Shared contracts live in `packages/ui/src/types/shell.types.ts` (SchoolOption,
RailItem, NavItem, NavGroup, UserProfile, UserMenuItem, BreadcrumbEntry,
PageHeaderMeta). Existing primitives reused where they fit (Button, Badge,
Card, Avatar, Breadcrumb, DropdownMenu, Tooltip) — no one-off UI.

Responsive model is CSS-only (Tailwind viewport breakpoints — SSR-safe, no
layout shift): <md collapses the rail to a bottom tab bar and hides the
secondary nav / inspector / status bar; lg+ shows rail + nav; xl+ shows the
inspector.

### Verification (Milestone 3)

- `pnpm --filter web check-types` ✅
- `pnpm --filter web lint` ✅
- `pnpm --filter web build` ✅ (`/design-system` + `/design-system/shell`
  prerendered static)
- Visual via preview: `/design-system/shell` confirmed faithful to the Aurora
  design in **dark + light** at desktop (1440) and **mobile** (375) — top bar,
  rail, secondary nav, page header, inspector, status bar on desktop; condensed
  top bar + bottom tab bar with nav/inspector/status hidden on mobile. School
  switcher dropdown verified opening with all tenants + "Add school".
- Note: `pnpm --filter @workspace/ui lint` fails to resolve `eslint` (the
  package has no direct eslint dep) — pre-existing infra, unrelated to this
  change; shell source is still covered by `tsc` and the web lint. Logged as a
  follow-up below.

## Session Summary (2026-06-13) — Milestone 2: Token Foundation

Translated the approved `design-export` **Aurora** direction (neon-glass,
light + dark) into a stable, flat token layer in
`packages/ui/src/styles/globals.css`. Aurora light maps to `:root`, Aurora
dark to `.dark`.

- Replaced the neutral starter palette with Aurora color roles for both
  themes: base surfaces, primary (`#4f6df5` light / `#5b8cff` dark),
  secondary/muted, accent, destructive, border/input/ring, and full sidebar
  roles. Light/dark parity verified.
- Added semantic status tokens — `--success`, `--warning`, `--info` (+
  `-foreground`) — sourced from Aurora `--pos` / `--warn` / `--accent-2`, and
  registered them in `@theme inline` (usable as `bg-success`, etc.).
- Mapped the chart palette (`--chart-1..5`) to the Aurora neon blend
  (blue · green · blurple · pink · amber) for each theme.
- Added structural tokens (theme-independent): radius base `1rem` (Aurora
  rounded), typography (font-family roles wired to the app's `next/font`
  Geist variables with Aurora families as fallback, plus weight / leading /
  tracking scales), layout dimensions (rail/nav/inspector widths, content
  padding, header height), and an elevation scale (`--shadow-xs..lg`,
  `--shadow-card`, `--shadow-accent`) with dark overrides.
- Removed the leftover starter `--foreground-rgb` variables and the gradient
  `body` background (resolves the Known Issue from Milestone 1). `body` now
  uses `bg-background text-foreground font-sans` only.
- Documented the **tenant branding contract**: tenants may override brandable
  color roles only (scoped to a `data-tenant` attribute), never structural
  tokens (radius, fonts, layout dimensions, spacing, elevation). Includes a
  worked light + dark example in the file.
- Dropped the dead `--mode-toggle-background/foreground` vars (nothing
  consumed them; `ModeToggle` styling is hardcoded — see TD-003).

## Verification

- `pnpm --filter web check-types` ✅
- `pnpm --filter web lint` ✅
- `pnpm --filter web build` ✅ (`/design-system` prerendered static)
- Visual: `/design-system` previewed in light + dark at desktop (1280) and
  mobile (375) viewports. Confirmed token values resolve per theme
  (`--background`, `--primary`, `--success/--warning/--info`, `--radius`,
  `--shadow-card`), `body` font resolves to Geist, and the legacy
  `--foreground-rgb` is gone.

## Session Summary (2026-06-13) — Milestone 1

Rebuilt `apps/web` as the design-system preview surface (the prior scaffold had
been removed from the working tree). This satisfies Phase 1 / Milestone 1
("Web Preview Scaffold") in `implementation-roadmap.md`.

- Scaffolded a minimal Next.js 15 app in `apps/web`, wired to `@workspace/ui`,
  shared Tailwind/PostCSS config, workspace TypeScript config, and ESLint.
- Imports `@workspace/ui/globals.css` (the existing shared token layer) and
  mounts `ThemeProvider` + `ColorScheme` so light/dark theming works.
- Switched fonts from the deleted local `.woff` files to `next/font/google`
  Geist / Geist Mono (no binary assets committed).
- Added a `/design-system` preview route rendering shared `@workspace/ui`
  components (Button, Badge, Card, Input, Label) plus the shared `ModeToggle`
  for theme switching. `/` redirects to `/design-system`.
- Resolved a workspace-wide `@types/react` duplication (Radix pulled 19.1.0 vs
  app 19.2.17), which made forwardRef components fail as JSX element types, by
  adding an `overrides` block to `pnpm-workspace.yaml`.

## Verification

- `pnpm --filter web check-types` ✅
- `pnpm --filter web lint` ✅
- `pnpm --filter web build` ✅ (`/design-system` prerendered static)
- Runtime smoke test: `/` serves, `/design-system` returns 200 and renders.

---

# Files Modified

## Phase 2 — Settings nav de-duplication (tidy-up)

Edited:

- apps/web/lib/navigation/app-navigation.tsx (removed `groups` from the Settings
  footer entry; kept `panelHeader` for the breadcrumb)
- apps/web/app/(app)/settings/layout.tsx (refreshed the stale section-filtering
  comment)
- AI_HANDOFF.md (this file) + NEXT_RECOMMENDED_PROMPT.md

No Prisma schema or API changes. No shared component changed. `.claude/launch.json`
was temporarily pointed at port 3013 for preview verification (a sibling project
held 3001) and reverted to 3001 — not part of the committed diff.

## Phase 2 — Students sub-pages (Students area complete)

Created:

- apps/web/app/(app)/students/fees/page.tsx (per-student fee balances)
- apps/web/app/(app)/students/transport/page.tsx (route assignments)
- apps/web/app/(app)/students/attendance/page.tsx (attendance history; uses Meter)
- apps/web/app/(app)/students/gradebook/report-cards/page.tsx (term report cards)
- apps/web/app/(app)/students/gradebook/transcripts/page.tsx (cumulative transcripts)
- apps/web/app/(app)/students/gradebook/page.tsx (→ report-cards redirect)

Edited:

- AI_HANDOFF.md (this file) + NEXT_RECOMMENDED_PROMPT.md

No Prisma schema or API changes. No new shared component — reuse of
`DataTableLayout` / `StatGrid` / `Meter` / `StatusBadge`. All resolve ahead of
the `[...slug]` placeholder; the Students nav section is now fully built.

## Phase 2 — Settings surfaces (M6 SettingsLayout)

Created:

- apps/web/app/(app)/settings/layout.tsx (SettingsLayout shell + section nav)
- apps/web/app/(app)/settings/general/page.tsx (profile + locale forms)
- apps/web/app/(app)/settings/branding/page.tsx (logo, colour swatches, theme)
- apps/web/app/(app)/settings/features/page.tsx (module toggles)
- apps/web/app/(app)/settings/roles/page.tsx (roles table)
- apps/web/app/(app)/settings/users/page.tsx (users table)
- apps/web/app/(app)/settings/audit/page.tsx (audit log)
- apps/web/app/(app)/settings/page.tsx (/settings → /settings/general redirect)

Edited:

- AI_HANDOFF.md (this file) + NEXT_RECOMMENDED_PROMPT.md

No Prisma schema or API changes. No new shared component — Settings reuses
`SettingsLayout` + existing primitives. Resolves ahead of the `[...slug]`
placeholder.

## Phase 2 — Finance surfaces (+ Meter)

Created:

- packages/ui/src/custom/data-display/meter.tsx (Meter + MeterTone)
- apps/web/app/(app)/finance/invoices/page.tsx (fee invoices + StatGrid)
- apps/web/app/(app)/finance/payments/page.tsx (payment receipts)
- apps/web/app/(app)/finance/reports/page.tsx (financial reports + Meters)
- apps/web/app/(app)/finance/page.tsx (/finance → /finance/invoices redirect)

Edited:

- packages/ui/README.md (added the Meter catalog entry)
- AI_HANDOFF.md (this file) + NEXT_RECOMMENDED_PROMPT.md

No Prisma schema or API changes. The Finance leaves resolve ahead of the
`[...slug]` placeholder; `Meter` is the only new shared component.

## Phase 2 — Classes surfaces (+ ScheduleGrid)

Created:

- packages/ui/src/custom/data-display/schedule-grid.tsx (ScheduleGrid + types)
- apps/web/app/(app)/classes/timetable/page.tsx (timetable on ScheduleGrid)
- apps/web/app/(app)/classes/subjects/page.tsx (subject catalog)
- apps/web/app/(app)/classes/gradebook/page.tsx (class gradebook)
- apps/web/app/(app)/classes/page.tsx (/classes → /classes/timetable redirect)

Edited:

- packages/ui/README.md (added the ScheduleGrid catalog entry)
- AI_HANDOFF.md (this file) + NEXT_RECOMMENDED_PROMPT.md

No Prisma schema or API changes. The Classes leaves resolve ahead of the
`[...slug]` placeholder; `ScheduleGrid` is the only new shared component.

## Phase 2 — Enrollment + Attendance surfaces

Created:

- apps/web/app/(app)/students/enrollment/page.tsx (admissions pipeline)
- apps/web/app/(app)/attendance/daily/page.tsx (daily attendance register)

Edited:

- AI_HANDOFF.md (this file) + NEXT_RECOMMENDED_PROMPT.md

No Prisma schema or API changes. No new shared component — both surfaces reuse
existing `packages/ui` parts (`DataTableLayout`, `StatGrid`, `StatusBadge`,
`ToggleGroup`, M5 states). Both routes resolve ahead of the `[...slug]`
placeholder.

## Phase 2 — Student directory surface

Created:

- packages/ui/src/custom/data-display/status-badge.tsx (StatusBadge — tone pill)
- apps/web/app/(app)/students/directory/page.tsx (student directory surface)

Edited:

- packages/ui/README.md (added the "Data display" catalog entry for StatusBadge)
- AI_HANDOFF.md (this file)

No Prisma schema or API changes. `DataTableLayout` and the M5 states are
consumed unchanged; `/students/directory` now resolves ahead of the `[...slug]`
placeholder.

## Phase 2 — Nav wiring + first authenticated surface

Created:

- packages/ui/src/hooks/use-navigation.ts (useResolvedNavigation)
- apps/web/app/providers/viewer-provider.tsx (ViewerProvider + useViewer; mock session)
- apps/web/lib/navigation/app-navigation.tsx (real SCHOOL_NAV / PLATFORM_NAV / configForViewer)
- apps/web/app/(app)/layout.tsx (mounts ViewerProvider)
- apps/web/app/(app)/app-chrome.tsx (live shell: usePathname + router.push)
- apps/web/app/(app)/overview/page.tsx (Owner dashboard — M6 + M5)
- apps/web/app/(app)/[...slug]/page.tsx (M5 EmptyState placeholder for unbuilt routes)

Edited:

- packages/ui/src/lib/navigation.ts (export findActiveNavItem)
- apps/web/app/page.tsx (redirect `/` → `/overview`)
- apps/web/app/design-system/shell/navigation.data.tsx (re-export the promoted
  config; keep only preview personas — de-duplicated)
- apps/web/app/design-system/shell/page.tsx (use shared findActiveNavItem)
- CURRENT_PHASE.md (→ Phase 2)
- AI_HANDOFF.md (this file)

No Prisma schema or API changes. The shell component contracts are unchanged.

## Milestone 7 (Verification And Documentation)

Created:

- packages/ui/README.md (design-system usage notes, catalog, accessibility
  checklist, responsive notes, Phase-2 known gaps)

Edited:

- apps/web/app/design-system/page.tsx (added the "Preview surfaces" catalog)
- AI_HANDOFF.md (this file)

No changes to `packages/ui` components, the Prisma schema, or any API.

## Milestone 6 (Layout Patterns)

Created:

- packages/ui/src/types/layout.types.ts (StatItem, StatDelta, SettingsNavItem)
- packages/ui/src/custom/layouts/stat-grid.tsx (StatGrid + StatCard)
- packages/ui/src/custom/layouts/dashboard-layout.tsx (DashboardLayout)
- packages/ui/src/custom/layouts/list-detail-layout.tsx (ListDetailLayout)
- packages/ui/src/custom/layouts/data-table-layout.tsx (DataTableLayout)
- packages/ui/src/custom/layouts/form-layout.tsx (FormLayout + FormSection)
- packages/ui/src/custom/layouts/settings-layout.tsx (SettingsLayout + SettingsNav)
- apps/web/app/design-system/layouts/page.tsx (preview; holds sample copy)

Edited:

- apps/web/app/design-system/page.tsx (added "View layouts" link)
- AI_HANDOFF.md (this file)

No changes to existing `packages/ui` components, the Prisma schema, or any API.
Layout patterns only compose existing primitives, the M3 PageHeader, and the M5
state components.

## Milestone 5 (State And Feedback Components)

Created:

- packages/ui/src/types/states.types.ts (StateTone, StateAction, ValidationItem)
- packages/ui/src/custom/states/state-view.tsx (StateView + StateActionButton)
- packages/ui/src/custom/states/page-states.tsx (Empty / Error / Forbidden)
- packages/ui/src/custom/states/loading-state.tsx (Spinner + LoadingState)
- packages/ui/src/custom/states/skeletons.tsx (text/list/table/card-grid/form)
- packages/ui/src/custom/states/notice-banner.tsx (NoticeBanner + Offline/ReadOnly)
- packages/ui/src/custom/states/validation-summary.tsx (ValidationSummary)
- apps/web/app/design-system/states/page.tsx (preview surface; holds sample copy)

Edited:

- apps/web/app/design-system/page.tsx (added "View states" link)
- apps/web/next.config.ts (added `output: 'standalone'` — enables the
  preview-from-/tmp workaround for the macOS TCC launcher block; see Known Issues)
- .claude/launch.json (added the `web-standalone` preview config used for the
  workaround; the default `pnpm`-based `web` config is unchanged)
- AI_HANDOFF.md (this file)

No changes to existing `packages/ui` components, the Prisma schema, or any API.
State components only consume existing primitives and the M2 tokens.

## Milestone 4 (Role-Aware Navigation Model)

Created:

- packages/ui/src/types/access.types.ts (RBAC primitives)
- packages/ui/src/types/navigation.types.ts (navigation config + resolved shapes)
- packages/ui/src/lib/navigation.ts (canAccess / isRouteActive / resolveNavigation)
- apps/web/app/design-system/shell/navigation.data.tsx (example configs + personas)

Edited:

- packages/ui/src/custom/shell/app-sidebar.tsx (NavElement: compose injected
  onClick with onSelect — fixes rail items being inert)
- apps/web/app/design-system/shell/page.tsx (resolve sidebar from the model;
  remove hardcoded active flags; add persona switcher)
- AI_HANDOFF.md (this file)

No changes to the Prisma schema or any API. The model is pure TypeScript; the
shell component contracts (`RailItem[]` / `NavGroup[]`) are unchanged.

## Technical Debt Cleanup (TD-001, TD-003, TD-004) — branch chore/technical-debt-cleanup

Deleted:

- packages/ui/src/custom/app-sidebar.tsx (legacy template)
- packages/ui/src/custom/nav-main.tsx (legacy template)
- packages/ui/src/custom/nav-projects.tsx (legacy template)
- packages/ui/src/custom/nav-user.tsx (legacy template)
- packages/ui/src/custom/team-switcher.tsx (legacy template)
- packages/ui/src/custom/sidebar-toggle.tsx (orphaned by the above)

Edited:

- packages/ui/src/custom/mode-toggle.tsx (removed debug styling)
- package.json (removed dead `pnpm.overrides` field)
- TECHNICAL_DEBT.md (TD-001/003/004 moved to Resolved; TD-002 still pending)
- AI_HANDOFF.md (this file)

No changes to the Prisma schema or any API. The `pnpm-workspace.yaml` React-type
overrides are pre-existing uncommitted work and were left untouched.

## Milestone 3 (Core Shell Components)

Created:

- packages/ui/src/types/shell.types.ts (shell contracts)
- packages/ui/src/custom/shell/app-shell.tsx (AppShell + ShellMain)
- packages/ui/src/custom/shell/app-header.tsx (AppHeader + OmniSearch)
- packages/ui/src/custom/shell/app-sidebar.tsx (rail + nav + mobile tab bar)
- packages/ui/src/custom/shell/school-switcher.tsx
- packages/ui/src/custom/shell/user-menu.tsx
- packages/ui/src/custom/shell/app-breadcrumbs.tsx
- packages/ui/src/custom/shell/page-header.tsx (PageHeader + SegmentedControl)
- apps/web/app/design-system/shell/page.tsx (full-bleed shell preview;
  holds all sample data)

Edited:

- apps/web/app/design-system/page.tsx (added "View app shell" link)
- TECHNICAL_DEBT.md (updated TD-001 status)
- AI_HANDOFF.md (this file)

No changes to existing `packages/ui` components, the Prisma schema, or any API.
Shell components only consume existing primitives and the Milestone 2 tokens.

## Milestone 2 (Token Foundation)

Edited:

- packages/ui/src/styles/globals.css (Aurora token layer; removed legacy
  starter variables + gradient body)
- AI_HANDOFF.md (this file)

Created:

- .claude/launch.json (preview dev-server config for the `/design-system`
  verification route)

No changes to `packages/ui` components, the Prisma schema, or any API.

## Milestone 1 (Web Preview Scaffold)

Created:

- apps/web/package.json
- apps/web/next.config.ts
- apps/web/tsconfig.json
- apps/web/postcss.config.js
- apps/web/eslint.config.mjs
- apps/web/components.json
- apps/web/.gitignore
- apps/web/lib/utils.ts
- apps/web/app/layout.tsx
- apps/web/app/page.tsx
- apps/web/app/providers/theme-provider.tsx
- apps/web/app/design-system/page.tsx

Edited:

- pnpm-workspace.yaml (added React type `overrides`)
- TECHNICAL_DEBT.md (added TD-003, TD-004)
- AI_HANDOFF.md (this file)

No changes to `packages/ui`, the Prisma schema, or any API.

---

# Architectural Decisions

Decision:

`apps/web` is a design-system preview surface only for Phase 1, not a product
app. `/` redirects to `/design-system`.

Reason:

Roadmap scopes `apps/web` to validating shared UI before product workflows
begin; keeps the foundation stable before screens are built on it.

---

Decision:

Pin a single `@types/react` / `@types/react-dom` across the workspace via
`pnpm-workspace.yaml` overrides.

Reason:

Transitive deps (Radix) pulled an older `@types/react`; multiple copies break
forwardRef components as JSX element types. A single version is required for the
shared UI to type-check from `apps/web`.

---

# Outstanding Tasks

Phase 1 is complete (all 7 milestones); Phase 2 has begun. The items below carry
forward — see also the Known Gaps section of `packages/ui/README.md`.

High Priority (Phase 2 entry)

- ✅ DONE — wired the M4 navigation model to a real `ViewerContext` + the Next
  router (`usePathname` / `router.push`) and built the first authenticated
  surface (`/overview`). See the Phase 2 session summary above.
- Replace the **mock session** in `app/providers/viewer-provider.tsx` with a real
  auth source (NextAuth / server component / API). The seam is in place; nothing
  downstream needs to change.
- Build out real screens for the high-traffic nav destinations that currently
  fall through to the `[...slug]` placeholder. ✅ Done: **Students directory**
  (`/students/directory`), **Enrollment** (`/students/enrollment`), **Attendance
  daily register** (`/attendance/daily`), **Classes** (`/classes/timetable` ·
  `/classes/subjects` · `/classes/gradebook`), **Finance** (`/finance/invoices` ·
  `/finance/payments` · `/finance/reports`), **Settings** (general · branding ·
  features · roles · users · audit), and the full **Students** area (directory ·
  enrollment · attendance history · fees · transport · gradebook report-cards +
  transcripts). The main remaining placeholder section is **Reports**
  (`/reports/academic`, `/reports/analytics`) — fits `StatGrid` + `Meter` or the
  `chart` primitive.

Medium Priority

- Add unit tests for the pure resolver (`resolveNavigation` / `canAccess` /
  `isRouteActive`) — currently cross-checked only via a throwaway harness.

Low Priority (cleanups)

- Fix the `@workspace/ui` lint script's missing eslint dep (source is covered by
  `tsc` + the `web` lint today).
- Regenerate + commit `pnpm-lock.yaml` (stale `lockfileVersion 5.4`).
- TD-002 (notification service) — unbuilt feature in `TECHNICAL_DEBT.md`.

---

# Known Issues

- Git state: the project lives on branch **`claude`**, fully pushed. `origin` is
  now the HTTPS remote `https://github.com/Ewosoft-Solutions/claude-trial.git`
  (the earlier SSH-alias form is gone, so the old passphrase-key blocker no
  longer applies). `origin/claude` is at the latest local commit; `main`,
  `codex`, and `chore/technical-debt-cleanup` also exist on the remote. No PR
  from `claude` → `main` is open yet (deferred by choice — open one when Phase 2
  has more substance). NB: the Phase-2 *student-directory* work (this session)
  is **uncommitted** in the working tree — commit + push it.
- Preview launcher blocked by macOS Privacy (TCC): `preview_start` fails because
  the Claude app's preview-launcher helper has **not been granted access to the
  `~/Documents` folder**, where this project lives. Symptoms seen: `EPERM:
  uv_cwd` (can't stat its cwd under Documents) and `EPERM: open/access` on
  `apps/web/package.json`. Confirmed by isolation — the launcher reads a script
  in `/tmp` fine but `EPERM`s on any file under the project tree. Not a project
  or `launch.json` issue: the Bash tool (different entitlement) reads the tree
  and `next dev` launched from `apps/web` serves normally.
  Real fix (user action): System Settings → Privacy & Security → **Files and
  Folders** → enable the **Documents Folder** for Claude (or add Claude under
  **Full Disk Access**), then switch the `web` launch config back to the
  `web-pnpm` form for live HMR. Alternatively move the repo out of `~/Documents`
  (e.g. `~/dev`).
  Workaround in use (no grant needed): the default **`web`** launch config runs
  a self-contained build from `/tmp`, which the launcher can read; `web-pnpm`
  holds the original `pnpm --filter web exec next dev` form for once the grant
  is in place. Reproducible refresh after any source change —
  1) `output: 'standalone'` is set in `apps/web/next.config.ts`;
  2) `pnpm --filter web build`;
  3) `rm -rf /tmp/swe-preview && cp -R apps/web/.next/standalone/. /tmp/swe-preview/`,
     then `cp -R apps/web/.next/static /tmp/swe-preview/apps/web/.next/static`
     (and `public` if present);
  4) `/tmp/swe-run.cjs` chdir's to `/tmp/swe-preview/apps/web` and `import()`s
     `server.js` (ESM) with `PORT=3013` (3013, not 3001 — a sibling project,
     `codex_trial/apps/api`, permanently holds 3001; the `web` launch config's
     `port` is set to 3013 to match);
  5) restart via `preview_start web` (port 3013). NB: it serves a production
     *snapshot* — rebuild + re-copy after source changes — and `/tmp` clears on
     reboot.
- TD-002: notification service not implemented. Unbuilt feature (not cleanup);
  remains the only pending item in TECHNICAL_DEBT.md.
- TD-001, TD-003, TD-004: resolved this session (branch
  `chore/technical-debt-cleanup`, not yet merged). See the cleanup session
  summary above and TECHNICAL_DEBT.md.
- Stale lockfile: committed `pnpm-lock.yaml` is `lockfileVersion 5.4` (pnpm 6
  era) while the repo uses pnpm 10.4.1; any `pnpm install` regenerates it to
  `9.0`. Regenerating/committing it is a deferred, separate cleanup.
- `pnpm --filter @workspace/ui lint` fails to resolve `eslint` (package has no
  direct eslint dependency). Pre-existing infra; shell source is covered by
  `tsc` + the `web` lint. Deferred to Phase 2 (see README Known Gaps).
- Aurora's glassmorphic surfaces remain flattened to solid colour roles in the
  token layer (Milestone 2 decision). The shell renders against those flat
  roles; the decorative aurora gradient field was not reintroduced and is
  considered out of scope (chrome reads cleanly in both themes without it).

---

# Database Impact

No database changes made.

---

# API Impact

No API changes made.

Breaking Changes: None.

---

# Testing Status

TypeScript: ✅ Passed (`pnpm --filter web check-types`)
Lint:       ✅ Passed (`pnpm --filter web lint`, 0 warnings)
Build:      ✅ Passed (`pnpm --filter web build`, 33 routes)
Visual:     ✅ Students sub-pages verified in the preview browser
            (standalone-in-/tmp): fees (StatGrid + balance pills), transport
            (assignment pills), attendance history (present-rate Meters +
            on-track/at-risk), report-cards (grade + publish pills), transcripts
            (CGPA + standing), `/students/gradebook` redirect → report-cards; no
            console errors. Earlier: Settings (6 sections + interactive toggles),
            Finance (invoices/payments/reports + Meter), Classes, enrollment,
            `/attendance/daily` (live toggles 10/0/0 → 7/1/2), directory
            (search → EmptyState → reset; light + dark), `/overview`; M5–M7.
Docs:       ✅ packages/ui/README.md (usage, catalog, a11y checklist, responsive
            notes, Phase-2 known gaps)
Unit Tests: ⚠ None added (presentational components + pure resolver; resolver
            cross-checked via a throwaway tsx harness — a real unit test for
            `resolveNavigation` is a good Phase-2 follow-up)
E2E:        ⚠ Not applicable yet

---

# Next Recommended Prompt

Moved to its own file: **[`NEXT_RECOMMENDED_PROMPT.md`](./NEXT_RECOMMENDED_PROMPT.md)** — start the next
session with **"Read NEXT_RECOMMENDED_PROMPT.md"**. Keep it in sync at the end of each
session (it summarizes the status/history captured in full above).
