#!/usr/bin/env node
/**
 * Guard: no NEW privileged-client usage outside the sanctioned layers.
 *
 * `DatabaseService` wraps the owner Prisma connection. It was long described
 * here as one "which Postgres RLS does not constrain" — that was WRONG on any
 * managed database, and the error was load-bearing: the owner is an ordinary
 * role there and every app table is FORCE ROW LEVEL SECURITY, which applies to
 * the table owner too. The connection is not a bypass; it is an ordinary
 * RLS-subject connection that usually has no scope set, so its reads silently
 * return nothing. See docs/rls-privileged-client-plan.md.
 *
 * Tenant data must go through `TenantDbService.client` (single-tenant scope) and
 * cross-tenant reads through `@PlatformScoped()` (audited `app.is_platform`
 * scope) — see ADR-004 and docs/platform-scope-plan.md. Where neither fits —
 * auth paths that run before any request scope exists — the read must scope
 * ITSELF with `withTenantScope` / `withUserScope` from `@workspace/database/rls`.
 *
 * Some layers legitimately hold the privileged client: auth and guards run
 * before a tenant context exists, and the database/health plumbing owns the
 * connection itself. Those directories are allowlisted below — but holding the
 * client is not permission to read tenant tables unscoped, which is what the
 * second check enforces.
 *
 * Everything else is a ratchet: the files already using it are frozen into
 * `privileged-db-baseline.json`. New occurrences fail; removing one and not
 * updating the baseline also fails, so the list can only shrink.
 *
 * Usage:  node scripts/check-privileged-db-usage.mjs [--update-baseline]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(scriptDir, '..');
const baselinePath = join(scriptDir, 'privileged-db-baseline.json');

/**
 * Layers that may HOLD the privileged client by design.
 *
 * Deliberately not a licence to use it unscoped: these directories are exactly
 * where the login and audit breakages of 2026-07-23 lived, invisible because
 * this allowlist waved them through. The unscoped-read check below applies to
 * them too.
 */
const ALLOWED_PREFIXES = [
  'src/auth/', // runs pre-tenant-context; guards resolve who you are
  'src/common/', // owns the connection, audit writes, health probes
];

/**
 * Prisma models whose tables are tenant-scoped under RLS. Reading one of these
 * without a scope returns zero rows on a deployed database — a silent failure
 * that local dev and CI cannot reproduce, because their owner is a superuser.
 *
 * Generated from the Prisma schema: every model carrying `tenantId`/`schoolId`.
 * Regenerate with `--update-models` if the schema gains tenant-scoped models.
 */
const TENANT_SCOPED_MODELS = JSON.parse(
  readFileSync(join(scriptDir, 'tenant-scoped-models.json'), 'utf8'),
);

/** Scope helpers that make a read safe, plus the request-scoped client. */
const SCOPE_MARKERS = [
  'withTenantScope',
  'withUserScope',
  'runScoped',
  'runPlatform',
  'tenantDb.client',
  'TenantDbService',
];

/** Walk `src` for .ts files, skipping tests. Pure Node — no ripgrep in CI. */
function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      yield* sourceFiles(full);
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.e2e-spec.ts')
    ) {
      yield full;
    }
  }
}

function findOffenders() {
  const found = [];
  for (const file of sourceFiles(join(apiRoot, 'src'))) {
    // `: DatabaseService` catches constructor injection and field declarations.
    if (!readFileSync(file, 'utf8').includes(': DatabaseService')) continue;
    // Normalize to posix-style repo-relative paths so the baseline is portable.
    const rel = relative(apiRoot, file).split(sep).join('/');
    if (ALLOWED_PREFIXES.some((p) => rel.startsWith(p))) continue;
    found.push(rel);
  }
  return found.sort();
}

/**
 * Second, narrower check: a file that reads a tenant-scoped model must show
 * some evidence of scoping.
 *
 * This is the check that would have caught the login and audit breakages. The
 * allowlist above only says a layer may HOLD the privileged client; it says
 * nothing about reading tenant tables with no `app.current_tenant_id` set, and
 * that gap is precisely where those bugs lived.
 *
 * Deliberately file-level and heuristic rather than per-call-site: proving a
 * given read is scoped needs real dataflow analysis, and a check that is easy
 * to reason about but occasionally coarse is worth more than a precise one
 * nobody trusts. It ratchets against a baseline like the check above, so the
 * existing unscoped files are frozen and can only be removed.
 */
