/**
 * Tenant feature resolution — the default-on semantics of the toggle map.
 */
import {
  FEATURE_KEYS,
  isFeatureKey,
  resolveEnabledFeatures,
  resolveFeatureMap,
} from './tenant-features';

describe('tenant-features', () => {
  it('treats every feature as enabled when settings are empty', () => {
    expect(resolveEnabledFeatures(null)).toEqual([...FEATURE_KEYS]);
    expect(resolveEnabledFeatures({})).toEqual([...FEATURE_KEYS]);
    expect(resolveEnabledFeatures({ features: {} })).toEqual([...FEATURE_KEYS]);
  });

  it('only drops features explicitly set to false', () => {
    const settings = { features: { transport: false, library: true } };
    const enabled = resolveEnabledFeatures(settings);
    expect(enabled).not.toContain('transport');
    expect(enabled).toContain('library');
    expect(enabled).toContain('health');
  });

  it('resolves the full on/off map', () => {
    const map = resolveFeatureMap({ features: { transport: false } });
    expect(map.transport).toBe(false);
    expect(map.library).toBe(true);
    expect(Object.keys(map).sort()).toEqual([...FEATURE_KEYS].sort());
  });

  it('ignores non-boolean / unknown junk in the stored map', () => {
    const map = resolveFeatureMap({ features: { transport: 'yes', bogus: true } });
    // Non-false value → still enabled; unknown keys never appear.
    expect(map.transport).toBe(true);
    expect('bogus' in map).toBe(false);
  });

  it('recognizes only catalog keys', () => {
    expect(isFeatureKey('transport')).toBe(true);
    expect(isFeatureKey('bogus')).toBe(false);
  });
});
