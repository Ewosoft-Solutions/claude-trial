import { baseConfig } from '@workspace/vitest-config';

/**
 * The nav resolver and other helpers under `src/lib` are pure modules, so the
 * Node-environment {@link baseConfig} is enough. Switch to `uiConfig` (jsdom)
 * if/when component tests are added here.
 */
export default baseConfig;
