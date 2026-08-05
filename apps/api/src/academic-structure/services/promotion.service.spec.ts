/**
 * Unit coverage for the WB2-4 promotion target resolver: which section a
 * promotion item is placed into, including the 'repeat' fallback to the
 * student's source section.
 */
import { describe, it, expect } from '@jest/globals';
import { resolveTargetSection } from './promotion.service';

describe('resolveTargetSection (WB2-4)', () => {
  it('promote/manual place into the proposed section', () => {
    expect(
      resolveTargetSection({
        decision: 'promote',
        proposedClassSectionId: 'sec-next',
        fromClassSectionId: 'sec-prev',
      }),
    ).toBe('sec-next');
    expect(
      resolveTargetSection({
        decision: 'manual',
        proposedClassSectionId: 'sec-manual',
        fromClassSectionId: 'sec-prev',
      }),
    ).toBe('sec-manual');
  });

  it("a repeat falls back to the student's source section", () => {
    expect(
      resolveTargetSection({
        decision: 'repeat',
        proposedClassSectionId: null,
        fromClassSectionId: 'sec-prev',
      }),
    ).toBe('sec-prev');
  });

  it('a repeat still honours an explicit proposed section', () => {
    expect(
      resolveTargetSection({
        decision: 'repeat',
        proposedClassSectionId: 'sec-chosen',
        fromClassSectionId: 'sec-prev',
      }),
    ).toBe('sec-chosen');
  });

  it('returns null for a promote with no proposal (needs manual placement)', () => {
    expect(
      resolveTargetSection({
        decision: 'promote',
        proposedClassSectionId: null,
        fromClassSectionId: 'sec-prev',
      }),
    ).toBeNull();
  });
});
