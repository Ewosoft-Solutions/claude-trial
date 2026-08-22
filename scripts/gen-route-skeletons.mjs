#!/usr/bin/env node
/**
 * Regenerates `apps/web/lib/navigation/route-skeletons.tsx`.
 *
 * The registry maps a route to the skeleton its own `loading.tsx` renders, so
 * the shell can paint the DESTINATION's shape from the moment a link is
 * clicked — before the router has committed and long before that `loading.tsx`
 * could run. It is a copy, kept honest by `audit-route-skeletons.mjs`.
 *
 * Every route that declares a literal shape is included, not only nav
 * destinations, because a segment's `loading.tsx` also stands in for its
 * CHILD routes — `/finance/invoices` covers `[id]` and `/new` — and those
 * parents delegate back here to draw whichever child is opening.
 *
 * Entries marked AUTHORITATIVE in the existing file are preserved: their own
 * `loading.tsx` delegates, so this file is the only place the shape survives.
 *
 *   node scripts/gen-route-skeletons.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const APP = 'apps/web/app/(app)';
const OUT = 'apps/web/lib/navigation/route-skeletons.tsx';
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory() && e !== 'node_modules') walk(p, out);
  }
  out.push(dir); return out;
}

// route -> literal skeleton JSX
const shapes = new Map();
for (const dir of walk(APP)) {
  const lp = join(dir, 'loading.tsx');
  if (!existsSync(lp) || !existsSync(join(dir, 'page.tsx'))) continue;
  const src = read(lp);
  if (src.includes('RouteSkeleton')) continue;            // delegates; see AUTHORITATIVE
  const m = /return\s*\(?\s*(<[A-Za-z][\s\S]*?\/>)\s*\)?\s*;/.exec(src);
  if (!m) continue;                                        // computed shape (e.g. /overview)
  const jsx = m[1].replace(/\s+/g, ' ');
  if (/\{\.\.\./.test(jsx) || /\(/.test(jsx.replace(/\(\)/g, ''))) continue; // not a literal
  shapes.set('/' + relative(APP, dir), jsx);
}

// nav destinations that only redirect map to wherever they land
const nav = read('apps/web/lib/navigation/app-navigation.tsx');
const redirects = new Map();
for (const m of nav.matchAll(/href:\s*'(\/[^']*)'/g)) {
  const href = m[1];
  if (shapes.has(href)) continue;
  const target = /redirect\('([^']+)'\)/.exec(read(join(APP, href.replace(/^\//, ''), 'page.tsx')))?.[1];
  if (target && shapes.has(target)) redirects.set(href, target);
}

// keep hand-authored AUTHORITATIVE entries from the current file
const prev = read(OUT);
const authoritative = new Map();
for (const m of prev.matchAll(/AUTHORITATIVE[\s\S]*?'(\/[^']*)':\s*\(\)\s*=>\s*([\s\S]*?),\n  '/g)) {
  authoritative.set(m[1], m[2].trim());
}

const used = [...new Set([...shapes.values(), ...authoritative.values()]
  .map((v) => /<(\w+)/.exec(v)?.[1]).filter(Boolean))].concat('DashboardPageSkeleton');
const imports = [...new Set(used)].sort();

const entries = [...new Set([...shapes.keys(), ...authoritative.keys()])].sort()
  .map((route) => {
    const body = authoritative.get(route) ?? shapes.get(route);
    const note = authoritative.has(route)
      ? '  // AUTHORITATIVE: this route\'s loading.tsx delegates back here, so this\n  // entry is the only declaration of its shape.\n'
      : '';
    return `${note}  '${route}': () => ${body},`;
  }).join('\n');

const header = prev.slice(0, prev.indexOf('import * as React'));
// Everything from OverviewSkeleton down is hand-written and preserved verbatim.
// (Anchoring on the REDIRECTS doc-comment instead emitted that block twice.)
const TAIL_ANCHOR = '/**\n * Overview picks its shape';
const tailAt = prev.indexOf(TAIL_ANCHOR);
if (tailAt === -1) { console.error('tail anchor not found — refusing to rewrite'); process.exit(1); }
const tail = prev.slice(tailAt);

const out = `${header}import * as React from 'react';

import {
${imports.map((i) => `  ${i},`).join('\n')}
} from '@workspace/ui/custom/states/page-skeletons';

import { useViewer } from '@/app/providers/viewer-provider';
import {
  DASHBOARD_SHAPES,
  dashboardKindFor,
} from '@/app/(app)/overview/dashboard-shape';

/** Route → the shape its own \`loading.tsx\` renders. */
const ROUTE_SKELETONS: Record<string, () => React.ReactElement> = {
${entries}
};

/** Nav destinations that only redirect, mapped to where they land. */
const REDIRECTS: Record<string, string> = {
${[...redirects.entries()].sort().map(([a, b]) => `  '${a}': '${b}',`).join('\n')}
};

${tail}`;

writeFileSync(OUT, out);
console.log(`registry: ${shapes.size} literal shapes, ${authoritative.size} authoritative, ${redirects.size} redirects`);
