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
//   pnpm db:env local db:verify
//   pnpm db:env demo  db:seed
//   pnpm db:env demo  db:seed:dev:full
//
// `<db-script>` is any script in packages/database/package.json
// (db:seed, db:seed:dev, db:seed:academics, db:seed:ops, db:verify,
//  db:deploy, db:studio, …). The runner injects this environment's vars,
// then runs `pnpm --filter @workspace/database run <db-script>`.
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
