# Next Recommended Prompt

> Kick off with **"Read AGENTS.md"**. This repo is now multi-agent; the canonical,
> agent-neutral entrypoint is [`AGENTS.md`](AGENTS.md) (contract, validation, gotchas,
> handoff ritual). This file is a thin pointer kept for the old kickoff phrase.
> Full session history lives in [`AI_HANDOFF.md`](AI_HANDOFF.md).

## Where things stand

- **Active initiative: product-expansion (legacy-system parity).** Plan-of-record + backlog + task board:
  [`design-export/product-expansion/action-plan/`](design-export/product-expansion/action-plan/README.md).
  The assessment (135 screenshots reviewed) is in
  [`design-export/product-expansion/plan/`](design-export/product-expansion/plan/README.md).
- **Prior initiative — platform (cross-tenant) scope — is complete** (Phases 0–3 of
  `docs/platform-scope-plan.md`, PRs #11–#13). Details + deferrals are in `AI_HANDOFF.md`
  and that plan doc.
- **Phase-1 foundations progress:** hygiene `H1`–`H3` done; `F1` (Person) + `F2` (Import)
  + `F3` (jobs/outbox) + `F4` (Documents) **done** — merged to `main` ([PR #42](https://github.com/Ewosoft-Solutions/claude-trial/pull/42) + [#43](https://github.com/Ewosoft-Solutions/claude-trial/pull/43)).
  Still `ready`: `F5` (delivery), `F7` (search), `F8` (Aurora patterns). `F6`/`F9` blocked.
  **WB1 (People directory)** unblocked once F7+F8 land. Follow-ups: `F2-fu1/2/3` (backlog).
  Most ADRs accepted; 5 owner-gated (03/04/05/10/11).

## Do next

1. Read [`AGENTS.md`](AGENTS.md) → read the
   [task board](design-export/product-expansion/action-plan/TASK-BOARD.md) →
   claim a `ready` item (currently `F5`, `F7`, `F8`, `P0-4`), set Owner + Status,
   branch, build to DoD, hand off. (`F1`/`F2`/`F3`/`F4` are **done** — merged via
   PR #42; **WB1 People directory** is now unblocked once F7+F8 land.)
2. Owner-gated items (`P0-1`, `P0-2`, ADR-10/11) need product-owner input first.

## Read first

- [`AGENTS.md`](AGENTS.md) — the shared contract (all agents).
- [`design-export/product-expansion/action-plan/WORKFLOW.md`](design-export/product-expansion/action-plan/WORKFLOW.md) — how items flow + collision rules.
- `docs/platform-scope-plan.md` + `docs/deployment-runbook.md` — prior initiative + deploy detail.

_(The Known Gotchas that used to live here now live in `AGENTS.md` §7, agent-neutral so Codex reads them too.)_
