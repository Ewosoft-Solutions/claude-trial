# Requirement-Pillar Scorecard

> Snapshot assessment of how the current build aligns with `requirements/`.
> Created 2026-06-20; **refreshed 2026-07-10** after the full-swing sprint
> cleared the parked backlog (feature toggles, subdomain routing, PWA Phase 2,
> Step 8 sub-surfaces, Gate 4, AI settings maker-checker, app_runtime grants).
> This is a point-in-time judgement — re-verify against code before relying on
> a row.

## Headline verdict

PRD Phase 1 (core platform) and the operational-module half of Phase 2 are
**built and wired end-to-end**: real auth, RBAC on a 297-permission catalog,
RLS-enforced tenancy, and every major domain (academic, finance,
communication, admissions, transport, library, health, HR/payroll, events)
has a real backend module and at least one real frontend surface. As of
2026-07-10 the former parked backlog is cleared: PWA Phase 2 (installable +
offline + push handlers), subdomain tenant routing, demonstrated
schoolType/feature-toggle polymorphism, the last Step 8 sub-surfaces, Gate 4,
and AI settings maker-checker all shipped. The remaining edges are operational,
not build gaps: per-environment `app_runtime` activation (ADR-004), a web-push
delivery backend, and live browser acceptance of the newest surfaces.

## Scorecard

| Pillar | Requirement (source) | Status | Notes |
|---|---|---|---|
| **Design system** | Token-driven, light/dark parity, a11y, explicit states, no per-page styling (`PRD.md` A1–A6) | ✅ Strong | Aurora tokens, M3–M6 components, state set, chart wrappers; 72 UI tests |
| **Access control (model)** | 11 clearance levels (0–10), standard roles, granular permissions, scope (`access-control.md`, `permissions.md`) | ✅ Aligned | Mirrored in `packages/ui` types + nav resolver (tested); 297 permissions seeded |
| **Access control (backend)** | RBAC, maker-checker, MFA, audit, breach response (`permissions.md`, `access-control.md`) | ✅ Substantial | `apps/api`, DB-backed; exercised by the live frontend since Step 3 |
| **Multi-tenancy (data)** | Tenant isolation, hybrid DB, audit (`multi-tenant-architecture.md`) | ✅ Enforced at DB | RLS across 19 schemas (ENABLE/FORCE + policy), CI guard `db:rls:check`; runtime cutover to `app_runtime` role still pending (ADR-004) |
| **Frontend ↔ backend** | Real data, real auth | ✅ Wired (2026-07-01) | Full auth lifecycle incl. profile switching; all module pages hit real endpoints (dev-mode mock only as fallback when `NEXT_PUBLIC_API_URL` unset) |
| **Domain coverage** | Academic mgmt, admin/ops modules (`PRD.md` §4, `features-functionality.md`) | ✅ Broad MVP | Students/attendance/grading/finance/communication + all six Step 8 operational domains; some sub-surfaces still `[...slug]`-backed (see plan → Parked) |
| **Polymorphism (UI)** | Nav/UI adapts by school type (`polymorphic-design.md`, `PRD.md` §5) | 🟡 Typed, not exercised | `schoolType` in the model; no nav branching on it; feature toggles still a mock settings page |
| **PWA / mobile** | Offline, push, quick actions, responsive (`mobile-web-hybrid.md`) | ✅ Substantial (2026-07-10) | Responsive ✅; installable manifest + service worker (offline fallback, static caching, push/notificationclick handlers) + client subscribe. Web-push *delivery* backend (VAPID) is the remaining follow-on |
| **Subdomain tenant resolution** | `{slug}.domain` routing (`multi-tenant-architecture.md`) | ✅ Wired (2026-07-10) | Middleware resolves `{slug}.domain` → `x-tenant-slug`; public `GET /public/tenants/:slug`; login brands per subdomain |
| **Polymorphism / feature toggles** | schoolType-driven UI + real per-tenant feature toggles | ✅ Demonstrated (2026-07-10) | schoolType gates nav (tested); per-tenant `FeatureKey` toggles persisted in `tenant.settings`, surfaced via `/auth/me`, gate `canAccess`, edited at `/settings/features` |
| **AI — access control layer** | Clearance-scoped AI mediation (`ai-integration.md` §6) | ✅ Used in production paths | `AIMediatorService` validates/audits analytics tool calls and tutor exchanges; permission matrix tests added in Step 6 |
| **AI — foundation/governance** | Module, LLM SDK, chat persistence, `ai.*` permissions, usage controls (plan Steps 1+6) | ✅ Done 2026-07-09 | `AnthropicService`, `LlmProvider` port, chat persistence, `ai_settings`/monthly usage/concurrency leases with RLS, `/ai/admin/usage`, `/settings/ai-usage`; no new permissions beyond existing `ai.*` |
| **AI — Analytics assistant** | Role-scoped NL analytics with charts + insights (`ai-integration.md`) | ✅ Done 2026-07-07 | Tool-use SSE chat, persisted sessions, scoped charts, live owner/parent/student acceptance passed; Step 6 prompt-injection + matrix coverage added |
| **AI — Academic tutor** | Lesson-material RAG, chat history, integrity guardrails (`ai-integration.md`) | ✅ Code complete; live browser acceptance pending | Learning substrate + RAG tutor with citations, assessment-window block, teacher usage; unit coverage green, live paid-key browser pass still pending |
| **Test coverage** | (implied by CI quality bar) | 🟡 Better, still uneven | 185 API + 38 web + 82 UI tests; AI hardening tests added; Step 8 module breadth and gated RLS e2e still depend on CI/runtime DB |

## Legend

- ✅ Strong / Aligned / Substantial — materially meets the requirement
- 🟡 Partial / Modeled / Typed — present in part or in design, not fully realized
- ❌ Not started — required but absent

## Top risks (2026-07-10)

1. **Runtime RLS enforcement is prepared but not flipped per environment** —
   `app_runtime` grants + role are ready and isolation is proven AS the role,
   but each environment still needs `APP_RUNTIME_DATABASE_URL` set (secret) to
   actually run as the restricted role (ADR-004). Until then the app relies on
   app-level scoping with RLS as an audited backstop.
2. **Web-push has no delivery backend** — the service worker + client
   subscription ship, but VAPID signing + subscription persistence + fan-out
   are not built.
3. **No live browser acceptance for the 2026-07-10 surfaces** — new Step 8
   sub-surfaces, feature toggles, subdomain login, and PWA are unit-tested and
   build-verified but not exercised in a browser (preview is TCC-blocked here).

*Resolved since 2026-07-09:* Step 5 live acceptance (done 07-09 pt.4); AI
settings read-only → maker-checker mutate (07-10 slice 1); polymorphism/feature
toggles demonstrated (slice 5); Step 8 sub-surfaces + tests (slices 3–4).

## Highest-value next move

Activate the `app_runtime` cutover in the target environment (set
`APP_RUNTIME_DATABASE_URL`), then run a smoke pass of tenant-scoped flows to
confirm no privileged path regressed — turning RLS into the live runtime
backstop.
