import { baseConfig } from '@workspace/vitest-config';

/**
 * The web app's tests today exercise pure modules — the navigation config
 * resolved through `@workspace/ui/lib/navigation` — so the Node-environment
 * {@link baseConfig} is enough (it also transpiles the config's JSX via the
 * automatic runtime). Switch to `uiConfig` (jsdom) if/when component or page
 * rendering tests are added here.
 */
export default baseConfig;
