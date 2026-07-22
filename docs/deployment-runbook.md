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
   is what CI and the SQL step below use — append `?sslmode=verify-full`
   (see the TLS note in Step 2).
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
openssl rand -base64 32   # ENCRYPTION_KEY   (32 bytes → exactly 44 base64 chars)
openssl rand -base64 64   # AUTH_RESUME_SECRET (web)
openssl rand -hex 32      # app_runtime DB password (hex → safe in a connection URL)
```

> **`ENCRYPTION_KEY` is a HARD boot requirement in production — the API refuses
> to start without a valid one.** The value must be a base64-encoded **32-byte**
> key; `openssl rand -base64 32` produces exactly that (44 characters). The two
> common mistakes both fail with a clear boot error:
>
> - **missing** → `ENCRYPTION_KEY is required in production`
> - **wrong size** (a `JWT_SECRET`-shaped `-base64 64` value = 88 chars, or a hex
>   key = 64 chars) → `ENCRYPTION_KEY must be a base64-encoded 32-byte key`
>
> Either surfaces as a Render `update_failed` and a failed CD run, not a clear
> message in the deploy UI — read the *instance's* logs for the exact error. This
> is deliberate fail-closed behaviour (0.5.7a): without a real key the app would
> otherwise encrypt pupil health data under a constant, effectively-public key.
> It is NOT enforced in `development`/`test`, so CI (which runs `NODE_ENV=test`)
> cannot catch a mis-set *production* key for you — the boot smoke in CI covers
> the code path, not your Render env. Rotating the key later invalidates every
> encrypted column; use `db:rotate:health-encryption` under a maintenance window
> (Step 4d).

> **Remote connection strings need `?sslmode=verify-full`.** Render (and most
> managed Postgres) refuse non-TLS external connections. Prisma's *migration
> engine* negotiates TLS automatically, so `db:deploy` works without it — but
> every script that goes through `packages/database/src/singleton.ts` (`db:seed`,
> `db:verify`, `db:rls:proof`, `db:rls:verify`, the dev seeds) uses a raw `pg`
> Pool, which enables TLS **only** when the URL says so. Without it they fail
> with `P1010 … DatabaseAccessDenied` / `SSL/TLS required`. Append
> `?sslmode=verify-full` to the external URL for all of these.
>
> **Use `verify-full`, not `require`.** `require` encrypts but accepts *any*
> certificate, so it does not stop an active man-in-the-middle between the client
> and the database — an attacker who can intercept the connection sees every row
> in plaintext. `verify-full` validates the certificate chain and the hostname.
> This is already proven against Render: the `DEMO_DB` string in Step 5 uses it
> successfully. If a connection that worked under `require` fails under
> `verify-full`, that is the check doing its job — resolve the trust chain rather
> than downgrading it back. (Caveat: node-`pg` has not historically implemented
> libpq's sslmode semantics in full, so for the raw-`pg` scripts this is the
> correct declaration but not by itself proof of verification — see Step 4b.)
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
APP_RUNTIME_DATABASE_URL="postgresql://app_runtime:<hex32>@<host>:<port>/<db>?sslmode=verify-full"
```

## Step 4c — Read-only inspection role + connection logging (0.5.9)

Least-privilege for humans: nobody needs standing **write** credentials.
Migrations run through CI (`pnpm db:deploy` in `cd.yml`), so day-to-day
inspection should use a role that can read but not mutate, and every connection
should be logged. This closes the gap that platform audit cannot see — direct
`psql` access sits entirely outside the API's audit trail (docs/platform-scope-plan.md
§7.1 decision 3).

**Create the role (as owner, out-of-band — like `app_runtime`).** Not a
migration: on managed Postgres the owner is **not** a superuser, so it cannot
grant `BYPASSRLS`, and an auto-applied `CREATE ROLE … BYPASSRLS` migration would
fail on Render. Run this by hand, once:

```sql
-- As the OWNER, against the target database.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') THEN
    CREATE ROLE app_readonly NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- SELECT-only, every application schema. Repeat GRANT SELECT after any migration
-- that adds a schema (or use ALTER DEFAULT PRIVILEGES per schema for new tables).
GRANT USAGE ON SCHEMA
  "academic-structure","admissions","ai","audit-logging","communication","events",
  "finance","health","hr","jwt-secrets","learning","library","profile",
  "roles-permissions","security-policy","student-management","tenant",
  "transportation","user-management"
  TO app_readonly;

GRANT SELECT ON ALL TABLES IN SCHEMA
  "academic-structure","admissions","ai","audit-logging","communication","events",
  "finance","health","hr","jwt-secrets","learning","library","profile",
  "roles-permissions","security-policy","student-management","tenant",
  "transportation","user-management"
  TO app_readonly;

-- Enable login out-of-band when an operator actually needs it:
ALTER ROLE app_readonly WITH LOGIN PASSWORD '<generated>';
```

