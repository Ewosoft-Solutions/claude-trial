# D0 Deployment Runbook — demo environment

> Operational checklist to stand up the **demo** environment for the stack in
> `docs/deployment-plan.md` (Cloudflare + Render + Vercel + R2 + GitHub Actions).
> All code artifacts (Dockerfile, `render.yaml`, `vercel.json`, health probes,
> CD workflow) are already in the repo. This is the account/dashboard work.
>
> **Order matters** — datastores → runtime role → services → DNS → secrets →
> first deploy. Do the steps top to bottom.

## Prerequisites

- Accounts: **Render**, **Vercel**, **Cloudflare** (with `schoolwithease.com`
  managed on Cloudflare DNS).
- The `main` branch pushed to GitHub, CI green.
- Local tools: `openssl`, and either `psql` or `pnpm` (for the one SQL step).

---

## Step 1 — Render Postgres

1. Render → **New → Postgres**. Name `swe-postgres`, region **Oregon**, Postgres
   **16**, plan **Basic-256MB** (bump to Basic-1GB in D2 under load).
2. After it provisions, open **Info** and copy both the **Internal** and
   **External** connection strings for the **owner** user. The external one
   (`…?sslmode=require`) is what CI and the SQL step below use.
3. `pgvector` needs no toggle — the `learning_domain` migration runs
   `CREATE EXTENSION vector`. (If Render ever gates extensions, confirm `vector`
   is allowed.)

> The owner user must be able to `CREATE ROLE` (the migrations create
> `app_runtime`). Render's primary DB user can. If a `permission denied to
> create role` error appears in Step 3, the account/user lacks `CREATEROLE` —
> stop and resolve before continuing.

## Step 2 — Generate per-environment secrets (local)

Generate once, store in your password manager; you'll paste them into Render/
Vercel/GitHub below. **Never commit these.**

```bash
openssl rand -base64 64   # JWT_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY   (32 bytes; rotating it invalidates every encrypted column)
openssl rand -base64 64   # AUTH_RESUME_SECRET (web)
openssl rand -hex 32      # app_runtime DB password (hex → safe in a connection URL)
```

> **Remote connection strings need `?sslmode=require`.** Render (and most managed
> Postgres) refuse non-TLS external connections. Prisma's *migration engine*
> negotiates TLS automatically, so `db:deploy` works without it — but every
> script that goes through `packages/database/src/singleton.ts` (`db:seed`,
> `db:verify`, `db:rls:proof`, `db:rls:verify`, the dev seeds) uses a raw `pg`
> Pool, which enables TLS **only** when the URL says so. Without it they fail
> with `P1010 … DatabaseAccessDenied` / `SSL/TLS required`. Append
> `?sslmode=require` to the external URL for all of these.
>
> Note also that `packages/database/.env` defines a localhost `DATABASE_URL`.
> Forgetting the inline prefix silently targets your **local** database rather
> than failing loudly — always pass it explicitly for remote work.

## Step 3 — Apply migrations as the DB owner

Creates every table **and** the `app_runtime` role (as `NOLOGIN`) + its grants.

```bash
DATABASE_URL='<owner EXTERNAL conn from Step 1>' \
  pnpm --filter @workspace/database db:deploy
```

Expect "All migrations have been applied." (36 migrations.)

## Step 4 — Enable the `app_runtime` login (out-of-band, as owner)

The role exists but is **`NOLOGIN`** with no password. Enable login **and** set
the password in one statement (do **not** follow the password-only form in
database-setup.md §5a — the role does not yet have LOGIN):

```sql
-- Run as the OWNER, against the demo database.
ALTER ROLE app_runtime WITH LOGIN PASSWORD 'PASTE_THE_hex32_FROM_STEP_2';