/** Remove block and line comments. Crude but sufficient: no string-literal in
 *  this codebase contains a `.model.findMany(` sequence. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function findUnscopedReaders() {
  const ops =
    '(?:findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|findMany|' +
    'create|createMany|update|updateMany|upsert|delete|deleteMany|count|' +
    'aggregate|groupBy)';
  const found = [];

  for (const file of sourceFiles(join(apiRoot, 'src'))) {
    // Strip comments first: doc comments discussing `prisma.auditLog.create()`
    // and deliberately commented-out calls are not reads, and matching them
    // produces exactly the kind of noise that gets a gate disabled.
    const src = stripComments(readFileSync(file, 'utf8'));
    const rel = relative(apiRoot, file).split(sep).join('/');

    // Only files that could be holding an unscoped client at all.
    if (!src.includes(': DatabaseService') && !src.includes('prisma:')) continue;
    if (SCOPE_MARKERS.some((marker) => src.includes(marker))) continue;

    const touched = TENANT_SCOPED_MODELS.filter((model) =>
      new RegExp(`\\.${model}\\.${ops}\\b`).test(src),
    );
    if (touched.length) found.push(`${rel}  [${touched.join(', ')}]`);
  }

  return found.sort();
}

const offenders = findOffenders();
const unscoped = findUnscopedReaders();

if (process.argv.includes('--update-baseline')) {
  writeFileSync(
    join(scriptDir, 'unscoped-tenant-reads-baseline.json'),
    `${JSON.stringify(unscoped, null, 2)}\n`,
  );
  writeFileSync(baselinePath, `${JSON.stringify(offenders, null, 2)}\n`);
  console.log(`Baseline updated: ${offenders.length} file(s).`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const added = offenders.filter((f) => !baseline.includes(f));
const removed = baseline.filter((f) => !offenders.includes(f));

if (added.length) {
  console.error(
    '\n✖ New privileged DatabaseService usage outside auth/ and common/:\n',
  );
  for (const f of added) console.error(`    ${f}`);
  console.error(
    '\n  Tenant data should use TenantDbService.client inside a @TenantScoped()' +
      '\n  handler; cross-tenant reads should use @PlatformScoped([...]), which' +
      '\n  opens the audited app.is_platform scope. See docs/platform-scope-plan.md.' +
      '\n\n  If this file genuinely needs the privileged client, add it to' +
      '\n  scripts/privileged-db-baseline.json with a comment on the PR explaining why.\n',
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    '\n✖ Baseline is stale — these files no longer use DatabaseService:\n',
  );
  for (const f of removed) console.error(`    ${f}`);
  console.error(
    '\n  Nice work. Run `pnpm check:privileged-db --update-baseline` to lock the gain in.\n',
  );
  process.exit(1);
}

const unscopedBaselinePath = join(
  scriptDir,
  'unscoped-tenant-reads-baseline.json',
);
const unscopedBaseline = JSON.parse(
  readFileSync(unscopedBaselinePath, 'utf8'),
);
const newUnscoped = unscoped.filter((f) => !unscopedBaseline.includes(f));
const fixedUnscoped = unscopedBaseline.filter((f) => !unscoped.includes(f));

if (newUnscoped.length) {
  console.error('\n✖ Tenant-scoped model read with no visible RLS scope:\n');
  for (const f of newUnscoped) console.error(`    ${f}`);
  console.error(
    '\n  On a deployed database the owner connection does NOT bypass RLS, so an' +
      '\n  unscoped read returns zero rows — silently. Local dev and CI cannot' +
      '\n  reproduce this: their owner is a superuser.' +
      '\n\n  Scope the read with withTenantScope / withUserScope from' +
      '\n  @workspace/database/rls, or run the handler under @TenantScoped() /' +
      '\n  @PlatformScoped() and read via TenantDbService.client.' +
      '\n  See docs/rls-privileged-client-plan.md.\n',
  );
  process.exit(1);
}

if (fixedUnscoped.length) {
  console.error('\n✖ Unscoped-read baseline is stale — these are now scoped:\n');
  for (const f of fixedUnscoped) console.error(`    ${f}`);
  console.error(
    '\n  Run `pnpm check:privileged-db --update-baseline` to lock the gain in.\n',
  );
  process.exit(1);
}

console.log(
  `✔ No new privileged DB usage (${offenders.length} grandfathered file(s) remaining).`,
);
console.log(
  `✔ No new unscoped tenant reads (${unscoped.length} grandfathered file(s) remaining).`,
);
