# Next Recommended Prompt

> Kick off the next session by saying **"Read CLAUDE_TRIAL_NEXT_RECOMMENDED_PROMPT.md"**. This
> file is the single hand-off prompt, kept short on purpose — full history and
> session-by-session detail live in `AI_HANDOFF.md`; don't duplicate it here.

## Status

**2026-07-10: the 8 remaining roadmap chunks are all done (autonomous
full-swing sprint, one commit per slice, all pushed to `origin/claude`).**
The AI integration plan (Steps 1–6 + polish) was already complete; this sprint
cleared the rest of the parked/product backlog. Details in `AI_HANDOFF.md`
2026-07-10; each slice is its own commit:

1. **AI settings maker-checker** (`81329b6`) — gated mutate path for
   `ai_settings` (BYOK encrypted at submit, dual-control approve) + admin UI.
2. **Clearance Enforcement Gate 4** (`e46dfdc`) — update-time consistency on
   role/pool clearance (reject-and-list), `PATCH /roles/:id/clearance` +
   `PATCH /permissions/pool/:id/clearance`.
3. **Step 8 sub-surfaces** (`ff044b7`, `07fb115`) — all six promoted off
   `[...slug]`: transport routes/pickups, library loans, hr directory (derived)
   + hr leave and events roster (new RLS-backed tables).
4. **Step 8 test coverage** (`e1b87e6`) — service specs for the four domains.
5. **schoolType polymorphism + feature toggles** (`6063dc3`) — real per-tenant
   feature-toggle system gating nav; `/settings/features` now persists.
6. **Subdomain tenant resolution** (`94ddd47`) — `{slug}.domain` → tenant via
   middleware + public lookup; branded login.
7. **PWA Phase 2** (`4815b42`) — manifest, service worker (offline + push),
   installable.
8. **app_runtime cutover** (`81294df`, ADR-004) — grants completed/audited
   (fixed the ungranted `attendance_records`), RLS isolation proven AS
   `app_runtime`; activation is now a per-env `APP_RUNTIME_DATABASE_URL` flip.

Final verification (Node 22.21.1): api build + unit **234/234** + lint 0
errors; web types/lint/build + vitest **55/55**; ui vitest **86/86**;
db `db:rls:check` + migrate status clean. Two additive migrations
(`20260710000000`, `…10000`) + the grants migration (`…20000`) applied to the
dev DB.

---
### Prior status (2026-07-09): AI integration plan Steps 1–6 code-complete
See `AI_HANDOFF.md` 2026-07-09 pt. 5/4/3 and
`docs/ai-integration-plan.md` Step 6 close-out.

Step 6 added DB-backed tenant AI governance:
- `ai_settings`, `ai_usage_monthly`, and `ai_concurrency_leases` in the `ai`
  schema with RLS + `app_runtime` grants.
- `AiUsageService`: feature toggles, monthly tenant token budget, quota
  exhausted error shape, tenant concurrency cap, monthly aggregate writes, and
  threshold alert markers.
- Analytics + tutor chats now keep the per-user throttle and also enforce
  tenant quota/concurrency before LLM calls; usage is recorded after completed
  assistant turns.
- `GET /ai/admin/usage` gated on `ai.configure` + frontend
  `/settings/ai-usage`.
- Hardening tests: usage service, analytics tool-permission matrix, analytics
  + tutor prompt-injection smoke tests, and gated AI-schema RLS e2e.

Verification from the Step 6 session:
- database generate/deploy/RLS check/build ✅
- api build ✅, api unit **185/185** ✅, api lint exits 0 (pre-existing warnings) ✅
- web check-types/lint/build ✅, web vitest **38/38** ✅
- `test/ai-rls.e2e-spec.ts` skips locally unless `APP_RUNTIME_DATABASE_URL` is
  set to the real `app_runtime` role.

Step 5 live acceptance from 2026-07-09 pt. 4:
- Restarted the dev API on **3030** and confirmed `/ai/admin/usage` +
  academic tutor routes were mapped.
