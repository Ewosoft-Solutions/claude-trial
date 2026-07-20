# SchoolWithEase — Project Audit

_Date: 2026-06-08 · Branch: `main` · Auditor: automated codebase review_

This audit reflects the **actual state of the working tree**, which differs materially from the project's own status documents. The repo has been restructured: the previously committed `apps/web` Next.js frontend, the `_requirements/`, `_actions/`, and `_testing/` folders, and the API testing guides have all been **deleted** (visible in `git status`). The narrative docs (`AI_CONTEXT.md`, `AI_HANDOFF.md`, `CURRENT_PHASE.md`) describe a Next.js + frontend-first Phase 1 that no longer matches reality.

---

## 1. Architecture Assessment

**Shape.** pnpm + Turborepo monorepo. Workspaces: `apps/*` and `packages/*`.

| Workspace | Stack | State |
|---|---|---|
| `apps/api` | **NestJS 11** (not Next.js) | Substantial, ~20 controllers, ~10 modules |
| `apps/web` | — | **Empty directory** (frontend deleted) |
| `apps/docs` | — | A single stray markdown file (`raw/user-management.md`) |
| `packages/database` | Prisma 7 + Postgres (pg adapter) | Mature schema, 7 migrations, large seed |
| `packages/api` | Shared Nest library (`@workspace/api`) | Tenant context/jwt/queries services + shared enums/DTOs |
| `packages/ui` | React 19 + shadcn/ui (new-york) + Tailwind v4 | ~25 primitives + shadcn dashboard scaffold |
| `packages/tailwind-config` / `typescript-config` / `eslint-config` / `vitest-config` / `jest-config` | Shared tooling | Present and wired |

**Observations**

- **Doc/code drift is the headline architecture risk.** `AI_CONTEXT.md` lists Next.js as the stack and frontend reconstruction as "Current Priority (Phase 1)," but the only running application is a NestJS API and the web app is gone. Source-of-truth docs cannot be trusted as-is.
- **Backend split between `apps/api` and `packages/api` is blurry.** Tenant logic lives in *both* (`apps/api/src/tenant/**` and `packages/api/src/tenant/**`). The boundary/ownership between the app's tenant module and the shared library's tenant services is undocumented and will cause duplication and confusion.
- Test split is inconsistent: `apps/api` uses **Jest** (`jest.config.ts`, `test/*.e2e-spec.ts`), while the root and shared packages standardize on **Vitest** (`@workspace/vitest-config`, root `vitest` dep). `apps/api` even lists `vitest` as a dependency it does not use.
- No CI: there is **no `.github/workflows/`**. The "must compile, lint, and type-check before complete" rule in `AI_CONTEXT.md` is unenforced.
- No containerization/deploy manifest (no Dockerfile, no compose, no IaC). Only `env.*.template` files exist.
- Build artifacts are committed/tracked in the tree: `apps/api/dist/**`, `apps/api/coverage/**`, and `packages/api/src/**/*.js` (compiled `.js` sitting next to `.ts` sources). These should not be in source control.

---

## 2. Frontend Assessment

**Status: effectively non-existent.**

- `apps/web/` is an empty directory. The prior Next.js app (`app/(protected)`, `(public)`, providers, `lib/api.ts`, `routes.ts`) has been deleted and not replaced.
- There is therefore **no application shell, no routing, no auth UI, no data-fetching layer, no PWA setup** — despite the PRD's strong PWA, offline, and responsive requirements.
- The only frontend code that exists is in `packages/ui` (component library) — it has no consumer.
- `design-export/` contains rich hi-fi HTML/CSS/JS design references (Aurora layout, role dashboards, auth flow, mobile experience, AI assistant) plus screenshots. These are **design source-of-truth** per `DESIGN_RULES.md` but nothing in code consumes them yet.

**Implication:** "Phase 1 frontend" is essentially greenfield. The handoff doc's claim of "35% complete, built button/input/sidebar, dashboard layout" describes the *deleted* app, not the current state.

---

## 3. Backend Assessment

**Status: the most mature part of the project.** NestJS 11, modular, with real domain depth.

**Modules present** (`apps/api/src/app.module.ts`): Common, Links, Auth, Tenant, Student, AcademicStructure, AssessmentGrading, Communication, ReportingAnalytics.

**Strengths**

