#!/usr/bin/env node
/**
 * Second-stage loading audit (AGENTS.md golden rule 11, third part).
 *
 * The route boundary makes the FIRST paint instant. This catches the second
 * stage: a client component that fetches on mount and, while waiting, shows a
 * line of text or a bare pulsing slab instead of a skeleton of its content.
 *
 * Both are the same defect from the reader's side — the card is a different
 * size and shape before and after the data lands, so the page jumps — and a
 * text "Loading…" also tells a screen reader nothing, because it is not in a
 * busy region.
 *
 * Use the shared primitives in `@workspace/ui/custom/states/skeletons`
 * (`SkeletonList`, `SkeletonText`, `SkeletonTable`, `SkeletonForm`): they are
 * `role="status"` busy regions AND the right silhouette.
 *
 *   node scripts/audit-loading-states.mjs [--json]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'apps/web/app';
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') walk(p); }
    else if (p.endsWith('.tsx')) files.push(p);
  }
})(ROOT);

const findings = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  src.split('\n').forEach((line, i) => {
    // A visible "Loading…" — an sr-only label inside a busy region is correct
    // and deliberately not flagged.
    if (/>\s*Loading[….]*\s*</.test(line) && !/sr-only/.test(line))
      findings.push({ file: f, line: i + 1, kind: 'text', snippet: line.trim().slice(0, 80) });
    // A hand-rolled pulsing slab rather than the shared skeleton primitives.
    if (/animate-pulse/.test(line) && !/skeleton/i.test(src))
      findings.push({ file: f, line: i + 1, kind: 'ad-hoc pulse', snippet: line.trim().slice(0, 80) });
  });
}

if (process.argv.includes('--json')) console.log(JSON.stringify({ findings }, null, 2));
else {
  console.log(`Client files scanned: ${files.length}`);
  console.log(`\nUnshaped loading states (${findings.length}):`);
  findings.length
    ? findings.forEach((x) => console.log(`  ✗ ${x.file}:${x.line}  [${x.kind}]  ${x.snippet}`))
    : console.log('  ✓ none — every second-stage wait paints a shaped skeleton');
  console.log();
}
process.exit(findings.length ? 1 : 0);
