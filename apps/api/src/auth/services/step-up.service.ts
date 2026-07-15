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

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';

@Injectable()
export class StepUpService {
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
}
