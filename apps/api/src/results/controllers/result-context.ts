import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedRequest } from 'src/auth';
import type { ResultActor } from '../services/results.types';

/** Extract the tenant + acting user's authority (clearance + grant scope). */
export function resultContext(req: AuthenticatedRequest): {
  tenantId: string;
  actor: ResultActor;
} {
  if (!req.user) throw new ForbiddenException('User context not found');
  const context = req.userContext;
  return {
    tenantId: req.user.tenantId,
    actor: {
      userId: req.user.userId,
      clearanceLevel: context?.clearanceLevel ?? 0,
      grantScope: context?.grantScope ?? null,
    },
  };
}
