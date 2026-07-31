# Product-expansion — action plan

This turns the [assessment](../plan/README.md) into **executable, agent-agnostic work**. It is the plan-of-record for the product-expansion initiative (source-of-truth priority #3, per [`/AGENTS.md`](../../../AGENTS.md)).

## How this maps to the assessment

| Assessment (analysis)                                                                          | Action plan (execution)                                                            |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [07 · parity matrix](../plan/07-capability-parity-matrix.md) (116 jobs, decision/effort/phase) | → [`TASK-BOARD.md`](TASK-BOARD.md) work items (each item cites its `#` matrix row) |
| [06 · roadmap](../plan/06-roadmap-and-discussion-guide.md) (phases + gates)                    | → [`BACKLOG.md`](BACKLOG.md) (phase structure) + the detailed near-term docs       |
| [04 · architecture](../plan/04-target-product-and-architecture.md) (ADRs to record)            | → [`adr/`](adr/README.md) (the 12 decisions, tracked to closure)                   |
| [08 · design bridge](../plan/08-design-system-bridge.md)                                       | → the "UI" section of each work item (Aurora components/tokens)                    |

## What's detailed now vs later

Per the chosen scope (**near-term detailed + rest as backlog**):

- **Detailed & ready:** [Phase 0 — scope-lock + ADRs](phase-0-scope-lock.md) · [Phase 1 — shared foundations](phase-1-foundations.md) · [Workbench 1 — Shared foundations + People](workbench-people.md).
- **Outlined only (detailed just-in-time):** Phases 2–5 in [`BACKLOG.md`](BACKLOG.md) — Admissions, Results, Family Account/Finance, Engagement delivery, Migration cockpit, operations, AI.

## How to use this (any agent)

1. Read [`/AGENTS.md`](../../../AGENTS.md) (contract, validation, gotchas, handoff ritual).
2. Read [`WORKFLOW.md`](WORKFLOW.md) (how items flow + collision rules).
3. Open [`TASK-BOARD.md`](TASK-BOARD.md), claim a `ready` item, work it on a branch, keep it green, hand off.

## Files

| File                                               | Purpose                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`WORKFLOW.md`](WORKFLOW.md)                       | Multi-agent operating manual: item lifecycle, claim/branch rules, review gates, escalation. |
| [`TASK-BOARD.md`](TASK-BOARD.md)                   | **The coordination point.** Every item: status/owner/deps/DoD/validation/phase.             |
| [`BACKLOG.md`](BACKLOG.md)                         | Phases 2–5 outline mapped to parity-matrix rows.                                            |
| [`phase-0-scope-lock.md`](phase-0-scope-lock.md)   | Decisions + ADRs before code (no feature code).                                             |
| [`phase-1-foundations.md`](phase-1-foundations.md) | Shared platforms every later module reuses.                                                 |
| [`workbench-people.md`](workbench-people.md)       | First feature workbench: People directory + identity + role editor.                         |
| [`adr/README.md`](adr/README.md)                   | ADR index + template; the 12 decisions to record.                                           |
| [`templates/`](templates/)                         | Copy-paste `work-item.md` and `session-log-entry.md`.                                       |

## Guiding thesis (from the assessment)

**Capability parity WITHOUT information-architecture parity.** Guarantee the jobs/records the legacy system customers use; reassemble them into a few cohesive Aurora workspaces; deepen a handful of shared aggregates (**People, Admission, ResultCycle, Family/Student Account+Ledger, Engagement Delivery, Curriculum Version, Migration Job**) rather than one page per screenshot. Where we're already ahead (scoped permissions, RLS, maker-checker, encrypted health, kobo money), **finish** rather than rebuild.
