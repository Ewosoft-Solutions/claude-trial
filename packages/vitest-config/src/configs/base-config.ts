import { defineConfig } from 'vitest/config';

/**
 * Shared base Vitest config for the workspace. Framework-agnostic: a plain
 * Node environment suitable for pure modules (helpers, resolvers, schemas).
 * Packages that exercise the DOM extend `uiConfig` instead.
 */
export const baseConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'coverage/', '**/*.config.*'],
    },
  },
});
