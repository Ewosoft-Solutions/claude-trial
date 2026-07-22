#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
  process.exit(0);
}

const repositoryCheck = spawnSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
});

// Installing the package outside a Git checkout should remain harmless.
if (repositoryCheck.status !== 0) {
  process.exit(0);
}

const repositoryRoot = repositoryCheck.stdout.trim();
const currentHooksPath = spawnSync(
  'git',
  ['config', '--local', '--get', 'core.hooksPath'],
  { cwd: repositoryRoot, encoding: 'utf8' },
);

if (currentHooksPath.stdout.trim() === '.githooks') {
  process.exit(0);
}

const installation = spawnSync(
  'git',
  ['config', '--local', 'core.hooksPath', '.githooks'],
  { cwd: repositoryRoot, encoding: 'utf8' },
);

if (installation.status !== 0) {
  console.error('Unable to install the repository Git hooks.');
  if (installation.stderr) console.error(installation.stderr.trim());
  process.exit(installation.status ?? 1);
}

console.log('Installed repository Git hooks from .githooks.');
