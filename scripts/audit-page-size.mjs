#!/usr/bin/env node
/**
 * Page-size audit (AGENTS.md golden rule 11).
 *
 * Every table opens at the same number of rows, so moving between directories
 * does not resize the page under the reader. That number lives in ONE place —
 * `DEFAULT_PAGE_SIZE` in `apps/web/lib/page-size.ts` — and a page that declares
 * its own silently opts out of it.
 *
 * Nine pages had done exactly that (eight at 25, one at 50) while still calling
 * the constant `DEFAULT_PAGE_SIZE`, so the shadowing was invisible at the call
 * site. This fails the build if it happens again.
 *
 *   node scripts/audit-page-size.mjs [--json]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'apps/web';
const SOURCE_OF_TRUTH = 'apps/web/lib/page-size.ts';

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (!['node_modules', '.next'].includes(e)) walk(p); }
    else if (/\.tsx?$/.test(p)) files.push(p);
  }
})(ROOT);

const offenders = [];
for (const f of files) {
  if (f === SOURCE_OF_TRUTH || f.includes('design-system')) continue;
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/^\s*const\s+(DEFAULT_PAGE_SIZE|PAGE_SIZE)\s*=\s*(\d+)\s*;/gm)) {
    offenders.push({ file: relative(ROOT, f), name: m[1], value: Number(m[2]) });
  }
}

if (process.argv.includes('--json')) console.log(JSON.stringify({ offenders }, null, 2));
else {
  console.log(`Files scanned: ${files.length}`);
  console.log(`\nPages declaring their own page size (${offenders.length}):`);
  offenders.length
    ? offenders.forEach((o) => console.log(`  ✗ ${o.file}  ${o.name} = ${o.value}  — import it from @/lib/page-size instead`))
    : console.log('  ✓ none — every table uses the shared default');
  console.log();
}
process.exit(offenders.length ? 1 : 0);
