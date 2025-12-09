/**
 * MFA Required Guard
 *
 * Guard that enforces MFA verification for sensitive operations (3a.9, 3a.10).
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MfaBaseService } from '../services/mfa-base.service';
import { DatabaseService } from '../../common';

/**
 * MFA Required Decorator Metadata Key
 */
export const MFA_REQUIRED_KEY = 'mfaRequired';

/**
 * MFA Required Decorator
 *
 * Marks an endpoint as requiring MFA verification.
 */
export const MfaRequired = () => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    // This will be handled by the guard using Reflector
  };
};

/**
 * MFA Required Guard
 *
 * Enforces MFA verification for sensitive operations.
 */
@Injectable()
export class MfaRequiredGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if MFA is required for this endpoint
    const mfaRequired = this.reflector.getAllAndOverride<boolean>(
      MFA_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!mfaRequired) {
      // MFA not required for this endpoint
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const prisma = this.db.client;

    // Check if user has active MFA methods
    const hasMfa = await MfaBaseService.hasActiveMfaMethods(
      prisma,
      user.userId,
    );

    if (!hasMfa) {
      // User doesn't have MFA set up, but endpoint requires it
      // In production, this might be configurable per school/security policy
      throw new ForbiddenException(
        'MFA is required for this operation. Please set up MFA first.',
      );
    }

    // Check if MFA challenge is verified in this request
    // This assumes the MFA verification was done in a previous step
    // and the challenge ID is stored in the request
    const mfaChallengeId = request.headers['x-mfa-challenge-id'];
    const mfaVerified = request.headers['x-mfa-verified'] === 'true';

    if (!mfaChallengeId || !mfaVerified) {
      // Check if challenge exists and is verified
      if (mfaChallengeId) {
        const challenge = await prisma.mfaChallenge.findUnique({
          where: { id: mfaChallengeId },
          select: {
            userId: true,
            verified: true,
            expiresAt: true,
            operation: true,
          },
        });

        if (
          challenge &&
          challenge.userId === user.userId &&
          challenge.verified &&
          new Date() < challenge.expiresAt
        ) {
          // Challenge is valid and verified
          return true;
        }
      }

      // MFA verification required
      throw new ForbiddenException(
        'MFA verification required for this operation. Please verify your MFA first.',
      );
    }

    return true;
  }
}
