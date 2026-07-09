# Next Recommended Prompt

> Kick off the next session by saying **"Read CLAUDE_TRIAL_NEXT_RECOMMENDED_PROMPT.md"**. This
> file is the single hand-off prompt, kept short on purpose — full history and
> session-by-session detail live in `AI_HANDOFF.md`; don't duplicate it here.

## Status

**2026-07-09: AI integration plan Steps 1–6 are code-complete through
hardening/governance, and Step 5 live acceptance is closed** (see
`AI_HANDOFF.md` 2026-07-09 pt. 4 / pt. 3 and
`docs/ai-integration-plan.md` Step 6 close-out).

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
  Note: the AI work is still in the local dirty tree until committed/pushed.

## Not Closed From Previous Steps

- Step 3 polish remains: assistant markdown-lite rendering and chart y-axis
  clipping for large currency values.
- Step 2 term context is still absent from the analytics system prompt because
  no "current term" read service exists yet.
- Non-AI parked items remain parked: PWA/offline/push, subdomain tenant
  resolution, Step 8 sub-surfaces, `app_runtime` full runtime cutover, etc.

## Do Next

1. Commit/push the local AI Steps 1–6 work when the user wants the remote PR
   diff to match the refreshed body.
2. Continue only with explicit follow-up work: Step 3 polish, Step 2 term
   context once a current-term read service exists, or parked non-AI items.

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
