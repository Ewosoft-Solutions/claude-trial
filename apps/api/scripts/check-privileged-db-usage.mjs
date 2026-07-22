#!/usr/bin/env node
/**
 * Guard: no NEW privileged-client usage outside the sanctioned layers.
 *
 * `DatabaseService` wraps the privileged Prisma connection, which Postgres RLS
 * does not constrain. Tenant data must go through `TenantDbService.client`
 * (single-tenant scope) and cross-tenant reads through `@PlatformScoped()`
 * (audited `app.is_platform` scope) — see ADR-004 and docs/platform-scope-plan.md.
 *
 * Some layers legitimately need the privileged client: auth and guards run
 * before a tenant context exists, and the database/health plumbing owns the
 * connection itself. Those directories are allowlisted below.
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

/** Layers that may hold the privileged client by design. */
const ALLOWED_PREFIXES = [
  'src/auth/', // runs pre-tenant-context; guards resolve who you are
  'src/common/', // owns the connection, audit writes, health probes
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

const offenders = findOffenders();

if (process.argv.includes('--update-baseline')) {
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

console.log(
  `✔ No new privileged DB usage (${offenders.length} grandfathered file(s) remaining).`,
);
