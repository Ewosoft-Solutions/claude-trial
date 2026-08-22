#!/usr/bin/env node
/**
 * Skeleton SHAPE audit (AGENTS.md golden rule 11, second half).
 *
 * `audit-nav-boundaries.mjs` proves a route paints something instantly. This
 * proves it paints the RIGHT something: a skeleton whose silhouette matches the
 * page, so nothing reflows when the data lands.
 *
 * It infers what a page renders by following its relative imports (most pages
 * are a thin server wrapper around a client component) and compares that to the
 * skeleton variant its `loading.tsx` uses.
 *
 * Heuristic, not proof — it cannot see a layout, only which components appear.
 * Treat a hit as "go and look", and add a reasoned entry to ACCEPTED when the
 * skeleton is right and the heuristic is wrong.
 *
 *   node scripts/audit-skeleton-shapes.mjs [--json]
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, normalize, relative } from 'node:path';

const APP = 'apps/web/app';
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

const VARIANTS = ['TablePageSkeleton','DashboardPageSkeleton','ListDetailPageSkeleton',
  'FormPageSkeleton','ReportPageSkeleton','DetailPageSkeleton','DetailBodySkeleton'];

/**
 * Routes whose skeleton is correct even though the heuristic disagrees, and why.
 */
const ACCEPTED = {
  '(app)/people/[id]': 'DetailBodySkeleton is deliberate — the chrome is the [id] layout, which has already painted the header. A page-level variant would open a second ShellMain.',
  '(auth)/login': 'Auth pages render outside the app shell; a bare centred card is the right silhouette.',
  '(portal)/apply/[slug]': 'Public portal, outside the app shell.',
  '(portal)/status/[token]': 'Public portal, outside the app shell.',
  '(app)/platform/analytics': 'Report-shaped: stat row + charts dominate; the table is secondary.',
  '(app)/finance/invoices/new': 'Form-dominant; the line-items table is one field within the form.',
  '(app)/finance/invoices/[id]': 'Detail-dominant; the lines table sits inside a section card.',
  // A segment's loading.tsx stands in for its CHILD routes as well, so where a
  // child has a different shape the parent cannot be a fixed one: it delegates
  // to RouteSkeleton and draws whichever route is opening. Their shapes live in
  // the route-skeleton registry, marked AUTHORITATIVE there.
  '(app)/classes/assessments':
    'Delegates: /take is a table page, not a list/detail one.',
  '(app)/classes/assessments/take':
    'Delegates: its [id] child is a detail page, not a table.',
  '(app)/finance/households':
    'Delegates: its [id] child is a detail page, not a table.',
  '(app)/finance/invoices':
    'Delegates: its [id] (detail) and /new (form) children are neither a table.',
  '(app)/people':
    'Delegates: its [id] child is a person profile, not the directory table.',
  '(app)/platform/analytics':
    'Delegates: its /assistant child is a detail page, not a report.',
  '(app)/students/admissions':
    'Delegates: its [id] child is an application detail, not the pipeline table.',
  '(app)/settings/ai-usage': 'Cards-dominant; the usage table is nested INSIDE a card, which a section-card block already stands for. The heuristic sees <Table> but cannot see nesting.',
};

const skeletonOf = (src) => VARIANTS.find((v) => new RegExp(`\\b${v}\\b`).test(src))
  ?? (/\bSkeleton\b/.test(src) ? 'custom' : null);

function expand(dir, src, depth = 2) {
  const seen = new Set(); let txt = src; let frontier = [[dir, src]];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const [cwd, s] of frontier)
      for (const rel of s.match(/from '(\.[^']+)'/g) ?? []) {
        const base = normalize(join(cwd, rel.slice(6, -1)));
        for (const cand of [base + '.tsx', base + '.ts', join(base, 'index.tsx')]) {
          if (seen.has(cand) || !existsSync(cand)) continue;
          seen.add(cand); const c = read(cand); txt += c; next.push([dirname(cand), c]);
        }
      }
    frontier = next;
  }
  return txt;
}

const signals = (t) => new Set([
  /DirectoryTable|<Table\b|TableHeader|TableBody/.test(t) && 'table',
  /\bStatGrid\b|\bStatTiles\b|StatCard/.test(t) && 'stats',
  /Recharts|ResponsiveContainer|<BarChart|<LineChart|<AreaChart|<PieChart/.test(t) && 'chart',
  /FormField|<form\b|useForm/.test(t) && 'form',
].filter(Boolean));

function expected(sig) {
  if (sig.has('table')) return ['TablePageSkeleton', 'ListDetailPageSkeleton'];
  if (sig.has('chart')) return ['ReportPageSkeleton', 'DashboardPageSkeleton'];
  if (sig.has('form')) return ['FormPageSkeleton', 'DetailPageSkeleton'];
  if (sig.has('stats')) return ['DashboardPageSkeleton', 'DetailPageSkeleton', 'ReportPageSkeleton'];
  return [...VARIANTS, 'custom'];
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory() && e !== 'node_modules') walk(p, out);
  }
  out.push(dir); return out;
}

const suspect = [], accepted = [], inherits = [];
let matched = 0, total = 0;

for (const dir of walk(APP)) {
  const pagePath = join(dir, 'page.tsx');
  if (!existsSync(pagePath)) continue;
  const src = read(pagePath);
  if (src.includes('redirect(') && !/return\s*\(?\s*</.test(src)) continue;
  total++;
  const route = relative(APP, dir);
  const lp = join(dir, 'loading.tsx');
  if (!existsSync(lp)) { inherits.push(route); continue; }
  const sk = skeletonOf(read(lp));
  const exp = expected(signals(expand(dir, src)));
  if (exp.includes(sk)) { matched++; continue; }
  (ACCEPTED[route] ? accepted : suspect).push({ route, has: sk, wants: exp });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total, matched, suspect, accepted, inherits }, null, 2));
} else {
  console.log(`Routes with a page: ${total}`);
  console.log(`  shape matches      : ${matched}`);
  console.log(`  accepted exceptions: ${accepted.length}`);
  console.log(`  inherit a parent's : ${inherits.length}`);
  console.log(`\nSUSPECT shapes (${suspect.length}) — go and look:`);
  suspect.length
    ? suspect.forEach((s) => console.log(`  ✗ ${s.route}  has=${s.has}  wants=${s.wants.join('|')}`))
    : console.log('  ✓ none');
  console.log();
}
process.exit(suspect.length ? 1 : 0);
