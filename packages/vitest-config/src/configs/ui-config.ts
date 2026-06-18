import { defineConfig, mergeConfig } from 'vitest/config';

import { baseConfig } from './base-config.js';

/**
 * Vitest config for packages that render React / touch the DOM. Layers a
 * `jsdom` environment over {@link baseConfig}.
 */
export const uiConfig = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
    },
  }),
);
