# Database Setup Guide

The end-to-end checklist for standing up the SchoolWithEase database in an
environment (local, dev, staging, prod). Follow it top to bottom the first time;
later runs only repeat the steps that changed.

> **Model recap (ADR-004):** one shared Postgres database **per environment**,
> all tenants separated by a `tenant_id` column + Row-Level Security. There is
> **no** database/schema/role per tenant — adding a school is just rows. So
> "per-environment" below means *local vs staging vs prod*, never per-tenant.

---

## 0. Prerequisites

- **PostgreSQL** reachable, and an owner/admin role that can run DDL + `ALTER
  ROLE` (locally this is your `DATABASE_URL` user).
- **Node ≥ 20.19** and `corepack` (run `corepack pnpm …`). If your shell
  defaults to an older Node, `nvm use 22` (or any ≥20.19) first — several
  toolchain steps hard-fail below 20.19.
- Repo installed: `corepack pnpm install`.

---

## 1. Environment variables

Copy the templates and fill them in (they carry inline comments for every var):
`apps/api/.env.example` → `apps/api/.env`, `apps/web/.env.example` →
`apps/web/.env.local`, `packages/database/.env.example` →
`packages/database/.env`. `.env*` files are gitignored — never commit secrets.
Full validation + defaults live in `apps/api/src/common/config/env.config.ts`.

| Var | Required | Purpose |
|-----|----------|---------|
| `DATABASE_URL` | **yes** | Owner connection. Used by migrations, seed, and platform/cross-tenant reads. `postgres(ql)://…`. |
| `APP_RUNTIME_DATABASE_URL` | recommended | Restricted `app_runtime` connection for tenant-scoped requests, so **RLS enforces at runtime** (§5). When unset, tenant queries fall back to the owner connection and RLS is **bypassed** (works, but not enforced). See ADR-004. |
| `DB_RLS_ENFORCED` | no | Forces the boot-time RLS self-test (§6) to **fail-closed** (refuse to boot) instead of warn. Defaults to **on in production**, off elsewhere. Set `true` to enforce in staging; `false` to opt a prod-like box out deliberately. |
| `ENCRYPTION_KEY` | prod | AES-256-GCM key for encrypted columns (JWT/MFA secrets, BYOK AI keys). Base64 32 bytes preferred. A dev default is used if unset (NOT for prod). |
| `JWT_SECRET` | prod | Signing secret (per-tenant JWT config may override). |
| `DB_POOL_MIN` / `DB_POOL_MAX` | no | Pool sizing (defaults are Kubernetes/serverless-aware). |

---

## 2. Apply the schema (migrations)

Run **as the owner** (`DATABASE_URL`). Migrations and seed always use the owner,
never `app_runtime`.

```bash
cd packages/database
corepack pnpm exec prisma migrate deploy      # apply all migrations
corepack pnpm exec prisma generate            # regenerate the client
corepack pnpm exec prisma migrate status      # expect: "Database schema is up to date!"
```

- Never hand-edit an applied migration; add a new one.
- New tenant-scoped tables **must** ship RLS in their migration — see
  `packages/database/README.md` → "Tenant isolation" and
  `docs/tenant-isolation-plan.md`.

---

## 3. Seed

```bash
# Production-safe catalog data (permissions, system roles, pools) — always safe:
corepack pnpm --filter @workspace/database run db:seed

# Local/dev only — demo personas + academics + operational data:
corepack pnpm --filter @workspace/database run db:seed:dev:full
```

Do **not** run the `:dev` seeds against staging/prod. Verify with
`corepack pnpm --filter @workspace/database run db:verify`.

---

## 4. Verify RLS coverage (CI gate)

Every tenant-scoped table must have RLS + a `tenant_isolation` policy. This is a
build gate — run it after any schema change:

```bash
corepack pnpm --filter @workspace/database run db:rls:check     # fails if a tenant table lacks RLS
corepack pnpm --filter @workspace/database run db:rls:enforce   # (fix) apply the strict policy to any missing
```

---

## 5. Provision the `app_runtime` role (RLS runtime enforcement)

This is what makes RLS a **live runtime backstop** rather than a dormant one.
The role, its grants, and `ALTER DEFAULT PRIVILEGES` are created by migrations;
you only supply a **password** and the **connection string** per environment.

