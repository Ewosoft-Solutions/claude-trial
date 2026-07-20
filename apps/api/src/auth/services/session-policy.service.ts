import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnforcedBy } from '@workspace/api';
import type { PrismaClient } from '@workspace/database';

import { SecurityPolicyService } from './security-policy.service';

export const HARD_IDLE_TIMEOUT_MIN_MINUTES = 5;
export const HARD_IDLE_TIMEOUT_MAX_MINUTES = 120;

export interface EffectiveSessionPolicy {
  idleTimeoutMinutes: number;
  minimumIdleTimeoutMinutes: number;
  maximumIdleTimeoutMinutes: number;
  standardWarningSeconds: number;
  focusWarningSeconds: number;
}

@Injectable()
export class SessionPolicyService {
  constructor(
    private readonly config: ConfigService,
    private readonly securityPolicies: SecurityPolicyService,
  ) {}

  getBounds() {
    const configuredMin = this.config.get<number>(
      'AUTH_IDLE_TIMEOUT_MIN_MINUTES',
      HARD_IDLE_TIMEOUT_MIN_MINUTES,
    );
    const configuredMax = this.config.get<number>(
      'AUTH_IDLE_TIMEOUT_MAX_MINUTES',
      60,
    );
    const minimum = Math.min(
      HARD_IDLE_TIMEOUT_MAX_MINUTES,
      Math.max(HARD_IDLE_TIMEOUT_MIN_MINUTES, configuredMin),
    );
    const maximum = Math.min(
      HARD_IDLE_TIMEOUT_MAX_MINUTES,
      Math.max(minimum, configuredMax),
    );
    return { minimum, maximum };
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }

  async getEffectivePolicy(
    prisma: PrismaClient,
    tenantId: string,
  ): Promise<EffectiveSessionPolicy> {
    const { minimum, maximum } = this.getBounds();
    const defaultTimeout = this.clamp(
      this.config.get<number>('AUTH_IDLE_TIMEOUT_DEFAULT_MINUTES', 15),
      minimum,
      maximum,
    );
    const policy = await this.securityPolicies.getOrCreateDefaultPolicy(
      prisma,
      tenantId,
    );

    return {
      idleTimeoutMinutes: this.clamp(
        policy.sessionTimeout || defaultTimeout,
        minimum,
        maximum,
      ),
      minimumIdleTimeoutMinutes: minimum,
      maximumIdleTimeoutMinutes: maximum,
      standardWarningSeconds: this.clamp(
        this.config.get<number>('AUTH_IDLE_STANDARD_GRACE_SECONDS', 120),
        30,
        600,
      ),
      focusWarningSeconds: this.clamp(
        this.config.get<number>('AUTH_IDLE_FOCUS_GRACE_SECONDS', 300),
        30,
        900,
      ),
    };
  }

  async updateIdleTimeout(
    prisma: PrismaClient,
    tenantId: string,
    idleTimeoutMinutes: number,
    actorId: string,
    enforcedBy: EnforcedBy,
  ): Promise<EffectiveSessionPolicy> {
    const { minimum, maximum } = this.getBounds();
    if (
      !Number.isInteger(idleTimeoutMinutes) ||
      idleTimeoutMinutes < minimum ||
      idleTimeoutMinutes > maximum
    ) {
      throw new BadRequestException(
        `Inactivity timeout must be between ${minimum} and ${maximum} minutes`,
      );
    }

    await this.securityPolicies.getOrCreateDefaultPolicy(prisma, tenantId);
    await prisma.schoolSecurityPolicy.update({
      where: { schoolId: tenantId },
      data: {
        sessionTimeout: idleTimeoutMinutes,
        enforcedBy,
        enforcedByUserId: actorId,
        enforcedAt: new Date(),
        updatedBy: actorId,
      },
    });

    return this.getEffectivePolicy(prisma, tenantId);
  }
}
