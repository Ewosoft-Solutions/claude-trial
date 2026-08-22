#!/usr/bin/env node
/**
 * Skeleton FIDELITY audit (AGENTS.md golden rule 11, sixth part).
 *
 * `audit-skeleton-shapes.mjs` checks a route uses the right skeleton FAMILY —
 * a table page gets a table skeleton. This checks the numbers inside it: that a
 * page with five summary cards does not paint four, that a six-column table
 * does not paint five, that a header with one button does not paint two.
 *
 * Those are the mismatches a reader actually notices, because the placeholder
 * rearranges itself into the content instead of being replaced by it.
 *
 * Ground truth is the page's own source: the `items` array on its `StatGrid`,
 * the `columns` array on its `DirectoryTable`, and the controls in its
 * `PageHeader actions`. A `<Select>` with eight options is ONE control.
 *
 *   node scripts/audit-skeleton-fidelity.mjs [--json]
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, normalize, relative } from 'node:path';

const APP = 'apps/web/app/(app)';
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

const DEFAULTS = {
  TablePageSkeleton: { rows: 6, columns: 5, stats: 0, actions: 2 },
  ReportPageSkeleton: { stats: 4, charts: 2, actions: 2 },
  ListDetailPageSkeleton: { listRows: 7, actions: 1 },
  FormPageSkeleton: { fields: 6, actions: 1 },
  DetailPageSkeleton: { sections: 3, actions: 2 },
};
/** Which measurable counts each skeleton can express. */
const ACCEPTS = {
  TablePageSkeleton: ['stats', 'actions', 'columns'],
  ReportPageSkeleton: ['stats', 'actions'],
  ListDetailPageSkeleton: ['actions'],
  FormPageSkeleton: ['actions'],
  DetailPageSkeleton: ['actions'],
};

/**
 * Routes whose counts cannot be read from source, and why.
 */
const ACCEPTED = {};

function balanced(s, start, open, close) {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close && --depth === 0) return s.slice(start, i + 1);
  }
  return '';
}

/** Top-level elements of an array literal. */
function countArrayItems(arr) {
  const inner = arr.slice(1, -1);
  let depth = 0, n = 0, seen = false, str = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (str) { if (ch === str && inner[i - 1] !== '\\') str = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { str = ch; seen = true; continue; }
    if ('([{'.includes(ch)) { depth++; seen = true; }
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) { if (seen) n++; seen = false; }
    else if (!/\s/.test(ch)) seen = true;
  }
  return seen ? n + 1 : n;
}

function resolveArray(txt, expr) {
  const e = expr.trim();
  if (e.startsWith('[')) return countArrayItems(e);
  if (/^[A-Za-z_$][\w$]*$/.test(e)) {
    const m = new RegExp(`(?:const|let)\\s+${e}(?:\\s*:[^=]+)?\\s*=\\s*\\[`).exec(txt);
    if (m) return countArrayItems(balanced(txt, txt.indexOf('[', m.index + m[0].length - 1), '[', ']'));
  }
  return null;
}

function propValue(txt, tag, prop) {
  const re = new RegExp(`<${tag}\\b`, 'g');
  for (let m; (m = re.exec(txt)); ) {
    const seg = txt.slice(m.index, m.index + 4000);
    const pm = new RegExp(`\\b${prop}=\\{`).exec(seg);
    if (!pm) continue;
    return balanced(seg, pm.index + pm[0].length - 1, '{', '}').slice(1, -1);
  }
  return null;
}

/** Controls in an actions cluster: a <Select> with eight options is one. */
function countControls(jsx) {
  let j = jsx.trim();
  if (j.startsWith('<>') && j.endsWith('</>')) j = j.slice(2, -3).trim();
  let n = 0, depth = 0, i = 0;
  while (i < j.length) {
    if (j[i] === '<') {
      if (j[i + 1] === '/') { depth--; const c = j.indexOf('>', i); i = c === -1 ? j.length : c + 1; continue; }
      const close = j.indexOf('>', i);
      if (close === -1) break;
      const selfClosing = j.slice(i, close + 1).trimEnd().endsWith('/>');
      if (depth === 0) n++;
      if (!selfClosing) depth++;
      i = close + 1; continue;
    }
    i++;
  }
  return n;
}

function expand(dir, src, depth = 2) {
  const seen = new Set(); let txt = src; let frontier = [[dir, src]];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const [cwd, s] of frontier)
      for (const m of s.match(/from '(\.[^']+)'/g) ?? []) {
        const base = normalize(join(cwd, m.slice(6, -1)));
        for (const cand of [base + '.tsx', base + '.ts']) {
          if (seen.has(cand) || !existsSync(cand)) continue;
          seen.add(cand); const c = read(cand); txt += '\n' + c; next.push([dirname(cand), c]);
        }
      }
    frontier = next;
  }
  return txt;
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory() && e !== 'node_modules') walk(p, out);
  }
  out.push(dir); return out;
}

const mismatches = [], accepted = [];
let compared = 0;

for (const dir of walk(APP)) {
  if (!existsSync(join(dir, 'loading.tsx')) || !existsSync(join(dir, 'page.tsx'))) continue;
  const route = '/' + relative(APP, dir);
  const jsx = /return\s*\(?\s*(<[A-Za-z][\s\S]*?\/>)\s*\)?\s*;/.exec(read(join(dir, 'loading.tsx')))?.[1];
  if (!jsx) continue;
  const flat = jsx.replace(/\s+/g, ' ');
  const comp = /^<(\w+)/.exec(flat)?.[1];
  if (!ACCEPTS[comp]) continue;

  const nums = { ...DEFAULTS[comp] };
  for (const m of flat.matchAll(/(\w+)=\{(\d+)\}/g)) nums[m[1]] = Number(m[2]);

  const txt = expand(dir, read(join(dir, 'page.tsx')));
  const real = {};
  const sg = propValue(txt, 'StatGrid', 'items');
  if (sg !== null) real.stats = resolveArray(txt, sg);
  const ph = propValue(txt, 'PageHeader', 'actions');
  if (ph !== null) real.actions = countControls(ph);
  const dt = propValue(txt, 'DirectoryTable', 'columns');
  if (dt !== null) real.columns = resolveArray(txt, dt);
  else { const th = (txt.match(/<TableHead\b/g) ?? []).length; if (th) real.columns = th; }

  if (!Object.keys(real).length) continue;
  compared++;
  if (ACCEPTED[route]) { accepted.push(route); continue; }
  const diffs = ACCEPTS[comp]
    .filter((k) => real[k] != null && nums[k] != null && nums[k] !== real[k])
    .map((k) => ({ prop: k, skeleton: nums[k], page: real[k] }));
  if (diffs.length) mismatches.push({ route, comp, diffs });
}

if (process.argv.includes('--json')) console.log(JSON.stringify({ compared, mismatches, accepted }, null, 2));
else {
  console.log(`Routes with measurable structure: ${compared}`);
  console.log(`  accepted exceptions: ${accepted.length}`);
  console.log(`\nSkeletons that misrepresent their page (${mismatches.length}):`);
  mismatches.length
    ? mismatches.forEach((m) => {
        console.log(`  ✗ ${m.route}  [${m.comp}]`);
        m.diffs.forEach((d) => console.log(`      ${d.prop}: skeleton ${d.skeleton}, page ${d.page}`));
      })
    : console.log('  ✓ none');
  console.log();
}
process.exit(mismatches.length ? 1 : 0);
