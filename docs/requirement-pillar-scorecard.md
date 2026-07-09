# Requirement-Pillar Scorecard

> Snapshot assessment of how the current build aligns with `requirements/`.
> Created 2026-06-20; **refreshed 2026-07-09** after AI integration plan
> Steps 1–6 shipped through the hardening/governance close-out. This is a
> point-in-time judgement — re-verify against code before relying on a row.

## Headline verdict

PRD Phase 1 (core platform) and the operational-module half of Phase 2 are
**built and wired end-to-end**: real auth, RBAC on a 297-permission catalog,
RLS-enforced tenancy, and every major domain (academic, finance,
communication, admissions, transport, library, health, HR/payroll, events)
has a real backend module and at least one real frontend surface. The
remaining gaps are the PWA-specific parts of Phase 2 (offline/push/subdomain
routing), exercised polymorphism, and live/manual acceptance for the newest
AI tutor/governance surfaces.

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
| **PWA / mobile** | Offline, push, quick actions, responsive (`mobile-web-hybrid.md`) | 🟡 Partial | Responsive ✅; offline/push/install not started (parked) |
| **Subdomain tenant resolution** | `{slug}.domain` routing (`multi-tenant-architecture.md`) | ❌ Not in `apps/web` | No host-based tenant resolution in the frontend (parked) |
| **AI — access control layer** | Clearance-scoped AI mediation (`ai-integration.md` §6) | ✅ Used in production paths | `AIMediatorService` validates/audits analytics tool calls and tutor exchanges; permission matrix tests added in Step 6 |
| **AI — foundation/governance** | Module, LLM SDK, chat persistence, `ai.*` permissions, usage controls (plan Steps 1+6) | ✅ Done 2026-07-09 | `AnthropicService`, `LlmProvider` port, chat persistence, `ai_settings`/monthly usage/concurrency leases with RLS, `/ai/admin/usage`, `/settings/ai-usage`; no new permissions beyond existing `ai.*` |
| **AI — Analytics assistant** | Role-scoped NL analytics with charts + insights (`ai-integration.md`) | ✅ Done 2026-07-07 | Tool-use SSE chat, persisted sessions, scoped charts, live owner/parent/student acceptance passed; Step 6 prompt-injection + matrix coverage added |
| **AI — Academic tutor** | Lesson-material RAG, chat history, integrity guardrails (`ai-integration.md`) | ✅ Code complete; live browser acceptance pending | Learning substrate + RAG tutor with citations, assessment-window block, teacher usage; unit coverage green, live paid-key browser pass still pending |
| **Test coverage** | (implied by CI quality bar) | 🟡 Better, still uneven | 185 API + 38 web + 82 UI tests; AI hardening tests added; Step 8 module breadth and gated RLS e2e still depend on CI/runtime DB |

## Legend

- ✅ Strong / Aligned / Substantial — materially meets the requirement
- 🟡 Partial / Modeled / Typed — present in part or in design, not fully realized
- ❌ Not started — required but absent

## Top risks (2026-07-09)

1. **Step 5 live acceptance still pending** — the tutor's paid-key browser pass
   must prove grounded citations, cross-lesson non-leak, integrity refusal,
   logout/login persistence, and assessment blocking without looping paid calls.
2. **AI cost controls now exist but settings are read-only** — changing model
   tiers/quotas/BYOK keys needs a future maker-checker configuration workflow.
3. **Polymorphism still asserted, not demonstrated** — the central product
   differentiator remains unexercised (parked, but aging).
4. **Step 8 modules still unevenly tested** — six domains rely heavily on manual
   verification.

## Highest-value next move

Run the Step 5 live browser acceptance with the spend-capped Anthropic key,
then refresh PR #1 with the full AI Steps 1–6 delivery and verification notes.
