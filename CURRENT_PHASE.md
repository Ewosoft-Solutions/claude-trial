# Current Phase

**Active initiative:** Product expansion — legacy-system capability parity.

> Refreshed 2026-07-31. The earlier Phase 3 AI objective is complete. The
> plan of record is now
> `design-export/product-expansion/action-plan/`; its task board is the single
> coordination point for implementation.

## Where the product stands

- The core platform, operational modules, and AI rollout are implemented.
- `apps/web` is wired to the real `apps/api` backend; runtime pages use backend
  data and explicit empty/error states rather than local mock fallbacks.
- RBAC has **305 seeded permissions across 9 persisted categories**, assembled
  from 28 catalog groups, plus 11 clearance levels (0–10), maker-checker,
  step-up, and audit enforcement.
- Tenant-owned data is covered by RLS checks, with the restricted
  `app_runtime` role prepared for per-environment activation.
- The parity assessment maps 116 legacy-system jobs to the target architecture.
  The delivery thesis is capability parity without copying the legacy
  information architecture.

## Current objective

Complete Phase 0 scope-lock and ADR acceptance, then build the shared
foundations and People workbench in dependency order. Work must be claimed on
`design-export/product-expansion/action-plan/TASK-BOARD.md` and completed to the
Definition of Done in `AGENTS.md`.

Product-owner decisions remain required for the Release-1 profile, design
partners/export fixtures, general-ledger direction, and tenant-versus-campus
boundary. Do not turn those unresolved choices into code.
