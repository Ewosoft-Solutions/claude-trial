import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { SENSITIVE_OPERATION_CATALOG } from '@workspace/database';
import { SensitiveOperationPolicyService } from './sensitive-operation-policy.service';

describe('SensitiveOperationPolicyService', () => {
  let securityPolicies: { getOrCreateDefaultPolicy: jest.Mock };
  let service: SensitiveOperationPolicyService;

  beforeEach(() => {
    securityPolicies = {
      getOrCreateDefaultPolicy: jest.fn().mockResolvedValue({
        biometricEnrollmentPolicy: 'allow',
      }),
    };
    service = new SensitiveOperationPolicyService(securityPolicies as never);
  });

  it('falls back to the complete versioned catalog before seed rows exist', async () => {
    const prisma = {
      sensitiveOperationPolicy: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const policies = await service.listPolicies(prisma as never);

    expect(policies).toHaveLength(SENSITIVE_OPERATION_CATALOG.length);
    expect(policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'biometrics.remove',
          enabled: true,
          requiresStepUp: true,
          id: null,
        }),
      ]),
    );
  });

  it('rejects unknown operation names', async () => {
    await expect(
      service.getPolicy(
        { sensitiveOperationPolicy: { findUnique: jest.fn() } } as never,
        'invented.operation',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not allow an enabled operation with no assurance control', async () => {
    const upsert = jest.fn();
    const prisma = {
      sensitiveOperationPolicy: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert,
      },
    };

    await expect(
      service.updatePolicy(
        prisma as never,
        'biometrics.remove',
        { requiresStepUp: false, requiresMakerChecker: false },
        'platform-user',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('enforces the tenant forbid-enrolment policy', async () => {
    securityPolicies.getOrCreateDefaultPolicy.mockResolvedValue({
      biometricEnrollmentPolicy: 'forbid',
    });

    await expect(
      service.assertEnrollmentAllowed({} as never, 'tenant-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('makes another active school requirement effective account-wide', async () => {
    const prisma = {
      schoolSecurityPolicy: {
        findMany: jest.fn().mockResolvedValue([
          {
            schoolId: 'required-tenant',
            school: { name: 'Required Academy' },
          },
        ]),
      },
    };

    await expect(
      service.getEffectiveBiometricEnrollmentPolicy(
        prisma as never,
        'allow-tenant',
        'user-1',
      ),
    ).resolves.toEqual({
      policy: 'require',
      activePolicy: 'allow',
      requiredBy: [
        { schoolId: 'required-tenant', schoolName: 'Required Academy' },
      ],
    });
  });

  it('prevents removal of the last active platform passkey when enrolment is required', async () => {
    securityPolicies.getOrCreateDefaultPolicy.mockResolvedValue({
      biometricEnrollmentPolicy: 'require',
    });
    const prisma = {
      mfaMethod: { count: jest.fn().mockResolvedValue(1) },
      schoolSecurityPolicy: {
        findFirst: jest.fn().mockResolvedValue({ schoolId: 'tenant-1' }),
      },
    };

    await expect(
      service.assertCanRemovePasskey(prisma as never, 'tenant-1', 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('enforces another active school require-policy after the user switches tenants', async () => {
    securityPolicies.getOrCreateDefaultPolicy.mockResolvedValue({
      biometricEnrollmentPolicy: 'allow',
    });
    const prisma = {
      mfaMethod: { count: jest.fn().mockResolvedValue(1) },
      schoolSecurityPolicy: {
        findFirst: jest.fn().mockResolvedValue({
          schoolId: 'other-required-tenant',
        }),
      },
    };

    await expect(
      service.assertCanRemovePasskey(prisma as never, 'allow-tenant', 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a second pending tenant proposal for the same operation', async () => {
    const create = jest.fn();
    const prisma = {
      sensitiveOperationPolicy: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      sensitiveOperationPolicyChangeRequest: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
        create,
      },
    };

    await expect(
      service.createChangeRequest(prisma as never, 'tenant-1', 'requester-1', {
        operation: 'biometrics.remove',
        freshnessMinutes: 10,
        reason: 'Align our security review window.',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('prevents a requester from reviewing their own proposal', async () => {
    const tx = {
      sensitiveOperationPolicyChangeRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'request-1',
          status: 'pending',
          requestedBy: 'requester-1',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };

    await expect(
      service.reviewChangeRequest(prisma as never, 'request-1', 'requester-1', {
        decision: 'approved',
        feedback: 'Approved after review.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies an approved tenant proposal and closes it atomically', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const closedRequest = { id: 'request-1', status: 'approved' };
    const tx = {
      sensitiveOperationPolicy: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert,
      },
      sensitiveOperationPolicyChangeRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'request-1',
          status: 'pending',
          requestedBy: 'requester-1',
          operation: 'biometrics.remove',
          requestedEnabled: null,
          requestedRequiresStepUp: null,
          requestedRequiresMakerChecker: null,
          requestedFreshnessMinutes: 10,
        }),
        updateMany,
        findUniqueOrThrow: jest.fn().mockResolvedValue(closedRequest),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };

    await expect(
      service.reviewChangeRequest(prisma as never, 'request-1', 'reviewer-1', {
        decision: 'approved',
        feedback: 'Approved after review.',
      }),
    ).resolves.toBe(closedRequest);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { operation: 'biometrics.remove' },
        create: expect.objectContaining({ freshnessMinutes: 10 }),
      }),
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'request-1', status: 'pending' },
      data: expect.objectContaining({
        status: 'approved',
        reviewedBy: 'reviewer-1',
      }),
    });
  });
});