> **RLS note.** `app_readonly` is `NOBYPASSRLS`, so under `FORCE ROW LEVEL
> SECURITY` it sees only rows its GUC allows — nothing, by default. For
> cross-tenant inspection an operator sets the audited platform GUC on the
> session (`options=-c%20app.is_platform%3Don`, as Step 4b does for seeding). It
> can read across tenants but can never write — the intended "look, don't touch"
> posture. Do **not** grant it `BYPASSRLS`.
>
> This is why the encryption in 0.5.7 matters independently: even a read-only
> operator (and any backup) sees the health narrative only as `enc:v1:` ciphertext.

**Connection + DDL logging.** Enable on the Postgres instance (plain settings —
no extension, works on managed Postgres):

```
log_connections = on
log_disconnections = on
log_statement = 'ddl'
```

This yields who-connected-when plus every schema change. If Render offers
`pgaudit`, enable it too for statement-level read auditing — verify availability
at deploy time; do not block the deploy on it.

**Backups.** Render automated backups + PITR export a full copy of the database
on a schedule — a larger exposure surface than `psql`, and one DB auditing does
not cover. Restrict who can download or restore backups to the smallest possible
set, and treat a backup as equivalent to production data. (The 0.5.7 encryption
is the only control that reaches inside a backup.)

## Step 4b — Seed the database

The base seed creates system roles, permission pools, permissions, the platform
tenant, and the 32 sensitive-operation policies. The app cannot function without
it. Three things the connection string must carry:

| Requirement | Why |
| --- | --- |
| `sslmode=verify-full` | Render refuses non-TLS external connections, and the seed's raw `pg` Pool only enables TLS when the URL asks for it (Prisma's migration engine negotiates it on its own, which is why Step 3 worked without it). `verify-full` rather than `require`: Prisma honours the distinction, and `require` never verifies the certificate. Note that node-`pg` has historically not implemented libpq's sslmode semantics in full, so for the raw-`pg` scripts treat `verify-full` as the correct *declaration* and confirm actual verification behaviour rather than assuming it — the guarantee is only as good as the client. |
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

## Step 4d — Re-seed on redeploy (when a release changes roles/permissions/policies)

Step 4b is the *first* seed of an empty database. This step is the recurring
companion: **an environment that already has data must be re-seeded whenever a
release changes the permission catalog, roles, permission pools, or the
sensitive-operation policies.** The CD `migrate` job (`pnpm db:deploy`) applies
schema migrations automatically, but it does **not** run the seed — so this is a
manual step the operator runs after such a release.

Whether a release needs it: if the diff touches `packages/database/prisma/scripts/seed.ts`
(role/pool/permission definitions) or `packages/database/src/sensitive-operations.ts`,
re-seed. (Example: the platform permission split — `platform.tenants` became
`platform.tenants.read`/`.act`/`.inspect` plus `platform.metrics` /
`platform.privileges` / `platform.approvals.override`. Without a re-seed, an
existing environment keeps the old single permission and platform roles get the
wrong access.)

**The base seed is idempotent and data-safe.** It upserts roles, pools,
permissions, and their assignments; it does **not** touch tenant rows, user
accounts, or seeded personas. Re-running it only reconciles the
authorization catalog. Same connection-string requirements as Step 4b
(`sslmode=verify-full`, `app.is_platform=on`, `SEED_ARCHITECT_EMAIL`):

```bash
# Migrations must already be applied (CD migrate job, or Step 3 manually).
SEED_ARCHITECT_EMAIL='architect@yourdomain.com' DATABASE_URL="$DEMO_DB" \
  pnpm --filter @workspace/database db:seed

DATABASE_URL="$DEMO_DB" pnpm --filter @workspace/database db:verify
```

**Two things that will bite — do not skip:**

1. **`EXPECTED_PERMISSION_COUNTS` must match the catalog.** The seed asserts the
   total and per-array permission counts at startup and aborts on a mismatch, so
   a release that changed permissions must have updated those numbers in the same
   commit. If the re-seed aborts here, the code and the guard disagree — fix the
   code, don't work around the guard. (This is a feature: it caught the platform
   split before it wrote a single row.)

