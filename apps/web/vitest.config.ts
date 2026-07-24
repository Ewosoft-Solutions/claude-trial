import { fileURLToPath } from 'node:url';

import { mergeConfig } from 'vitest/config';
import { baseConfig } from '@workspace/vitest-config';

/**
 * The web app's tests today exercise pure modules — the navigation config
 * resolved through `@workspace/ui/lib/navigation`, the auth-cookie writers, and
 * the server-refresh cookie helpers — so the Node-environment {@link baseConfig}
 * is enough (it also transpiles the config's JSX via the automatic runtime).
 * Switch to `uiConfig` (jsdom) if/when component or page rendering tests are
 * added here.
 *
 * The one addition over the base config is the `@/` path alias, mirroring the
 * app's tsconfig `paths`, so tests can import app modules (e.g. `@/lib/*`) the
 * same way the source does. Scoped to `@/` so `@workspace/*` package resolution
 * is untouched.
 */
const appRoot = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');

export default mergeConfig(baseConfig, {
  resolve: {
    alias: [{ find: /^@\//, replacement: `${appRoot}/` }],
  },
});
