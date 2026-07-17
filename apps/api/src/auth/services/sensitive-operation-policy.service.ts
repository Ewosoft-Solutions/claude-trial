import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PrismaClient,
  SENSITIVE_OPERATION_CATALOG,
  getSensitiveOperationDefinition,
  type SensitiveOperationDefinition,
} from '@workspace/database';
import type {
  BiometricEnrollmentPolicy,
  CreateSensitiveOperationChangeRequestDto,
  ReviewSensitiveOperationChangeRequestDto,
  UpdateSensitiveOperationPolicyDto,
} from '../dto/security-policy.dto';
import { SecurityPolicyService } from './security-policy.service';

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface EffectiveSensitiveOperationPolicy extends SensitiveOperationDefinition {
  id: string | null;
  enabled: boolean;
  updatedBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface EffectiveBiometricEnrollmentPolicy {
  /** Account-wide effective policy; any active required school wins. */
  policy: BiometricEnrollmentPolicy;
  /** Policy of the school/profile that issued the current access token. */
  activePolicy: BiometricEnrollmentPolicy;
  requiredBy: Array<{ schoolId: string; schoolName: string }>;
}

@Injectable()
export class SensitiveOperationPolicyService {
  constructor(private readonly securityPolicies: SecurityPolicyService) {}

  async listPolicies(
    prisma: DbClient,
  ): Promise<EffectiveSensitiveOperationPolicy[]> {
    const stored = await prisma.sensitiveOperationPolicy.findMany({
      orderBy: [{ category: 'asc' }, { label: 'asc' }],
    });
    const byOperation = new Map(
      stored.map((policy) => [policy.operation, policy]),
    );

    return SENSITIVE_OPERATION_CATALOG.map((definition) => {
      const policy = byOperation.get(definition.operation);
      return policy
        ? this.toEffective(policy)
        : this.definitionFallback(definition);
    });
  }

  async getPolicy(
    prisma: DbClient,
    operation: string,
  ): Promise<EffectiveSensitiveOperationPolicy> {
    const definition = getSensitiveOperationDefinition(operation);
    if (!definition) {
      throw new BadRequestException('Unsupported sensitive operation.');
    }

    const stored = await prisma.sensitiveOperationPolicy.findUnique({
      where: { operation },
    });
    return stored
      ? this.toEffective(stored)
      : this.definitionFallback(definition);
  }

  async updatePolicy(
    prisma: PrismaClient,
    operation: string,
    dto: UpdateSensitiveOperationPolicyDto,
    actorId: string,
  ): Promise<EffectiveSensitiveOperationPolicy> {
    const current = await this.getPolicy(prisma, operation);
    const desired = this.mergePolicy(current, dto);
    this.assertAssurance(desired);

    const definition = getSensitiveOperationDefinition(operation)!;
    const updated = await prisma.sensitiveOperationPolicy.upsert({
      where: { operation },
      update: {
        enabled: desired.enabled,
        requiresStepUp: desired.requiresStepUp,
        requiresMakerChecker: desired.requiresMakerChecker,
        freshnessMinutes: desired.freshnessMinutes,
        updatedBy: actorId,
      },
      create: {
        ...definition,
        enabled: desired.enabled,
        requiresStepUp: desired.requiresStepUp,
        requiresMakerChecker: desired.requiresMakerChecker,
        freshnessMinutes: desired.freshnessMinutes,
        updatedBy: actorId,
      },
    });

    return this.toEffective(updated);
  }

  async getBiometricEnrollmentPolicy(
    prisma: PrismaClient,
    tenantId: string,
  ): Promise<{ policy: BiometricEnrollmentPolicy }> {
    const policy = await this.securityPolicies.getOrCreateDefaultPolicy(
      prisma,
      tenantId,
    );
    return {
      policy: this.normalizeBiometricPolicy(policy.biometricEnrollmentPolicy),
    };
  }

  async getEffectiveBiometricEnrollmentPolicy(
    prisma: PrismaClient,
    tenantId: string,
    userId: string,
  ): Promise<EffectiveBiometricEnrollmentPolicy> {
    const [active, requiredPolicies] = await Promise.all([
      this.getBiometricEnrollmentPolicy(prisma, tenantId),
      prisma.schoolSecurityPolicy.findMany({
        where: {
          biometricEnrollmentPolicy: 'require',
          school: {
            status: 'active',
            userTenants: {
              some: { userId, status: 'active', suspended: false },
            },
          },
        },
        select: {
          schoolId: true,
          school: { select: { name: true } },
        },
        orderBy: { school: { name: 'asc' } },
      }),
    ]);

    const requiredBy = requiredPolicies.map((entry) => ({
      schoolId: entry.schoolId,
      schoolName: entry.school.name,
    }));
    return {
      activePolicy: active.policy,
      policy: requiredBy.length > 0 ? 'require' : active.policy,
      requiredBy,
    };
  }

  async updateBiometricEnrollmentPolicy(
    prisma: PrismaClient,
    tenantId: string,
    policy: BiometricEnrollmentPolicy,
    actorId: string,
  ): Promise<{ policy: BiometricEnrollmentPolicy }> {
    await this.securityPolicies.getOrCreateDefaultPolicy(prisma, tenantId);
    const updated = await prisma.schoolSecurityPolicy.update({
      where: { schoolId: tenantId },
      data: {
        biometricEnrollmentPolicy: policy,
        updatedBy: actorId,
      },
      select: { biometricEnrollmentPolicy: true },
    });
    return {
      policy: this.normalizeBiometricPolicy(updated.biometricEnrollmentPolicy),
    };
  }

  async assertEnrollmentAllowed(
    prisma: PrismaClient,
    tenantId: string,
  ): Promise<void> {
    const { policy } = await this.getBiometricEnrollmentPolicy(
      prisma,
      tenantId,
    );
    if (policy === 'forbid') {
      throw new ForbiddenException(
        'This school does not allow biometric sign-in enrolment.',
      );
    }
  }

  async assertCanRemovePasskey(
    prisma: PrismaClient,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    // Ensure the active tenant has its default row, then enforce account-wide:
    // passkeys are account credentials shared across the user's schools, so
    // switching to an "allow" tenant must not bypass another active school's
    // "require" policy.
    await this.getBiometricEnrollmentPolicy(prisma, tenantId);
    const requiredMembership = await prisma.schoolSecurityPolicy.findFirst({
      where: {
        biometricEnrollmentPolicy: 'require',
        school: {
          status: 'active',
          userTenants: {
            some: { userId, status: 'active', suspended: false },
          },
        },
      },
      select: { schoolId: true },
    });
    if (!requiredMembership) return;

    const activePasskeys = await prisma.mfaMethod.count({
      where: {
        userId,
        type: 'webauthn',
        webauthnAttachment: 'platform',
        isActive: true,
      },
    });
    if (activePasskeys <= 1) {
      throw new ConflictException(
        'One of your schools requires biometric sign-in. Enrol another passkey before removing this one.',
      );
    }
  }

  async createChangeRequest(
    prisma: PrismaClient,
    tenantId: string,
    requestedBy: string,
    dto: CreateSensitiveOperationChangeRequestDto,
  ) {
    this.assertChangeFields(dto);
    const current = await this.getPolicy(prisma, dto.operation);
    const desired = this.mergePolicy(current, dto);
    this.assertAssurance(desired);

    // Change requests carry a real FK to the platform catalog. Keep requests
    // usable during a rolling deploy even if the seed job has not run yet.
    if (!current.id) {
      const definition = getSensitiveOperationDefinition(dto.operation)!;
      await prisma.sensitiveOperationPolicy.upsert({
        where: { operation: dto.operation },
        update: {},
        create: { ...definition },
      });
    }

    const existing =
      await prisma.sensitiveOperationPolicyChangeRequest.findFirst({
        where: {
          tenantId,
          operation: dto.operation,
          status: 'pending',
        },
        select: { id: true },
      });
    if (existing) {
      throw new ConflictException(
        'A pending request already exists for this operation.',
      );
    }

    try {
      return await prisma.sensitiveOperationPolicyChangeRequest.create({
        data: {
          tenantId,
          operation: dto.operation,
          requestedEnabled: dto.enabled,
          requestedRequiresStepUp: dto.requiresStepUp,
          requestedRequiresMakerChecker: dto.requiresMakerChecker,
          requestedFreshnessMinutes: dto.freshnessMinutes,
          reason: dto.reason.trim(),
          requestedBy,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A pending request already exists for this operation.',
        );
      }
      throw error;
    }
  }

  listTenantChangeRequests(prisma: PrismaClient, tenantId: string) {
    return prisma.sensitiveOperationPolicyChangeRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listPlatformChangeRequests(prisma: PrismaClient) {
    return prisma.sensitiveOperationPolicyChangeRequest.findMany({
      include: { tenant: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async reviewChangeRequest(
    prisma: PrismaClient,
    requestId: string,
    reviewerId: string,
    dto: ReviewSensitiveOperationChangeRequestDto,
  ) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.sensitiveOperationPolicyChangeRequest.findUnique(
        {
          where: { id: requestId },
        },
      );
      if (!request) throw new NotFoundException('Change request not found.');
      if (request.status !== 'pending') {
        throw new ConflictException('This change request is already closed.');
      }
      if (request.requestedBy === reviewerId) {
        throw new ForbiddenException(
          'The requester cannot review their own policy proposal.',
        );
      }

      if (dto.decision === 'approved') {
        const current = await this.getPolicy(tx, request.operation);
        const desired = this.mergePolicy(current, {
          enabled: request.requestedEnabled ?? undefined,
          requiresStepUp: request.requestedRequiresStepUp ?? undefined,
          requiresMakerChecker:
            request.requestedRequiresMakerChecker ?? undefined,
          freshnessMinutes: request.requestedFreshnessMinutes ?? undefined,
        });
        this.assertAssurance(desired);
        const definition = getSensitiveOperationDefinition(request.operation)!;
        await tx.sensitiveOperationPolicy.upsert({
          where: { operation: request.operation },
          update: {
            enabled: desired.enabled,
            requiresStepUp: desired.requiresStepUp,
            requiresMakerChecker: desired.requiresMakerChecker,
            freshnessMinutes: desired.freshnessMinutes,
            updatedBy: reviewerId,
          },
          create: {
            ...definition,
            enabled: desired.enabled,
            requiresStepUp: desired.requiresStepUp,
            requiresMakerChecker: desired.requiresMakerChecker,
            freshnessMinutes: desired.freshnessMinutes,
            updatedBy: reviewerId,
          },
        });
      }

      const closed = await tx.sensitiveOperationPolicyChangeRequest.updateMany({
        where: { id: requestId, status: 'pending' },
        data: {
          status: dto.decision,
          reviewedBy: reviewerId,
          feedback: dto.feedback.trim(),
          reviewedAt: new Date(),
        },
      });
      if (closed.count !== 1) {
        throw new ConflictException('This change request is already closed.');
      }

      return tx.sensitiveOperationPolicyChangeRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      });
    });
  }

  private toEffective(policy: {
    id: string;
    operation: string;
    label: string;
    description: string | null;
    category: string;
    enabled: boolean;
    requiresStepUp: boolean;
    requiresMakerChecker: boolean;
    freshnessMinutes: number;
    requiredClearanceLevel: number;
    requiredPermission: string | null;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): EffectiveSensitiveOperationPolicy {
    return {
      ...policy,
      description: policy.description ?? '',
      category: policy.category as SensitiveOperationDefinition['category'],
    };
  }

  private definitionFallback(
    definition: SensitiveOperationDefinition,
  ): EffectiveSensitiveOperationPolicy {
    return {
      ...definition,
      id: null,
      enabled: true,
      updatedBy: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  private mergePolicy(
    current: EffectiveSensitiveOperationPolicy,
    changes: UpdateSensitiveOperationPolicyDto,
  ): Pick<
    EffectiveSensitiveOperationPolicy,
    'enabled' | 'requiresStepUp' | 'requiresMakerChecker' | 'freshnessMinutes'
  > {
    return {
      enabled: changes.enabled ?? current.enabled,
      requiresStepUp: changes.requiresStepUp ?? current.requiresStepUp,
      requiresMakerChecker:
        changes.requiresMakerChecker ?? current.requiresMakerChecker,
      freshnessMinutes: changes.freshnessMinutes ?? current.freshnessMinutes,
    };
  }

  private assertAssurance(policy: {
    enabled: boolean;
    requiresStepUp: boolean;
    requiresMakerChecker: boolean;
    freshnessMinutes: number;
  }): void {
    if (
      policy.enabled &&
      !policy.requiresStepUp &&
      !policy.requiresMakerChecker
    ) {
      throw new BadRequestException(
        'An enabled sensitive operation must require step-up or maker-checker approval.',
      );
    }
    if (policy.freshnessMinutes < 1 || policy.freshnessMinutes > 30) {
      throw new BadRequestException(
        'Step-up freshness must be between 1 and 30 minutes.',
      );
    }
  }

  private assertChangeFields(
    dto: CreateSensitiveOperationChangeRequestDto,
  ): void {
    if (
      dto.enabled === undefined &&
      dto.requiresStepUp === undefined &&
      dto.requiresMakerChecker === undefined &&
      dto.freshnessMinutes === undefined
    ) {
      throw new BadRequestException(
        'Request at least one concrete policy change.',
      );
    }
  }

  private normalizeBiometricPolicy(policy: string): BiometricEnrollmentPolicy {
    return policy === 'require' || policy === 'forbid' ? policy : 'allow';
  }
}
