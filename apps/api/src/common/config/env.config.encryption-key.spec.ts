/**
 * ENCRYPTION_KEY validation (env.config).
 *
 * The invariant is "decodes to exactly 32 bytes", checked at config load in
 * production only. This pins that a correctly-generated key is accepted (with or
 * without base64 padding) and that the common wrong-size mistakes are rejected
 * with a helpful message — the failure that took down a Render deploy
 * ("length must be 44 characters long").
 */
import * as crypto from 'node:crypto';
import { envValidationSchema } from './env.config';

const BASE = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
};

function validate(env: Record<string, unknown>) {
  return envValidationSchema.validate(
    { ...BASE, ...env },
    { allowUnknown: true, abortEarly: false },
  );
}

const key32 = crypto.randomBytes(32).toString('base64'); // 44 chars, padded

describe('ENCRYPTION_KEY validation', () => {
  it('accepts a 32-byte base64 key in production', () => {
    const { error } = validate({ NODE_ENV: 'production', ENCRYPTION_KEY: key32 });
    expect(error).toBeUndefined();
  });

  it('accepts a valid key without base64 padding', () => {
    const unpadded = key32.replace(/=+$/, '');
    const { error } = validate({
      NODE_ENV: 'production',
      ENCRYPTION_KEY: unpadded,
    });
    expect(error).toBeUndefined();
  });

  it('rejects a JWT-style 64-byte base64 value (the common mistake)', () => {
    const key64 = crypto.randomBytes(64).toString('base64'); // 88 chars
    const { error } = validate({
      NODE_ENV: 'production',
      ENCRYPTION_KEY: key64,
    });
    expect(error?.message).toMatch(/32-byte key/);
  });

  it('rejects a hex key', () => {
    const hex = crypto.randomBytes(32).toString('hex'); // 64 chars
    const { error } = validate({ NODE_ENV: 'production', ENCRYPTION_KEY: hex });
    expect(error?.message).toMatch(/32-byte key/);
  });

  it('rejects a missing key in production, with actionable guidance', () => {
    const { error } = validate({ NODE_ENV: 'production' });
    expect(error?.message).toMatch(/openssl rand -base64 32/);
  });

  it('does not require the key outside production', () => {
    expect(validate({ NODE_ENV: 'development' }).error).toBeUndefined();
    expect(validate({ NODE_ENV: 'test' }).error).toBeUndefined();
  });
});
