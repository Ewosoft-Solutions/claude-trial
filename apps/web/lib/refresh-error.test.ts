import { describe, expect, it } from 'vitest';

import { isTerminalRefreshFailure } from './refresh-error';

describe('isTerminalRefreshFailure', () => {
  it('ends sessions only for rejected credentials', () => {
    expect(isTerminalRefreshFailure(401)).toBe(true);
    expect(isTerminalRefreshFailure(403)).toBe(true);
    expect(isTerminalRefreshFailure(429)).toBe(false);
    expect(isTerminalRefreshFailure(500)).toBe(false);
    expect(isTerminalRefreshFailure(503)).toBe(false);
  });
});
