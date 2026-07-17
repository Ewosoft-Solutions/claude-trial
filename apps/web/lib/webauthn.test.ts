import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  canAttemptPasskey,
  getPasskeyAvailability,
  signalUnknownPasskey,
} from './webauthn';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canAttemptPasskey', () => {
  it('allows an explicit passkey attempt when the iOS platform probe is false', () => {
    vi.stubGlobal('window', {
      PublicKeyCredential: {
        isUserVerifyingPlatformAuthenticatorAvailable: vi
          .fn()
          .mockResolvedValue(false),
      },
    });
    vi.stubGlobal('navigator', { credentials: {} });

    expect(canAttemptPasskey()).toBe(true);
  });

  it('allows an explicit passkey attempt when the platform probe is absent', () => {
    vi.stubGlobal('window', { PublicKeyCredential: {} });
    vi.stubGlobal('navigator', { credentials: {} });

    expect(canAttemptPasskey()).toBe(true);
  });

  it('rejects the attempt only when the WebAuthn API itself is unavailable', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { credentials: {} });

    expect(canAttemptPasskey()).toBe(false);
  });

  it('distinguishes an insecure HTTP origin from browser incompatibility', () => {
    vi.stubGlobal('window', {
      isSecureContext: false,
      PublicKeyCredential: undefined,
    });

    expect(getPasskeyAvailability()).toBe('insecure-context');
    expect(canAttemptPasskey()).toBe(false);
  });
});

describe('signalUnknownPasskey', () => {
  it('notifies a supporting password manager about the removed credential', async () => {
    const signalUnknownCredential = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('window', {
      isSecureContext: true,
      PublicKeyCredential: { signalUnknownCredential },
    });

    await expect(
      signalUnknownPasskey({
        rpId: 'schoolwithease.com',
        credentialId: 'credential-id',
      }),
    ).resolves.toBe('signalled');
    expect(signalUnknownCredential).toHaveBeenCalledWith({
      rpId: 'schoolwithease.com',
      credentialId: 'credential-id',
    });
  });

  it('reports unsupported providers without failing account-side removal', async () => {
    vi.stubGlobal('window', {
      isSecureContext: true,
      PublicKeyCredential: {},
    });

    await expect(
      signalUnknownPasskey({
        rpId: 'schoolwithease.com',
        credentialId: 'credential-id',
      }),
    ).resolves.toBe('unsupported');
  });

  it('turns provider errors into a manual-cleanup result', async () => {
    vi.stubGlobal('window', {
      isSecureContext: true,
      PublicKeyCredential: {
        signalUnknownCredential: vi.fn().mockRejectedValue(new Error('nope')),
      },
    });

    await expect(
      signalUnknownPasskey({
        rpId: 'schoolwithease.com',
        credentialId: 'credential-id',
      }),
    ).resolves.toBe('failed');
  });
});
