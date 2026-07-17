/**
 * Step-Up Guard
 *
 * Enforces a fresh, server-verified MFA step-up before a sensitive operation
 * (P0-3). Mark an endpoint with `@RequireStepUp('<operation>')`; the caller
 * must first verify an MFA challenge for that operation (normal MFA verify
 * flow) and pass its id as `stepUpChallengeId` in the request body.
 *
 * This replaces the former `MfaRequiredGuard`, which trusted client-supplied
 * `x-mfa-verified` / `x-mfa-challenge-id` headers and could be bypassed by
 * sending them. Here, headers are never consulted: the challenge id comes from
 * the request body and is validated + consumed entirely server-side.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../common';
import { RequestUser } from '../types/request-user';
import { StepUpService } from '../services/step-up.service';

/**
 * Metadata key carrying the operation an endpoint requires step-up for.
 */
export const STEP_UP_OPERATION_KEY = 'step_up_operation';

/**
 * Require a fresh MFA step-up for this route, bound to `operation`.
 *
 * `operation` must match a value from the platform-owned sensitive-operation
 * catalog and the operation on the server-side challenge.
 */
export const RequireStepUp = (operation: string) =>
  SetMetadata(STEP_UP_OPERATION_KEY, operation);

/**
 * Step-Up Guard
 *
 * Allows the request only when a matching verified, unconsumed, unexpired
 * challenge is successfully consumed for the calling user and operation.
 */
@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dbService: DatabaseService,
    private readonly stepUpService: StepUpService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const operation = this.reflector.getAllAndOverride<string>(
      STEP_UP_OPERATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No step-up requirement declared on this route — nothing to enforce.
    if (!operation) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = (request as { user?: RequestUser }).user;

    if (!user?.userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // The challenge id is taken ONLY from the request body. Headers are never
    // trusted (that was the old guard's flaw); the body value is meaningless
    // unless it matches a server-side challenge row, checked next.
    const body = (request as { body?: Record<string, unknown> }).body;
    const challengeId =
      typeof body?.stepUpChallengeId === 'string'
        ? body.stepUpChallengeId
        : undefined;

    if (!challengeId) {
      throw new ForbiddenException(
        'Step-up verification required for this operation.',
      );
    }

    const verified = await this.stepUpService.verifyAndConsume(
      this.dbService.client,
      user.userId,
      operation,
      challengeId,
    );

    if (!verified) {
      throw new ForbiddenException(
        'Step-up verification required for this operation.',
      );
    }

    return true;
  }
}
