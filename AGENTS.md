# AGENTS.md — the shared contract for every coding agent

**Any agent working in this repo (Claude Code, Codex, Cursor, a human) reads this file first.** It is agent-neutral and canonical. Tool-specific notes live at the bottom. Keep it short; details live in the docs it points to.

> If your kickoff was "Read CLAUDE_TRIAL_NEXT_RECOMMENDED_PROMPT.md", that file now just points here.

## 1 · Read-first order (source-of-truth priority)

When two sources conflict, the higher one wins (from `AI_CONTEXT.md`):

1. **`requirements/`** — product/architecture intent (PRD, access-control, permissions, multi-tenant, ai-integration, polymorphic-design). Never override without explicit instruction.
2. **Approved designs** — `design-export/` + the Aurora design system in `packages/ui` (tokens: `docs/design-tokens.md`).
3. **The active initiative's plan-of-record** — a `docs/<name>-plan.md` (or, for the legacy system parity, `design-export/product-expansion/action-plan/`). This is where _what to build next_ lives.
4. **Existing codebase.**
5. **Agent suggestions** (lowest).

Context you should skim once per machine: `AI_CONTEXT.md` (product/stack/personas/AI rules), this file, and the **task board** (§6).

## 2 · Golden rules (non-negotiable)

1. **Requirements are constitutional.** Parity with the legacy system is an _input_, not the source of truth.
2. **Records before pages.** No critical workflow ships as UI without a durable domain lifecycle + server-side enforcement.
3. **One fact, one owner.** A payment/enrollment/publication/delivery has exactly one authoritative domain.
4. **Multi-tenant always.** Every tenant-owned row carries a non-null `tenant_id`; **RLS is a mandatory backstop** (`db:rls:check` gates CI). Never reach for the privileged client to dodge RLS (`check:privileged-db` gates CI; 29 uses are grandfathered — do not add #30).
5. **Permissions are `resource.action.context` + clearance.** Never hard-code a permission or tenant check in a component. Enforce **server-side**, scope-aware.
6. **High-risk changes are workflows** — reuse `MakerCheckerRequest` + `SensitiveOperationPolicy` + step-up; never silently mutate a posted receipt, published result, or role grant.
7. **No secret/PII leakage.** Contact data masked by default; health/safeguarding narrative stays encrypted + non-indexed (see the health crypto note in §7).
8. **Definition of Done is the DoD in §5 — a rendered page is not "done".**
9. **Defend the render against absent data.** Anything crossing a trust boundary — `serverApiGet`/API responses, component props, route & search params, destructured objects — can arrive `undefined`, `null`, empty, or missing keys. Reach through it with optional chaining and nullish defaults **at that boundary** (`summary?.[type]`, `rows ?? []`, `{ data = {} }`) so an unexpected shape renders an empty/error state, never a `TypeError` that white-screens the route. Guard the boundary, not every internal access — blanket `?.` on values your own logic guarantees only hides real bugs. _Enforcement:_ repo-wide `strict` + `noUncheckedIndexedAccess` (types) plus, on **web + ui**, `@typescript-eslint/prefer-optional-chain` + `prefer-nullish-coalescing` (from `@workspace/eslint-config/defensive-access`, tuned so only nullable object/array `||` fallbacks flag — boolean/string logic is left alone). These catch the idiom, but **cannot** catch a value _typed_ non-null that's `undefined` at runtime (the original crash) — that one only the boundary guard above prevents.
10. **Governed UI + domain routing.** A screen that lists an entity uses the governed **`DirectoryTable`** with the **Pattern-B toolbar** (search / filters / saved views), a **`StatGrid`** summary, and `ShellMain` + `PageHeader` — never a bespoke `<table>` + hand-rolled search. Quick-look is a **`Sheet` drawer**; deep work is a **full route**. **Surfaces** (§3): a **modal** blocks and never scrolls (confirmations, step-up, one decision ≤ 5 fields); every create/edit is a **drawer**; an action or form never gets an inline in-page panel. State renders through the semantic **`StatusBadge`** tones, never ad-hoc colours. **Routing:** a screen lives under its domain segment and the nav label matches — the student lifecycle **including admissions** (`/students/admissions`) under `/students/*`, academics under `/academics/*`, finance under `/finance/*`. _Enforcement:_ DoD (§5) + review against [`docs/frontend-conventions.md`](docs/frontend-conventions.md); a lint gate for the table/route idioms is a tracked follow-up. _(Born from admissions shipping a bespoke table at a top-level `/admissions` while the design-system + `/students/*` convention already existed only as intent — now consolidated.)_

## 3 · Repo map (orient fast)

- `apps/api` — **the real NestJS backend** (HTTP app; auth/MFA/RBAC/maker-checker/audit/tenant + all domain modules). 45 controllers / 24 modules.
- `apps/web` — Next.js frontend (Aurora design system + product surfaces). _(Note: `AI_CONTEXT.md` still says "mock data, not yet wired" — that is stale; routes are wired to services. Tracked as hygiene item **H1** on the board.)_
- `packages/api` — NestJS **service library** consumed by `apps/api` (tenant-context, JWT-secret, school-selection). **Not** the HTTP app — a past hand-off confused the two and wrongly concluded "no auth backend".
- `packages/database` — Prisma schema (58 models / 22 files under `prisma/models/`), client `@workspace/database`, seed + RLS scripts.
- `packages/ui` — Aurora design system (tokens in `styles/globals.css`; `docs/design-tokens.md`).
- `requirements/` — product source of truth. `docs/` — per-initiative plans + runbooks. `design-export/product-expansion/` — the legacy-system parity assessment (`plan/`) + `action-plan/`.

## 4 · Validation contract (what "green" means)

Run from repo root with **pnpm** (never npm/yarn). Turbo orchestrates; `prebuild`/`predev` auto-run `db:generate`.

| Check                  | Command                    | Notes                                                                                                   |
| ---------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Types + build          | `pnpm build`               | turbo build across packages; fails on TS errors                                                         |
| Lint                   | `pnpm lint`                | ESLint; violations block                                                                                |
| Unit tests             | `pnpm test`                | jest (api) + vitest (web/ui)                                                                            |
| E2E                    | `pnpm test:e2e`            | run when you touched an end-to-end path                                                                 |
| Format                 | `pnpm format:check`        | `pnpm format` to fix                                                                                    |
| Prisma client          | `pnpm db:generate`         | after any schema change (use `pnpm run db:generate`, not `--schema …` which yields a model-less client) |
| **RLS gate**           | `pnpm db:rls:check`        | every tenant table must be covered; CI gate                                                             |
| **Privileged-DB gate** | `pnpm check:privileged-db` | blocks new `DatabaseService` injections; CI gate                                                        |
| Seed integrity         | `pnpm db:verify`           | seed counts (permissions/pools) must match                                                              |
| Local quick CI         | `pnpm ci:quick`            | `scripts/ci/run-quick-ci.mjs` — run before you push                                                     |

**CI/CD:** There is **no pre-push gate** — a former `act`-in-Docker pre-push was removed (it timed out under local Docker limits and blocked pushes for unrelated reasons; see [`docs/local-ci.md`](docs/local-ci.md)). `git push` needs no Docker; run `pnpm ci:quick` first (fast, no Docker), and GitHub Actions is the authoritative gate. CI (`.github/workflows/ci.yml`, Node 22): install → `pnpm audit --audit-level=low` → `db:deploy` → **`db:rls:check`** → **`check:privileged-db`** → build → lint → typecheck → test. On CI success, **CD** (`cd.yml`, `workflow_run`) migrates (owner) → deploys API (Render) → deploys Web (Vercel) → **smoke tests** (API liveness/readiness + web→API round-trip). A change is not "validated" until `pnpm ci:quick` passes locally and (for shipped code) CI is green.

**A feature is DoD-complete only when its acceptance test passes AND the whole contract above is green.**

## 5 · Definition of Done (per work item)

Copy the checklist from `design-export/product-expansion/action-plan/templates/work-item.md`. In short, an item is done when:

- [ ] User job + lifecycle + owning domain defined; data ownership + invariants defined.
- [ ] Tenant + privacy classification defined; `tenant_id` present; RLS covers new tables (`db:rls:check` green).
- [ ] Permission/scope/step-up/approval enforced **server-side** (not just hidden UI).
- [ ] Command path complete: **permission → validation → mutation → audit → state feedback**.
- [ ] Empty / loading / error / offline / permission-denied states exist (use `packages/ui` `custom/states`).
- [ ] Mobile + keyboard usable; WCAG 2.2 AA for the touched surface.
- [ ] Import/export/migration implications addressed (if the domain has history).
- [ ] New/changed **env vars wired in the same change** — declared in `.env.example` (commented: purpose, when required, how to generate) **and** every deploy config that reads them (`render.yaml`, Vercel) **and** the validation schema (`apps/api/src/common/config/env.config.ts`), all in parity. For boot-required/blocking secrets, hand the human the exact setup (which dashboard, key name, `openssl rand …`) and say plainly that it gates the deploy (§7).
- [ ] Tests cover happy-path, invalid transition, **unauthorized scope**, **tenant isolation**, retry/idempotency, audit.
- [ ] Full validation contract (§4) green; `pnpm ci:quick` passes.
- [ ] Board updated + `AI_HANDOFF.md` session entry appended (§6).

## 6 · How work is tracked & handed off (multi-agent)

**The board is the single coordination point:** `design-export/product-expansion/action-plan/TASK-BOARD.md`. Full mechanics in `action-plan/WORKFLOW.md`. The essentials:

**Claim before you work (avoid collisions):**

1. Open the board; pick a `ready` item whose dependencies are `done`.
2. Set its **Owner** to your agent name and **Status → `claimed`**, in a tiny commit `board: claim <ID> (<agent>)` — _before_ writing code. If two agents race, the first commit wins; the loser picks another item.
3. Work on a branch **`<agent>/<ID>-<slug>`** (e.g. `claude/WB1-3-people-directory`, `codex/P1-2-import-platform`). Optionally an isolated git worktree (`.claude/worktrees/` already exists for this).
4. One item = one branch = one PR. Keep PRs reviewable; don't bundle unrelated items.

**Session start ritual:** read this file → read the board → read the top entry of `AI_HANDOFF.md` (latest state) → read the plan-of-record for your item.

**Session close / handoff ritual (always, even mid-item):**

1. Update the item's **Status** on the board (`in-progress` with a one-line "next step", or `in-review`/`done`/`blocked`).
2. Append a **session entry** to the TOP of `AI_HANDOFF.md` using `action-plan/templates/session-log-entry.md` (what changed, why, verification run + result, what's next, any new gotcha).
3. If a decision was made, record/point to the ADR (`action-plan/adr/`).
4. Leave the tree green (`pnpm ci:quick`) or clearly mark WIP + why in the session entry.

Because the board + `AI_HANDOFF.md` are files in git, any agent can resume another's work from the last commit: the board says _what state_ each item is in, the handoff log says _what just happened and what's next_.

## 7 · Known gotchas (agent-neutral — burned before)

- **No pre-push gate (`act`-in-Docker was removed).** `git push` needs no Docker and is not blocked locally; GitHub Actions runs the authoritative CI on the PR (see [`docs/local-ci.md`](docs/local-ci.md)). Still run `pnpm ci:quick` before pushing to catch the common failures in seconds.
- **Use `rg`, not bash `grep`** — `grep` here is ugrep and silently finds nothing in files containing emoji (e.g. `seed.ts`). If `rg` output looks mangled by emoji, fall back to `grep -a` on the specific file.
- **Changing permissions?** Update `EXPECTED_PERMISSION_COUNTS` in `packages/database/prisma/scripts/seed.ts` **in the same commit** (the seed aborts otherwise). The seed **upserts but never prunes** — a removed permission stays granted until deleted by hand.
- **Permission groups are not categories.** The current 305-permission seed is assembled from 28 named groups but persists 9 `category` values; use `db:verify` rather than counting seed arrays when reporting categories.
- **Migrations drift → `prisma migrate dev` wants to RESET (drops data).** For additive changes use hand-written SQL + `prisma db execute` + `prisma migrate resolve --applied`; verify the DDL landed before resolving. Don't run `migrate dev` casually.
- **RLS row writes in a migration need `set_config` in a DO block** — two separate statements silently update 0 rows on Render.
- **Never `next build` while `next dev` is live** — they share `apps/web/.next` and it corrupts the running server (→ 500s; recover with `rm -rf apps/web/.next` + restart). `nest build` also conflicts with a running `nest start --watch`. Docker CI builds in isolation.
- **Ports:** dev API **:3030**, web **:3001**; use **:3031** for a scratch API. `apps/api/.env` is loaded by ConfigModule, so a local "missing env var" test is polluted by it (real env vars take precedence).
- **Prod-only config gates are invisible to CI** (`NODE_ENV=test`); the `Production boot smoke` CI step exists to catch them — keep it. But that smoke uses **generated** secrets, so a prod-required env var present in CI yet missing from the **deploy** env still passes CI and then crashes the Render deploy on boot (`update_failed`) — declare every prod-required var in `render.yaml` **and** set it in the Render dashboard (burned by `DOCUMENT_URL_SIGNING_SECRET`, 2026-08-02; §5 makes wiring it part of DoD). `NEXT_PUBLIC_*` is inlined at **build** time (changing it needs a rebuild, not a redeploy).
- **Health-record crypto** is duplicated in two DB scripts that can't import Nest; a guard test in `encryption.service.spec.ts` pins the wire format. Keep them in lock-step; the blind index is **keyed**, so key rotation must re-index or flag search silently breaks.
- **DEV nav is 10–50× slower than PROD** (measured) — don't chase phantom perf issues in `next dev`.

## 8 · Tool-specific notes

- **Claude Code:** memory + this repo's `CLAUDE_TRIAL_NEXT_RECOMMENDED_PROMPT.md` (now a thin pointer here). Prefer the dedicated file/search tools; use the browser-preview tools to verify web changes (dev server on :3001) rather than asking the user to check.
- **Codex / OpenAI agents:** this `AGENTS.md` is your entrypoint by convention; the board + `AI_HANDOFF.md` are your coordination + memory. Same golden rules, validation contract, and handoff ritual apply.
- **All agents:** don't edit another agent's in-progress item without claiming a handoff on the board first. Don't delete or rewrite `AI_HANDOFF.md` history — only prepend.

---

_Active initiative: product-expansion (legacy-system parity) — see `design-export/product-expansion/action-plan/README.md`. Prior initiative (platform scope) is complete; its history is in `AI_HANDOFF.md` and `docs/platform-scope-plan.md`._
