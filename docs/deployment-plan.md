# Deployment & Environments — Design & Rollout Plan

> **Status:** Draft — authored 2026-07-17, stack re-evaluated & finalized
> 2026-07-18 on branch `claude`. No infrastructure provisioned yet; this is the
> plan of record. Companion to `ARCHITECTURE_DECISIONS.md` (esp. ADR-004 RLS)
> and the auth/biometrics plans.
>
> **Locked stack:**
>
> | Layer | Provider | Why |
> | --- | --- | --- |
> | API + worker + Postgres/pgvector + Redis | **Render** (paid tiers) | No cold starts on paid; native pgvector; one private network (zero egress, low hot-path latency); matches Render's documented AI architecture; one IaC (`render.yaml`), one bill |
> | Web (Next.js) | **Vercel Hobby** (free) | Next.js's native home; zero cold start; free. Web only proxies to the API — off the DB/Redis hot path, so no latency cost |
> | Object storage | **Cloudflare R2** | S3-compatible, no egress fees, free 10GB |
> | DNS / TLS / WAF | **Cloudflare** | Already in use (dev tunnels) |
> | CI | **GitHub Actions** | Existing pipeline |
>
> **Sequencing:** stand up the production-shaped topology first (single API
> instance is fine on day one), then close the three scale-out code gaps (§6)
> before scaling load tests past one node.

## Why this stack (2026 re-evaluation)

An earlier draft pivoted to a fragmented multi-vendor stack (Cloudflare Workers +
Railway + Neon + Upstash) to dodge Render cold starts and Railway/Neon free
tiers. Verified research (2026) collapsed that reasoning:

- **Render cold starts are a free-tier-only behavior.** Any paid tier ($7/mo
  Starter) is always-on. The premise for leaving Render was moot.
- **"Render is bad for AI apps" is false.** Render allows a **100-minute request
  duration** (vs Vercel 10s–13min, Heroku 30s), publishes first-party AI-agent
  and pgvector guides, and its recommended AI topology — **web + background
  worker + Key Value + Postgres** — is *exactly* our design. Provider switching
  is a config change, not code. The only real "code change" for AI apps —
  offloading long tasks to a background worker — is universal best practice and
  is already our §6.2 plan.
- **No platform has a meaningful perpetual free tier anymore** (Railway removed
  2023; Fly.io removed 2024; Render's free Postgres self-deletes after 30 days;
  **Neon free forces scale-to-zero → 0.5–2s DB cold start** on idle). For a
  make-or-break UAT, a cold start on the *database* is as bad as one on the API.
  "Cost-minimal" therefore means *the cheapest always-on production-shaped
  setup*, not *stitched-together free tiers*.

**Conclusion:** for an AI-integrated, pgvector-heavy, Redis-throttled multi-tenant
app at a make-or-break UAT, colocating everything hot-path on one always-on
private network (Render) beats four vendors / four bills / four failure domains /
cross-vendor hops. Web is the one piece safely split off to Vercel (free) because
it doesn't touch the hot path.

---

## Goal

Stand up a **demo/dev environment furnished like production** — same topology,
same deploy workflow, same secrets discipline — so we can:

1. **Load-test** against a realistic, always-on shape,
2. **Rehearse the go-live deployment workflow** end to end, and
3. **Onboard our first clients for UAT in test mode**, safely isolated from any
   real production data.

Explicitly **not** a throwaway demo: every choice carries into production by
promoting the same immutable image and flipping configuration.

---

## 1. What we deploy (architecture snapshot)

