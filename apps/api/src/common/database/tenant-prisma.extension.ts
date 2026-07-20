import { PrismaClient, Prisma } from '@workspace/database';

/**
 * Tenant-Aware Prisma Extension (defense-in-depth, second layer)
 *
 * Auto-injects `tenantId` into queries so application code is tenant-safe by
 * default. This is the ergonomic SECOND layer behind Postgres RLS — RLS
 * (row-level policies + a per-request `app.current_tenant_id` GUC) is the
 * ENFORCING layer. See docs/tenant-isolation-plan.md.
 *
 * Important limitations (why RLS is required, not optional):
 * - Prisma's single-row `update`/`delete`/`findUnique`/`findUniqueOrThrow` take
 *   a UNIQUE `where` input, so `tenantId` cannot be added to them unless a
 *   compound unique includes it. This extension therefore CANNOT tenant-scope
 *   those calls — RLS makes the cross-tenant row invisible, which is what
 *   actually blocks them. Prefer `updateMany`/`deleteMany` (which this extension
 *   does scope) when you want app-level scoping too.
 * - Models with a nullable `tenant_id` (global/system rows: Role,
 *   PermissionPool, MakerCheckerRequest) are intentionally NOT auto-filtered
 *   here — doing so would hide global rows. Their NULL-aware RLS policy handles
 *   them.
 */

/**
 * Models that own a non-null `tenant_id` and are always safe to filter by it.
 *
 * NOTE: expand this once T2 (tenant_id denormalization) lands to also cover
 * Term, Class, ClassTeacher, Assessment, Grade, Enrollment, MessageReadReceipt,
 * UserTenantRole, UserTenantPermission, SchoolSecurityPolicy and the
 * custom-role join tables. Listing a model here before it has a `tenant_id`
 * column would make every query/write on it fail, so the list tracks the
 * schema.
 */
export const STRICT_TENANT_MODELS = new Set<Prisma.ModelName>([
  'AcademicYear',
  'Course',
  'GradingSystem',
  'AuditLog',
  'Announcement',
  'Message',
  'TenantJWTConfig',
  'UserTenant',
  'Student',
  'StudentGuardian',
]);

/** Operations whose `where` accepts arbitrary filters (safe to add tenantId). */
const WHERE_SCOPED_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
]);

/** Create-style operations whose `data` should carry the tenantId. */
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

type ScopableArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
};

function injectTenantData<T>(data: T, tenantId: string): T {
  if (Array.isArray(data)) {
    return data.map((item) => ({ ...item, tenantId })) as T;
  }
  if (data && typeof data === 'object') {
    return { ...data, tenantId } as T;
  }
  return data;
}

/**
 * Pure tenant-scoping transform applied to a Prisma operation's args.
 *
 * Exported for unit testing (no DB needed). Returns the (possibly new) args to
 * forward to the underlying query. Leaves args untouched for non-tenant models
 * and for operations that cannot be safely scoped (single update/delete/
 * findUnique — see the file header).
 */
export function applyTenantScope(params: {
  operation: string;
  model?: string;
  args: unknown;
  tenantId: string;
}): unknown {
  const { operation, model, tenantId } = params;

  if (!model || !STRICT_TENANT_MODELS.has(model as Prisma.ModelName)) {
    return params.args;
  }

  const args = (params.args ?? {}) as ScopableArgs;

  // Already explicitly tenant-scoped by the caller — respect it.
  if (args.where?.tenantId !== undefined) {
    return args;
  }

  if (WHERE_SCOPED_OPS.has(operation)) {
    return { ...args, where: { ...args.where, tenantId } };
  }

  if (CREATE_OPS.has(operation)) {
    return args.data === undefined
      ? args
      : { ...args, data: injectTenantData(args.data, tenantId) };
  }

  if (operation === 'upsert') {
    // where is a unique input (can't scope); ensure the created row is owned.
    return args.create === undefined
      ? args
      : { ...args, create: { ...args.create, tenantId } };
  }

  // create-then-nothing-more, and the unscopable single-row ops
  // (update/delete/findUnique/findUniqueOrThrow) fall through unchanged — RLS
  // is the enforcing layer for those.
  return args;
}

/**
 * Wrap a Prisma client so tenant-scoped models are auto-filtered by tenantId.
 *
 * @example
 * const db = withTenant(this.client, tenantId);
 * await db.student.findMany(); // tenantId added to the where clause
 */
export function withTenant<T extends PrismaClient>(
  client: T,
  tenantId: string,
): T {
  return client.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          return query(
            applyTenantScope({ operation, model, args, tenantId }) as typeof args,
          );
        },
      },
    },
  }) as unknown as T;
}

/**
 * Create a tenant-aware client with BOTH the extension and the RLS context set.
 *
 * NOTE: the RLS context (`set_config(..., true)`) is transaction-scoped, so for
 * real isolation this must be used inside a transaction (see
 * PrismaTransactionService.runInTransaction). Outside a transaction only the
 * application-level extension applies.
 */
export async function createTenantClient(
  client: PrismaClient,
  tenantId: string,
  userId?: string,
): Promise<PrismaClient> {
  const { setContext } = await import('@workspace/database/rls');
  await setContext(client, tenantId, userId);
  return withTenant(client, tenantId);
}
