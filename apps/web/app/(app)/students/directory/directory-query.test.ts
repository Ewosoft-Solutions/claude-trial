import { describe, expect, it } from 'vitest';

import { toApiQuery } from './directory-query';

describe('toApiQuery', () => {
  it('defaults to page 1 / limit 25 for an empty URL', () => {
    expect(toApiQuery({})).toBe('page=1&limit=25');
  });

  it('maps q / page / size / sort into the projection query', () => {
    const qs = toApiQuery({
      q: 'ada',
      page: '2',
      size: '50',
      sort: 'name:desc',
    });
    const params = new URLSearchParams(qs);
    expect(params.get('page')).toBe('2');
    expect(params.get('limit')).toBe('50');
    expect(params.get('q')).toBe('ada');
    expect(params.get('sort')).toBe('name');
    expect(params.get('dir')).toBe('desc');
  });

  it('maps prefixed filter params to their REST names', () => {
    const params = new URLSearchParams(
      toApiQuery({ f_status: 'active', f_grade: 'SS1', f_class: 'c1' }),
    );
    expect(params.get('status')).toBe('active');
    expect(params.get('gradeLevel')).toBe('SS1');
    expect(params.get('classId')).toBe('c1');
  });

  it('ignores unknown filter keys', () => {
    const params = new URLSearchParams(toApiQuery({ f_unknown: 'x' }));
    expect(params.has('unknown')).toBe(false);
  });

  it('tolerates array-valued params (takes the first)', () => {
    const params = new URLSearchParams(toApiQuery({ q: ['ada', 'bola'] }));
    expect(params.get('q')).toBe('ada');
  });
});
