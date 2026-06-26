import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@workspace/database';

/**
 * Per-request Row-Level-Security scope, propagated via AsyncLocalStorage so a
 * request's tenant-data services all use the SAME transaction-bound client (the
 * one with `app.current_tenant_id` set). See ADR-004 + docs/tenant-isolation-plan.md.
 */
export interface RlsScope {
  /** The transaction client bound to the connection that carries the RLS GUC. */
  tx: Prisma.TransactionClient;
  /** Active tenant id (empty string for a platform/cross-tenant scope). */
  tenantId: string;
  /** Acting user id, when known. */
  userId?: string;
  /** True when this scope used the audited `app.is_platform` bypass. */
  isPlatform?: boolean;
}

export const rlsAls = new AsyncLocalStorage<RlsScope>();

/** The current request's RLS-scoped transaction client, if inside a scope. */
export function currentRlsTx(): Prisma.TransactionClient | undefined {
  return rlsAls.getStore()?.tx;
}
