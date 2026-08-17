import { describe, expect, it } from '@jest/globals';

import {
  bandsForSchoolType,
  defaultLadderFor,
  EDUCATION_LEVELS,
  educationLevelOf,
  isEducationLevel,
  isLevelCode,
  ladderForBands,
  LEVEL_CODES,
  LEVEL_SPINE,
  levelCodesFor,
  matchLevelCode,
} from '@workspace/database';

/**
 * The level spine is reference data every school's structure hangs off, and the
 * matcher decides how existing free-text levels get mapped. A wrong mapping
 * silently mis-files a child's whole academic record, so the rules are pinned
 * here: the taxonomy is internally consistent, Nigeria's Basic 1–9 spans two
 * bands correctly, and an unrecognised name returns null instead of a guess.
 */
describe('the spine is internally consistent', () => {
  it('has an entry for every declared code, and no extras', () => {
    expect(LEVEL_SPINE.map((e) => e.code).sort()).toEqual(
      [...LEVEL_CODES].sort(),
    );
  });

  it('assigns every code to a declared band', () => {
    for (const entry of LEVEL_SPINE) {
      expect(isEducationLevel(entry.educationLevel)).toBe(true);
    }
  });

  it('leaves no band empty (every band is reachable)', () => {
    for (const band of EDUCATION_LEVELS) {
      expect(levelCodesFor(band).length).toBeGreaterThan(0);
    }
  });

  it('orders the ladder strictly, so sorting works across bands', () => {
    const orders = LEVEL_SPINE.map((e) => e.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('never maps one alias to two different rungs', () => {
    const seen = new Map<string, string>();
    const fold = (v: string) => v.toLowerCase().replace(/[\s_\-./]+/g, '');
    for (const entry of LEVEL_SPINE) {
      for (const key of [entry.canonicalName, ...entry.aliases]) {
        const f = fold(key);
        if (seen.has(f)) {
          throw new Error(
            `alias "${key}" is claimed by both ${seen.get(f)} and ${entry.code}`,
          );
        }
        seen.set(f, entry.code);
      }
    }
  });

  it('includes nursery — the band LearnLift omits', () => {
    expect(levelCodesFor('nursery')).toEqual([
      'NURSERY_1',
      'NURSERY_2',
      'NURSERY_3',
    ]);
  });
});

describe('matchLevelCode', () => {
  it('matches the canonical national name', () => {
    expect(matchLevelCode('Primary 3')).toBe('PRY_3');
    expect(matchLevelCode('JSS 1')).toBe('JSS_1');
    expect(matchLevelCode('200 Level')).toBe('L_200');
  });

  it('matches the code itself', () => {
    expect(matchLevelCode('PRY_3')).toBe('PRY_3');
    expect(matchLevelCode('sss_2')).toBe('SSS_2');
  });

  it('maps the two school names in the brief to the same rung', () => {
    // Surulere says "Basic 3", Lekki says "Year 3" — one national rung.
    expect(matchLevelCode('Basic 3')).toBe('PRY_3');
    expect(matchLevelCode('Year 3')).toBe('PRY_3');
  });

  it('spans Basic 1–9 across primary AND junior secondary (UBE)', () => {
    // The trap: Basic 7 is JSS 1, not a primary rung.
    expect(matchLevelCode('Basic 6')).toBe('PRY_6');
    expect(matchLevelCode('Basic 7')).toBe('JSS_1');
    expect(matchLevelCode('Basic 9')).toBe('JSS_3');
    expect(educationLevelOf('PRY_6')).toBe('primary');
    expect(educationLevelOf('JSS_1')).toBe('secondary');
  });

  it('ignores case, spacing and separators', () => {
    for (const v of ['ss 1', 'SS1', 'sS-1', 'ss_1', '  ss 1  ']) {
      expect(matchLevelCode(v)).toBe('SSS_1');
    }
  });

  it('returns null rather than guessing', () => {
    expect(matchLevelCode('Transition Class')).toBeNull();
    expect(matchLevelCode('Alpha Set')).toBeNull();
    expect(matchLevelCode('')).toBeNull();
    expect(matchLevelCode(null)).toBeNull();
    expect(matchLevelCode(undefined)).toBeNull();
  });
});

describe('default ladders', () => {
  it('gives a school exactly the band its type implies, nothing extra', () => {
    expect(bandsForSchoolType('nursery')).toEqual(['nursery']);
    expect(bandsForSchoolType('primary')).toEqual(['primary']);
    expect(bandsForSchoolType('secondary')).toEqual(['secondary']);
    expect(bandsForSchoolType('university')).toEqual(['tertiary']);
    expect(bandsForSchoolType('college')).toEqual(['tertiary']);
    expect(bandsForSchoolType('training_institute')).toEqual(['special']);
    expect(bandsForSchoolType('organization')).toEqual(['special']);
  });

  it('falls back to primary for an unknown or unset school type', () => {
    expect(bandsForSchoolType(null)).toEqual(['primary']);
    expect(bandsForSchoolType('something-new')).toEqual(['primary']);
  });

  it('builds a stage per band, carrying that band’s rungs in order', () => {
    const ladder = defaultLadderFor('secondary');
    expect(ladder).toHaveLength(1);
    expect(ladder[0]!.educationLevel).toBe('secondary');
    expect(ladder[0]!.levels).toEqual([
      'JSS_1',
      'JSS_2',
      'JSS_3',
      'SSS_1',
      'SSS_2',
      'SSS_3',
    ]);
  });

  it('supports a combined school (nursery + primary) explicitly', () => {
    const ladder = ladderForBands(['nursery', 'primary']);
    expect(ladder.map((s) => s.code)).toEqual(['NUR', 'PRY']);
    expect(ladder.flatMap((s) => s.levels)).toHaveLength(9);
  });

  it('exposes a valid code set for every ladder it builds', () => {
    for (const stage of ladderForBands([...EDUCATION_LEVELS])) {
      for (const code of stage.levels) expect(isLevelCode(code)).toBe(true);
    }
  });
});
