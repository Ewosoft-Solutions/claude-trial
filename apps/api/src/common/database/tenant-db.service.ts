import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@workspace/database';
import { setContext } from '@workspace/database/rls';
import { TENANT_PRISMA_CLIENT_TOKEN } from './database.service';
import { rlsAls, currentRlsTx } from './rls-als';

/**
 * Tenant-scoped database access for the RLS runtime cutover (ADR-004).
 *
 * Wraps the `app_runtime` Prisma client (non-superuser, non-BYPASSRLS) so a unit
 * of work runs inside ONE interactive transaction with the tenant GUC set, and
 * exposes that transaction client to tenant-data services via AsyncLocalStorage.
 * Because all queries in the callback run on the transaction's single pinned
 * connection, Postgres RLS enforces tenant isolation.
 *
 * Auth / guards / platform code keep using the privileged `DatabaseService`
 * client — only tenant-data services should use `TenantDbService.client`.
 */
@Injectable()
export class TenantDbService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantDbService.name);

  constructor(
    @Inject(TENANT_PRISMA_CLIENT_TOKEN)
    private readonly tenantPrisma: PrismaClient,
  ) {}

  /** Close the restricted-role connection pool when Nest shuts down. */
  async onModuleDestroy(): Promise<void> {
    await this.tenantPrisma.$disconnect();
  }

  /** Run `fn` with the tenant RLS context set (`app.current_tenant_id`). */
  async runScoped<T>(
    tenantId: string,
    userId: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.tenantPrisma.$transaction(
      async (tx) => {
        await setContext(tx as unknown as PrismaClient, tenantId, userId);
        return rlsAls.run({ tx, tenantId, userId }, fn);
      },
      { maxWait: 5000, timeout: 15000 },
    );
  }

  /**
   * Run `fn` with the audited platform bypass (`app.is_platform = 'on'`), for
   * clearance-9/10 cross-tenant operations. Call sites must be authorization-gated
   * and audit-logged.
   */
  async runPlatform<T>(
    userId: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.tenantPrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_platform', 'on', true)`;
      if (userId) {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      }
      return rlsAls.run({ tx, tenantId: '', userId, isPlatform: true }, fn);
    });
  }

  /**
   * The current request's RLS-scoped client. Throws if used outside `runScoped`/
   * `runPlatform` — that guard is intentional: a tenant-data query that escapes
   * the scope would run without the GUC and (as `app_runtime`) see nothing.
   */
  get client(): Prisma.TransactionClient {
    const tx = currentRlsTx();
    if (!tx) {
      throw new Error(
        'TenantDbService.client used outside an RLS scope. Wrap the work in ' +
          'runScoped(tenantId, userId, fn) (or apply the RLS interceptor).',
      );
    }
    return tx;
  }

  /** Whether the caller is currently inside an RLS scope. */
  get isScoped(): boolean {
    return currentRlsTx() !== undefined;
  }
}
