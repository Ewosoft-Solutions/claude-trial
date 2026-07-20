import { Injectable, Scope, Inject, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@workspace/database';
import { PRISMA_CLIENT_TOKEN } from './database.service';
import { setContext, clearContext } from '@workspace/database/rls';
import { currentRlsTx } from './rls-als';

/**
 * Prisma Transaction Service
 *
 * Request-scoped service that manages database transactions and RLS context.
 *
 * CRITICAL for your setup because:
 * 1. RLS uses SET LOCAL (transaction-scoped)
 * 2. Multiple service calls per request need atomicity
 * 3. Prevents context leakage between requests
 *
 * Usage:
 * ```ts
 * constructor(private readonly prismaTx: PrismaTransactionService) {}
 *
 * async createUserAndProfile(tenantId: string, userId: string) {
 *   return this.prismaTx.runInTransaction(async (tx) => {
 *     // RLS context is automatically set
 *     await tx.user.create(...);
 *     await tx.profile.create(...);
 *   }, tenantId, userId);
 * }
 * ```
 */
@Injectable({ scope: Scope.REQUEST })
export class PrismaTransactionService {
  private readonly logger = new Logger(PrismaTransactionService.name);
  private tx: Prisma.TransactionClient | null = null;
  private tenantId: string | null = null;
  private userId: string | null = null;

  constructor(
    @Inject(PRISMA_CLIENT_TOKEN)
    private readonly prisma: PrismaClient,
  ) {}

  /**
   * Get the active client (transaction or regular)
   *
   * Returns transaction client if in transaction, otherwise regular client.
   */
  get client(): PrismaClient | Prisma.TransactionClient {
    return this.tx ?? this.prisma;
  }

  /**
   * Run operations in a transaction with RLS context
   *
   * This is the CORRECT way to handle transactions with RLS:
   * 1. Starts transaction
   * 2. Sets RLS context (SET LOCAL - transaction-scoped)
   * 3. Executes operations
   * 4. Commits or rolls back
   * 5. Clears context automatically
   *
   * @param fn - Function to execute in transaction
   * @param tenantId - Tenant ID for RLS context
   * @param userId - Optional user ID for RLS context
   * @returns Result of the transaction
   */
  async runInTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    tenantId: string,
    userId?: string,
  ): Promise<T> {
    // If a request-level RLS scope is active (opened by RlsTenantInterceptor on
    // the app_runtime client), reuse its transaction so this work runs RLS-
    // enforced under the request's tenant GUC. Covers @TenantScoped routes.
    const scopedTx = currentRlsTx();
    if (scopedTx) {
      return fn(scopedTx);
    }

    if (this.tx) {
      // Already in transaction - reuse it
      // RLS context should already be set
      return fn(this.tx);
    }

    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        this.tx = tx;
        this.tenantId = tenantId;
        this.userId = userId ?? null;

        try {
          // Set RLS context inside transaction
          // SET LOCAL is transaction-scoped, perfect for this
          await setContext(tx as unknown as PrismaClient, tenantId, userId);

          const result = await fn(tx);

          return result;
        } catch (error) {
          this.logger.error('Transaction error', error);
          throw error;
        } finally {
          // Context is cleared automatically when transaction ends
          // But we clear our references
          this.tx = null;
          this.tenantId = null;
          this.userId = null;
        }
      },
      {
        // Transaction options
        maxWait: 5000, // Max time to wait for transaction
        timeout: 10000, // Max time transaction can run
      },
    );
  }

  /**
   * Set RLS context for non-transactional operations
   *
   * Use this when you need RLS context but don't need a transaction.
   * WARNING: This uses session-level context, not transaction-scoped.
   * Prefer runInTransaction() when possible.
   */
  async setContext(tenantId: string, userId?: string): Promise<void> {
    this.tenantId = tenantId;
    this.userId = userId ?? null;
    await setContext(this.prisma, tenantId, userId);
  }

  /**
   * Clear RLS context
   *
   * Should be called in cleanup (interceptor, guard, etc.)
   */
  async clearContext(): Promise<void> {
    if (this.tenantId) {
      await clearContext(this.prisma);
      this.tenantId = null;
      this.userId = null;
    }
  }

  /**
   * Check if currently in a transaction
   */
  get isInTransaction(): boolean {
    return this.tx !== null;
  }
}