- **Auth/security is deep and serious.** `auth/services` (~22 files) covers authentication, JWT, sessions, password + password reset + password history, login-attempt throttling, **MFA across TOTP / WebAuthn / SMS / email** with audit, breach response, maker-checker workflow, permission + permission-pool + role services, security-policy, platform oversight, and an AI mediator.
- **Guards** are comprehensive: `jwt-auth`, `permission`, `clearance-level`, `mfa-required`, `tenant-context`, `context-validation`, `security-policy`, `pre-auth`.
- Global `ValidationPipe` (whitelist + forbidNonWhitelisted + transform), global `HttpExceptionFilter`, request-logging middleware, Swagger with bearer auth and tagged docs.
- Config is validated at boot with **Joi** (`env.config.ts`), and the DB module is wired with pool sizing, timeouts, and conditional log levels.
- `Links` is leftover Nest CLI scaffolding (generated CRUD example) and should be removed.

**Weaknesses / gaps**

- **The RLS context interceptor is never registered.** `RlsContextInterceptor` exists but there is no `APP_INTERCEPTOR` provider in `app.module.ts` (no `APP_GUARD` either). So per-request tenant context setting is, as wired today, **not active globally**. (See §4/§7.)
- The `withTenant` Prisma extension is explicitly marked "OPTIONAL" and hard-codes a set of **only 11 tenant-scoped models** — many tenant-owned tables are not in the list, so application-level filtering is partial and easy to forget.
- CORS is wide open (`app.enableCors()` with no origin allowlist).
- `apps/api` has its own `.prettierrc.mjs` / `eslint.config.mjs` duplicating root config.
- Domain modules beyond auth/tenant (academic, assessment, communication, reporting, student) are thinner — mostly controllers + a service each; depth/coverage there is unverified.

---

## 4. Prisma Assessment

**Status: well-organized schema, but a critical isolation gap.**

**Strengths**

- **Multi-file schema** under `prisma/models/` split by bounded context (tenant, user-management, roles-permissions, profile, academic-structure, assessment-grading, communication, student-management, security-policy, audit-logging, jwt-secrets) — clean and readable (~1,500 lines total).
- Uses **Postgres multi-schema** (`schemas = [...]`) mapping each context to its own DB schema — strong logical separation.
- Modern setup: Prisma 7, `@prisma/adapter-pg` with a `pg` Pool, `prisma.config.ts`, singleton client with dev global caching (`packages/database/src/client.ts`).
- Rich RBAC model: `Role` (platform/system/custom with clearance levels 0–10), `Permission` (resource.action.context, category, required clearance), permission pools with inheritance, per-profile permission overrides, maker-checker requests.
- Good indexing discipline visible on `Role`/`Permission`/`Tenant`; documented in `docs/INDEXES_AND_CONSTRAINTS.md`.
- 7 sequential migrations with sensible names; substantial seed (`scripts/seed.ts`, ~3,600 lines) plus a `verify-seed.ts`.

**Critical gap**

- **RLS is documented but not implemented in the database.** `docs/RLS_IMPLEMENTATION.md` prescribes `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... current_setting('app.current_tenant_id')` on every tenant table, but **no migration contains a single `ENABLE ROW LEVEL SECURITY` or `CREATE POLICY` statement** (verified: the only file with those keywords is the doc itself). The init migration has zero RLS references.
- Consequence: the architecture's headline claim — "shared database with strict tenant isolation enforced at the DB layer" — is **false in the current schema**. Isolation rests entirely on application code that is itself partial (§3) and not globally wired (§4 interceptor).

**Other notes**

