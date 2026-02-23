import { Injectable, Logger } from '@nestjs/common';
import { PrismaTransactionService } from './prisma-transaction.service';

/**
 * Example Service: Demonstrating PrismaTransactionService Usage
 *
 * This is a reference implementation showing how to use PrismaTransactionService
 * for request-scoped transactions with RLS context.
 *
 * Key patterns demonstrated:
 * 1. Injecting PrismaTransactionService (request-scoped)
 * 2. Using runInTransaction() for atomic operations
 * 3. Automatic RLS context management
 * 4. Nested transaction handling
 */
@Injectable()
export class ExampleTransactionService {
  private readonly logger = new Logger(ExampleTransactionService.name);

  constructor(private readonly prismaTx: PrismaTransactionService) {}

  /**
   * Example 1: Simple transaction with RLS context
   *
   * Creates a user and profile atomically within a transaction.
   * RLS context is automatically set for the transaction.
   */
  async createUserWithProfile(
    tenantId: string,
    userId: string,
    userData: { email: string; firstName?: string; lastName?: string },
    profileData?: { status?: string },
  ) {
    return this.prismaTx.runInTransaction(
      async (tx) => {
        // RLS context is automatically set (tenantId, userId)
        // All queries in this transaction will use the RLS context

        // Create user
        const user = await tx.user.create({
          data: {
            id: userId,
            email: userData.email,
            ...(userData.firstName ? { firstName: userData.firstName } : {}),
            ...(userData.lastName ? { lastName: userData.lastName } : {}),
          },
        });

        // Create user-tenant profile in same transaction
        const profile = await tx.userTenant.create({
          data: {
            userId: user.id,
            tenantId,
            status: profileData?.status ?? 'active',
          },
        });

        this.logger.log(
          `Created user ${user.id} with profile ${profile.id} in transaction`,
        );

        return { user, profile };
      },
      tenantId,
      userId,
    );
  }

  /**
   * Example 2: Transaction with error handling
   *
   * If any operation fails, the entire transaction rolls back.
   */
  async transferDataBetweenTenants(
    sourceTenantId: string,
    targetTenantId: string,
    userTenantId: string,
    userId: string,
  ) {
    try {
      return await this.prismaTx.runInTransaction(
        async (tx) => {
          // Read from source tenant
          // Note: RLS context is set to sourceTenantId
          const sourceProfile = await tx.userTenant.findUnique({
            where: { id: userTenantId },
          });

          if (!sourceProfile) {
            throw new Error(`UserTenant ${userTenantId} not found`);
          }

          // Create profile in target tenant if it doesn't exist
          const existingTargetProfile = await tx.userTenant.findFirst({
            where: {
              userId: sourceProfile.userId,
              tenantId: targetTenantId,
            },
          });

          const targetProfile =
            existingTargetProfile ??
            (await tx.userTenant.create({
              data: {
                userId: sourceProfile.userId,
                tenantId: targetTenantId,
                status: 'active',
              },
            }));

          return targetProfile;
        },
        sourceTenantId,
        userId,
      );
    } catch (error) {
      this.logger.error('Transaction failed, rolled back', error);
      throw error;
    }
  }

  /**
   * Example 3: Nested transaction handling
   *
   * If already in a transaction, runInTransaction() reuses it.
   */
  async createUserWithNestedOperations(
    tenantId: string,
    userId: string,
    userData: { email: string; firstName?: string; lastName?: string },
  ) {
    return this.prismaTx.runInTransaction(
      async (tx) => {
        // Main transaction
        const user = await tx.user.create({
          data: {
            id: userId,
            email: userData.email,
            ...(userData.firstName ? { firstName: userData.firstName } : {}),
            ...(userData.lastName ? { lastName: userData.lastName } : {}),
          },
        });

        // Call another method that also uses runInTransaction
        // It will reuse the same transaction
        await this.createUserSettings(tx, user.id, tenantId, userId);

        return user;
      },
      tenantId,
      userId,
    );
  }

  /**
   * Helper: find-or-create a profile using an existing transaction client.
   */
  private async findOrCreateProfile(
    client: { userTenant: PrismaTransactionService['client']['userTenant'] },
    userId: string,
    tenantId: string,
    contextUserId: string,
  ) {
    const existing = await client.userTenant.findFirst({
      where: { userId, tenantId },
    });
    if (existing) return existing;
    return client.userTenant.create({
      data: {
        userId,
        tenantId,
        status: 'active',
        addedBy: contextUserId,
      },
    });
  }

  /**
   * Create user settings within an existing transaction.
   */
  private async createUserSettings(
    tx: PrismaTransactionService['client'],
    userId: string,
    tenantId: string,
    contextUserId: string,
  ) {
    return this.findOrCreateProfile(tx, userId, tenantId, contextUserId);
  }

  /**
   * Create user settings in a new transaction.
   */
  private async createUserSettingsInTransaction(
    userId: string,
    tenantId: string,
    contextUserId: string,
  ) {
    return this.prismaTx.runInTransaction(
      async (tx) =>
        this.findOrCreateProfile(tx, userId, tenantId, contextUserId),
      tenantId,
      contextUserId,
    );
  }

  /**
   * Example 4: Non-transactional operations with RLS context
   *
   * For read-only operations that don't need transactions,
   * you can use the client directly (RLS context is set by interceptor).
   */
  async getUserProfile(tenantId: string, userId: string) {
    // RLS context should be set by RlsContextInterceptor
    // But you can also set it manually if needed
    await this.prismaTx.setContext(tenantId, userId);

    // Use the client directly (not in transaction)
    const user = await this.prismaTx.client.user.findUnique({
      where: { id: userId },
      include: { userTenants: true },
    });

    return user;
  }

  /**
   * Example 5a: Fetch users within a transaction (atomic read with RLS)
   */
  async findUsersInTransaction(tenantId: string, userId: string) {
    return this.prismaTx.runInTransaction(
      async (tx) => tx.user.findMany(),
      tenantId,
      userId,
    );
  }

  /**
   * Example 5b: Fetch users without a transaction (simple RLS-scoped read)
   */
  async findUsers(tenantId: string, userId: string) {
    await this.prismaTx.setContext(tenantId, userId);
    return this.prismaTx.client.user.findMany();
  }
}
