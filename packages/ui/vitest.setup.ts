/**
 * Vitest setup for the UI package's component tests. Registers the
 * `@testing-library/jest-dom` matchers (e.g. `toBeInTheDocument`,
 * `toHaveClass`) and auto-cleans the rendered DOM between tests.
 */
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