- Real-key live tutor acceptance completed with minimal paid calls:
  grounded/cited material answer ✅, cross-lesson non-leak ✅, guided-help
  refusal ✅, logout/login persistence ✅, assessment-window 403 ✅.
- `apps/api/test/ai-academic-live.e2e-spec.ts` was updated for current
  `Enrollment.termId` fixture shape and a less brittle non-leak assertion.
- PR #1 body was refreshed with the Steps 1–6 summary and verification list.
  The AI rollout was committed and pushed to `origin/claude` as `aaa63db`.

## 2026-07-09 pt. 5 — Step 3 polish + Step 2 term context CLOSED

Both remaining AI follow-ups are done (details in `AI_HANDOFF.md` pt. 5):
- **Step 3 polish** — new dependency-free `MarkdownLite`
  (`packages/ui/src/custom/chat/markdown-lite.tsx`) renders assistant markdown
  (bold/italic/`code`/lists/headings + allow-listed links); large ₦ chart
  values no longer clip via a shared `formatCompactNumber` default tick
  formatter + wider numeric axis on `CategoryBarChart`/`TrendChart`.
- **Step 2 term context** — new `CurrentTermService`
  (`apps/api/src/academic-structure/services/current-term.service.ts`), and
  `AnalyticsChatService` prepends the current-term line to the volatile system
  block.

Verification (Node 22.21.1 — the active shell defaults to v20.18.0, below the
≥20.19 floor, so `nvm use` first): api build ✅, api unit **192/192** ✅, api
lint 0 errors ✅; web check-types/lint/build ✅, web vitest **38/38** ✅; ui
vitest **85/85** ✅. Committed and pushed to `origin/claude` as
`6515df5 feat(ai): close Step 3 polish + Step 2 term context`; PR #1 updated.

## Not Closed / Follow-ups

The former parked backlog is cleared. Remaining thin edges (none blocking):

- **app_runtime activation per environment** — grants + role are ready and
  isolation is proven; each env still needs `APP_RUNTIME_DATABASE_URL` set to
  the `app_runtime` connection (password is a secret) to actually flip runtime
  enforcement on. See ADR-004.
- **Web push delivery backend** — the SW push handler + client `subscribeToPush`
  ship in slice 7; VAPID signing + subscription persistence + fan-out is a
  follow-on if push is prioritized.
- **PWA icons** — a single `/icon.svg` covers install; add raster PNG sizes
  (192/512, maskable) for best OS integration.
- Live browser acceptance for the new surfaces was not run (preview is
  TCC-blocked under `~/Documents`; changes are unit-tested + build-verified).

## Do Next

1. Nothing is queued. Pick up new work at the user's direction, or activate the
   `app_runtime` cutover in a target environment (ADR-004).

## Read First

- `AI_HANDOFF.md` — 2026-07-09 pt. 3 (Step 6), pt. 2 (Step 5), and Known Issues.
- `docs/ai-integration-plan.md` — Step 6 close-out and Parked list.
- `apps/api/test/ai-academic-live.e2e-spec.ts` — paid Step 5 acceptance path.
- `apps/api/src/ai/services/ai-usage.service.ts` — tenant quota/concurrency
  mechanics.

## Known Gotchas

- Run node tooling under Node ≥20.19; use `corepack pnpm`.
- `ANTHROPIC_API_KEY` is spend-capped; `VOYAGE_API_KEY` is free-tier. Avoid
  paid loops.
- The reliable paid tutor e2e invocation preloads `apps/api/.env` before Jest
  setup and calls Jest directly through `pnpm exec`; otherwise the generic e2e
  setup can fall back to a passwordless test DB URL.
- Chat, tutor, and learning endpoints are not `@TenantScoped` on purpose:
  long LLM/embedding calls must not sit inside 15s RLS transactions.
- `GET /classes` still 400s on its own default query params (pre-existing).
- E2e specs that prove RLS backstops need `APP_RUNTIME_DATABASE_URL` pointing
  at the real `app_runtime` role.
- `pnpm --filter @workspace/ui lint` still fails on a stale eslint symlink; UI
  source is covered by `tsc` and web lint/build.
