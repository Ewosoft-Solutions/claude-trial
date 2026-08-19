import { Prisma } from '@workspace/database';

/**
 * Row locks for the money paths.
 *
 * Every finance write runs inside the request's single RLS transaction, but a
 * transaction on its own does not stop two cashiers settling the same invoice
 * at the same instant: under READ COMMITTED both read the same outstanding
 * balance, both pass the "does this fit?" check, and both write. The invoice
 * ends up over-settled and the receivable goes negative against it.
 *
 * So the writers take a row lock on what they are about to reason about,
 * BEFORE they read the balance. The second transaction then blocks until the
 * first commits, and re-reads the balance it actually has to respect.
 *
 * Ids are sorted so two callers touching the same set always take the locks in
 * the same order — the cheap way to avoid deadlocking a family checkout
 * against another one covering some of the same children.
 */

/** The only two tables this locks. Fixed strings — never caller-supplied. */
const LOCKABLE = {
  invoices: '"finance"."fee_invoices"',
  credits: '"finance"."account_credits"',
} as const;

async function lockRows(
  client: Prisma.TransactionClient,
  table: (typeof LOCKABLE)[keyof typeof LOCKABLE],
  tenantId: string,
  ids: string[],
): Promise<void> {
  const unique = Array.from(new Set(ids)).sort();
  if (unique.length === 0) return;

  // Values are parameterised; only the table name is interpolated, and it comes
  // from the closed set above rather than from anything a caller passes in.
  const placeholders = unique.map((_, index) => `$${index + 2}`).join(', ');
  await client.$queryRawUnsafe(
    `SELECT "id" FROM ${table} WHERE "tenant_id" = $1 AND "id" IN (${placeholders}) FOR UPDATE`,
    tenantId,
    ...unique,
  );
}

/** Lock invoices before reading what they still owe. */
export function lockInvoices(
  client: Prisma.TransactionClient,
  tenantId: string,
  invoiceIds: string[],
): Promise<void> {
  return lockRows(client, LOCKABLE.invoices, tenantId, invoiceIds);
}

/** Lock credits before reading what is left to draw on them. */
export function lockCredits(
  client: Prisma.TransactionClient,
  tenantId: string,
  creditIds: string[],
): Promise<void> {
  return lockRows(client, LOCKABLE.credits, tenantId, creditIds);
}