- `Tenant` model carries only a generic `settings Json?` — there are **no first-class columns for branding or feature toggles**, both of which the PRD/polymorphic requirements treat as core. They'd have to live untyped inside `settings`.
- Application-level uniqueness is required for platform/system role names (Prisma can't enforce it because `@@unique([name, tenantId])` permits multiple NULLs) — a documented footgun.

---

## 5. API Assessment

**Surface:** ~20 controllers; roughly **138 route handlers** (53 POST, 48 GET, 16 PUT, 13 DELETE, 8 PATCH).

**Strengths**

- OpenAPI/Swagger is set up with bearer auth, tag list, and persisted authorization at `/api/docs`.
- DTO-driven with `class-validator`/`class-transformer` and a strict global validation pipe.
- Coverage spans auth, MFA, tenant management/registration, user management, students (+ guardians), academic structure (years/classes/courses), assessment/grading (assessments/grades/grading systems), communication (announcements/messages), reporting, audit logs, role/permission management, security policy, and breach response.
- e2e tests exist for the important seams: `auth`, `mfa`, `authorization`, `multi-tenant-isolation`, `breach-response`, plus unit specs for permission pool inheritance, custom-role constraints, student-guardians.

**Weaknesses**

- **No API versioning** (no `/v1` prefix or Nest URI versioning) despite the "backward compatible" mandate in `AI_CONTEXT.md`.
- Open CORS (noted above) is a production concern.
- No global rate limiting (`@nestjs/throttler` absent) — only login-attempt-specific logic.
- The example `Links` resource is exposed as real API surface and should be deleted.
- API health/readiness endpoints not evident beyond the default `AppController`.

---

## 6. Design-System Readiness

**Status: a solid shadcn baseline, but not yet the *product's* design system.**

- `packages/ui` is a proper shared library: Tailwind **v4**, shadcn (`new-york`, neutral base, CSS variables), correct subpath `exports` for `components/*`, `custom/*`, `hooks/*`, `lib/*`, and `globals.css`.
- ~25 primitives present (button, input, select, table, tabs, card, sheet, drawer, dropdown, sidebar, tooltip, breadcrumb, avatar, badge, skeleton, chart, etc.) plus `custom/` pieces (`app-sidebar`, `nav-main/user/projects`, `team-switcher`, `data-table`, `section-cards`, `chart-area-interactive`, `site-breadcrumbs`, `mode-toggle`, `color-scheme`).
- Tokens are centralized in `globals.css` with light/dark variants (`--background`, `--primary`, `--sidebar`, `--chart-*`, `--radius`, etc.) using oklch — good foundation for theming and dark-mode parity.

**Gaps vs. requirements**

- The `custom/` set is essentially the **stock shadcn "dashboard-01" block**, not components derived from the rich `design-export/` (Aurora) designs that `DESIGN_RULES.md` names as source-of-truth. There's a gap between the exported hi-fi designs and the scaffolded components.
- Tokens are the **default shadcn neutral grayscale** — they do not encode the PRD's brand direction ("glass-and-light / graphite-and-ink," contrast-safe per-tenant primary/accent).
- **No tenant-level theming/branding mechanism** (per-tenant logo/colors within contrast bounds) — required by PRD A2, absent in both UI and DB.
- No evidence of accessibility tooling, no Storybook/visual catalog, no design-token pipeline, and the library currently has **no consumer app** to validate it against.

---

## 7. Risks

| # | Risk | Severity | Notes |
|---|---|---|---|
| R1 | **Tenant isolation not enforced at DB layer.** RLS documented but no policies/migrations exist; app-level filtering is partial and the RLS interceptor isn't globally registered. | **Critical** | Cross-tenant data exposure is possible if any query omits a manual `tenantId` filter. |
| R2 | **Doc/reality drift.** `AI_CONTEXT.md`/`AI_HANDOFF.md`/`CURRENT_PHASE.md` describe a Next.js frontend Phase 1 that has been deleted; stack is actually NestJS. | High | Future work driven from these docs will be misdirected. |
| R3 | **No frontend at all.** `apps/web` empty; PWA/offline/responsive requirements unstarted. | High | The product has no user-facing surface. |
| R4 | **No CI/CD and no deploy artifacts.** Quality gates (lint/type/test/build) unenforced; no Dockerfile/IaC. | High | Regressions and broken builds can land unnoticed. |
| R5 | **Raw SQL string interpolation for context** (`SET LOCAL app.current_tenant_id = '${tenantId}'` via `$executeRawUnsafe`). | Medium | Acceptable only if `tenantId` is always a validated UUID; still an injection-shaped pattern. Prefer parameterized `set_config`. |
| R6 | **Session vs. transaction context with pooling.** Interceptor sets context at request scope using `SET LOCAL`, which is transaction-scoped; with a `pg` Pool this can either no-op or leak across requests. | Medium | Needs the transaction-wrapped approach the code hints at but doesn't enforce. |
| R7 | **Open CORS + no rate limiting + no API versioning.** | Medium | Production hardening gaps. |
| R8 | **Committed build artifacts** (`dist/`, `coverage/`, compiled `.js` beside `.ts`). | Low | Repo hygiene; risk of stale artifacts being imported. |
| R9 | **Test-runner split (Jest in api, Vitest elsewhere).** | Low | Maintenance overhead, duplicated config. |
| R10 | **Branding/feature-toggle data has no schema home.** Only `Tenant.settings Json?`. | Medium | Polymorphic per-tenant config will be untyped and unvalidated. |

---

## 8. Missing Infrastructure

- **CI pipeline** (`.github/workflows`): lint + typecheck + `turbo build` + unit/e2e on PR. None today.
- **Containerization & deploy**: Dockerfile(s), compose for local Postgres, and a deploy target (api + db + future web). None today.
- **Actual RLS migration(s)**: `ENABLE ROW LEVEL SECURITY` + per-table tenant policies + `FORCE ROW LEVEL SECURITY`, to match the documented strategy.
- **Frontend application**: a Next.js (or chosen) app in `apps/web` with routing, auth, API client, and PWA manifest/service worker.
- **API hardening**: versioning, CORS allowlist, `@nestjs/throttler`, health/readiness endpoints, structured/observable logging + error tracking.
- **Unified test strategy** and coverage thresholds (pick Vitest or Jest per layer; wire into CI).
- **Tenant theming/feature-flag infrastructure** (DB columns or a config service) to satisfy polymorphic/branding requirements.
- **Secrets management** beyond local `.env` files (templates exist; no vault/secret-store guidance).
- **Refreshed source-of-truth docs** reconciling the NestJS reality with the requirements set.

---

## 9. Recommended Phase 1 Implementation Plan

Phase 1's stated goal (design-system + frontend) is sound, but it must be sequenced **after** closing the tenant-isolation gap, since every screen will read tenant data. Recommended ordering:

**Workstream A — Close the security/isolation gap (must precede UI data work)**
1. Write a Prisma migration that enables RLS and creates `tenant_isolation` policies (and `FORCE ROW LEVEL SECURITY`) on **every** tenant-scoped table, using `current_setting('app.current_tenant_id', true)::uuid`.
2. Globally register `RlsContextInterceptor` (or a guard) via `APP_INTERCEPTOR`, and ensure context is set with **transaction-scoped** `SET LOCAL` (or `set_config(..., true)` parameterized) so it is safe under connection pooling. Replace `$executeRawUnsafe` interpolation with parameterized `set_config`.
3. Expand/replace the `withTenant` extension so tenant scoping is **default-on for all tenant models**, not an opt-in list of 11 — defense-in-depth behind RLS.
4. Add the `multi-tenant-isolation` e2e suite to a CI gate; assert cross-tenant reads fail.

**Workstream B — Establish delivery guardrails (parallel, fast)**
5. Add `.github/workflows/ci.yml`: install → `turbo lint typecheck build test` on PRs to `main`.
6. Remove tracked build artifacts (`apps/api/dist`, `coverage`, compiled `packages/api/**/*.js`); add to `.gitignore`.
7. Delete the scaffold `Links` module/resource.
8. Reconcile `AI_CONTEXT.md` / `AI_HANDOFF.md` / `CURRENT_PHASE.md` with the actual NestJS-API + empty-web reality.

**Workstream C — Frontend foundation (the actual Phase 1 deliverable)**
9. Scaffold `apps/web` (Next.js App Router, React 19, Tailwind v4) consuming `@workspace/ui`; wire PWA manifest + service worker shell.
10. Build the **app shell** from `design-export/` (Aurora): protected/public layouts, role-aware sidebar/nav, theme provider with light/dark parity.
11. Implement **auth flows** against the existing API (login, MFA challenge, password reset, school/profile selection) with a typed API client and error/empty/loading states.
12. Promote the design tokens from default-neutral to the PRD brand direction; add a **per-tenant branding** mechanism (DB columns or config service + token override at runtime).

**Workstream D — Design-system completion (overlaps C)**
13. Map `design-export` components to `packages/ui` `custom/` components; replace the stock dashboard-01 scaffold with product components.
14. Add accessibility checks (WCAG AA), a component catalog (Storybook or equivalent), and visual/contrast validation as a CI step.

**Suggested gate for "Phase 1 complete":** RLS enforced + verified by e2e; CI green on lint/type/test/build; `apps/web` boots with shell, theming, and working auth against the API; UI library consumed by the web app and aligned to the exported designs.