### 5a. Set the role password (once per database, as owner)

`psql` may not be installed; use Prisma's `db execute`, and keep the secret in a
temp file **outside** the repo:

```bash
SECRET="$(openssl rand -hex 32)"                       # hex → no URL-encoding needed
printf "ALTER ROLE app_runtime WITH PASSWORD '%s';\n" "$SECRET" > /tmp/app-runtime-pw.sql
cd packages/database
corepack pnpm exec prisma db execute --file /tmp/app-runtime-pw.sql
rm -f /tmp/app-runtime-pw.sql                          # delete the file with the secret
echo "app_runtime password (store in secret manager): $SECRET"
```

The role already has `LOGIN` and `NOBYPASSRLS`; you're only setting its password.

### 5b. Point the app at it

Set `APP_RUNTIME_DATABASE_URL` to the **same host/db** as `DATABASE_URL`, with
the `app_runtime` user + the password from 5a:

```
APP_RUNTIME_DATABASE_URL="postgresql://app_runtime:<SECRET>@<host>:<port>/<db>"
```

Leave `DATABASE_URL` untouched. Restart the API.

### 5c. Confirm grants are complete (drift check)

Migration `20260710020000_app_runtime_grants_cutover` grants `app_runtime` full
DML on every tenant schema/table and sets default privileges for future tables.
If you ever suspect drift, `app_runtime` should have **0** tables missing DML and
**0** schemas missing USAGE. (A missing grant surfaces at runtime as
`permission denied for table/sequence …`.)

---

## 6. Prove isolation as `app_runtime`

With `APP_RUNTIME_DATABASE_URL` set, run the isolation proof — it connects **as
the restricted role** and asserts cross-tenant read/insert/update/delete are all
blocked and the audited platform bypass works:

```bash
corepack pnpm --filter @workspace/database run db:rls:proof
```

Then a live smoke test: sign in and load a few tenant surfaces (attendance,
students, finance). Success = data loads normally. Watch the API logs for the
two failure signatures:

- `permission denied for table/sequence …` → a missing `app_runtime` grant (§5c).
- `new row violates row-level security policy …` → a write path that didn't set
  the tenant GUC (`app.current_tenant_id`).

### Boot-time enforcement (automatic)

The API self-tests RLS at startup (`RlsEnforcementService`). When
`APP_RUNTIME_DATABASE_URL` is configured it probes the live connection and
confirms the role is **not** a superuser / `BYPASSRLS` role and that the tenant
GUC takes effect. Outcomes:

- **Production (or `DB_RLS_ENFORCED=true`)** — fail-closed: if `app_runtime`
  isn't configured, or the probe shows a role that bypasses RLS, or the GUC
  doesn't apply, **the app refuses to boot** with a clear error. This is the
  "must-have" gate — prod cannot silently run without runtime isolation.
- **Dev/test (default)** — logs a loud `⚠` warning and continues, so a fresh
  clone or CI that hasn't provisioned `app_runtime` still runs.

So the most dangerous misconfiguration — `APP_RUNTIME_DATABASE_URL` pointed at a
privileged role, where you *think* RLS is on but it isn't — is caught at boot in
enforcing environments rather than in production traffic.

---

## 7. Wire it into CI (recommended)

Provide `APP_RUNTIME_DATABASE_URL` to CI so the gated RLS e2e specs actually run
(they **skip** without it) — e.g. `apps/api/test/ai-rls.e2e-spec.ts`. This turns
any future missing-grant / missing-GUC regression into a failed build instead of
a production surprise.

---

## Rollback

Removing / commenting `APP_RUNTIME_DATABASE_URL` and restarting reverts to the
owner connection (today's pre-cutover behaviour). No schema or data change to
undo — it's a pure connection switch.

---

## Quick checklist

- [ ] `DATABASE_URL` set; `ENCRYPTION_KEY` / `JWT_SECRET` set for non-local.
- [ ] `prisma migrate deploy` + `generate`; `migrate status` clean.
- [ ] `db:seed` (+ `db:seed:dev:full` for local only).
- [ ] `db:rls:check` passes.
- [ ] `app_runtime` password set (5a); `APP_RUNTIME_DATABASE_URL` set (5b).
- [ ] `db:rls:proof` passes; live smoke test clean.
- [ ] CI has `APP_RUNTIME_DATABASE_URL`.
