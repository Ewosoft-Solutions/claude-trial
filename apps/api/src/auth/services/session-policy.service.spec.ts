import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnforcedBy } from '@workspace/api';

import { SecurityPolicyService } from './security-policy.service';
import { SessionPolicyService } from './session-policy.service';

describe('SessionPolicyService', () => {
  const securityPolicies = {
    getOrCreateDefaultPolicy: jest.fn(),
  } as unknown as SecurityPolicyService;

  function makeService(values: Record<string, number> = {}) {
    const config = {
      get: jest.fn((key: string, fallback: number) => values[key] ?? fallback),
    } as unknown as ConfigService;
    return new SessionPolicyService(config, securityPolicies);
  }

  beforeEach(() => jest.clearAllMocks());

  it('returns the stored tenant timeout with configured warning windows', async () => {
    (securityPolicies.getOrCreateDefaultPolicy as jest.Mock).mockResolvedValue({
      sessionTimeout: 15,
    });
    const service = makeService();

    await expect(
      service.getEffectivePolicy({} as never, 'tenant-1'),
    ).resolves.toEqual({
      idleTimeoutMinutes: 15,
      minimumIdleTimeoutMinutes: 5,
      maximumIdleTimeoutMinutes: 60,
      standardWarningSeconds: 120,
      focusWarningSeconds: 300,
    });
  });

  it('clamps legacy stored values to the configured operating range', async () => {
    (securityPolicies.getOrCreateDefaultPolicy as jest.Mock).mockResolvedValue({
      sessionTimeout: 90,
    });
    const service = makeService({ AUTH_IDLE_TIMEOUT_MAX_MINUTES: 45 });

    const policy = await service.getEffectivePolicy({} as never, 'tenant-1');
    expect(policy.idleTimeoutMinutes).toBe(45);
  });

  it('rejects updates outside the configured tenant range', async () => {
    const service = makeService();
    await expect(
      service.updateIdleTimeout(
        {} as never,
        'tenant-1',
        61,
        'actor-1',
        EnforcedBy.SCHOOL_ADMIN,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists a valid timeout and returns the effective policy', async () => {
    (securityPolicies.getOrCreateDefaultPolicy as jest.Mock)
      .mockResolvedValueOnce({ sessionTimeout: 15 })
      .mockResolvedValueOnce({ sessionTimeout: 20 });
    const update = jest.fn().mockResolvedValue({});
    const prisma = { schoolSecurityPolicy: { update } } as never;
    const service = makeService();

    const result = await service.updateIdleTimeout(
      prisma,
      'tenant-1',
      20,
      'actor-1',
      EnforcedBy.SCHOOL_ADMIN,
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId: 'tenant-1' },
        data: expect.objectContaining({ sessionTimeout: 20 }),
      }),
    );
    expect(result.idleTimeoutMinutes).toBe(20);
  });
});