-- Verify the boot self-test's requirements: can log in, NOT superuser, NOT bypassrls.
SELECT rolname, rolcanlogin, rolsuper, rolbypassrls
FROM pg_roles WHERE rolname = 'app_runtime';
-- Expect: rolcanlogin = t, rolsuper = f, rolbypassrls = f
```

Run it via `psql "<owner external conn>"` or, from `packages/database`, write the
`ALTER ROLE …` line to a temp file and `pnpm exec prisma db execute --file <tmp>`
then delete the file.

Build the runtime connection string (same host/db as owner, `app_runtime` user):

```
APP_RUNTIME_DATABASE_URL="postgresql://app_runtime:<hex32>@<host>:<port>/<db>?sslmode=require"
```

## Step 4b — Seed the database

The base seed creates system roles, permission pools, permissions, the platform
tenant, and the 32 sensitive-operation policies. The app cannot function without
it. Three things the connection string must carry:

| Requirement | Why |
| --- | --- |
| `sslmode=verify-full` | Render refuses non-TLS external connections, and the seed's raw `pg` Pool only enables TLS when the URL asks for it (Prisma's migration engine negotiates it on its own, which is why Step 3 worked without it). `verify-full` rather than `require` — pg treats them identically today but `require` weakens in pg v9. |
| `options=-c%20app.is_platform%3Don` | Tables are `FORCE ROW LEVEL SECURITY`, so even the owner is subject to RLS, and the managed owner is **not** a superuser (unlike local/CI, where it is). Global rows (`tenant_id IS NULL`) can only be inserted through the ADR-004 platform branch. Scoped to this session only. |
| `SEED_ARCHITECT_EMAIL` | Required in every environment; the seed has no built-in default. |

```bash
 export DEMO_DB='postgresql://<owner>:<pw>@<external-host>/<db>?sslmode=verify-full&options=-c%20app.is_platform%3Don'

SEED_ARCHITECT_EMAIL='architect@yourdomain.com' DATABASE_URL="$DEMO_DB" \
  pnpm --filter @workspace/database db:seed

DATABASE_URL="$DEMO_DB" pnpm --filter @workspace/database db:verify
```

Expect this to take a while against a remote database and to print little while
it runs — it is issuing thousands of inserts across the network.

**Claim the Architect account.** It is seeded with **no password**, so no
standing credential for it exists anywhere. Mint a single-use token (valid 30
minutes; only its hash is stored) when you are ready to use it — never from a
deploy pipeline, where it would land in the logs:

```bash
SEED_ARCHITECT_EMAIL='architect@yourdomain.com' DATABASE_URL="$DEMO_DB" \
  pnpm --filter @workspace/database run bootstrap:architect-token
```

Exchange it for a password of your choosing:
`POST /auth/reset-password { "token": "<token>", "newPassword": "<chosen>" }`.

**Optional — synthetic demo data.** Dev seeds refuse a non-local target unless
you opt in explicitly, so pass `ALLOW_REMOTE_DEV_SEED_TARGET=true`. Run them in
order; academics and operational data depend on the schools personas creates:

```bash
for s in db:seed:dev db:seed:academics db:seed:ops; do
  DATABASE_URL="$DEMO_DB" ALLOW_REMOTE_DEV_SEED_TARGET=true \
    pnpm --filter @workspace/database $s
done
```

These create accounts with well-known passwords — acceptable for synthetic demo
data, but **rotate them before any UAT client touches the environment**, and
never run them against production.

## Step 5 — Render Key Value (Redis)

Render → **New → Key Value**. Name `swe-keyvalue`, region **Oregon**, plan
**Free** (25MB; throttle-only, no persistence — a paid plan comes with the
durable queue in D1). Copy the **Internal** connection string → `REDIS_URL`.

## Step 6 — Render Web Service (API)

Easiest: Render → **New → Blueprint**, connect the repo; `render.yaml` creates
`swe-api` + wires `swe-postgres` / `swe-keyvalue`. Then set the `sync: false`
env vars on `swe-api` (dashboard → Environment):

| Key | Value |
| --- | --- |
| `APP_RUNTIME_DATABASE_URL` | from Step 4 |
| `APP_WEB_URL` | `https://demo.schoolwithease.com` |
| `CORS_ALLOWED_ORIGINS` | `https://demo.schoolwithease.com` |
| `WEBAUTHN_RP_ID` | `demo.schoolwithease.com` |
| `WEBAUTHN_ORIGIN` | `https://demo.schoolwithease.com` |
| `WEBAUTHN_ALLOWED_ORIGINS` | `https://demo.schoolwithease.com` |
| `JWT_SECRET` / `ENCRYPTION_KEY` | from Step 2 |
| `ANTHROPIC_API_KEY` / `VOYAGE_API_KEY` | your keys (optional; AI degrades gracefully) |
| `STORAGE_S3_*` | from Step 7 (set now; consumed in D1) |

