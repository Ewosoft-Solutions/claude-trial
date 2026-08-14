import { describe, it, expect } from '@jest/globals';
import { resolveAdmissionFeeKobo } from './admission-fee-pricing';

describe('resolveAdmissionFeeKobo (WB3-5 pricing)', () => {
  const config = {
    currency: 'NGN',
    amount: 500000, // default ₦5,000
    classPrices: { yl_p5: 400000, yl_free: 0 },
    sectionPrices: { sec_a: 300000, yl_p5: 999999 },
  };

  it('falls back to the default when nothing matches', () => {
    expect(resolveAdmissionFeeKobo(config, { yearLevelId: 'yl_x' })).toBe(
      500000,
    );
  });

  it('uses the class override when present', () => {
    expect(resolveAdmissionFeeKobo(config, { yearLevelId: 'yl_p5' })).toBe(
      400000,
    );
  });

  it('uses the section override when there is no class override', () => {
    expect(
      resolveAdmissionFeeKobo(config, {
        yearLevelId: 'yl_x',
        sectionId: 'sec_a',
      }),
    ).toBe(300000);
  });

  it('class override supersedes section override', () => {
    expect(
      resolveAdmissionFeeKobo(config, {
        yearLevelId: 'yl_p5',
        sectionId: 'sec_a',
      }),
    ).toBe(400000);
  });

  it('a present override of 0 is "free" (N/A), not a fall-through', () => {
    expect(
      resolveAdmissionFeeKobo(config, { yearLevelId: 'yl_free' }),
    ).toBeNull();
  });

  it('returns null when there is no default and no match', () => {
    expect(
      resolveAdmissionFeeKobo({ currency: 'NGN' }, { yearLevelId: 'yl_x' }),
    ).toBeNull();
  });

  it('treats a 0 default as N/A', () => {
    expect(
      resolveAdmissionFeeKobo({ amount: 0 }, { yearLevelId: 'yl_x' }),
    ).toBeNull();
  });

  it('is robust to missing / malformed config', () => {
    expect(resolveAdmissionFeeKobo(null, { yearLevelId: 'yl_x' })).toBeNull();
    expect(resolveAdmissionFeeKobo(undefined, {})).toBeNull();
    expect(
      resolveAdmissionFeeKobo({ amount: 'nope' }, { yearLevelId: 'yl_x' }),
    ).toBeNull();
  });
});
