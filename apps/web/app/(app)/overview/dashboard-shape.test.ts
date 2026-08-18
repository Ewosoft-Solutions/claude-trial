import { describe, expect, it } from 'vitest';

import { DASHBOARD_SHAPES, dashboardKindFor } from './dashboard-shape';

describe('dashboardKindFor', () => {
  it('sends a platform viewer to the platform overview regardless of clearance', () => {
    // Scope outranks clearance — a platform operator has no active school, so a
    // school dashboard would have nothing to render.
    expect(dashboardKindFor('platform', 0)).toBe('platform');
    expect(dashboardKindFor('platform', 8)).toBe('platform');
  });

  it('maps each school clearance level to its dashboard', () => {
    expect(dashboardKindFor('school', 8)).toBe('admin');
    expect(dashboardKindFor('school', 7)).toBe('admin');
    expect(dashboardKindFor('school', 6)).toBe('it');
    expect(dashboardKindFor('school', 5)).toBe('finance');
    expect(dashboardKindFor('school', 4)).toBe('operations');
    expect(dashboardKindFor('school', 3)).toBe('teacher');
    expect(dashboardKindFor('school', 2)).toBe('parent');
    expect(dashboardKindFor('school', 1)).toBe('student');
    expect(dashboardKindFor('school', 0)).toBe('student');
  });

  it('has a shape for every dashboard it can return', () => {
    // The loading skeleton indexes DASHBOARD_SHAPES by this result; a missing
    // entry would spread `undefined` and silently fall back to the generic
    // shape for that persona.
    const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (const level of levels) {
      for (const scope of ['school', 'platform']) {
        const kind = dashboardKindFor(scope, level);
        expect(DASHBOARD_SHAPES[kind], `no shape for ${kind}`).toBeDefined();
      }
    }
  });

  it('keeps wideStats aligned with the stat count where declared', () => {
    // A mismatched wideStats array would mark the wrong tile wide, so the
    // skeleton would not line up with the content that replaces it.
    for (const [kind, shape] of Object.entries(DASHBOARD_SHAPES)) {
      if (!shape.wideStats) continue;
      expect(shape.wideStats, `${kind} wideStats length`).toHaveLength(
        shape.stats,
      );
    }
  });

  it('describes a real layout for every persona', () => {
    for (const [kind, shape] of Object.entries(DASHBOARD_SHAPES)) {
      expect(shape.stats, `${kind} stats`).toBeGreaterThan(0);
      expect(shape.mainCards, `${kind} mainCards`).toBeGreaterThan(0);
      expect(shape.asideCards, `${kind} asideCards`).toBeGreaterThan(0);
    }
  });
});
