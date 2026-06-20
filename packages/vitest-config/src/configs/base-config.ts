import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Shared base Vitest config for the workspace. A plain Node environment
 * suitable for pure modules (helpers, resolvers, schemas). The React plugin
 * transforms JSX/TSX with the automatic runtime — inert for pure `.ts` files,
 * but required for tests that import modules carrying JSX (e.g. the app
 * navigation config) and for the component tests under `uiConfig`.
 * Packages that exercise the DOM extend `uiConfig` (jsdom) instead.
 */
export const baseConfig = defineConfig({
  plugins: [react()],
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
