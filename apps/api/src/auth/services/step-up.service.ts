/**
 * Step-Up Service
 *
 * Server-authoritative verification for sensitive-operation step-up (P0-3).
 *
 * Replaces the header-trusting logic of the former MfaRequiredGuard: the ONLY
 * source of truth is a server-side MfaChallenge row that was already verified
 * (by the normal MFA verify flow) and has not yet been consumed. A challenge is
 * single-use — it is consumed atomically the first time it is accepted, so it
 * cannot be replayed for a second action.
 */

import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { isStepUpOperation } from '../step-up.operations';
import { MfaWebAuthnService } from './mfa-webauthn.service';
import { PasswordService } from './password.service';
import { MfaTotpService } from './mfa-totp.service';
import { MfaService } from './mfa.service';
import { SensitiveOperationPolicyService } from './sensitive-operation-policy.service';

@Injectable()
export class StepUpService {
  constructor(
    private readonly webauthn: MfaWebAuthnService,
    private readonly totp: MfaTotpService,
    private readonly mfa: MfaService,
    private readonly policies: SensitiveOperationPolicyService,
  ) {}

  async requiresStepUp(
    prisma: PrismaClient,
    operation: string,
  ): Promise<boolean> {
    this.assertOperation(operation);
    const policy = await this.policies.getPolicy(prisma, operation);
    return policy.enabled && policy.requiresStepUp;
  }

  /**
   * Prepare passkey-first step-up for a catalogued operation. Password remains
   * available as the fallback even when no platform passkey is enrolled.
   */
  async begin(prisma: PrismaClient, userId: string, operation: string) {
    this.assertOperation(operation);

    const policy = await this.policies.getPolicy(prisma, operation);
    if (!policy.enabled || !policy.requiresStepUp) {
      return {
        required: false as const,
        freshnessMinutes: policy.freshnessMinutes,
        hasPasskey: false as const,
        methods: {
          passkey: false,
          totp: false,
          recoveryCode: false,
          password: false,
        },
      };
    }
    const [passkeyCount, totpCount, recoveryCodeCount, user] =
      await Promise.all([
        prisma.mfaMethod.count({
          where: {
            userId,
            type: 'webauthn',
            webauthnAttachment: 'platform',
            isActive: true,
          },
        }),
        prisma.mfaMethod.count({
          where: { userId, type: 'totp', isActive: true },
        }),
        prisma.mfaRecoveryCode.count({ where: { userId, used: false } }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { passwordHash: true },
        }),
      ]);

    const methods = {
      passkey: passkeyCount > 0,
      totp: totpCount > 0,
      recoveryCode: recoveryCodeCount > 0,
      password: Boolean(user?.passwordHash),
    };

    if (passkeyCount === 0) {
      return {
        required: true as const,
        freshnessMinutes: policy.freshnessMinutes,
        hasPasskey: false as const,
        methods,
      };
    }

    const options = await this.webauthn.generateAuthenticationOptions(
      prisma,
      userId,
      operation,
      'required',
      'platform',
    );

