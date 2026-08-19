import { describe, expect, it } from 'vitest';

import { safeErrorMessage } from './api-client';

/**
 * What users see when the API answers badly — which, in production, is most
 * likely when it is stale, mid-deploy, or behind a load balancer that is
 * answering for it.
 */
describe('safeErrorMessage', () => {
  const fallback = 'Request failed (400)';

  it('passes through a deliberate domain message', () => {
    // These are written FOR the operator and must survive.
    expect(
      safeErrorMessage(
        'Invoice INV-2026-000010 only has 100000 kobo outstanding.',
        fallback,
      ),
    ).toBe('Invoice INV-2026-000010 only has 100000 kobo outstanding.');
  });

  it('refuses an array of validation messages', () => {
    expect(
      safeErrorMessage(
        ['operation must be one of the following values: roles.create, tenant.suspend'],
        fallback,
      ),
    ).toBe(fallback);
  });

  it('refuses an HTML error page from a proxy', () => {
    expect(
      safeErrorMessage('<html><body>502 Bad Gateway</body></html>', fallback),
    ).toBe(fallback);
  });

  it('refuses a log-sized dump', () => {
    expect(safeErrorMessage('x'.repeat(301), fallback)).toBe(fallback);
  });

  it('refuses objects, nulls and blanks', () => {
    expect(safeErrorMessage({ nested: 'oops' }, fallback)).toBe(fallback);
    expect(safeErrorMessage(null, fallback)).toBe(fallback);
    expect(safeErrorMessage(undefined, fallback)).toBe(fallback);
    expect(safeErrorMessage('   ', fallback)).toBe(fallback);
  });
});
