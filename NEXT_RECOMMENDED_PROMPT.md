# Next Recommended Prompt

> Kick off the next session by saying **"Read NEXT_RECOMMENDED_PROMPT.md"**. This
> file is the single hand-off prompt, kept short on purpose — full history and
> session-by-session detail live in `AI_HANDOFF.md`; don't duplicate it here.

## Status

**`docs/backend-remediation-plan.md` is fully complete (Steps 1–8, closed
2026-07-01).** Step 8 — the last item — shipped all six remaining operational
modules (Admissions, Transport, Library, Health, HR/Payroll, Events), each
with a Prisma model + migration + explicit RLS policy + NestJS module +
frontend surface, following one consistent pattern throughout. This closes
the entire backend backlog that has driven the last several sessions — there
is **no next step queued in that document**; see "Open questions" below for
what to decide next.

The same session also fixed a real gap found along the way: `hr.view` was
referenced by the Step 6 nav config and `/hr/layout.tsx` but never existed in
the permission seed catalog (every school's HR section was silently
ungrantable) — added `hr.view`/`payroll.view`/`payroll.process` and
re-verified the pool-assignment loop picks them up. All 5 new module pages
were live-verified in a real browser against a running API + real DB rows,
not just type-checked. Full detail: `AI_HANDOFF.md`, 2026-07-01 pt. 2 entry.

**Git: branch `claude` is 5 commits ahead of `origin/claude` — not yet
pushed.** Push first, then refresh PR #1's body (open, `claude` → `main`) to
describe the now-closed Step 8 backlog.

## Read first

- `AI_HANDOFF.md` (2026-07-01 pt. 2 entry) — what shipped and why, including the deliberately-deferred sub-surfaces (see "Open questions")
- `requirements/role-permissions-management.md` — "Clearance Enforcement Gates", before touching anything permission/pool/clearance-related
- `packages/ui/README.md` — how to consume the design-system foundation
- `apps/api` — the real NestJS backend; `apps/web` has consumed it for its whole auth lifecycle since Step 3. `packages/api` is a separate library, not the HTTP app — don't confuse the two.

> ⚠ Phase numbering is overloaded: internal docs use Phase 1 = design system,
> Phase 2 = dashboard infra (current, per `CURRENT_PHASE.md`). `requirements/PRD.md`
> §11 uses Phase 1 = core platform, Phase 2 = PWA/ops, Phase 3 = AI. Say which
> when it matters. Note also that `CURRENT_PHASE.md` describes a "Phase 3" of
> academic/finance/communication modules that, in practice, already shipped
> during Phase 2 via the backend-remediation-plan — that doc is stale and
> shouldn't be trusted for what's next; see "Open questions" below instead.

## Open questions (no committed backlog item covers these — ask or use judgment)

1. **What's next now that the backend-remediation backlog is closed?** Candidates
   surfaced but not committed to: (a) build the deferred sub-surfaces from Step 8
   (`/transport/routes`+`/pickups`, `/library/loans`, `/hr/directory`+`/leave` —
   currently `[...slug]`-backed), (b) add unit/e2e test coverage for the 5 new
   Step 8 modules (none was added this session, matching the other modules'
   precedent, but it's a real gap), (c) the "Clearance Enforcement Gate 4"
   (update-time consistency check) noted as spec'd-but-unbuilt in
   `requirements/role-permissions-management.md`, (d) more `packages/ui`
   coverage (page-level resolution, shell/layout components — reuse the jsdom
   recharts stub `packages/ui/src/test/recharts-mock.tsx`).
2. Push + refresh PR #1 either way — that's not blocked on the above.

## Requirements

- Reuse `packages/ui` components; build new shared UI there first.
- Pass type-check, lint, and build before considering anything complete.
- Update `AI_HANDOFF.md` and refresh this file when done.

## Known gotchas (full detail: `AI_HANDOFF.md` → Known Issues)

- Preview launcher is blocked by macOS TCC; default `web` launch config serves
  a self-contained build from `/tmp` on port 3013 — rebuild + re-copy after
  source edits, or grant Documents access and use `web-pnpm`.
- `pnpm --filter @workspace/ui lint` fails on a stale eslint symlink — UI
  source is covered by `tsc` instead.
- Whole-repo `pnpm build` (turbo) fails on `@workspace/database` under Node
  20.18 (< required 20.19) — build `apps/web` directly, or run everything
  under Node ≥20.19 (e.g. `nvm` v22).
- The user's own `apps/api` dev server runs on port **3030** — if you need to
  start your own API instance for verification, use a different port (e.g.
  3031) rather than competing for 3030.
