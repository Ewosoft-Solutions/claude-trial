#!/usr/bin/env node
/**
 * Route-skeleton registry audit (AGENTS.md golden rule 11, fifth part).
 *
 * `lib/navigation/route-skeletons.tsx` re-declares each nav destination's
 * skeleton so the app shell can paint the DESTINATION's shape from the moment
 * a nav item is clicked — hundreds of milliseconds before the router commits
 * and the route's own `loading.tsx` could run.
 *
 * It has to be a copy: those `loading.tsx` files are free to be server
 * components, and several are, so a client module cannot import them. This
 * script is what stops the copy from drifting. It fails when:
 *
 *   · a nav destination has no entry in the registry (the reader would get a
 *     generic placeholder that then re-settles into the real shape), or
 *   · an entry disagrees with the shape that route's `loading.tsx` renders.
 *
 * Regenerate the registry after adding a nav destination, then re-run this.
 *
 *   node scripts/audit-route-skeletons.mjs [--json]
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const APP = 'apps/web/app/(app)';
const NAV = 'apps/web/lib/navigation/app-navigation.tsx';
const REGISTRY = 'apps/web/lib/navigation/route-skeletons.tsx';
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const routeDir = (href) => join(APP, href.replace(/^\//, ''));
const norm = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * Destinations whose shape cannot be compared textually, and why.
 */
const ACCEPTED = {
  '/overview':
    'Its shape depends on the viewer\'s clearance. Both the route loading.tsx and the registry read DASHBOARD_SHAPES + dashboardKindFor, so they cannot drift.',
};

const navSrc = read(NAV);
const hrefs = [...new Set([...navSrc.matchAll(/href:\s*'(\/[^']*)'/g)].map((m) => m[1]))].sort();

// Resolve each nav destination to the route whose skeleton stands in for it.
const resolved = new Map();
for (const href of hrefs) {
  const dir = routeDir(href);
  if (existsSync(join(dir, 'loading.tsx'))) { resolved.set(href, href); continue; }
  const redirect = /redirect\('([^']+)'\)/.exec(read(join(dir, 'page.tsx')))?.[1];
  if (redirect && existsSync(join(routeDir(redirect), 'loading.tsx'))) resolved.set(href, redirect);
}

// What each route's own loading.tsx renders.
const actual = new Map();
for (const target of new Set(resolved.values())) {
  const jsx = /return\s*\(?\s*(<[A-Za-z][\s\S]*?\/>)\s*\)?\s*;/.exec(read(join(routeDir(target), 'loading.tsx')))?.[1];
  if (jsx) actual.set(target, norm(jsx));
}

// What the registry claims.
const registrySrc = read(REGISTRY);
// Entries may be wrapped across lines by the formatter, so take each arrow
// body up to the start of the next entry rather than assuming one line.
const block = /const ROUTE_SKELETONS[\s\S]*?=\s*\{([\s\S]*?)\n\};/.exec(registrySrc)?.[1] ?? '';
const claimed = new Map();
{
  const re = /'(\/[^']*)':\s*\(\)\s*=>\s*/g;
  const starts = [];
  for (let m; (m = re.exec(block)); ) starts.push({ path: m[1], from: re.lastIndex });
  starts.forEach((entry, i) => {
    const to = i + 1 < starts.length
      ? block.lastIndexOf("'" + starts[i + 1].path + "'", starts[i + 1].from)
      : block.length;
    const body = block.slice(entry.from, to).trim().replace(/,$/, '').trim();
    const jsx = /(<[\s\S]*\/>)/.exec(body)?.[1];
    if (jsx) claimed.set(entry.path, norm(jsx));
  });
}

const missing = [], mismatched = [], accepted = [];
for (const [href, target] of resolved) {
  if (ACCEPTED[href] || ACCEPTED[target]) { accepted.push(href); continue; }
  const want = actual.get(target);
  const got = claimed.get(target);
  if (!want) continue;                       // nothing to compare against
  if (!got) { missing.push({ href, target, want }); continue; }
  if (got !== want) mismatched.push({ target, want, got });
}

const problems = missing.length + mismatched.length;
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ missing, mismatched, accepted, checked: resolved.size }, null, 2));
} else {
  console.log(`Nav destinations checked: ${resolved.size}`);
  console.log(`  accepted (shape is computed, not literal): ${accepted.length}`);
  console.log(`\nMissing from the registry (${missing.length}):`);
  missing.length ? missing.forEach((m) => console.log(`  ✗ ${m.href}  → ${m.target}  wants ${m.want}`))
                 : console.log('  ✓ none');
  console.log(`\nDrifted from the route's own loading.tsx (${mismatched.length}):`);
  mismatched.length ? mismatched.forEach((m) => {
    console.log(`  ✗ ${m.target}`);
    console.log(`      route:    ${m.want}`);
    console.log(`      registry: ${m.got}`);
  }) : console.log('  ✓ none');
  console.log();
}
process.exit(problems ? 1 : 0);
