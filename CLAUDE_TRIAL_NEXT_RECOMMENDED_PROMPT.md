# Next Recommended Prompt

> Kick off the next session by saying **"Read CLAUDE_TRIAL_NEXT_RECOMMENDED_PROMPT.md"**. This
> file is the single hand-off prompt, kept short on purpose — full history and
> session-by-session detail live in `AI_HANDOFF.md`; don't duplicate it here.

## Status

**2026-07-22: the platform (cross-tenant) scope is built and deployed —
Phases 0, 0.5, 1, 2 and 3 of `docs/platform-scope-plan.md`, merged to `main`
(PRs #11, #12, #13). The demo environment is healthy on all three layers.**

The platform scope was previously "an identity without an application": `scope:
'platform'` and twelve `platform.*` permissions existed, but `runPlatform()` had
zero production callers, cross-tenant reads went through the *privileged* client
(unaudited), 14 of 18 platform nav links 404'd, and `/overview` rendered the
school dashboard for an Architect. That is now a working platform manager.

- **Phase 0 — audited cross-tenant seam.** `@PlatformScoped` +
  `RlsPlatformInterceptor` is the only sanctioned cross-tenant path (audited
  `app.is_platform` scope). The permission check lives in the *interceptor*, not
  a guard, so refused attempts are audited rather than short-circuited.
  `TenantService` moved off the privileged client; a CI ratchet blocks new
  `DatabaseService` injections (29 grandfathered).
- **Phase 0.5 — Option D separation of duties + privacy.** `platform.tenants`
  split into `.read`/`.act`/`.inspect` (+ `metrics`/`privileges`/
  `approvals.override`); `GET /tenant/:id` is facet-gated at the *payload*
  level. SuperAdmin proposes, Architect disposes on `tenant.act`. Health data
  encrypted at rest (enveloped AES) with a **keyed blind index** so flags stay
  searchable; backfill + key-rotation scripts. Production hard-fails without a
  valid `ENCRYPTION_KEY`.
- **Phase 1 — honest console.** Platform `/overview` (scope branches before
  clearance), its aggregation endpoint, dead-nav cleanup, facet-gated tenant
  detail.
- **Phase 2 — oversight & policy.** Cross-tenant audit log; cross-tenant policy
  posture with baseline drift (directional rules — a *stricter* tenant is never
  flagged).
- **Phase 3 — insight & AI.** Aggregate-only analytics surface, rules-based
  at-risk detection, and a facet-gated platform AI assistant. The 0.5.8 hard
  gate is satisfied and was **proven live with a real LLM**: a SuperAdmin's
  query had both metrics tools refused (`missing_facet`) and the assistant
  reported the data was out of reach — it could not route around the gate.

**Three real bugs were found and fixed in passing** (all pre-existing, none
introduced by this work): `MakerCheckerService.approveRequest` allowed
**self-approval** and gated the checker on the *maker's* clearance (affected
existing school ops too); `AuditLogController` had a clearance-9 branch reading
cross-tenant on the privileged client, unaudited; and that same controller had
no guard populating `req.userContext`, so `@RequireClearanceLevel(7)` was inert
and every handler 403'd for real callers.

**Deploy incidents closed.** Two CD failures were diagnosed and fixed:
`ENCRYPTION_KEY` missing/wrong-size (the new production boot gate doing its job —
CI ran `NODE_ENV=test` so it was blind to it) and `NEXT_PUBLIC_API_URL` empty at
build time. `/api/health` — which previously proxied student *medical records*
despite its name — is now a real web→API connectivity probe.

## Not Closed / Follow-ups

None blocking. Deliberate deferrals are recorded with reasoning in
`docs/platform-scope-plan.md`:

- **2.4 onboarding wizard** — step 6 (Plan) has no billing domain; steps 2/5
  need new cross-tenant *provisioning* flows. Building it now means stubbing a
  third of it against domains that don't exist.
- **3.2 product polish** — platform AI has no session persistence or streaming
  yet (the tenant chat has both). Safety-critical parts are complete.
- **Platform AI tool executions aren't audited** — returned in the response
  trace but not written to the audit log (the AI endpoint is clearance-gated,
  not `@PlatformScoped`, so the interceptor doesn't see it). Low exposure
  (aggregates only), but worth closing.
- **`app_readonly` role + Postgres connection/DDL logging** — runbook Step 4c
  has the reviewed SQL (validated live, rolled back); not yet applied to any
  environment. Direct `psql` access remains outside the API audit trail.
- **Standing verification gap** — `platform.metrics`/`.inspect`/`.security` are
  Architect-only and there is no Architect dev credential (forced rotation by
  design), so those HTTP happy paths are unit-tested while the *denial* paths
  are proven live.
- **Billing and support domains don't exist** — the §3 overview design (MRR,
  renewals, tickets) is deliberately not rendered as zeroes.

## Do Next

1. Nothing is queued. Pick up new work at the user's direction. Natural
   candidates: the billing domain (unblocks 2.4 and the remaining overview
   tiles), auditing platform AI tool runs, or applying `app_readonly` in a
   target environment.

## Read First

- `docs/platform-scope-plan.md` — **the source of truth**: gap analysis, the
  control-plane/data-plane decision, Option D facets, the four privacy
  decisions, and per-item status for every phase.
- `docs/deployment-runbook.md` — Step 4c (`app_readonly`), 4d (re-seed on
  redeploy + health-encryption backfill), Step 8 (`NEXT_PUBLIC_*` build-time
  inlining), Step 12 (three ordered probes + failure triage table).
- `apps/api/src/common/database/rls-platform.interceptor.ts` — the cross-tenant
  seam and why the permission check sits there.
- `apps/api/src/platform/` — overview, audit query, policy/drift, analytics,
  risk, and the facet-gated AI tool registry.

## Known Gotchas

- **`git push` runs the full CI locally via `act` in Docker.** Docker must be
  running or the push is refused. It takes minutes even for docs-only changes.
  Don't wrap the push in a compound command — a trailing `echo` masks its exit
  code and makes a *blocked* push look successful.
- **Use `rg`, not bash `grep`** — `grep` here is ugrep and silently finds
  nothing in files containing emoji (e.g. `seed.ts`). `rg` output can itself be
  mangled by emoji; fall back to `grep -a` on a specific file when it looks odd.
- **Changing permissions?** Update `EXPECTED_PERMISSION_COUNTS` in `seed.ts` in
  the same commit (the seed aborts otherwise), and note the seed **upserts but
  never prunes** — a removed permission stays granted until deleted by hand.
- **Never `next build` while `next dev` is live** — they share `apps/web/.next`
  and it corrupts the running server. The Docker CI builds safely in isolation.
- Dev API on **:3030**, web on **:3001**; use **:3031** for a scratch API.
  `nest build` also conflicts with a running `nest start --watch`.
- `apps/api/.env` is loaded by ConfigModule, so a local "missing env var" test
  is polluted by it; real env vars take precedence over `.env`.
- macOS has no `timeout` command (CI/act on Ubuntu does) — local reproductions
  of CI shell steps need adjusting.
- **Prod-only config gates are invisible to CI** (`NODE_ENV=test`). The
  `Production boot smoke` step in `ci.yml` exists to catch them; keep it.
- `NEXT_PUBLIC_*` is inlined at **build** time — changing it needs a rebuild,
  not a redeploy (a plain Vercel "Redeploy" reuses the build).
- Health-record crypto is duplicated in two DB scripts that can't import Nest;
  a guard test in `encryption.service.spec.ts` pins the wire format. Keep them
  in lock-step, and remember the blind index is **keyed** — rotation must
  re-index or flag search silently breaks.