    return {
      hasPasskey: true,
      required: true as const,
      freshnessMinutes: policy.freshnessMinutes,
      methods,
      challengeId: options.challengeId,
      options,
    };
  }

  /** Verify a passkey assertion for the exact user + operation challenge. */
  async verifyPasskey(
    prisma: PrismaClient,
    userId: string,
    operation: string,
    challengeId: string,
    response: AuthenticationResponseJSON,
  ): Promise<string> {
    this.assertOperation(operation);
    await this.requireStepUpPolicy(prisma, operation);

    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: challengeId },
      select: {
        userId: true,
        operation: true,
        type: true,
        verified: true,
        consumedAt: true,
        expiresAt: true,
      },
    });

    if (
      !challenge ||
      challenge.userId !== userId ||
      challenge.operation !== operation ||
      challenge.type !== 'webauthn' ||
      challenge.verified ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Could not verify your identity.');
    }

    const verified = await this.webauthn.verifyAuthentication(
      prisma,
      challengeId,
      response,
    );

    if (!verified) {
      throw new UnauthorizedException('Could not verify your identity.');
    }

    return challengeId;
  }

  /**
   * Verify the signed-in user's current password and mint a short-lived,
   * operation-bound challenge. The target endpoint still consumes it once.
   */
  async verifyPassword(
    prisma: PrismaClient,
    userId: string,
    operation: string,
    password: string,
  ): Promise<string> {
    this.assertOperation(operation);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    const verified =
      Boolean(user?.passwordHash) &&
      (await PasswordService.comparePassword(password, user!.passwordHash!));

    if (!verified) {
      throw new UnauthorizedException('Could not verify your identity.');
    }

    return this.mintVerifiedChallenge(prisma, userId, operation, 'password');
  }

  async verifyTotp(
    prisma: PrismaClient,
    userId: string,
    operation: string,
    token: string,
  ): Promise<string> {
    this.assertOperation(operation);
    await this.requireStepUpPolicy(prisma, operation);

    const methods = await prisma.mfaMethod.findMany({
      where: { userId, type: 'totp', isActive: true },
      select: { id: true, secret: true },
    });
    const method = methods.find(
      (candidate) =>
        candidate.secret && this.totp.verifyToken(candidate.secret, token),
    );
    if (!method) {
      throw new UnauthorizedException('Could not verify your identity.');
    }

    return prisma.$transaction(async (tx) => {
      await tx.mfaMethod.update({
        where: { id: method.id },
        data: { lastUsedAt: new Date() },
      });
      return this.mintVerifiedChallenge(
        tx as unknown as PrismaClient,
        userId,
        operation,
        'totp',
        method.id,
      );
    });
  }

  async verifyRecoveryCode(
    prisma: PrismaClient,
    userId: string,
    operation: string,
    code: string,
  ): Promise<string> {
    this.assertOperation(operation);
    await this.requireStepUpPolicy(prisma, operation);

    return prisma.$transaction(async (tx) => {
      const verified = await this.mfa.verifyRecoveryCode(
        tx as unknown as PrismaClient,
        userId,
        code,
      );
      if (!verified) {
        throw new UnauthorizedException('Could not verify your identity.');
      }
      return this.mintVerifiedChallenge(
        tx as unknown as PrismaClient,
        userId,
        operation,
        'recovery',
      );
    });
  }

  /**
   * Atomically verify-and-consume a step-up challenge.
   *
   * Succeeds only if a challenge exists that is bound to this `userId` AND this
   * `operation`, is `verified`, is not yet consumed, and has not expired — and
   * is consumed by *this* call. The match + consume happen in a single
   * `updateMany` so two concurrent requests cannot both spend the same
   * challenge: Postgres serializes the row update, and the loser re-evaluates
   * its `WHERE` against the now-consumed row and matches zero rows.
   *
   * @param prisma - Prisma client instance
   * @param userId - The authenticated caller's user id
   * @param operation - The operation the guarded endpoint demands step-up for
   * @param challengeId - The challenge id supplied in the request body
   * @returns true only if a matching challenge was consumed by this call
   */
  async verifyAndConsume(
    prisma: PrismaClient,
    userId: string,
    operation: string,
    challengeId: string,
  ): Promise<boolean> {
    if (!challengeId) {
      return false;
    }

    const policy = await this.policies.getPolicy(prisma, operation);
    if (!policy.enabled || !policy.requiresStepUp) return false;
    const freshnessCutoff = new Date(
      Date.now() - policy.freshnessMinutes * 60 * 1000,
    );

    const result = await prisma.mfaChallenge.updateMany({
      where: {
        id: challengeId,
        userId,
        operation,
        verified: true,
        verifiedAt: { gt: freshnessCutoff },
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });

    return result.count === 1;
  }

  private assertOperation(operation: string): void {
    if (!isStepUpOperation(operation)) {
      throw new BadRequestException('Unsupported step-up operation.');
    }
  }

  private async requireStepUpPolicy(prisma: PrismaClient, operation: string) {
    const policy = await this.policies.getPolicy(prisma, operation);
    if (!policy.enabled || !policy.requiresStepUp) {
      throw new BadRequestException(
        'Step-up verification is not required for this operation.',
      );
    }
    return policy;
  }

  private async mintVerifiedChallenge(
    prisma: PrismaClient,
    userId: string,
    operation: string,
    type: 'password' | 'totp' | 'recovery',
    mfaMethodId?: string,
  ): Promise<string> {
    const policy = await this.requireStepUpPolicy(prisma, operation);
    const now = new Date();
    const challenge = await prisma.mfaChallenge.create({
      data: {
        userId,
        mfaMethodId,
        type,
        operation,
        verified: true,
        verifiedAt: now,
        consumedAt: null,
        expiresAt: new Date(
          now.getTime() + policy.freshnessMinutes * 60 * 1000,
        ),
      },
      select: { id: true },
    });
    return challenge.id;
  }
}
