#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    ...options,
  });
}

function requireCommand(command, versionArgs, installationHint) {
  const result = run(command, versionArgs);

  if (result.error?.code === 'ENOENT') {
    console.error(`\nLocal CI blocked: ${command} is not installed.`);
    console.error(installationHint);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\nLocal CI blocked: ${command} could not be started.`);
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(result.status ?? 1);
  }
}

console.log('\nLocal CI pre-push gate');
console.log('======================');

requireCommand(
  'docker',
  ['--version'],
  'Install Docker Desktop or Docker Engine: https://docs.docker.com/get-docker/',
);
requireCommand(
  'act',
  ['--version'],
  'Install act for your platform: https://nektosact.com/installation/',
);

const dockerInfo = run('docker', ['info'], { stdio: 'ignore' });
if (dockerInfo.status !== 0) {
  console.error('\nLocal CI blocked: the Docker daemon is not running.');
  console.error('Start Docker, wait until it is ready, and push again.');
  process.exit(1);
}

const actArguments = [
  'pull_request',
  '-W',
  '.github/workflows/ci.yml',
  '-j',
  'ci',
  '--pull=false',
];

if (existsSync(path.join(repositoryRoot, '.act.secrets'))) {
  actArguments.push('--secret-file', '.act.secrets');
}

console.log('Running the complete GitHub Actions CI job locally with act.');
console.log('The push will proceed only if this job succeeds.\n');

const actResult = run('act', actArguments, { stdio: 'inherit' });

if (actResult.error) {
  console.error(`\nLocal CI blocked: ${actResult.error.message}`);
  process.exit(1);
}

if (actResult.status !== 0) {
  console.error('\nLocal CI failed. The push has been blocked.');
  process.exit(actResult.status ?? 1);
}

console.log('\nLocal CI passed. The push may proceed.');