2. **The seed upserts but never *prunes*.** A permission *removed* from the
   catalog stays in the database, still attached to its pools, still granted.
   After re-seeding, delete any now-orphaned permissions by hand. For the
   platform split:

   ```sql
   -- As owner, with app.is_platform=on. The bundled permission was replaced by
   -- three facets; leaving it would keep a stale level-10 grant on Architect.
   DELETE FROM "roles-permissions".permissions WHERE name = 'platform.tenants';
   ```

   Verify the catalog is what you expect before moving on:

   ```sql
   SELECT name FROM "roles-permissions".permissions
   WHERE name LIKE 'platform.tenants%' ORDER BY name;
   -- expect exactly: platform.tenants.act, platform.tenants.inspect, platform.tenants.read
   ```

Do the re-seed **before** cutting traffic to the new API build: a running API
resolves permissions from the database, so between the schema migration and the
re-seed the platform roles are briefly on the old catalog.

> **Same-release companion — health-data encryption backfill.** The release that
> introduced the permission split also turned on at-rest encryption for health
> narrative fields (0.5.7). New writes are enveloped automatically, but rows that
> predate the cutover stay plaintext until backfilled. Run once, with the **same
> `ENCRYPTION_KEY` the API uses**, after migrations:
>
> ```bash
> ENCRYPTION_KEY="$API_ENCRYPTION_KEY" DATABASE_URL="$DEMO_DB" \
>   pnpm --filter @workspace/database db:backfill:health-encryption
> ```
>
> Idempotent (skips already-enveloped rows). Key rotation later uses
> `db:rotate:health-encryption` (OLD + NEW key) under a maintenance window.

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
| `JWT_SECRET` | from Step 2 |
| `ENCRYPTION_KEY` | from Step 2 — **required to boot**, a base64-encoded 32-byte key (`openssl rand -base64 32` → 44 chars). A missing or wrong-size value crashes the instance → Render `update_failed`. Do **not** reuse a `JWT_SECRET`-style `-base64 64` value. |
| `ANTHROPIC_API_KEY` / `VOYAGE_API_KEY` | your keys (optional; AI degrades gracefully) |
| `STORAGE_S3_*` | from Step 7 (set now; consumed in D1) |

> **If a deploy fails with `update_failed`, check `ENCRYPTION_KEY` first.** The
> most common cause of the new instance failing to go live is a missing or
> wrong-length `ENCRYPTION_KEY` (see Step 2). The instance's own logs show the
> exact boot error.

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

   > **`NEXT_PUBLIC_*` is inlined at BUILD time — changing it requires a REBUILD,
   > not just a redeploy.** Next.js substitutes `NEXT_PUBLIC_*` values into the
   > bundle when it builds, so editing the variable in Vercel has **no effect**
   > on an already-built deployment. Re-running "Redeploy" against the existing
   > build (or with the build cache on) silently keeps the old value. Trigger a
   > fresh build: re-run the CD workflow, or Vercel → Redeploy with **"Use
   > existing Build Cache" OFF**.
   >
   > `NEXT_PUBLIC_API_URL` must be a **full origin including the scheme**
   > (`https://api.demo.schoolwithease.com`) with no trailing slash. If it is
   > missing, scheme-less, or stale, the Next server cannot reach the API and
   > every proxied route returns **502** — which the Step 12 smoke test reports
   > as `GET /api/health -> 502, expected 401`. The API being healthy while the
   > web app 502s is the signature of exactly this misconfiguration.
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

### Reading a failed CD smoke test

The CD `Smoke test` job runs after both deploys and probes the web app's proxy
routes. The two failures worth recognising:

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Deploy API (Render)` never goes live → `update_failed` | API crashed on boot; most often a missing or wrong-size `ENCRYPTION_KEY` | Step 2 / Step 6 — read the *instance's* logs for the exact boot error |
| Smoke: `GET /api/health -> 502, expected 401` (API itself healthy) | The Next server cannot reach the API — `NEXT_PUBLIC_API_URL` missing, scheme-less, or **stale because it was not rebuilt** | Step 8.2 — set the full origin, then trigger a **fresh build** (build cache off) |

A 502 from the web while `api.…/healthz` returns 200 always means wiring, not a
broken API: the smoke test checks the API first precisely so the two are
distinguishable.

---

## Rollback / teardown

- Bad deploy: re-run CD on the last-good commit, or roll back the Render deploy
  in its dashboard (previous deploy → Redeploy) and Vercel (Deployments →
  Promote a prior one).
- Full teardown: delete the Render Blueprint services, the Vercel project, the
  R2 bucket, and the `demo` GitHub Environment. Nothing here is shared with UAT.
