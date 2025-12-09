import { config as baseConfig } from '@workspace/eslint-config/base';

export default [
  ...baseConfig,
  {
    rules: {
      'turbo/no-undeclared-env-vars': [
        'error',
        {
          allowList: ['NODE_ENV', 'DATABASE_URL'],
        },
      ],
    },
  },
  {
    files: ['prisma/scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: ['.eslintrc.js', 'eslint.config.mjs', 'node_modules/', 'dist/**'],
  },
];
