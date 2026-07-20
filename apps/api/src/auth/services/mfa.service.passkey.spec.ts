import { MfaService } from './mfa.service';

describe('MfaService — passwordless platform passkeys', () => {
  it('counts and requests only platform credentials for biometric login', async () => {
    const generateAuthenticationOptions = jest.fn().mockResolvedValue({
      challengeId: 'challenge-1',
      challenge: 'challenge',
    });
    const service = new MfaService(
      {} as never,
      {} as never,
      {} as never,
      { generateAuthenticationOptions } as never,
    );
    const count = jest.fn().mockResolvedValue(1);
    const prisma = { mfaMethod: { count } };

    await expect(
      service.beginWebAuthnLogin(prisma as never, 'user-1'),
    ).resolves.toEqual({
      challengeId: 'challenge-1',
      options: { challengeId: 'challenge-1', challenge: 'challenge' },
    });

    expect(count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        type: 'webauthn',
        webauthnAttachment: 'platform',
        isActive: true,
      },
    });
    expect(generateAuthenticationOptions).toHaveBeenCalledWith(
      prisma,
      'user-1',
      'login',
      'required',
      'platform',
    );
  });

  it('does not advertise hardware-key-only accounts as biometric login ready', async () => {
    const generateAuthenticationOptions = jest.fn();
    const service = new MfaService(
      {} as never,
      {} as never,
      {} as never,
      { generateAuthenticationOptions } as never,
    );
    const prisma = {
      mfaMethod: { count: jest.fn().mockResolvedValue(0) },
    };

    await expect(
      service.beginWebAuthnLogin(prisma as never, 'user-1'),
    ).resolves.toBeNull();
    expect(generateAuthenticationOptions).not.toHaveBeenCalled();
  });
});
