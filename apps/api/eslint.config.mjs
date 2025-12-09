import { nestJsConfig } from '@workspace/eslint-config/nest-js';

/** @type {import("eslint").Linter.Config} */
export default [
  ...nestJsConfig,
  {
    ignores: ['.prettierrc.mjs', 'eslint.config.mjs'],
  },
  {
    files: ['src/common/config/env.config.ts'],
    rules: {
      'turbo/no-undeclared-env-vars': 'off',
    },
  },
];
