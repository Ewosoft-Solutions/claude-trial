/**
 * DOCUMENT_URL_SIGNING_SECRET validation (env.config).
 *
 * This HMAC key authorizes every document download (F4 / ADR-08). A
 * constant-derived default would make signed tokens forgeable, so production
 * must fail-closed at boot without a strong secret — exactly like ENCRYPTION_KEY.
 * Dev/test keep a default so local + CI work without configuration.
 */
import * as crypto from 'node:crypto';
import { envValidationSchema } from './env.config';

const ENC = crypto.randomBytes(32).toString('base64'); // valid ENCRYPTION_KEY

function validate(env: Record<string, unknown>) {
  return envValidationSchema.validate(
    { DATABASE_URL: 'postgresql://u:p@localhost:5432/db', ...env },
    { allowUnknown: true, abortEarly: false },
  );
}

describe('DOCUMENT_URL_SIGNING_SECRET validation', () => {
  it('is required in production', () => {
    const { error } = validate({ NODE_ENV: 'production', ENCRYPTION_KEY: ENC });
    expect(error?.message).toMatch(/DOCUMENT_URL_SIGNING_SECRET is required/);
  });

  it('rejects a too-short secret in production', () => {
    const { error } = validate({
      NODE_ENV: 'production',
      ENCRYPTION_KEY: ENC,
      DOCUMENT_URL_SIGNING_SECRET: 'short',
    });
    expect(error?.message).toMatch(/at least 32 characters/);
  });

  it('accepts a strong secret in production', () => {
    const { error } = validate({
      NODE_ENV: 'production',
      ENCRYPTION_KEY: ENC,
      DOCUMENT_URL_SIGNING_SECRET: 'x'.repeat(40),
    });
    expect(error).toBeUndefined();
  });

  it('defaults outside production (dev/test boot without configuration)', () => {
    const { value, error } = validate({ NODE_ENV: 'development' });
    expect(error).toBeUndefined();
    expect(
      (value as { DOCUMENT_URL_SIGNING_SECRET?: string })
        .DOCUMENT_URL_SIGNING_SECRET,
    ).toBeTruthy();
  });
});
