import { ForbiddenException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

// The Prisma runtime error classes are not constructible under jest; the
// filter only needs them for instanceof checks.
jest.mock('@workspace/database', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {},
    PrismaClientValidationError: class extends Error {},
  },
}));

import { HttpExceptionFilter } from './http-exception.filter';

/**
 * Error-hygiene contract: clients only ever receive a toast-ready message;
 * details / stack / internal messages are opt-in via API_DEBUG_ERRORS=true
 * (unset principle — NODE_ENV alone must never expose internals).
 */
describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  function run(exception: unknown) {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'GET', path: '/ai/health' }),
      }),
    } as unknown as ArgumentsHost;
    filter.catch(exception, host);
    return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
  }

  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('never includes stack/details when API_DEBUG_ERRORS is unset, even in development', () => {
    delete process.env.API_DEBUG_ERRORS;
    process.env.NODE_ENV = 'development';

    const { status, body } = run(new ForbiddenException('You do not have permission to perform this action'));

    expect(status).toBe(403);
    expect(body.message).toBe('You do not have permission to perform this action');
    expect(body.stack).toBeUndefined();
    expect(body.details).toBeUndefined();
    expect(body.internalMessage).toBeUndefined();
  });

  it('hides raw unhandled-error messages behind a generic message', () => {
    delete process.env.API_DEBUG_ERRORS;

    const { status, body } = run(
      new Error('connect ECONNREFUSED db.internal:5432 (users table)'),
    );

    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });

  it('includes debug payloads only when API_DEBUG_ERRORS=true', () => {
    process.env.API_DEBUG_ERRORS = 'true';

    const { body } = run(new Error('boom internals'));

    expect(body.message).toBe('Internal server error');
    expect(body.internalMessage).toBe('boom internals');
    expect(body.stack).toEqual(expect.stringContaining('boom internals'));
  });

  it('treats any value other than the literal "true" as off', () => {
    process.env.API_DEBUG_ERRORS = '1';

    const { body } = run(new Error('boom'));

    expect(body.stack).toBeUndefined();
    expect(body.internalMessage).toBeUndefined();
  });
});
