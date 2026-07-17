import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BiometricsService } from './biometrics.service';

describe('BiometricsService', () => {
  let webauthn: {
    generateRegistrationOptions: jest.Mock;
    verifyRegistration: jest.Mock;
    getRpId: jest.Mock;
  };
  let service: BiometricsService;

  beforeEach(() => {
    webauthn = {
      generateRegistrationOptions: jest.fn(),
      verifyRegistration: jest.fn(),
      getRpId: jest.fn().mockReturnValue('schoolwithease.com'),
    };
    service = new BiometricsService(webauthn as never);
  });

  it('resolves the user from the db and enrols with the platform attachment', async () => {
    webauthn.generateRegistrationOptions.mockResolvedValue({
      challengeId: 'c1',
    });
    const findUnique = jest.fn().mockResolvedValue({
      email: 'u@e.com',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    const prisma = { user: { findUnique } };

    await service.generateRegistrationOptions(prisma as never, 'u1');

    // Email + display name come from the DB (the JWT carries no email).
    expect(webauthn.generateRegistrationOptions).toHaveBeenCalledWith(
      prisma,
      'u1',
      'u@e.com',
      'Jane Doe',
      'platform',
    );
  });

  it('throws NotFound when the user does not exist', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    await expect(
      service.generateRegistrationOptions(prisma as never, 'ghost'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(webauthn.generateRegistrationOptions).not.toHaveBeenCalled();
  });

  it('verifies enrolment with the platform attachment', async () => {
    webauthn.verifyRegistration.mockResolvedValue('method-1');
    const id = await service.verifyRegistration(
      {} as never,
      'c1',
      { foo: 'bar' },
      'My iPhone',
    );
    expect(id).toBe('method-1');
    expect(webauthn.verifyRegistration).toHaveBeenCalledWith(
      {},
      'c1',
      { foo: 'bar' },
      'My iPhone',
      'platform',
    );
  });

  it("lists only the user's active platform devices, mapped for the UI", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'm1',
        name: 'My iPhone',
        webauthnBackedUp: true,
        webauthnTransports: ['internal', 'hybrid'],
        createdAt: new Date('2026-07-15'),
        lastUsedAt: null,
      },
      {
        id: 'm2',
        name: null,
        webauthnBackedUp: null,
        webauthnTransports: [],
        createdAt: new Date('2026-07-14'),
        lastUsedAt: new Date('2026-07-15'),
      },
    ]);
    const prisma = { mfaMethod: { findMany } };

    const devices = await service.listDevices(prisma as never, 'u1');

    expect(findMany.mock.calls[0][0].where).toMatchObject({
      userId: 'u1',
      type: 'webauthn',
      webauthnAttachment: 'platform',
      isActive: true,
    });
    expect(devices).toEqual([
      {
        id: 'm1',
        label: 'My iPhone',
        backedUp: true,
        transports: ['internal', 'hybrid'],
        createdAt: new Date('2026-07-15'),
        lastUsedAt: null,
      },
      {
        id: 'm2',
        label: 'Passkey',
        backedUp: false,
        transports: [],
        createdAt: new Date('2026-07-14'),
        lastUsedAt: new Date('2026-07-15'),
      },
    ]);
  });

  it('removes a device scoped to the user + platform, deleting the matched row', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'm1',
      webauthnId: 'credential-id',
    });
    const del = jest.fn().mockResolvedValue({});
    const prisma = { mfaMethod: { findFirst, delete: del } };

    await expect(
      service.removeDevice(prisma as never, 'u1', 'm1'),
    ).resolves.toEqual({
      credentialId: 'credential-id',
      rpId: 'schoolwithease.com',
    });

    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'm1',
      userId: 'u1',
      type: 'webauthn',
      webauthnAttachment: 'platform',
    });
    expect(findFirst.mock.calls[0][0].select).toEqual({
      id: true,
      webauthnId: true,
    });
    expect(del).toHaveBeenCalledWith({ where: { id: 'm1' } });
  });

  it("throws NotFound (and does not delete) when the device is not the user's", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const del = jest.fn();
    const prisma = { mfaMethod: { findFirst, delete: del } };

    await expect(
      service.removeDevice(prisma as never, 'u1', 'other'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(del).not.toHaveBeenCalled();
  });

  it('maps a known AAGUID to a provider name, and leaves unknown ones undefined', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'm1',
        name: 'iPhone',
        webauthnAaguid: 'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4',
        webauthnBackedUp: true,
        webauthnTransports: ['internal', 'hybrid'],
        createdAt: new Date('2026-07-15'),
        lastUsedAt: null,
      },
      {
        id: 'm2',
        name: 'Mac',
        webauthnAaguid: 'b5397666-4885-aa6b-cebf-e52262a439a2',
        webauthnBackedUp: false,
        webauthnTransports: ['internal'],
        createdAt: new Date('2026-07-14'),
        lastUsedAt: null,
      },
    ]);
    const devices = await service.listDevices(
      { mfaMethod: { findMany } } as never,
      'u1',
    );
    expect(devices[0].provider).toBe('Google Password Manager');
    expect(devices[1].provider).toBeUndefined();
  });

  it('renames a device scoped to the user + platform', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { mfaMethod: { updateMany } };

    await service.renameDevice(prisma as never, 'u1', 'm1', '  iPhone 16 Pro  ');

    expect(updateMany.mock.calls[0][0]).toMatchObject({
      where: {
        id: 'm1',
        userId: 'u1',
        type: 'webauthn',
        webauthnAttachment: 'platform',
      },
      data: { name: 'iPhone 16 Pro' }, // trimmed
    });
  });

  it('rejects an empty rename', async () => {
    const updateMany = jest.fn();
    await expect(
      service.renameDevice({ mfaMethod: { updateMany } } as never, 'u1', 'm1', '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('throws NotFound when renaming a device that is not the user\'s', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    await expect(
      service.renameDevice({ mfaMethod: { updateMany } } as never, 'u1', 'x', 'New name'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
