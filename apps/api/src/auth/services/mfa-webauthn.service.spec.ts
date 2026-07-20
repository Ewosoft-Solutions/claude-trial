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
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { MfaWebAuthnService } from './mfa-webauthn.service';

// A credential id in base64url form — contains '-' and '_', the exact chars a
// base64 round-trip would corrupt.
const CRED_ID = 'aB-_cd12EF-_gh';

const OLD_ENV = process.env;

// Reversible stand-in for AES-256-GCM so tests can assert what gets encrypted.
let encryption: { encrypt: jest.Mock; decrypt: jest.Mock };

function makeService() {
  return new MfaWebAuthnService(encryption as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  encryption = {
    encrypt: jest.fn((s: string) => `enc(${s})`),
    decrypt: jest.fn((s: string) => s.replace(/^enc\(/, '').replace(/\)$/, '')),
  };
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
    const service = makeService();

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
    const service = makeService();

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

describe('MfaWebAuthnService — authenticator routing', () => {
  it('uses stored transports and only platform credentials for biometric login', async () => {
    const service = makeService();
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'platform-method',
        webauthnId: 'platform-credential',
        webauthnAttachment: 'platform',
        webauthnTransports: ['hybrid', 'internal'],
      },
    ]);
    const prisma = {
      mfaMethod: { findMany },
      mfaChallenge: {
        create: jest.fn().mockResolvedValue({ id: 'challenge-1' }),
      },
    };
    (generateAuthenticationOptions as jest.Mock).mockResolvedValue({
      challenge: 'challenge',
      timeout: 60_000,
    });

    const result = await service.generateAuthenticationOptions(
      prisma as never,
      'user-1',
      'login',
      'required',
      'platform',
    );

    expect(findMany.mock.calls[0][0].where).toMatchObject({
      userId: 'user-1',
      type: 'webauthn',
      isActive: true,
      webauthnAttachment: 'platform',
    });
    expect(
      (generateAuthenticationOptions as jest.Mock).mock.calls[0][0],
    ).toMatchObject({
      allowCredentials: [
        {
          id: 'platform-credential',
          transports: ['hybrid', 'internal'],
        },
      ],
    });
    expect(result.hints).toEqual(['client-device']);
  });

  it('preserves registered transports in duplicate-credential exclusions', async () => {
    const service = makeService();
    const prisma = {
      mfaMethod: {
        findMany: jest.fn().mockResolvedValue([
          {
            webauthnId: 'platform-credential',
            webauthnTransports: ['hybrid', 'internal'],
          },
        ]),
      },
      mfaChallenge: {
        create: jest.fn().mockResolvedValue({ id: 'challenge-1' }),
      },
    };
    (generateRegistrationOptions as jest.Mock).mockResolvedValue({
      challenge: 'challenge',
    });

    await service.generateRegistrationOptions(
      prisma as never,
      'user-1',
      'user@example.test',
      'Test User',
      'platform',
    );

    expect(
      (generateRegistrationOptions as jest.Mock).mock.calls[0][0]
        .excludeCredentials,
    ).toEqual([
      {
        id: 'platform-credential',
        transports: ['hybrid', 'internal'],
      },
    ]);
  });
});

describe('MfaWebAuthnService — origin config (P0-5)', () => {
  it('falls back to a single WEBAUTHN_ORIGIN when the allow-list is unset', async () => {
    delete process.env.WEBAUTHN_ALLOWED_ORIGINS;
    process.env.WEBAUTHN_ORIGIN = 'http://localhost:3030';
    const service = makeService();

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

describe('MfaWebAuthnService — public-key encryption at rest (P0-6)', () => {
  // base64 of the raw public-key bytes [1,2,3] used below.
  const PUBKEY_B64 = Buffer.from([1, 2, 3]).toString('base64');

  it('encrypts the public key before storing it', async () => {
    const service = makeService();
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
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
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

    await service.verifyRegistration(prisma as never, 'chal-1', {
      id: CRED_ID,
    });

    // The base64 of the raw key is what gets encrypted, and the ciphertext is
    // what lands in the column — never the plaintext key.
    expect(encryption.encrypt).toHaveBeenCalledWith(PUBKEY_B64);
    expect(create.mock.calls[0][0].data.webauthnPublicKey).toBe(
      `enc(${PUBKEY_B64})`,
    );
  });

  it('decrypts the stored public key before verification', async () => {
    const service = makeService();
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
          webauthnPublicKey: `enc(${PUBKEY_B64})`,
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

    expect(encryption.decrypt).toHaveBeenCalledWith(`enc(${PUBKEY_B64})`);
    // The decrypted base64 is turned back into the original raw key bytes.
    const verifyArg = (verifyAuthenticationResponse as jest.Mock).mock
      .calls[0][0];
    expect(
      Buffer.from(verifyArg.credential.publicKey).equals(
        Buffer.from([1, 2, 3]),
      ),
    ).toBe(true);
  });
});
