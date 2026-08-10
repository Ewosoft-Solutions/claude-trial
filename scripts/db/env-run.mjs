#!/usr/bin/env node
// ============================================================
// db:env — run a packages/database script against a named environment
// ============================================================
// Usage:
//   pnpm db:env <envName> <db-script> [-- extra args]
//
// Reads target definitions from ./environments.local.mjs (gitignored), injects
// that environment's vars, then runs the db-script in packages/database.
//
// Safety:
//   * Base `db:seed` and read-only scripts run against any target.
//   * Dev seeds (db:seed:*) against a REMOTE host require the target's
//     `allowDevSeeds: true`; the runner then sets ALLOW_REMOTE_DEV_SEED_TARGET.
//   * `protected: true` targets refuse ALL dev seeds (use for production).
//   * Any write against a remote host asks for confirmation, unless --yes
//     (or DB_ENV_YES=1) is passed.
//
// See scripts/db/environments.example.mjs for the config shape.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, '..', '..');
const configPath = join(scriptDir, 'environments.local.mjs');
const examplePath = 'scripts/db/environments.example.mjs';

// Hosts that can only be a developer's own machine / container network.
// Mirrors packages/database/prisma/scripts/dev/guard.ts.
const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
  'host.docker.internal',
  'postgres',
  'db',
]);

function die(message) {
  console.error(`\n  db:env — ${message}\n`);
  process.exit(1);
}

// --- parse args -------------------------------------------------------------
const rawArgs = process.argv.slice(2);
let assumeYes = process.env.DB_ENV_YES === '1' || process.env.DB_ENV_YES === 'true';
const args = [];
for (const arg of rawArgs) {
  if (arg === '--yes' || arg === '-y') assumeYes = true;
  else args.push(arg);
}
const [envName, script, ...passthrough] = args;

if (!envName || !script) {
  die(
    'usage: pnpm db:env <envName> <db-script> [-- extra args]\n' +
      "  e.g. pnpm db:env demo db:seed\n" +
      "       pnpm db:env local db:verify",
  );
}

// --- load config ------------------------------------------------------------
if (!existsSync(configPath)) {
  die(
    `no environments.local.mjs found.\n` +
      `  Create it:  cp ${examplePath} scripts/db/environments.local.mjs\n` +
      `  then edit the connection strings. (It is gitignored — never commit it.)`,
  );
}

const { environments } = await import(pathToFileURL(configPath).href);
if (!environments || typeof environments !== 'object') {
  die(`environments.local.mjs must export an \`environments\` object.`);
}

const target = environments[envName];
if (!target) {
  const known = Object.keys(environments).join(', ') || '(none defined)';
  die(`unknown environment "${envName}". Defined: ${known}`);
}

const injected = target.env ?? {};
const databaseUrl = injected.DATABASE_URL;
if (!databaseUrl) {
  die(`environment "${envName}" is missing env.DATABASE_URL in environments.local.mjs`);
}

// --- resolve host / masked identity -----------------------------------------
let host;
let masked = '(unparseable connection string)';
try {
  const u = new URL(databaseUrl);
  host = u.hostname.toLowerCase();
  masked = `${u.username || '?'}@${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
} catch {
  // guard.ts refuses unparseable URLs for dev seeds; base seed still runs.
}
const isLocal = host !== undefined && LOCAL_HOSTS.has(host);
const isDevSeed = script.startsWith('db:seed:'); // base `db:seed` does NOT match

// --- safety gates -----------------------------------------------------------
const childEnv = { ...process.env, ...injected };

if (isDevSeed) {
  if (target.protected) {
    die(
      `"${envName}" is marked protected — dev seeds (${script}) are refused here.\n` +
        `  Only base \`db:seed\` and read-only scripts may target a protected environment.`,
    );
  }
  if (!isLocal) {
    if (target.allowDevSeeds !== true) {
      die(
        `dev seed "${script}" targets remote host "${host ?? '(unknown)'}", but "${envName}" ` +
          `does not set allowDevSeeds: true.\n` +
          `  Dev seeds write fake, destructive data. Set allowDevSeeds: true on "${envName}" ` +
          `in environments.local.mjs only if that DB is meant to receive fake data.`,
      );
    }
    childEnv.ALLOW_REMOTE_DEV_SEED_TARGET = 'true';
  }
}

// --- banner + confirmation for remote writes --------------------------------
const isReadOnly = script === 'db:verify' || script === 'db:studio';
console.log('');
console.log(`  environment : ${envName}${target.protected ? '  (protected)' : ''}`);
console.log(`  target      : ${masked}`);
console.log(`  script      : ${script}`);
if (isDevSeed && !isLocal) console.log(`  note        : ALLOW_REMOTE_DEV_SEED_TARGET set for this run`);
console.log('');

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise((resolve) => {
      rl.question(question, resolve);
      // Non-interactive / closed stdin (piped, CI): treat EOF as "no", never
      // a silent yes — a remote write must be an explicit, present decision.
      rl.on('close', () => resolve(''));
    });
    return answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

if (!isLocal && !isReadOnly && !assumeYes) {
  const ok = await confirm(`  Write to REMOTE "${envName}" (${masked}) via ${script}? Type "yes" to proceed: `);
  if (!ok) die('aborted.');
  console.log('');
}

// --- run --------------------------------------------------------------------
const child = spawn('pnpm', ['--filter', '@workspace/database', 'run', script, ...passthrough], {
  cwd: rootDir,
  env: childEnv,
  stdio: 'inherit',
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