| Component | Reality in repo | Deploy shape |
| --- | --- | --- |
| **Monorepo** | pnpm 10 + Turbo, Node ≥20.19 (CI: 22) | One repo → API image + Vercel web build + shared packages |
| **API** | NestJS 11 → `node dist/main` (`apps/api/package.json` `start:prod`) | Render Web Service, always-on, `PORT` from env |
| **Web** | Next.js 15, `output: 'standalone'` (`apps/web/next.config.ts`) | Vercel (native Next.js build; talks to API server+client) |
| **Database** | Postgres 16 **+ pgvector**, RLS, two roles (owner + `app_runtime`) — ADR-004 | Render Postgres (pgvector native); two connection strings |
| **Object storage** | `StorageProvider` port; **local-disk impl only** (`apps/api/src/common/storage/`) | Cloudflare R2 via the port (§6.1) |
| **Background jobs** | In-process `QueueService` (`apps/api/src/common/queue/queue.service.ts`) | Render Background Worker + Redis broker (§6.2) |
| **AI throttle/spend caps** | In-memory `Map` (`apps/api/src/ai/services/ai-throttle.service.ts`) | Render Key Value (Redis) shared state (§6.3) |
| **Auth** | JWT + WebAuthn passkeys (needs real HTTPS domain), AES-GCM encrypted columns | Real domain + TLS; secrets are load-bearing |
| **AI** | Anthropic + Voyage, spend-capped (`env.config.ts`) | External API keys; governance already built |

---

## 2. Readiness assessment

**🟢 Already production-shaped.** RLS tenant isolation with a boot-time
fail-closed self-test (`RlsEnforcementService`), the two-connection DB model
(migrations as owner, runtime as `app_runtime`), `prisma migrate deploy` path
(`packages/database` `db:deploy`), graceful shutdown hooks
(`database.service.ts` `OnApplicationShutdown`), AES-GCM encrypted secret
columns, staging/production env templates, AI spend governance, and a green CI
gate that includes the RLS coverage check and e2e isolation specs.

**🔴 Three scale-out blockers** (all annotated in-code as "single instance
today") — detailed with remediation in §6:

1. **Storage is local disk** — ephemeral containers lose uploaded lesson
   materials on every redeploy.
2. **Queue is in-process** — jobs (invitation emails, AI material ingestion)
   are lost on restart and double-run across instances.
3. **AI throttle is in-memory** — rate limits and daily/monthly spend caps
   become per-instance, so N instances multiply the cap N×.

**🟡 Operational gaps to close before first deploy** (§7):

- **No infra health probe.** The `HealthModule` is *student health records*, not
  liveness/readiness. Render's health check needs a real `/healthz` (+ a
  `/readyz` that checks DB + RLS status).
- **CORS is wide open** — `app.enableCors()` in `apps/api/src/main.ts` with no
  config; must pin to the Vercel web origin (cross-origin: web on Vercel, API on
  Render).
- **Secrets** — templates carry real slots; wire them to Render env groups +
  Vercel env vars + GitHub Secrets.

---

## 3. Target topology

Render for everything hot-path (one private network, always-on, no cold starts);
Vercel for the web tier; Cloudflare for DNS/TLS + R2. Backend declared in one
in-repo `render.yaml` Blueprint (reviewable IaC).

```
                    Cloudflare (DNS + TLS + WAF)
                    │                          │
                    ▼                          ▼
              Vercel (web)              Cloudflare R2
              Next.js standalone        (materials, S3-compat)
              zero cold start                  ▲
                    │                          │
                    │  NEXT_PUBLIC_API_URL     │
                    ▼                          │
        ┌───────────────────────── Render private network ──────────────────────┐
        │                                                                        │
        │   Render Web Service          Render Background Worker                 │
        │   api (NestJS)                worker (same image, queue consumer)      │
        │   always-on, ≥1→N             (D1+)                                    │
        │   health: /healthz                                                     │
        │        │                              │                                │
        │        ├──────────────┬───────────────┤                               │
        │        ▼              ▼               ▼                                │
        │   Render Postgres   Render Key Value  (R2 via StorageProvider port) ───┘
        │   +pgvector         (Redis: throttle
        │   owner+app_runtime  + queue)
        └────────────────────────────────────────────────────────────────────────
                    │
                    ▼
             Anthropic / Voyage / SendGrid / Twilio (external APIs)

  GitHub Actions: CI gate → build API image → deploy Render (render.yaml) + Vercel
```

