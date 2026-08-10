// ============================================================
// Database environment targets — TEMPLATE
// ============================================================
// Copy this file to `environments.local.mjs` (same directory) and fill in real
// values. The `.local.mjs` copy is gitignored and MUST NEVER be committed — it
// holds owner connection strings (full DB credentials).
//
//   cp scripts/db/environments.example.mjs scripts/db/environments.local.mjs
//
// Then target any environment with the runner:
//
//   pnpm db:env <envName> <db-script> [-- extra args]
//
//   pnpm db:env demo  db:deploy          # apply migrations
//   pnpm db:env demo  db:seed            # base seed (roles/perms/architect)
//   pnpm db:env demo  bootstrap:architect-token   # claim the Architect (below)
//   pnpm db:env local db:verify
//   pnpm db:env demo  db:seed:dev:full   # synthetic data (dev seeds)
//
// `<db-script>` is any script in packages/database/package.json
// (db:deploy, db:seed, db:seed:dev, db:seed:academics, db:seed:ops, db:verify,
//  bootstrap:architect-token, db:studio, …). The runner injects this
// environment's vars, then runs `pnpm --filter @workspace/database run <db-script>`.
//
// Claiming the Architect: `db:seed` creates the Platform Architect with NO
// password (no standing credential anywhere), so after seeding a fresh
// environment you must mint a one-time claim token — it is deliberately NOT
// minted during `db:seed` (that runs in CI/deploy logs). `bootstrap:architect-token`
// reads this entry's `SEED_ARCHITECT_EMAIL`, prints a single-use token (30-min,
// hash-only), which you exchange for a password of your choosing:
//
//   pnpm db:env demo bootstrap:architect-token
//   # → POST /auth/reset-password { "token": "<printed>", "newPassword": "<chosen>" }
//
// ------------------------------------------------------------
// Each environment is an object with the SAME shape ("template/class").
// Add a new environment by copying one entry and editing the values.
//
//   env            Required. Vars injected into the child process. DATABASE_URL
//                  is required (the owner/DDL connection). Anything else the
//                  script needs can live here too — SEED_ARCHITECT_EMAIL,
//                  APP_RUNTIME_DATABASE_URL, ENCRYPTION_KEY, etc. These override
//                  packages/database/.env for that run.
//
//   allowDevSeeds  Required for remote (non-local) targets to run dev seeds
//                  (db:seed:*). Dev seeds write fake, DESTRUCTIVE data. When the
//                  host is remote AND this is true, the runner sets
//                  ALLOW_REMOTE_DEV_SEED_TARGET=true for you. Leave false/unset
//                  on any environment that must not receive fake data.
//                  (Base `db:seed` is structural/idempotent and is allowed
//                  regardless — this flag only gates the dev seeds.)
//
//   protected      Optional. When true, ALL dev seeds are refused for this
//                  environment no matter what. Use for production. Base
//                  `db:seed` and read-only scripts (db:verify) still work.
// ------------------------------------------------------------

/** @type {Record<string, { env: Record<string, string>, allowDevSeeds?: boolean, protected?: boolean }>} */
export const environments = {
  // Your own machine. Dev seeds allowed automatically (host is local).
  local: {
    env: {
      DATABASE_URL: 'postgresql://<user>:<password>@localhost:5432/schoolsys',
      SEED_ARCHITECT_EMAIL: 'architect@<your-domain>',
    },
    allowDevSeeds: true,
  },

  // Shared remote demo DB. Dev seeds explicitly permitted here.
  demo: {
    env: {
      // Owner EXTERNAL connection (see docs/deployment-runbook.md Step 5).
      DATABASE_URL:
        'postgresql://<owner>:<pw>@<external-host>/<db>?sslmode=verify-full&options=-c%20app.is_platform%3Don',
      SEED_ARCHITECT_EMAIL: 'architect@<your-domain>',
      // Needed only by encryption backfill/rotate scripts:
      // ENCRYPTION_KEY: '<hex32>',
    },
    allowDevSeeds: true,
  },

  // Production. Base seed only — dev seeds hard-refused by `protected`.
  prod: {
    env: {
      DATABASE_URL:
        'postgresql://<owner>:<pw>@<external-host>/<db>?sslmode=verify-full&options=-c%20app.is_platform%3Don',
      SEED_ARCHITECT_EMAIL: 'architect@<your-domain>',
    },
    protected: true,
  },
};
