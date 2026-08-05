/**
 * Unit coverage for the WB2-1 label composition — the inverse of the incumbent's
 * name-parsing. `composeSectionLabel` BUILDS a stored label from structured
 * dimensions; nothing in the model derives stage/year/stream FROM a label.
 */
import { describe, it, expect } from '@jest/globals';
import { composeSectionLabel } from './academic-structure-model.service';

describe('composeSectionLabel (WB2-1)', () => {
  it('joins year + stream + section into a stored label', () => {
    expect(composeSectionLabel('SS1', 'Science', 'A')).toBe('SS1 Science A');
    expect(composeSectionLabel('SS1', 'Arts', 'A')).toBe('SS1 Arts A');
  });

  it('omits a missing stream (unstreamed junior class)', () => {
    expect(composeSectionLabel('JSS1', null, 'Gold')).toBe('JSS1 Gold');
    expect(composeSectionLabel('JSS1', undefined, 'Gold')).toBe('JSS1 Gold');
  });

  it('trims and drops blank parts', () => {
    expect(composeSectionLabel(' SS2 ', '  ', 'B')).toBe('SS2 B');
    expect(composeSectionLabel('SS3', 'Commercial', '  C ')).toBe(
      'SS3 Commercial C',
    );
  });

  it('distinguishes streams so SS1 Science and SS1 Arts never collapse', () => {
    const science = composeSectionLabel('SS1', 'Science', 'A');
    const arts = composeSectionLabel('SS1', 'Arts', 'A');
    expect(science).not.toBe(arts);
  });
});
