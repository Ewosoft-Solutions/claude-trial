# Phase 0 — scope-lock + ADRs

**Goal:** turn the assessment into an approved parity contract + settled architecture, so **no P0 build later forces a core-table redesign**. No feature code ships in this phase. Items: `P0-1..P0-4` + `ADR-01..12` on the [board](TASK-BOARD.md).

**Exit gate:** each P0 job has an owner, current artefact, target workflow, and acceptance test; source export formats + limits are known; every ADR that a Phase-1 item depends on is `Accepted`.

---

## P0-1 · Confirm Release-1 profile + "retire the legacy system" definition — owner decision, `S`

Answer [decision questions](../plan/06-roadmap-and-discussion-guide.md#decision-workshop--questions-to-settle) **1–3**: which schools Release-1 replaces end-to-end, what "retire" contractually covers, and which evidence outranks a screenshot. **Recommended default:** NG K-12 as the first full profile; guarantee the critical jobs the design partners actually use; publish a supported/excluded matrix. **Deliverable:** a one-page "Release-1 promise" committed here. **Unblocks:** ADR-11, ADR-10, and profile-specific scope in every workbench.

## P0-2 · Design partners + used-job inventory + exports — owner, `M`

Recruit two partners revealing variation (see [06 §pilot](../plan/06-roadmap-and-discussion-guide.md#recommended-pilot-shape)); for each, list which the legacy system modules they actually use, and collect **redacted** exports: a report card, a receipt, a broadsheet, a fee schedule, a debtor list, a student export. **Deliverable:** `partners/<name>-used-jobs.md` + a redacted-samples folder (git-ignored if sensitive). **Why it gates:** these samples are the real acceptance fixtures + the migration source contract; building admissions/results/finance without them is guessing.

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
- At least one partner's used-job inventory + redacted samples are in hand.
- `pnpm ci:quick` still green (docs-only changes shouldn't break it — but run it; markdown lint/format is part of the contract).
