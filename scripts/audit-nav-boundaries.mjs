#!/usr/bin/env node
/**
 * Instant-navigation audit (AGENTS.md golden rule 11).
 *
 * Finds every App Router segment that `await`s without a Suspense boundary
 * above it — the shape that makes a click do nothing visible until the server
 * answers.
 *
 * The rule that makes this non-obvious: a segment's own `loading.tsx` wraps its
 * CHILDREN, and its `layout.tsx` wraps that loading UI in turn. So a layout's
 * own `await` is covered only by a `loading.tsx` in an ANCESTOR segment.
 *
 *   node scripts/audit-nav-boundaries.mjs          # human-readable
 *   node scripts/audit-nav-boundaries.mjs --json   # machine-readable
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';

const APP = 'apps/web/app';
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const isClient = (src) => /^\s*['"]use client['"]/.test(src);
const isAsyncServer = (src) => !isClient(src) && /export default async function/.test(src);
/** A page whose whole job is `redirect()` never paints, so it needs no skeleton. */
const isRedirectOnly = (src) =>
  src.includes('redirect(') && !/return\s*\(?\s*</.test(src.replace(/\/\*[\s\S]*?\*\//g, ''));

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') walk(p, out); }
  }
  out.push(dir);
  return out;
}

const ancestors = (d) => {
  const out = []; let cur = d;
  for (;;) { out.push(cur); if (cur === APP) break; cur = dirname(cur); }
  return out;
};
const boundaryAbove = (d) =>
  ancestors(d).slice(1).find((a) => existsSync(join(a, 'loading.tsx'))) ?? null;
const boundaryAtOrAbove = (d) =>
  ancestors(d).find((a) => existsSync(join(a, 'loading.tsx'))) ?? null;

/**
 * Layouts that may await without a boundary above them, and why.
 *
 * Both run ONLY on a cold document load — a layout is not re-rendered when
 * navigating between its children — so neither can produce the "my click did
 * nothing" symptom rule 11 exists to prevent. During a document load the
 * browser shows its own progress. Covering them would mean a root-level
 * skeleton that also flashes over the auth and portal surfaces, which have
 * their own chrome.
 */
const ACCEPTED_LAYOUTS = new Set(['(app)', '(root)']);

const findings = { blockingPages: [], blockingLayouts: [], accepted: [], ok: 0, total: 0 };

for (const dir of walk(APP)) {
  const pagePath = join(dir, 'page.tsx');
  const layoutPath = join(dir, 'layout.tsx');

  if (existsSync(layoutPath) && isAsyncServer(read(layoutPath)) && !boundaryAbove(dir)) {
    const name = relative(APP, dir) || '(root)';
    (ACCEPTED_LAYOUTS.has(name) ? findings.accepted : findings.blockingLayouts).push(name);
  }
  if (existsSync(pagePath)) {
    findings.total++;
    const src = read(pagePath);
    if (isAsyncServer(src) && !isRedirectOnly(src) && !boundaryAtOrAbove(dir)) {
      findings.blockingPages.push(relative(APP, dir) || '(root)');
    } else findings.ok++;
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  const { blockingLayouts: L, blockingPages: P } = findings;
  console.log(`Routes checked: ${findings.total}`);
  console.log(`\nAsync LAYOUTS with no boundary above them (${L.length}) — block their whole subtree:`);
  L.length ? L.forEach((d) => console.log('  ✗ ' + d)) : console.log('  ✓ none');
  if (findings.accepted.length)
    console.log(`  (accepted, cold-load only: ${findings.accepted.join(', ')})`);
  console.log(`\nAsync PAGES with no boundary (${P.length}) — click paints nothing:`);
  P.length ? P.forEach((d) => console.log('  ✗ ' + d)) : console.log('  ✓ none');
  console.log();
}
process.exit(findings.blockingLayouts.length + findings.blockingPages.length > 0 ? 1 : 0);
