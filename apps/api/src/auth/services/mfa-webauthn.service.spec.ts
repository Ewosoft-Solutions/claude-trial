/**
 * Regression tests for the WebAuthn credential-id encoding fix (P0-4) and the
 * multi-origin config wiring (P0-5). The heavy crypto in @simplewebauthn/server
 * is mocked; these tests assert how the service stores/looks up the credential
 * id and how it configures origin verification.
 */

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

import {
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { MfaWebAuthnService } from './mfa-webauthn.service';

// A credential id in base64url form — contains '-' and '_', the exact chars a
// base64 round-trip would corrupt.
const CRED_ID = 'aB-_cd12EF-_gh';

const OLD_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...OLD_ENV,
    WEBAUTHN_RP_ID: 'schoolwithease.com',
    WEBAUTHN_ORIGIN: 'https://schoolwithease.com',
    WEBAUTHN_ALLOWED_ORIGINS:
      'https://schoolwithease.com, https://acme.schoolwithease.com',
  };
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe('MfaWebAuthnService — credential-id encoding (P0-4)', () => {
  it('stores the credential id verbatim (no base64/base64url mangling)', async () => {
    const service = new MfaWebAuthnService();

    const create = jest.fn().mockResolvedValue({ id: 'method-1' });
    const prisma = {
      mfaChallenge: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'chal-1',
          userId: 'user-1',
          webauthnChallenge: 'challenge-str',
          expiresAt: new Date(Date.now() + 60_000),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      mfaMethod: { create },
    };

    (verifyRegistrationResponse as jest.Mock).mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: CRED_ID,
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
        },
      },
    });

    await service.verifyRegistration(
      prisma as never,
      'chal-1',
      { id: CRED_ID },
      'My iPhone',
    );

    // Stored exactly as received — the previous Buffer→base64 round-trip broke this.
    expect(create.mock.calls[0][0].data.webauthnId).toBe(CRED_ID);
    // Origin verification uses the parsed allow-list array (P0-5).
    expect(
      (verifyRegistrationResponse as jest.Mock).mock.calls[0][0].expectedOrigin,
    ).toEqual([
      'https://schoolwithease.com',
      'https://acme.schoolwithease.com',
    ]);
  });

  it('looks up the credential by the raw base64url id and verifies against it', async () => {
    const service = new MfaWebAuthnService();

    const findFirst = jest.fn().mockResolvedValue({
      id: 'method-1',
      webauthnId: CRED_ID,
      webauthnPublicKey: Buffer.from([1, 2, 3]).toString('base64'),
      webauthnCounter: 0,
    });
    const prisma = {
      mfaChallenge: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'chal-1',
          userId: 'user-1',
          webauthnChallenge: 'challenge-str',
          expiresAt: new Date(Date.now() + 60_000),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      mfaMethod: { findFirst, update: jest.fn().mockResolvedValue({}) },
    };

    (verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 1 },
    });

    const ok = await service.verifyAuthentication(prisma as never, 'chal-1', {
      id: CRED_ID,
    } as never);

    expect(ok).toBe(true);
    // Lookup keys off the raw client id, unmodified.
    expect(findFirst.mock.calls[0][0].where.webauthnId).toBe(CRED_ID);
    // And the same id is handed to the verifier as the credential id.
    const verifyArg = (verifyAuthenticationResponse as jest.Mock).mock
      .calls[0][0];
    expect(verifyArg.credential.id).toBe(CRED_ID);
    expect(verifyArg.expectedOrigin).toEqual([
      'https://schoolwithease.com',
      'https://acme.schoolwithease.com',
    ]);
  });
});

describe('MfaWebAuthnService — origin config (P0-5)', () => {
  it('falls back to a single WEBAUTHN_ORIGIN when the allow-list is unset', async () => {
    delete process.env.WEBAUTHN_ALLOWED_ORIGINS;
    process.env.WEBAUTHN_ORIGIN = 'http://localhost:3030';
    const service = new MfaWebAuthnService();

    const prisma = {
      mfaChallenge: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'chal-1',
          userId: 'user-1',
          webauthnChallenge: 'challenge-str',
          expiresAt: new Date(Date.now() + 60_000),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      mfaMethod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'method-1',
          webauthnId: CRED_ID,
          webauthnPublicKey: Buffer.from([1]).toString('base64'),
          webauthnCounter: 0,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    (verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 1 },
    });

    await service.verifyAuthentication(prisma as never, 'chal-1', {
      id: CRED_ID,
    } as never);

    expect(
      (verifyAuthenticationResponse as jest.Mock).mock.calls[0][0]
        .expectedOrigin,
    ).toEqual(['http://localhost:3030']);
  });
});
