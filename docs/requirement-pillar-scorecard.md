# Requirement-Pillar Scorecard

> Snapshot assessment of how the current build aligns with `requirements/`.
> Created 2026-06-20. This is a point-in-time judgement — re-verify against code
> before relying on a row, and update it as the project moves.

## Headline verdict

The **foundation** is well-aligned with the requirements; the **integration**
has not started. The design-system and access-control *modeling* faithfully
mirror the requirements, and a substantial real backend exists (`apps/api`), but
the Next.js frontend runs entirely on mock data and is not wired to that backend.

## Scorecard

| Pillar | Requirement (source) | Status | Notes |
|---|---|---|---|
| **Design system** | Token-driven, light/dark parity, a11y, explicit states, no per-page styling (`PRD.md` A1–A6) | ✅ Strong | Aurora tokens, M3–M6 components, state set, charts; 72 UI tests |
| **Access control (model)** | 11 clearance levels (0–10), standard roles, ~240 permissions, scope (`access-control.md`, `permissions.md`) | ✅ Aligned | `packages/ui/src/types/access.types.ts` mirrors the hierarchy; nav resolver tested |
| **Access control (backend)** | RBAC, maker-checker, MFA, audit, breach response (`permissions.md`, `access-control.md`) | ✅ Substantial | Exists in `apps/api`, DB-backed; was previously undocumented |
| **Multi-tenancy (data)** | Tenant isolation, hybrid DB, audit (`multi-tenant-architecture.md`, `multi-tenancy-security-strategy.md`) | 🟡 Modeled | `Tenant`/`Role`/`Permission`/`AuditLog` Prisma models + `select-school`; isolation enforcement not yet audited |
| **Frontend ↔ backend** | Real data, real auth | ❌ Not started | `apps/web` imports neither `@workspace/api` nor `@workspace/database`; every page is mock; `getSession()` is a stub |
| **Polymorphism (UI)** | Nav/UI adapts by school type (`polymorphic-design.md`, `PRD.md` §5) | 🟡 Typed, not exercised | `SchoolType`/`schoolType` exist in the model but no nav config branches on `schoolType`; feature toggles are a mock settings page |
| **PWA / mobile** | Offline, push, quick actions, responsive (`mobile-web-hybrid.md`) | 🟡 Partial | Responsive ✅; offline/push/install not started (deferred) |
| **Subdomain tenant resolution** | `{slug}.domain` routing (`multi-tenant-architecture.md`) | ❌ Not in `apps/web` | No middleware / host-based tenant resolution in the frontend |
| **AI (phase-gated)** | Tutor + analytics AI (`ai-integration.md`) | ⏸️ Not started | Correctly deferred; an `ai-mediator.service` stub exists in `apps/api` |

## Legend

- ✅ Strong / Aligned / Substantial — materially meets the requirement
- 🟡 Partial / Modeled / Typed — present in part or in design, not fully realized
- ❌ Not started — required but absent
- ⏸️ Deferred — intentionally out of current scope

## Top risks (at time of writing)

1. **Integration debt** — a maturing backend and a fully-mock frontend have grown
   in parallel with zero wiring; contract drift risk grows over time.
2. **Doc accuracy** — fixed 2026-06-20: earlier hand-offs wrongly said "no auth
   backend" (they checked `packages/api`, not `apps/api`).
3. **Polymorphism asserted but not demonstrated** — the central product
   differentiator; modeled, not realized in any surface.
4. **Phase-numbering collision** — internal roadmap Phase 1/2 ≠ PRD Phase 1/2/3.

## Highest-value next move

Wire `getSession()` to `apps/api`'s `/auth/login` → `/select-school` flow as the
first frontend↔backend vertical slice — it also validates the access-control
model end-to-end and is now known to be unblocked.
