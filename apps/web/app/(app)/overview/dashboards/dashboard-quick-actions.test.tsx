import { describe, expect, it } from 'vitest';

import { preferredQuickActionColumns } from './dashboard-quick-actions';

describe('DashboardQuickActions', () => {
  it('balances four actions into a two-by-two grid', () => {
    expect(preferredQuickActionColumns(4)).toBe(2);
    expect(preferredQuickActionColumns(5)).toBe(3);
    expect(preferredQuickActionColumns(6)).toBe(3);
  });
});
