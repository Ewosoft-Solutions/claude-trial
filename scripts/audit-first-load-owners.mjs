#!/usr/bin/env node
/**
 * First-load ownership audit (AGENTS.md golden rule 11, fourth part).
 *
 * A route's `loading.tsx` stands in for the WHOLE body, so the body must be
 * able to render in full when it arrives. A client component that fetches its
 * own first load breaks that promise: the route skeleton is replaced not by
 * content but by the component's own, smaller skeleton — one wait becomes two,
 * and the second is a different size. That reads as a glitch, not as loading.
 *
 * The fix is always the same: resolve the first load on the SERVER and pass it
 * in; the component keeps ownership of refreshes after its own mutations.
 *
 *   node scripts/audit-first-load-owners.mjs [--json]
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, normalize, relative } from 'node:path';

const APP = 'apps/web/app';
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const isClient = (s) => /^\s*['"]use client['"]/.test(s);

/**
 * Components that legitimately own a first load, and why. A drawer or modal is
 * opened by an explicit action and IS its own surface — it never stands behind
 * a route skeleton, so its spinner is the only loader the reader sees.
 */
const ACCEPTED = {
  '(app)/_shared/step-up-prompt.tsx': 'Modal, opened by an action mid-flow.',
  '(app)/people/person-detail-drawer.tsx': 'Drawer, opened on a row click.',
  '(app)/students/admissions/application-drawer.tsx': 'Drawer, opened on a row click.',
  '(app)/overview/dashboards/parent-dashboard.tsx':
    'The /overview page is itself a client component, so there is no server render to seed from. Measured: the dashboard shell paints immediately and only card interiors fill in — page height stays constant, so no collapse.',
  '(app)/overview/dashboards/platform-dashboard.tsx':
    'Same as parent-dashboard: client page, stable layout, card interiors only.',
  '(app)/finance/households/[id]/household-detail-client.tsx':
    'Receives household, students, standing as props. Its fetches are all gated on `open` — dialog lookups, not the first load.',
  '(app)/settings/audit/audit-client.tsx':
    'Receives rows and total as props. Its fetch is the detail drawer for a selected row.',
  '(app)/settings/roles/roles-manager.tsx':
    'Receives roles and templates as props. Its fetches are gated on `open` — the preview drawer.',
};

function localDeps(dir, src, depth = 2) {
  const seen = new Set(); let frontier = [[dir, src]];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const [cwd, s] of frontier)
      for (const m of s.match(/from '(\.[^']+)'/g) ?? []) {
        const base = normalize(join(cwd, m.slice(6, -1)));
        for (const cand of [base + '.tsx', join(base, 'index.tsx')]) {
          if (seen.has(cand) || !existsSync(cand)) continue;
          seen.add(cand); next.push([dirname(cand), read(cand)]);
        }
      }
    frontier = next;
  }
  return seen;
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory() && e !== 'node_modules') walk(p, out);
  }
  out.push(dir); return out;
}

const offenders = [], accepted = [];
const seenPairs = new Set();

for (const dir of walk(APP)) {
  if (!existsSync(join(dir, 'page.tsx'))) continue;
  if (!existsSync(join(dir, 'loading.tsx'))) continue;   // no route skeleton, no clash
  const page = read(join(dir, 'page.tsx'));
  for (const cand of localDeps(dir, page)) {
    const src = read(cand);
    if (!isClient(src)) continue;
    const fetchesOnMount = /useEffect\(/.test(src) && /\bfetch\(/.test(src);
    const swr = /\buseSWR\b/.test(src);
    const ownLoader = /Skeleton|animate-pulse|Loader2/.test(src);
    if (!((fetchesOnMount || swr) && ownLoader)) continue;
    if (/\bseeded\b/.test(src)) continue;                // takes initial data
    const comp = relative(APP, cand);
    const key = `${relative(APP, dir)}::${comp}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    (ACCEPTED[comp] ? accepted : offenders).push({ route: relative(APP, dir), component: comp });
  }
}

if (process.argv.includes('--json')) console.log(JSON.stringify({ offenders, accepted }, null, 2));
else {
  console.log(`Components owning their first load under a route that already has a skeleton:`);
  console.log(`  accepted (drawers, modals, client pages): ${accepted.length}`);
  console.log(`\nUnseeded (route skeleton is replaced by theirs) — ${offenders.length}:`);
  offenders.length
    ? offenders.forEach((o) => console.log(`  ✗ ${o.route}  →  ${o.component}`))
    : console.log('  ✓ none');
  console.log();
}
process.exit(offenders.length ? 1 : 0);