Confirm **Auto-Deploy = No** (set by `render.yaml autoDeploy: false`). Add a
custom domain **`api.demo.schoolwithease.com`**. Copy the **service id**
(`srv-…`) for the CD secret.

## Step 7 — Cloudflare R2

1. Cloudflare → **R2 → Create bucket** `swe-demo-materials`.
2. **Manage R2 API Tokens → Create** (Object Read & Write). Record the Access
   Key ID + Secret, and the S3 endpoint `https://<accountid>.r2.cloudflarestorage.com`.
3. Put these on `swe-api` (Step 6): `STORAGE_S3_ENDPOINT`, `STORAGE_S3_BUCKET`,
   `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`.

## Step 8 — Vercel project (web)

1. Vercel → **Add New → Project**, import the repo. **Root Directory =
   `apps/web`**, Framework **Next.js** (`vercel.json` handles the monorepo build).
2. Env vars (Production): `NEXT_PUBLIC_API_URL=https://api.demo.schoolwithease.com`,
   `APP_CANONICAL_ORIGIN=https://demo.schoolwithease.com`,
   `AUTH_RESUME_SECRET=<Step 2>`.
3. **Disable Vercel's Git production auto-deploy** (Settings → Git → turn off
   production deployments, or set an Ignored Build Step) so the **CD workflow**
   is the single web deploy path and you don't get double deploys.
4. Add custom domain **`demo.schoolwithease.com`**.
5. Record `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (Project Settings), and create a
   `VERCEL_TOKEN` (Account Settings → Tokens).

## Step 9 — Cloudflare DNS

- `demo.schoolwithease.com` → CNAME to Vercel (Vercel shows the target).
- `api.demo.schoolwithease.com` → CNAME to the Render service host.

TLS is automatic (Cloudflare Universal SSL + the providers' certs).

## Step 10 — GitHub `demo` Environment + secrets

Repo → **Settings → Environments → New environment** `demo`. (Protection rules:
see the plan — demo is intended to auto-deploy, so leave required reviewers off;
reserve those for `uat`/`production`.) Add these **environment secrets**:

| Secret | Value |
| --- | --- |
| `DATABASE_URL_OWNER` | owner external conn (Step 1) |
| `RENDER_API_KEY` | Render → Account Settings → API Keys |
| `RENDER_API_SERVICE` | `swe-api` service id `srv-…` (Step 6) |
| `API_BASE_URL` | `https://api.demo.schoolwithease.com` (smoke only) |
| `WEB_BASE_URL` | `https://demo.schoolwithease.com` (smoke only) |
| `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | Step 8 |

> `API_BASE_URL` / `WEB_BASE_URL` are **only** the targets the smoke job curls —
> they do not configure either app. The web app's API origin comes from
> `NEXT_PUBLIC_API_URL` in **Vercel** project settings (Step 8), which `vercel
> pull` fetches at build time. Because `NEXT_PUBLIC_*` is inlined into the
> bundle during `vercel build`, changing it in Vercel requires a **redeploy** to
> take effect — restarting is not enough.

## Step 11 — First deploy

Push to `main` (or re-run CI). On green, **CD** (`.github/workflows/cd.yml`)
runs: migrate → deploy-api (waits for Render `live`) → deploy-web → smoke. Watch
the run in the **Actions** tab.

## Step 12 — Verify (D0 acceptance gate)

- `curl https://api.demo.schoolwithease.com/healthz` → `{"status":"ok"}`
- `curl https://api.demo.schoolwithease.com/readyz` → `{"status":"ready",…}`
  (200 only when the `app_runtime` connection + RLS self-test pass — proves
  runtime tenant isolation is live).
- Open `https://demo.schoolwithease.com`, do a login round-trip, and enroll +
  use a passkey (binds to the `demo.schoolwithease.com` RP).
- In the Render logs, confirm:
  `✔ RLS runtime enforcement active (role 'app_runtime', bypassrls=false, GUC applied)`.

---

## Rollback / teardown

- Bad deploy: re-run CD on the last-good commit, or roll back the Render deploy
  in its dashboard (previous deploy → Redeploy) and Vercel (Deployments →
  Promote a prior one).
- Full teardown: delete the Render Blueprint services, the Vercel project, the
  R2 bucket, and the `demo` GitHub Environment. Nothing here is shared with UAT.
