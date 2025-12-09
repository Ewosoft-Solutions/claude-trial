import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../types/request-user';

/**
 * Retrieves the authenticated user from the request.
 *
 * Usage:
 * ```ts
 * @Get()
 * someHandler(@AuthUser() user: RequestUser) { ... }
 * ```
 */
export const AuthUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
