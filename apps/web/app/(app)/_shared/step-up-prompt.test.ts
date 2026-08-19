import { describe, expect, it } from 'vitest';

import { stepUpErrorMessage } from './step-up-prompt';

/**
 * A validation failure comes back as an ARRAY of messages. Rendering that
 * directly is how a raw enum — every sensitive operation the platform has —
 * ended up displayed to an operator in a dialog.
 */
describe('stepUpErrorMessage', () => {
  const fallback = 'Could not prepare identity confirmation.';

  const respond = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });

  it('shows a plain string message from the API', async () => {
    expect(
      await stepUpErrorMessage(respond({ message: 'Password is incorrect.' }), fallback),
    ).toBe('Password is incorrect.');
  });

  it('refuses an array of validation messages and shows the fallback', async () => {
    const message = [
      'operation must be one of the following values: roles.create, roles.delete, tenant.suspend',
    ];
    expect(await stepUpErrorMessage(respond({ message }), fallback)).toBe(
      fallback,
    );
  });

  it('refuses a non-string body and shows the fallback', async () => {
    expect(
      await stepUpErrorMessage(respond({ message: { nested: 'object' } }), fallback),
    ).toBe(fallback);
    expect(await stepUpErrorMessage(respond({}), fallback)).toBe(fallback);
  });

  it('falls back when the body is not JSON at all', async () => {
    const response = new Response('<html>gateway error</html>', { status: 502 });
    expect(await stepUpErrorMessage(response, fallback)).toBe(fallback);
  });
});
