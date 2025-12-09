import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PrismaTransactionService } from './prisma-transaction.service';
import { RequestUser } from '../../auth/types/request-user';

/**
 * RLS Context Interceptor
 *
 * Automatically sets RLS (Row-Level Security) context for each request
 * based on the authenticated user's tenant and user ID.
 *
 * This interceptor:
 * 1. Extracts tenantId and userId from request.user (set by JWT guard)
 * 2. Sets RLS context via PrismaTransactionService
 * 3. Clears context after request completes (success or error)
 *
 * Usage:
 * Apply globally in AppModule or to specific controllers/routes:
 * ```ts
 * providers: [
 *   {
 *     provide: APP_INTERCEPTOR,
 *     useClass: RlsContextInterceptor,
 *   },
 * ]
 * ```
 */
@Injectable()
export class RlsContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RlsContextInterceptor.name);

  constructor(private readonly prismaTx: PrismaTransactionService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const user = request.user;

    // Only set context if user is authenticated
    if (user?.tenantId) {
      const tenantId = user.tenantId;
      const userId = user.userId;

      try {
        // Set RLS context for this request
        // This uses session-level context (not transaction-scoped)
        // For transaction-scoped context, use PrismaTransactionService.runInTransaction()
        await this.prismaTx.setContext(tenantId, userId);

        this.logger.debug(
          `RLS context set: tenantId=${tenantId}, userId=${userId}`,
        );
      } catch (error) {
        this.logger.error('Failed to set RLS context', error);
        // Don't block request, but log the error
      }
    }

    // Execute the request and ensure context is cleared afterwards
    return next.handle().pipe(
      tap(async () => {
        // Clear context on successful completion
        await this.clearContext();
      }),
      catchError(async (error) => {
        // Clear context on error
        await this.clearContext();
        throw error;
      }),
    );
  }

  private async clearContext(): Promise<void> {
    try {
      await this.prismaTx.clearContext();
    } catch (error) {
      this.logger.error('Failed to clear RLS context', error);
    }
  }
}
