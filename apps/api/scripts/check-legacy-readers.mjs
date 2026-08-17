#!/usr/bin/env node
/**
 * Ratchet guard for the legacy academic spine (Class, Course, Enrollment,
 * ClassTeacher).
 *
 * Stage B of the retirement is flipping every reader onto the structured
 * anchors (ClassSection / SubjectOffering / Student). That is a long job across
 * many services, and the failure mode is not the work itself — it is NEW code
 * quietly adding more legacy coupling while the migration is in flight, so the
 * count never reaches zero.
 *
 * So this does what check-privileged-db-usage.mjs does for the privileged
 * client: it counts `client.<legacyModel>.` call sites per file against a
 * committed baseline and fails when any file goes UP, or when a new file
 * appears. Going down is always allowed and prints the win.
 *
 * Update the baseline (only ever downwards) with:
 *   node apps/api/scripts/check-legacy-readers.mjs --update
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(scriptDir, '..');
const srcRoot = join(apiRoot, 'src');
const baselinePath = join(scriptDir, 'legacy-readers-baseline.json');

const LEGACY = ['class', 'course', 'enrollment', 'classTeacher'];
const PATTERN = new RegExp(`client\\.(${LEGACY.join('|')})\\.`, 'g');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts'))
      out.push(full);
  }
  return out;
}

const counts = {};
for (const file of walk(srcRoot)) {
  const matches = readFileSync(file, 'utf8').match(PATTERN);
  if (matches?.length) counts[relative(apiRoot, file)] = matches.length;
}

if (process.argv.includes('--update')) {
  writeFileSync(baselinePath, `${JSON.stringify(counts, null, 2)}\n`);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(
    `Baseline updated: ${total} legacy call site(s) across ${Object.keys(counts).length} file(s).`,
  );
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
} catch {
  console.error(
    '✖ Missing legacy-readers-baseline.json — run with --update to create it.',
  );
  process.exit(1);
}

const regressions = [];
const improvements = [];
for (const [file, count] of Object.entries(counts)) {
  const before = baseline[file] ?? 0;
  if (count > before) {
    regressions.push(
      before === 0
        ? `${file}: NEW legacy reader (${count} call site(s))`
        : `${file}: ${before} → ${count} legacy call site(s)`,
    );
  } else if (count < before) {
    improvements.push(`${file}: ${before} → ${count}`);
  }
}
for (const [file, before] of Object.entries(baseline)) {
  if (!(file in counts) && before > 0)
    improvements.push(`${file}: ${before} → 0 (gone)`);
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);

if (regressions.length > 0) {
  console.error('✖ New coupling to the legacy academic spine:\n');
  for (const r of regressions) console.error(`   ${r}`);
  console.error(
    '\n  Class/Course/Enrollment/ClassTeacher are being retired. Use the structured\n' +
      '  anchors instead: ClassSection, SubjectOffering, SectionEnrollment, Student.\n' +
      '  If a legacy read is genuinely unavoidable for now, run with --update and say\n' +
      '  why in the commit message.\n',
  );
  process.exit(1);
}

if (improvements.length > 0) {
  console.log(
    `✔ Legacy readers reduced: ${baseTotal} → ${total} call site(s)\n`,
  );
  for (const i of improvements) console.log(`   ${i}`);
  console.log('\n  Run with --update to lock in the lower baseline.\n');
} else {
  console.log(
    `✔ No new legacy-spine coupling (${total} call site(s) remaining).`,
  );
}
