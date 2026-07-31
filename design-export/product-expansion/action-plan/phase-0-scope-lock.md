# Phase 0 — scope-lock + ADRs

**Goal:** turn the assessment into an approved parity contract + settled architecture, so **no P0 build later forces a core-table redesign**. No feature code ships in this phase. Items: `P0-1..P0-4` + `ADR-01..12` on the [board](TASK-BOARD.md).

**Exit gate:** each P0 job has an owner, current artefact, target workflow, and acceptance test; source-format learnings are taken from the legacy-system screenshots (real per-school exports collected at that school's onboarding — see P0-2 — **not** before the build); every ADR that a Phase-1 item depends on is `Accepted`.

---

## P0-1 · Confirm Release-1 profile + "retire the legacy system" definition — owner decision, `S` — ✅ **decided 2026-07-31**

Answer [decision questions](../plan/06-roadmap-and-discussion-guide.md#decision-workshop--questions-to-settle) **1–3**: which schools Release-1 replaces end-to-end, what "retire" contractually covers, and which evidence outranks a screenshot. **Recommended default:** NG K-12 as the first full profile; guarantee the critical jobs the design partners actually use; publish a supported/excluded matrix. **Deliverable:** a one-page "Release-1 promise" committed here → **[`release-1-promise.md`](release-1-promise.md)** (owner approved the defaults). **Unblocks:** profile-specific scope in every workbench + P0-2's redacted-export requirement. **Note:** ADR-11 (tenant/campus, Q6) and ADR-10 (GL build-vs-integrate, Q19–20) are separate owner decisions and stay `blocked (owner)` — P0-1 frames but does not grant them.

## P0-2 · Design-partner validation + per-school exports — owner, `M` — **resequenced: not a pre-build gate**

**Strategy (2026-08-01, owner):** the legacy-system screenshots already sample what these schools use, so we **build from those learnings + seed data** (as we already seed) to a fully-functional demo first, sell on the working product, then tweak per school. P0-2 therefore moves from "before we build" to **onboarding time**: when a specific school signs, recruit it as a design partner, collect its **redacted** exports (report card, receipt, broadsheet, fee schedule, debtor list, student export), and use them to **reconcile that school's real data before its live cutover** (the Q3 evidence rule). An early partner may optionally validate our seed assumptions sooner. **Deliverable (per school, at onboarding):** `partners/<name>-used-jobs.md` + a redacted-samples folder (git-ignored if sensitive). **No longer gates:** the Phase-1/2 build or the demo.

## P0-3 · Draft + accept the 12 ADRs — `L`

Draft each ADR from the recommended defaults in [04](../plan/04-target-product-and-architecture.md) + [06](../plan/06-roadmap-and-discussion-guide.md), using the [template](adr/README.md). Sequence by what unblocks Phase 1: **ADR-06 (jobs/outbox) → ADR-01 (person) → ADR-07 (delivery) → ADR-03 (curriculum) → ADR-08 (documents/signatures) → ADR-09 (migration)** first; ADR-02/04/05 before their workbenches; **ADR-10 (GL build-vs-integrate) and ADR-11 (tenant vs campus)** need the owner. **Done when:** each ADR is `Accepted` (owner-gated ones signed) and its dependent board rows flip `blocked → ready`.

## P0-4 · Scorecards — `S`

Stand up the three tracking artefacts from [06 §5](../plan/06-roadmap-and-discussion-guide.md#suggested-parity-scorecard):

- **Parity scorecard** — score each _job_ 0–4 (not each screen), with personas, incumbent C-IDs, our route/model, required transitions, permissions, migration, a11y, acceptance, owner, score+date.
- **Migration reconciliation sheet** — the gates from [04 §migration](../plan/04-target-product-and-architecture.md#migration--cutover-p0-capability).
- **Acceptance register** — the scenarios from [06 §acceptance](../plan/06-roadmap-and-discussion-guide.md#acceptance-scenarios-that-matter).
  Keep them here as living markdown (or a sheet linked here).

---

### Verification for Phase 0 (no code, but still checkable)

- Every board row that a Phase-1 item depends on is `Accepted`/`done`.
- The Release-1 promise + supported/excluded matrix exists and is signed.
- Source-format learnings captured from the legacy-system screenshots + representative NG K-12 seed data planned. _(Real per-school exports deferred to onboarding — see P0-2; not a pre-build gate.)_
- `pnpm ci:quick` still green (docs-only changes shouldn't break it — but run it; markdown lint/format is part of the contract).
