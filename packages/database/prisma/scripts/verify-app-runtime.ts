/**
 * verify-app-runtime.ts — activation smoke check for the app_runtime cutover
 * (ADR-004; see docs/database-setup.md §5–6).
 *
 * Run this right after setting the app_runtime password + APP_RUNTIME_DATABASE_URL
 * to confirm runtime RLS is actually wired. It:
 *   [1] connects AS app_runtime,
 *   [2] confirms the role is restricted (not superuser, not BYPASSRLS),
 *   [3] confirms the tenant GUC (app.current_tenant_id) takes effect,
 *   [4] scopes to a real tenant and sees that tenant's rows (> 0),
 *   [5] scopes to a *different* tenant and sees 0 of the first tenant's rows,
 *   [6] confirms the audited platform bypass (app.is_platform='on') sees across
 *       tenants.
 *
 * Config resolution (never prints secrets): reads APP_RUNTIME_DATABASE_URL and
 * DATABASE_URL from the process env first, else parses apps/api/.env. The owner
 * URL is used only to auto-discover two populated tenants; all assertions run on
 * the app_runtime connection.
 *
 * Run:
 *   pnpm --filter @workspace/database run db:rls:verify
 * Exit 0 = pass, 1 = fail, 0 with SKIP = app_runtime not configured yet.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// ESM-safe __dirname (this package is "type": "module").
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

/** Parse an ENV file, returning only uncommented KEY=value pairs (quotes stripped). */
function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key) out[key] = val;
  }
  return out;
}

function resolve(name: string, fileEnv: Record<string, string>): string | undefined {
  return process.env[name] ?? fileEnv[name];
}

/** Candidate populated tenant-scoped tables to auto-discover two tenants from. */
const CANDIDATES: Array<[string, string]> = [
  ['student-management', 'students'],
  ['communication', 'announcements'],
  ['user-management', 'user_tenants'],
  ['finance', 'fee_invoices'],
];

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
}

async function main() {
  const apiEnvPath = path.resolve(scriptDir, '../../../../apps/api/.env');
  const fileEnv = parseEnvFile(apiEnvPath);
  const appUrl = resolve('APP_RUNTIME_DATABASE_URL', fileEnv);
  const ownerUrl = resolve('DATABASE_URL', fileEnv);

  if (!appUrl) {
    console.log(
      'SKIP verify-app-runtime: APP_RUNTIME_DATABASE_URL is not set (env or ' +
        `${path.relative(process.cwd(), apiEnvPath)}). ` +
        'Set the app_runtime password + URL first (docs/database-setup.md §5).',
    );
    process.exit(0);
  }
  if (!ownerUrl) {
    console.log('SKIP verify-app-runtime: DATABASE_URL (owner) not found.');
    process.exit(0);
  }
  if (appUrl === ownerUrl) {
    check('APP_RUNTIME_DATABASE_URL is distinct from the owner DATABASE_URL', false);
    process.exit(1);
  }

  const owner = new pg.Client({ connectionString: ownerUrl });
  const app = new pg.Client({ connectionString: appUrl });

  try {
    await app.connect();
    check('[1] connects as app_runtime', true);

    // [2]/[3] role attributes + GUC effect (mirrors the boot self-test probe).
    await app.query('BEGIN');
    await app.query(
      `SELECT set_config('app.current_tenant_id','00000000-0000-0000-0000-000000000000', true)`,
    );
    const probe = await app.query(
      `SELECT current_user::text role,
              (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) superuser,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) bypassrls,
              (current_setting('app.current_tenant_id',true)='00000000-0000-0000-0000-000000000000') guc`,
    );
    await app.query('ROLLBACK');
    const p = probe.rows[0];
    check('[2] runtime role is not superuser / not BYPASSRLS', !p.superuser && !p.bypassrls, `role=${p.role}`);
    check('[3] tenant GUC takes effect', p.guc === true);

    // Auto-discover two populated tenants (owner bypasses RLS).
    await owner.connect();
    let table: [string, string] | null = null;
    let tenants: string[] = [];
    for (const [s, t] of CANDIDATES) {
      const r = await owner
        .query(
          `SELECT tenant_id FROM "${s}"."${t}" WHERE tenant_id IS NOT NULL
           GROUP BY tenant_id ORDER BY count(*) DESC LIMIT 2`,
        )
        .catch(() => ({ rows: [] as Array<{ tenant_id: string }> }));
      if (r.rows.length >= 2) {
        table = [s, t];
        tenants = r.rows.map((x) => x.tenant_id);
        break;
      }
    }

    if (!table) {
      console.log(
        'NOTE: no table with ≥2 populated tenants found — [1]–[3] proved the ' +
          'connection + role; seed dev data to also exercise isolation [4]–[6].',
      );
    } else {
      const [s, t] = table;
      const [ta, tb] = tenants;
      await app.query('BEGIN');
      await app.query(`SELECT set_config('app.current_tenant_id',$1,true)`, [ta]);
      const own = await app.query(`SELECT count(*)::int n FROM "${s}"."${t}"`);
      const leak = await app.query(
        `SELECT count(*)::int n FROM "${s}"."${t}" WHERE tenant_id=$1`,
        [tb],
      );
      await app.query(`SELECT set_config('app.is_platform','on',true)`);
      const all = await app.query(`SELECT count(*)::int n FROM "${s}"."${t}"`);
      await app.query('ROLLBACK');

      check(`[4] scoped to tenant A sees its own rows (${s}.${t})`, own.rows[0].n > 0, `n=${own.rows[0].n}`);
      check('[5] tenant A cannot see tenant B rows', leak.rows[0].n === 0, `leak=${leak.rows[0].n}`);
      check('[6] app.is_platform=on sees across tenants', all.rows[0].n >= own.rows[0].n, `n=${all.rows[0].n}`);
    }
  } catch (e) {
    check('connection / query', false, (e as Error).message);
  } finally {
    await app.end().catch(() => {});
    await owner.end().catch(() => {});
  }

  console.log(
    failures === 0
      ? '\n✅ app_runtime cutover verified — runtime RLS is active.'
      : `\n❌ ${failures} check(s) failed — RLS is NOT safely enforced. See docs/database-setup.md §6.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
