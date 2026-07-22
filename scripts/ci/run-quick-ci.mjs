#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const steps = [
  {
    name: 'Build packages/database',
    args: ['--dir', 'packages/database', 'build'],
  },
  {
    name: 'Build packages/api',
    args: ['--dir', 'packages/api', 'build'],
  },
  {
    name: 'Build packages/vitest-config',
    args: ['--dir', 'packages/vitest-config', 'build'],
  },
  {
    name: 'Build packages/jest-config',
    args: ['--dir', 'packages/jest-config', 'build'],
  },
  {
    name: 'Type-check packages/database',
    args: [
      '--dir',
      'packages/database',
      'exec',
      'tsc',
      '-p',
      'tsconfig.json',
      '--noEmit',
    ],
  },
  {
    name: 'Type-check API',
    args: ['--dir', 'apps/api', 'check-types'],
  },
  {
    name: 'Type-check web',
    args: ['--dir', 'apps/web', 'check-types'],
  },
  {
    name: 'Lint API',
    args: [
      'exec',
      'eslint',
      '--config',
      'apps/api/eslint.config.mjs',
      'apps/api/{src,apps,libs,test}/**/*.ts',
    ],
  },
  {
    name: 'Lint web',
    args: ['--dir', 'apps/web', 'lint'],
  },
];

console.log('\nQuick local checks');
console.log('==================');

for (const step of steps) {
  console.log(`\n→ ${step.name}`);
  const result = spawnSync(pnpm, step.args, {
    cwd: repositoryRoot,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`\nQuick checks could not start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\nQuick checks failed during: ${step.name}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nQuick local checks passed.');
