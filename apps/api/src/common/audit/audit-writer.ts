import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@workspace/database';

/**
 * Audit row writer that works under RLS.
 *
 * Two things about `audit_logs` make `prisma.auditLog.create()` the wrong tool
 * once the connection no longer bypasses row-level security (ADR-004, and every
 * connection on managed Postgres — see docs/rls-privileged-client-plan.md):
 *
 * 1. `create()` always emits `INSERT ... RETURNING`, and RETURNING is checked
 *    against the policy's USING clause, not just WITH CHECK. Platform-level rows
 *    (`tenant_id IS NULL`) are deliberately readable only under the audited
 *    platform bypass, so the insert succeeds and then fails on the way out with
 *    "new row violates row-level security policy". This writer issues a plain
 *    INSERT with no RETURNING; nothing needs the row back.
 *
 * 2. A tenant-scoped row still has to satisfy WITH CHECK, which requires
 *    `app.current_tenant_id`. Callers write audit rows from all over the app,
 *    including paths that hold no tenant scope, so this sets the GUC itself for
 *    the one statement — inside its own transaction, since `set_config(..., true)`
 *    is transaction-scoped.
 *
 * Failures are logged and swallowed: auditing must never take down the request
 * it is recording. That was already the convention at every call site, but it is
 * also exactly why the RLS breakage stayed invisible in production — so the log
 * line here is deliberately loud and names the action that went unrecorded.
 */
const logger = new Logger('AuditWriter');

export interface AuditLogInput {
  /** Null for platform-level events. */
  tenantId?: string | null;
  eventType: string;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  actorId?: string | null;
  actorProfileId?: string | null;
  actorRole?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  description: string;
  metadata?: unknown;
  changes?: unknown;
  status?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}

/**
 * Write one audit row. Returns whether it landed, so a caller that wants to
 * escalate an unrecorded security event can; ignoring the result keeps the
 * existing best-effort behaviour.
 */
export async function writeAuditLog(
  prisma: PrismaClient,
  data: AuditLogInput,
): Promise<boolean> {
  const tenantId = data.tenantId ?? null;

  try {
    await prisma.$transaction(async (tx) => {
      // A tenant-scoped row needs the tenant GUC to satisfy WITH CHECK. A
      // global row needs no context at all (migration
      // 20260723094500_audit_logs_global_write) — and must not get one, or it
      // would be attributed to a tenant it does not belong to.
      if (tenantId !== null) {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      }

      await tx.$executeRaw`
        INSERT INTO "audit-logging"."audit_logs" (
          "id", "tenant_id", "event_type", "action", "resource", "resource_id",
          "actor_id", "actor_profile_id", "actor_role", "actor_email",
          "ip_address", "user_agent", "request_id", "session_id",
          "description", "metadata", "changes", "status",
          "error_code", "error_message"
        ) VALUES (
          ${randomUUID()}, ${tenantId}, ${data.eventType}, ${data.action},
          ${data.resource ?? null}, ${data.resourceId ?? null},
          ${data.actorId ?? null}, ${data.actorProfileId ?? null},
          ${data.actorRole ?? null}, ${data.actorEmail ?? null},
          ${data.ipAddress ?? null}, ${data.userAgent ?? null},
          ${data.requestId ?? null}, ${data.sessionId ?? null},
          ${data.description},
          ${toJson(data.metadata)}, ${toJson(data.changes)},
          ${data.status ?? 'success'},
          ${data.errorCode ?? null}, ${data.errorMessage ?? null}
        )`;
    });

    return true;
  } catch (error) {
    logger.error(
      `Audit row NOT written (${data.action}, tenant ${tenantId ?? 'platform'}, ` +
        `actor ${data.actorId ?? 'unknown'}): ${
          error instanceof Error ? error.message : String(error)
        }`,
    );
    return false;
  }
}

/** JSONB columns take null or a JSON value; undefined is not a value. */
function toJson(value: unknown): Prisma.Sql {
  if (value === undefined || value === null) return Prisma.sql`NULL`;
  return Prisma.sql`${JSON.stringify(value)}::jsonb`;
}