**Render services (declared in `render.yaml`):**

| Service | Type | Tier (UAT floor) | Notes |
| --- | --- | --- | --- |
| `api` | Web Service (Docker) | Starter 512MB (~$7/mo) | Always-on. Health `/healthz`. Migrations run in CI (not here). 100-min request timeout. |
| `worker` | Background Worker (Docker) | Deferred → Starter (~$7/mo) at D1 | Same image as `api`, queue-consumer start command. |
| `postgres` | Render Postgres | Basic-256MB (~$7/mo) → Basic-1GB (~$20) | pgvector native. Owner + `app_runtime` roles (§8). |
| `keyvalue` | Render Key Value | Free 25MB (throttle) → paid (~$10) for durable queue | Free tier has **no persistence** — fine for ephemeral throttle, not for durable jobs. |

Web (`web`) lives on **Vercel Hobby (free)**; storage on **Cloudflare R2** (free
10GB). Both addressed by config, not colocated (they don't touch the hot path).

**Cost — always-on, production-shaped:**

| | UAT floor | Scaled (post-gaps) |
| --- | --- | --- |
| api | $7 | $7 × N |
| worker | $0 (in-process) | +$7 |
| postgres | $7 | ~$20 |
| keyvalue | $0 (free) | ~$10 |
| web (Vercel) | $0 | $0 |
| R2 | ~$0 | usage |
| **Total** | **~$14/mo** | **~$45–60/mo** |

---

## 4. Environments

Two Render environments now; production is a later promotion of the same image
by SHA. Each env = its own Render Postgres, Key Value, R2 bucket (or prefix),
Render env group, Vercel project/env, and subdomain. **UAT never shares a
database or bucket with demo.**

| Env | Purpose | Instances | Data |
| --- | --- | --- | --- |
| **demo** | Deploy-workflow rehearsal, internal testing, load tests | 1 → ≥2 after §6 | Seeded/synthetic only |
| **uat** | First-client onboarding in **test mode** | ≥2 | Real client config, **clearly non-production**, disposable |
| _prod_ | (Later) go-live | ≥2 | Real |

**UAT database provisioning (no Neon branching here):** create a fresh Render
Postgres for UAT and apply migrations via `db:deploy` (schema is reproducible
from the migration history — no data copied). For a data-carrying rehearsal,
Render Postgres PITR / a database copy can seed UAT from demo. Promotion is
image-by-SHA + config swap, never a rebuild.

---

## 5. Deployment workflow (CD)

```
push to branch
   └─ CI (existing .github/workflows/ci.yml):
        build · lint · typecheck · unit + web/ui tests · RLS coverage gate · e2e isolation
   └─ on green (main branch) → build API Docker image, tag = git SHA, push to registry
   └─ deploy to DEMO (GitHub Actions CD job):
        1. MIGRATE (owner role):  pnpm --filter @workspace/database db:deploy   ← migrate deploy, NEVER migrate dev
        2. deploy `api` to Render (health-gated on /healthz: DB reachable + RLS self-test passed)
        3. deploy `worker` (same image/SHA)                          [D1+]
        4. deploy `web` to Vercel (next build; production deployment)
        5. smoke test (health + one authenticated read)
   └─ promote the SAME image SHA to UAT (Render env swap) + Vercel promote (config swap)
```

**Key rules:**

- **Migrations run in the CD job (GitHub Actions), as the DB owner, before the
  Render deploy is triggered** — `db:deploy` (`prisma migrate deploy`) against
  the target owner `DATABASE_URL`. Deliberately *not* a Render
  `preDeployCommand`: `prisma` is a devDependency and the migrations live in
  `packages/database`, so running from CI (full toolchain) keeps the runtime
  image lean and the two-role split (ADR-004) clean — the container only ever
  boots as `app_runtime`. Forward-only, nullable/additive migrations make the
  brief expand-contract window (new schema, old code) safe; never `migrate dev`
  against a shared env (drift → reset → data loss).
- **Immutable image promotion** — the exact API image SHA that passed CI on demo
  is the artifact UAT runs. No rebuild, no divergence.
- **Health gates traffic** — Render holds traffic until `/healthz` passes, so a
  bad boot (e.g. RLS self-test fail-closed, or a misconfigured `app_runtime`
  role) returns 503 and never takes traffic.
- **Web deploy** — Vercel builds Next.js from the monorepo (root + project set to
  `apps/web`); `NEXT_PUBLIC_API_URL` points at the Render API host per env.

---

## 6. The three scale-out gaps (topology first, then these)

Deferred until the topology is live per the locked sequencing, but **required
before scaling any load test past one API instance**. All three have a clean
seam already in the code.

### 6.1 Object storage — S3-compatible `StorageProvider` (Cloudflare R2)

- **Seam:** `apps/api/src/common/storage/storage.types.ts` defines the
  `StorageProvider` port + `STORAGE_PROVIDER` token; `storage.module.ts` binds
  the impl. DB rows carry only the storage key.
- **Do:** add `S3StorageService` (AWS SDK v3 S3 client → R2 endpoint),
  env-select in `storage.module.ts` via `STORAGE_PROVIDER=local|s3`. New keys
  grouped beside `STORAGE_LOCAL_ROOT`: `STORAGE_S3_ENDPOINT`,
  `STORAGE_S3_BUCKET`, `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY_ID`,
  `STORAGE_S3_SECRET_ACCESS_KEY`.
- **Accept:** put/get/delete round-trip against R2; local impl + spec unchanged;
  call sites (`material-ingestion`, lesson-material download) untouched.
- **Interim (single-instance only):** a Render persistent disk mounted at
  `STORAGE_LOCAL_ROOT` survives redeploys — acceptable *only* while `api` is one
  instance; a disk can't be shared across replicas, so it doesn't unblock
  scale-out.

### 6.2 Background queue — Redis broker (BullMQ) + `worker`

- **Seam:** `QueueService` is a documented stub ("swap the internals for a real
  broker (BullMQ/SQS) without touching callers"). Callers use
  `enqueue`/`registerHandler` (`user-invitation.service.ts`,
  `material-ingestion.service.ts`).
- **Do:** back `QueueService` with BullMQ on Render Key Value; run handlers in
  the `worker` service, not the web `api` process. Preserve the interface so
  callers are untouched. Requires a **paid** Key Value tier (persistence).
- **Accept:** enqueue from `api`, process in `worker`; a killed worker mid-job
  redelivers (no loss); no double-processing across replicas.

### 6.3 AI throttle / spend caps — shared Redis state

- **Seam:** `ai-throttle.service.ts` — in-memory `Map<string, UserWindow>`,
  explicitly "revisit when the API is [multi-instance]".
- **Do:** move the sliding window + daily/monthly counters into Render Key Value
  (atomic INCR/EXPIRE) so `AI_RATE_LIMIT_PER_MINUTE`, `AI_DAILY_MESSAGE_CAP`,
  `AI_MONTHLY_TOKEN_BUDGET`, `AI_TENANT_CONCURRENCY_LIMIT` hold **globally**.
- **Accept:** with ≥2 instances, the aggregate cap is respected (not multiplied);
  existing throttle unit tests adapted to the shared store.

---

## 7. Pre-deploy hardening (before first deploy)

Small, contained changes — do these with the §3 foundation, independent of §6.

1. **Infra health endpoints.** New `LivenessController` (or reuse
   `app.controller`): `GET /healthz` → 200 if the process is up; `GET /readyz` →
   checks the runtime DB connection and the RLS self-test verdict, 503 until
   ready. Wire Render's health check path to `/healthz`.
2. **CORS.** Replace bare `app.enableCors()` in `apps/api/src/main.ts` with an
   allow-list from config. **Cross-origin matters here:** web on Vercel
   (`https://demo.schoolwithease.com`) calls the API on Render
   (`https://api.demo.schoolwithease.com`), so pin CORS to the Vercel origin(s)
   and set `credentials: true` for cookie auth.
3. **Shutdown.** Ensure `app.enableShutdownHooks()` is called so SIGTERM drains
   in-flight work (DB hooks exist; wire Nest to fire them).
4. **Trust proxy / secure cookies.** Behind Render's LB + Cloudflare, set Express
   `trust proxy` and ensure auth cookies are `Secure` + `SameSite` correct for
   the cross-subdomain (web↔api) setup over HTTPS.

---

## 8. Database & migration strategy (Render Postgres)

- **Extension:** pgvector is supported on Render Postgres (the `learning_domain`
  migration does `CREATE EXTENSION vector`); CI uses `pgvector/pgvector:pg16`, so
  parity holds. Confirm `vector` is enabled on the instance at provision time.
- **Two roles (ADR-004):** the Render-provided user is the **owner**
  (`DATABASE_URL`, used by `db:deploy`/seed). Create the restricted `app_runtime`
  role via SQL (non-superuser, non-BYPASSRLS, LOGIN, password). Grant per the
  existing `*_app_runtime_grants_cutover` migration; set
  `APP_RUNTIME_DATABASE_URL` to it. The boot-time `RlsEnforcementService`
  self-test **fails closed in production** if this points at a privileged role —
  keep it enforced.
- **Always-on (no DB cold start):** Render Postgres paid tiers do not
  scale-to-zero — the DB is always warm. (This is a deliberate advantage over
  Neon free, whose forced scale-to-zero cold-starts the first query after idle.)
- **Migrations:** run in the GitHub Actions CD job as owner (`db:deploy`) before
  the Render deploy — not a Render pre-deploy hook (see §5). Forward-only.
- **Connection pool:** start from `env.production.template` values (`DB_POOL_*`,
  `sslmode=require`, `connection_limit`); tune under load test.
- **Backups & restore:** enable Render Postgres automated backups + PITR on both
  demo and UAT; verify a restore before onboarding real client config.

---

## 9. Secrets & configuration management

**Three stores, by placement:**

- **GitHub Secrets** (CI/build): registry creds, Render deploy hook / API key,
  Vercel token — whatever the Actions pipeline needs to deploy.
- **Render env groups** (API + worker runtime): `DATABASE_URL`,
  `APP_RUNTIME_DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, WebAuthn config,
  R2 keys, Redis URL, Anthropic/Voyage/SendGrid/Twilio keys, monitoring DSNs.
  One group per env; demo and UAT never share values.
- **Vercel env vars** (web): `NEXT_PUBLIC_API_URL`, `APP_CANONICAL_ORIGIN`,
  `AUTH_RESUME_SECRET` (not `NEXT_PUBLIC_*`).

**Generate fresh per env** — `JWT_SECRET`, `ENCRYPTION_KEY` (base64 32-byte),
web `AUTH_RESUME_SECRET`, and the `app_runtime` password: `openssl rand -base64
64` (32 for the encryption key). **Rotating `ENCRYPTION_KEY` invalidates every
AES-GCM encrypted column** (MFA/JWT secrets, BYOK AI keys) — pin per env from day
one; never rotate casually.

**External keys** (shared account, scoped per env): Anthropic (spend-capped —
mind the cap), Voyage (free-tier), SendGrid/SMTP (per-env From), Twilio (per-env
number), R2 access keys (per-env bucket/prefix).

**Never** commit real `.env*`; templates only. `apps/api/.env` stays gitignored.

---

## 10. DNS, TLS & WebAuthn

- **Domains (Cloudflare-managed DNS + TLS):**
  - `demo.schoolwithease.com` → Vercel (web)
  - `api.demo.schoolwithease.com` → Render (API)
  - `uat.schoolwithease.com` → Vercel (web); `api.uat.schoolwithease.com` → Render
  - Production: `schoolwithease.com` + `www.schoolwithease.com` (biometrics §10).
- **WebAuthn is domain-bound.** Per env: `WEBAUTHN_RP_ID` = the web domain (no
  scheme), `WEBAUTHN_ORIGIN`/`WEBAUTHN_ALLOWED_ORIGINS` = the exact HTTPS web
  origin(s). **Passkeys enrolled on demo do not work on UAT/prod** — expected;
  each env is its own RP. Production values recorded in `env.production.template`
  and the biometrics plan §10.
- **Web↔API cross-origin:** web (Vercel) and API (Render) are different
  subdomains, so cookies must be scoped to `.schoolwithease.com` (or use the
  server-side proxy `lib/api-proxy.ts` so the browser only ever talks to the web
  origin). Decide one model at D0 and set CORS + cookie `Domain`/`SameSite`
  accordingly. `NEXT_PUBLIC_API_URL` + `APP_CANONICAL_ORIGIN` per env; middleware
  redirects only the `www` alias.

---

## 11. Observability, load testing & UAT onboarding

- **Monitoring:** templates support Sentry (staging) / Datadog (prod). Wire
  Sentry to demo+UAT first (`SENTRY_DSN`, `SENTRY_ENVIRONMENT`). Vercel has its
  own analytics/logs for the web tier; Render streams API/worker logs.
- **Audit log:** `AUDIT_LOG_*` already exists; point at file + external sink.
- **Load testing:** k6 (recommended) or Artillery against demo. **Baseline
  single-instance first** (establishes the ceiling the §6 stubs impose), then
  re-run after §6 at ≥2 instances to prove the gaps are closed. Watch Render
  Postgres pool saturation, Key Value ops, R2 throughput, and Anthropic spend
  caps holding globally.
- **UAT client onboarding (test mode):** provision each client as a tenant with
  a test-mode flag; enrollment policy per school (biometrics plan Plane B);
  clearly label the env as non-production; seed nothing real. Verify recovery
  paths (password/TOTP/recovery codes) before handing over.

---

## 12. Phasing & task breakdown

**Phase D0 — Foundation (topology first).** _In progress on branch `claude`._
_Provisioning checklist: `docs/deployment-runbook.md`._
- ✅ `render.yaml` Blueprint: `api`, `postgres` (+`vector`), `keyvalue` (free);
  `worker` block written but commented until D1.
- ✅ `apps/api/Dockerfile` (multi-stage, `node dist/main`) + root `.dockerignore`.
- ✅ `apps/web/vercel.json` (monorepo root-dir + Turbo build; 300s fn duration).
- ✅ §7 hardening: `/healthz` + `/readyz` (readiness probes app_runtime inside an
  RLS scope), config-driven CORS lockdown (`CORS_ALLOWED_ORIGINS`), shutdown
  hooks, `trust proxy`, `0.0.0.0` bind. Built + browser-verified locally
  (`/healthz`→200, `/readyz`→200 with RLS active).
- ✅ CD workflow: `.github/workflows/cd.yml` — triggers after CI passes on
  `main`; `migrate` (owner `db:deploy`) → `deploy-api` (Render API trigger +
  poll to `live`) → `deploy-web` (Vercel CLI) → `smoke` (`/healthz` + `/readyz`).
  Gated behind the `demo` GitHub Environment. Render `autoDeploy: false` makes
  this the single deploy path. YAML validated.
- ⬜ Provision demo Render Postgres + create/grant `app_runtime`; Render env
  group; Vercel project + env vars; R2 bucket. _(account/dashboard work.)_
- ⬜ Add the CD secrets to the `demo` GitHub Environment (see below), then push
  to `main` to exercise the pipeline. **Demo live, single instance, ~$14/mo.**

**CD secrets (GitHub → Settings → Environments → `demo`):**

| Secret | What |
| --- | --- |
| `DATABASE_URL_OWNER` | Render Postgres **owner** external conn (`…?sslmode=require`) — migrations |
| `RENDER_API_KEY` | Render API key |
| `RENDER_API_SERVICE` | Render service id for `swe-api` (`srv-…`) |
| `API_BASE_URL` | Public API origin, e.g. `https://api.demo.schoolwithease.com` |
| `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | Vercel deploy + project link |

**Phase D1 — Close scale-out gaps (§6).** R2 storage provider · BullMQ + paid
Key Value queue + `worker` service · Key Value-backed throttle.

**Phase D2 — Scale & load test.** ≥2 `api` replicas; k6 baseline vs. post-D1
run; tune pools/limits; upgrade Postgres tier if needed.

**Phase D3 — UAT.** Stand up UAT Render env + Vercel project (promote the same
SHA); onboard first clients in test mode; backup/restore drill. **Add the
deploy-approval gate here** (decided 2026-07-18): a single lightweight `approve`
job in a reviewer-protected `uat` GitHub Environment that the deploy jobs
`needs`, with their secrets in a sibling non-gated environment — one human
approval per client-facing deploy, multi-job structure preserved. (Deliberately
**not** on `demo`, which auto-deploys; and **not** by collapsing CD into one job,
which would lose per-stage retry/visibility.)

**Phase D4 — Production readiness (later).** Promote Blueprint to prod domain;
prod monitoring (Datadog); runbook + on-call.

---

## 13. Open items to confirm before/at D0

- ~~**Web↔API cookie model**~~ — **SETTLED (2026-07-18): server-side proxy.**
  The codebase already implements it (`lib/api-proxy.ts` reads the httpOnly
  cookie → Bearer → forwards; `proxyStream` pipes SSE). The browser only talks
  to the Vercel web origin, so there is no browser→API CORS and cookies stay
  first-party. CORS is therefore locked down (§7), not opened. Vercel Hobby
  fluid compute (300s) covers the capped AI streams.
- ~~**Registry**~~ — **SETTLED for D0: Render builds from the Dockerfile
  directly** (the CD workflow triggers a Render deploy via the API; Render
  builds the connected commit). Upgrade path to immutable SHA-pinned images
  (build + push to GHCR in CI, deploy by digest) is a later refinement when
  demo→UAT byte-identical promotion matters.
- **Vercel monorepo build:** confirm Vercel builds `apps/web` from the pnpm/Turbo
  monorepo (root directory + install/build command) without the API in the way.
- **Key Value durability timing:** stay on free 25MB (throttle only, queue stays
  in-process) through D0; move to paid Key Value when D1 lands the durable queue.
- **Subdomain scheme** under `schoolwithease.com` (demo/UAT — assumption above).
- **Load-test tool:** k6 vs. Artillery.

---

## 14. Verification gate (per phase)

**Phase D0:**
- CI green (existing pipeline) on the deployed SHA.
- Demo `/healthz` → 200; `/readyz` → 200 **only** when the DB is reachable as
  `app_runtime` (not owner) and the RLS self-test passes (tenant-scoped reads
  only, cross-tenant writes blocked).
- Web (Vercel) serves the app with no 5XX; a login round-trip to the Render API
  succeeds (CORS + cookies correct).
- Passkey enrollment + login works end-to-end on the demo domain's RP ID/origin.

**Phase D1:**
- Kill the `worker` mid-job; on restart the job redelivers and completes (no
  loss).
- Scale `api` to ≥2 replicas; the AI throttle cap holds **globally**, not per
  instance.
- Upload a lesson material, redeploy `api`; the material is still retrievable
  (persisted in R2).

**Phase D2:**
- k6: single-instance baseline vs. ≥2-instance post-D1. Latency stable,
  throughput scales; Render Postgres pool not saturated.

**Phase D3:**
- UAT Render Postgres provisioned + migrated; same image SHA promoted from demo.
- Backup → restore (PITR) verified on UAT.
- A real test-mode client can enroll, log in (incl. passkey), and is fully
  tenant-isolated.

**Phase D4:**
- Production image promoted from demo SHA (no rebuild); prod monitoring live with
  alerts configured.
