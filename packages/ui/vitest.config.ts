import { uiConfig } from '@workspace/vitest-config';
import { defineConfig, mergeConfig } from 'vitest/config';

/**
 * The package mixes pure-module tests (the nav resolver under `src/lib`) with
 * component tests that render React, so it runs on the jsdom-backed
 * {@link uiConfig}; jsdom is a superset that serves the pure tests too. The
 * setup file registers the `@testing-library/jest-dom` matchers and DOM cleanup.
 */
export default mergeConfig(
  uiConfig,
  defineConfig({
    test: {
      setupFiles: ['./vitest.setup.ts'],
    },
  }),
);
