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

const PASSWORD_STEP_UP_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class StepUpService {
  constructor(private readonly webauthn: MfaWebAuthnService) {}

  /**
   * Prepare passkey-first step-up for a catalogued operation. Password remains
   * available as the fallback even when no platform passkey is enrolled.
   */
  async begin(
    prisma: PrismaClient,
    userId: string,
    operation: string,
  ): Promise<
    | { hasPasskey: false }
    | { hasPasskey: true; challengeId: string; options: unknown }
  > {
    this.assertOperation(operation);

    const passkeyCount = await prisma.mfaMethod.count({
      where: {
        userId,
        type: 'webauthn',
        webauthnAttachment: 'platform',
        isActive: true,
      },
    });

    if (passkeyCount === 0) {
      return { hasPasskey: false };
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

    const now = new Date();
    const challenge = await prisma.mfaChallenge.create({
      data: {
        userId,
        type: 'password',
        operation,
        verified: true,
        verifiedAt: now,
        consumedAt: null,
        expiresAt: new Date(now.getTime() + PASSWORD_STEP_UP_TTL_MS),
      },
      select: { id: true },
    });

    return challenge.id;
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

    const result = await prisma.mfaChallenge.updateMany({
      where: {
        id: challengeId,
        userId,
        operation,
        verified: true,
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
}
