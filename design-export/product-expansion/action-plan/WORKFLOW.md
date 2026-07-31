# Multi-agent workflow (operating manual)

This is _how_ work flows so Claude, Codex, and others collaborate without colliding and can resume each other's work. The **contract** (validation commands, golden rules, gotchas, session ritual) lives in [`/AGENTS.md`](../../../AGENTS.md) — this file doesn't duplicate it, it operationalizes it.

## 1 · Roles

There is no fixed "Claude does X, Codex does Y" split — any agent can take any `ready` item. Two _soft_ roles help quality:

- **Builder** — claims an item, implements it to DoD, opens a PR.
- **Reviewer** — a _different_ agent (or a human) verifies the PR against the item's acceptance + validation contract before it merges. Self-review is allowed for `S`-effort items; **`L`/`XL` items should get a second-agent review** (mirrors our maker–checker principle). The reviewer runs the validation contract independently and checks the DoD boxes.

## 2 · Item lifecycle (states on the board)

```
backlog ──▶ ready ──▶ claimed ──▶ in-progress ──▶ in-review ──▶ done
   ▲                     │              │              │
   └──────── blocked ◀───┴──────────────┴──────────────┘
```

| State         | Meaning                                                     | Who sets it |
| ------------- | ----------------------------------------------------------- | ----------- |
| `backlog`     | not yet ready (deps open, or not detailed)                  | planner     |
| `ready`       | deps `done`, spec exists, anyone may claim                  | planner     |
| `claimed`     | an agent has taken it (Owner set) — **claim before coding** | builder     |
| `in-progress` | actively being built; board note carries the "next step"    | builder     |
| `in-review`   | PR open, awaiting reviewer + green CI                       | builder     |
| `done`        | merged, CI+CD green, DoD checked, handoff logged            | reviewer    |
| `blocked`     | needs a decision/dep/credential; board note says what       | anyone      |

## 3 · Claiming & branching (collision avoidance)

1. Pick a `ready` item whose **Depends-on** are all `done`.
2. In one tiny commit, set the board row's **Owner** = your agent name and **Status** = `claimed` — commit message `board: claim <ID> (<agent>)`. **Do this before writing code.** First commit wins a race; the loser picks another item.
3. Branch: **`<agent>/<ID>-<slug>`** — e.g. `claude/WB1-3-people-directory`, `codex/F2-import-platform`. Never commit feature code to `main`.
4. One item → one branch → one PR. Don't bundle unrelated items. If you discover new work, add a board row rather than sneaking it in.
5. Optional isolation: a git worktree (`.claude/worktrees/` exists) so parallel agents don't share a working tree.

## 4 · While building

- Keep the board's Status note current (a one-liner "next step") so a hand-off mid-item is resumable.
- Follow the **Definition of Done** (`/AGENTS.md` §5) and the item's own acceptance test.
- Run `pnpm ci:quick` locally before pushing; `git push` runs full CI via `act` (Docker on).
- New reusable UI → `packages/ui` first (per `AI_CONTEXT.md`), then consume in `apps/web`.
- Schema change → hand-written SQL migration + `db:generate` + `db:rls:check` green (never casual `migrate dev`).

## 5 · Review gate (before `done`)

Reviewer confirms, independently:

- [ ] Acceptance test in the item passes.
- [ ] Validation contract green (`build`, `lint`, `test`, `db:rls:check`, `check:privileged-db`, `db:verify` if seed touched).
- [ ] Server-side permission/scope enforcement (not hidden UI); tenant-isolation test present.
- [ ] No new `DatabaseService` injection; no hard-coded permission/tenant; no secret/PII leak.
- [ ] DoD boxes checked in the PR description.

## 6 · Close / handoff (every session — see `/AGENTS.md` §6)

Update board Status → append a top entry to `AI_HANDOFF.md` (`templates/session-log-entry.md`) → record any decision in `adr/` → leave green or mark WIP + why. This is what lets the _next_ agent (or the _other_ agent) resume: **board = current state, handoff log = what just happened + what's next.**

## 7 · Escalation & decisions

- A choice that changes a **core table or contract** is an **ADR**, not a ticket — open/point to it in `adr/` and set the dependent item `blocked` until the ADR is `Accepted`.
- A choice that needs the **product owner** (scope, money semantics, curriculum policy, privacy) → the [decision questions](../plan/06-roadmap-and-discussion-guide.md#decision-workshop--questions-to-settle); set the item `blocked` with a board note naming the question.
- Don't turn an unresolved architectural question into code.

## 8 · Definition of Ready (before an item leaves `backlog`)

- Job + owning domain named; acceptance test written; deps identified and `done`/tracked; DoD applies cleanly; any blocking ADR/decision resolved. Planner flips it to `ready`.

## 9 · Conventions

- **Package manager:** pnpm only. **Search:** `rg`. **Money:** minor units (kobo). **IDs on the board:** stable; never renumber (reference `#N` = parity-matrix row in [07](../plan/07-capability-parity-matrix.md)).
- **Commits:** conventional-ish (`feat|fix|chore|docs|test|refactor(scope): …`); board-only commits use `board: …`.
- **PR body:** links the item ID, checks the DoD, pastes the validation output.
- **Never** rewrite `AI_HANDOFF.md` history (prepend only) or overwrite another agent's uncommitted work — claim a handoff first.
