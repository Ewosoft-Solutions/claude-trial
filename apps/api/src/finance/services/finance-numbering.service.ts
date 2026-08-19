import { Injectable } from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';

/** What a sequence counts. Each gets its own per-year run of numbers. */
export type SequenceKind = 'receipt' | 'invoice' | 'journal';

const PREFIX: Record<SequenceKind, string> = {
  receipt: 'RCT',
  invoice: 'INV',
  journal: 'JE',
};

/**
 * Gap-aware, never-reused document numbers (ADR-05 Q23).
 *
 * The old `INV-${Date.now()}-${random}` was unique but unauditable: you cannot
 * tell from a list of them whether a receipt is missing, and nothing tied a
 * number to a year. A counter row per tenant + kind + fiscal year, incremented
 * with a single atomic `UPDATE … RETURNING` inside the caller's transaction,
 * gives numbers that run 0001, 0002, 0003 and can never be handed out twice —
 * a concurrent request blocks on the row until this one commits.
 *
 * A rolled-back transaction leaves a GAP in the run rather than releasing the
 * number back. That is the deliberate trade: an auditor can see a missing
 * number and ask about it, whereas a reused one would silently produce two
 * different receipts bearing the same identity.
 */
@Injectable()
export class FinanceNumberingService {
  constructor(private readonly tenantDb: TenantDbService) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  /**
   * The fiscal-year scope a date falls in — the calendar year for now, read in
   * LOCAL time to match how the rest of finance handles dates. On UTC it would
   * number a receipt taken at 00:30 WAT on 1 January into the previous year's
   * run.
   */
  scopeKeyFor(date: Date): string {
    return String(date.getFullYear());
  }

  /**
   * Take the next number for `kind` in the scope `date` falls in, e.g.
   * `RCT-2026-000042`. Must run inside the request's RLS transaction.
   */
  async next(
    tenantId: string,
    kind: SequenceKind,
    date: Date = new Date(),
  ): Promise<string> {
    const scopeKey = this.scopeKeyFor(date);
    const prefix = PREFIX[kind];

    // Create-if-absent, then increment. Both statements run in the caller's
    // transaction, so the row lock the UPDATE takes is what serialises
    // concurrent issuers.
    // `upsert` still races two first-of-the-year requests against the unique
    // index; the loser's row already exists, which is all we needed.
    try {
      await this.client.financeNumberSequence.upsert({
        where: { tenantId_kind_scopeKey: { tenantId, kind, scopeKey } },
        create: { tenantId, kind, scopeKey, prefix, nextValue: 1 },
        update: {},
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
    }

    const rows = await this.client.$queryRaw<{ next_value: number }[]>`
      UPDATE "finance"."finance_number_sequences"
         SET "next_value" = "next_value" + 1, "updated_at" = now()
       WHERE "tenant_id" = ${tenantId} AND "kind" = ${kind} AND "scope_key" = ${scopeKey}
      RETURNING "next_value" - 1 AS next_value
    `;

    const value = rows[0]?.next_value;
    if (value == null) {
      // Silently starting again at 1 would hand out a number that already
      // exists; the unique index would reject it with nothing explaining why.
      throw new Error(
        `Could not take the next ${kind} number for ${scopeKey} — the sequence row was not updated.`,
      );
    }
    return `${prefix}-${scopeKey}-${String(value).padStart(6, '0')}`;
  }
}
