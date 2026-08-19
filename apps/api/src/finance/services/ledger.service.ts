import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { FinanceNumberingService } from './finance-numbering.service';

/**
 * The accounts the posting rules resolve by role rather than by number, so a
 * bookkeeper can renumber or rename the chart without breaking posting.
 */
export const SYSTEM_ACCOUNT = {
  CASH: 'cash',
  AR_CONTROL: 'ar_control',
  UNAPPLIED_CREDIT: 'unapplied_credit',
  OPENING_EQUITY: 'opening_balance_equity',
  FEE_INCOME: 'fee_income',
  DISCOUNTS_ALLOWED: 'discounts_allowed',
} as const;

export type SystemAccountKey =
  (typeof SYSTEM_ACCOUNT)[keyof typeof SYSTEM_ACCOUNT];

/** The starter chart every tenant gets on first posting. */
const SYSTEM_ACCOUNTS: {
  systemKey: SystemAccountKey;
  code: string;
  name: string;
  type: string;
  normalBalance: 'debit' | 'credit';
}[] = [
  {
    systemKey: SYSTEM_ACCOUNT.CASH,
    code: '1000',
    name: 'Cash & bank',
    type: 'asset',
    normalBalance: 'debit',
  },
  {
    systemKey: SYSTEM_ACCOUNT.AR_CONTROL,
    code: '1100',
    name: 'Accounts receivable (fees)',
    type: 'asset',
    normalBalance: 'debit',
  },
  {
    systemKey: SYSTEM_ACCOUNT.UNAPPLIED_CREDIT,
    code: '2100',
    name: 'Unapplied credit (fees in advance)',
    type: 'liability',
    normalBalance: 'credit',
  },
  {
    systemKey: SYSTEM_ACCOUNT.OPENING_EQUITY,
    code: '3000',
    name: 'Opening balance equity',
    type: 'equity',
    normalBalance: 'credit',
  },
  {
    systemKey: SYSTEM_ACCOUNT.FEE_INCOME,
    code: '4000',
    name: 'Fee income',
    type: 'income',
    normalBalance: 'credit',
  },
  {
    systemKey: SYSTEM_ACCOUNT.DISCOUNTS_ALLOWED,
    code: '5000',
    name: 'Discounts & waivers allowed',
    type: 'expense',
    normalBalance: 'debit',
  },
];

/** One side of an entry, addressed by the role its account plays. */
export interface PostingLine {
  account: SystemAccountKey;
  debit?: number;
  credit?: number;
  description?: string;
  invoiceId?: string | null;
  householdId?: string | null;
  studentId?: string | null;
}

export interface PostingInput {
  entryDate: Date;
  memo: string;
  /** invoice | adjustment | receipt | credit_application | opening | manual | reversal */
  sourceType: string;
  sourceId?: string | null;
  lines: PostingLine[];
  postedBy?: string | null;
}

/**
 * LedgerService — the double-entry backbone (ADR-10).
 *
 * Every subledger event that moves money or obligation posts a BALANCED entry
 * through here: an invoice issued, a discount applied, a receipt allocated,
 * credit drawn down. Nothing else writes `journal_entries`/`journal_lines`, so
 * the invariants live in one place:
 *
 *   - debits equal credits, on every entry, or it does not post;
 *   - a line is a debit or a credit, never both, never negative;
 *   - a posted entry is never edited or deleted — a mistake is corrected by a
 *     contra entry that points back at the original (parity job #95, the fix
 *     for the legacy negative-amount reversal);
 *   - nothing posts into a CLOSED accounting period.
 *
 * The chart of accounts is created lazily per tenant, together with an OPENING
 * entry that brings AR up to whatever the receivables subledger already showed
 * when the ledger was switched on — without it, the books would start life
 * disagreeing with the invoices by exactly the pre-existing debt.
 */
@Injectable()
export class LedgerService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly numbering: FinanceNumberingService,
    private readonly audit: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  // ---- Chart of accounts ----------------------------------------------

  /** Create the system accounts if this tenant has none yet. Idempotent. */
  async ensureChart(tenantId: string) {
    const existing = await this.client.chartOfAccount.findMany({
      where: { tenantId, systemKey: { not: null } },
    });
    const bySystemKey = new Map(existing.map((a) => [a.systemKey, a]));
    const missing = SYSTEM_ACCOUNTS.filter((a) => !bySystemKey.has(a.systemKey));

    for (const account of missing) {
      const created = await this.client.chartOfAccount.create({
        data: { tenantId, ...account },
      });
      bySystemKey.set(created.systemKey, created);
    }
    return bySystemKey;
  }

  listAccounts(tenantId: string) {
    return this.client.chartOfAccount.findMany({
      where: { tenantId },
      orderBy: [{ code: 'asc' }],
    });
  }

  private async resolveAccountIds(
    tenantId: string,
    keys: SystemAccountKey[],
  ): Promise<Map<string, string>> {
    const chart = await this.ensureChart(tenantId);
    const ids = new Map<string, string>();
    for (const key of keys) {
      const account = chart.get(key);
      if (!account) {
        // ensureChart just created anything missing, so this is unreachable
        // unless a tenant deliberately deleted a system account.
        throw new BadRequestException(
          `Chart of accounts is missing the "${key}" account.`,
        );
      }
      ids.set(key, account.id);
    }
    return ids;
  }

  // ---- Accounting periods ---------------------------------------------

  listPeriods(tenantId: string) {
    return this.client.accountingPeriod.findMany({
      where: { tenantId },
      orderBy: [{ startDate: 'desc' }],
    });
  }

  async createPeriod(
    tenantId: string,
    input: { name: string; startDate: string; endDate: string },
  ) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (end < start) {
      throw new BadRequestException('A period cannot end before it starts.');
    }
    const overlapping = await this.client.accountingPeriod.findFirst({
      where: {
        tenantId,
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { name: true },
    });
    if (overlapping) {
      throw new BadRequestException(
        `Those dates overlap the existing period "${overlapping.name}".`,
      );
    }
    return this.client.accountingPeriod.create({
      data: { tenantId, name: input.name, startDate: start, endDate: end },
    });
  }

  /** Close (or reopen) a period. Closing is what makes history non-editable. */
  async setPeriodStatus(
    tenantId: string,
    periodId: string,
    status: 'open' | 'closed',
    userId: string,
  ) {
    const period = await this.client.accountingPeriod.findFirst({
      where: { id: periodId, tenantId },
    });
    if (!period) throw new NotFoundException('Accounting period not found');
    if (period.status === status) return period;

    const updated = await this.client.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status,
        closedBy: status === 'closed' ? userId : null,
        closedAt: status === 'closed' ? new Date() : null,
      },
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action:
        status === 'closed'
          ? 'finance_period_closed'
          : 'finance_period_reopened',
      resource: 'accounting_period',
      resourceId: periodId,
      actorId: userId,
      description: `Accounting period "${period.name}" ${status === 'closed' ? 'closed' : 'reopened'}`,
      metadata: { periodId, name: period.name, status },
    });

    return updated;
  }

  /** The period a date falls in, if the tenant defines one. */
  private async periodFor(tenantId: string, date: Date) {
    return this.client.accountingPeriod.findFirst({
      where: { tenantId, startDate: { lte: date }, endDate: { gte: date } },
    });
  }

  // ---- Posting ---------------------------------------------------------

  /**
   * Post one balanced entry. Throws rather than posting anything unbalanced —
   * an out-of-balance ledger is worse than a failed request, because it is
   * discovered months later by whoever is trying to reconcile.
   */
  async post(tenantId: string, input: PostingInput) {
    const lines = input.lines.filter(
      (l) => (l.debit ?? 0) !== 0 || (l.credit ?? 0) !== 0,
    );
    if (lines.length < 2) {
      throw new BadRequestException(
        'A journal entry needs at least two non-zero lines.',
      );
    }

    let debits = 0;
    let credits = 0;
    for (const line of lines) {
      const debit = line.debit ?? 0;
      const credit = line.credit ?? 0;
      if (debit < 0 || credit < 0) {
        throw new BadRequestException(
          'Journal amounts are never negative — post the other side instead.',
        );
      }
      if (debit > 0 && credit > 0) {
        throw new BadRequestException(
          'A journal line is either a debit or a credit, not both.',
        );
      }
      debits += debit;
      credits += credit;
    }
    if (debits !== credits) {
      throw new BadRequestException(
        `Journal entry does not balance: debits ${debits} ≠ credits ${credits}.`,
      );
    }

    const period = await this.periodFor(tenantId, input.entryDate);
    if (period?.status === 'closed') {
      throw new BadRequestException(
        `The accounting period "${period.name}" is closed. Date the correction in an open period instead.`,
      );
    }

    const accountIds = await this.resolveAccountIds(
      tenantId,
      lines.map((l) => l.account),
    );
    const entryNumber = await this.numbering.next(
      tenantId,
      'journal',
      input.entryDate,
    );

    return this.client.journalEntry.create({
      data: {
        tenantId,
        entryNumber,
        entryDate: input.entryDate,
        periodId: period?.id ?? null,
        memo: input.memo,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        postedBy: input.postedBy ?? null,
        lines: {
          create: lines.map((line) => ({
            tenantId,
            accountId: accountIds.get(line.account)!,
            debit: line.debit ?? 0,
            credit: line.credit ?? 0,
            description: line.description ?? null,
            invoiceId: line.invoiceId ?? null,
            householdId: line.householdId ?? null,
            studentId: line.studentId ?? null,
          })),
        },
      },
      include: { lines: true },
    });
  }

  /**
   * Reverse a posted entry with a contra entry — the only way to undo. The
   * original stays exactly as posted and is marked `reversed`, so the history
   * shows what was thought at the time and what corrected it.
   */
  async reverse(
    tenantId: string,
    entryId: string,
    userId: string,
    reason?: string,
    entryDate: Date = new Date(),
  ) {
    const original = await this.client.journalEntry.findFirst({
      where: { id: entryId, tenantId },
      include: { lines: { include: { account: true } } },
    });
    if (!original) throw new NotFoundException('Journal entry not found');
    if (original.status === 'reversed') {
      throw new BadRequestException('That entry has already been reversed.');
    }

    const period = await this.periodFor(tenantId, entryDate);
    if (period?.status === 'closed') {
      throw new BadRequestException(
        `The accounting period "${period.name}" is closed. Date the reversal in an open period instead.`,
      );
    }

    const entryNumber = await this.numbering.next(
      tenantId,
      'journal',
      entryDate,
    );
    const reversal = await this.client.journalEntry.create({
      data: {
        tenantId,
        entryNumber,
        entryDate,
        periodId: period?.id ?? null,
        memo: reason
          ? `Reversal of ${original.entryNumber} — ${reason}`
          : `Reversal of ${original.entryNumber}`,
        sourceType: 'reversal',
        sourceId: original.id,
        reversalOfId: original.id,
        postedBy: userId,
        lines: {
          create: original.lines.map((line) => ({
            tenantId,
            accountId: line.accountId,
            // The sides swap; that is the whole of a contra entry.
            debit: line.credit,
            credit: line.debit,
            description: line.description,
            invoiceId: line.invoiceId,
            householdId: line.householdId,
            studentId: line.studentId,
          })),
        },
      },
      include: { lines: true },
    });

    await this.client.journalEntry.update({
      where: { id: original.id },
      data: { status: 'reversed' },
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'finance_journal_reversed',
      resource: 'journal_entry',
      resourceId: original.id,
      actorId: userId,
      description: `Journal entry ${original.entryNumber} reversed by ${reversal.entryNumber}`,
      metadata: { reason: reason ?? null, reversalId: reversal.id },
    });

    return reversal;
  }

  /** Reverse whatever a given subledger event posted, if anything. */
  async reverseSource(
    tenantId: string,
    sourceType: string,
    sourceId: string,
    userId: string,
    reason?: string,
  ) {
    const entries = await this.client.journalEntry.findMany({
      where: { tenantId, sourceType, sourceId, status: 'posted' },
      select: { id: true },
    });
    const reversals = [];
    for (const entry of entries) {
      reversals.push(await this.reverse(tenantId, entry.id, userId, reason));
    }
    return reversals;
  }

  // ---- Opening balance -------------------------------------------------

  /**
   * Bring the ledger up to the receivables the subledger already carried when
   * double-entry was switched on: DR receivables for what was outstanding, CR
   * opening-balance equity. Without it, a school that had invoices before this
   * release would show a permanent reconciliation difference equal to its
   * pre-existing debt.
   *
   * Only invoices whose charge was never posted count — an invoice issued
   * THROUGH the ledger is already there, and counting it again would state the
   * receivable twice. That exclusion is also what makes this safe to call on
   * every mutation: a school that started life with the ledger never has
   * anything to open, so nothing is ever posted.
   *
   * Call it BEFORE writing subledger rows, so the opening figure is the debt as
   * it stood before whatever is about to happen.
   */
  async ensureOpeningBalance(tenantId: string, userId?: string | null) {
    const existing = await this.client.journalEntry.findFirst({
      where: { tenantId, sourceType: 'opening' },
      select: { id: true },
    });
    if (existing) return null;

    const [invoices, posted] = await Promise.all([
      this.client.feeInvoice.findMany({
        where: { tenantId, status: { notIn: ['draft', 'cancelled'] } },
        select: {
          id: true,
          lines: { select: { amount: true, quantity: true } },
          adjustments: {
            where: { status: 'applied' },
            select: { amount: true },
          },
          allocations: { select: { amount: true } },
          creditApplications: { select: { amount: true } },
        },
      }),
      this.client.journalEntry.findMany({
        where: { tenantId, sourceType: 'invoice' },
        select: { sourceId: true },
      }),
    ]);

    const alreadyInTheLedger = new Set(posted.map((entry) => entry.sourceId));
    let outstanding = 0;
    for (const invoice of invoices) {
      if (alreadyInTheLedger.has(invoice.id)) continue;
      const gross = invoice.lines.reduce(
        (sum, line) => sum + line.amount * line.quantity,
        0,
      );
      const discounts = invoice.adjustments.reduce((s, a) => s + a.amount, 0);
      const settled =
        invoice.allocations.reduce((s, a) => s + a.amount, 0) +
        invoice.creditApplications.reduce((s, c) => s + c.amount, 0);
      outstanding += Math.max(0, gross - discounts - settled);
    }

    // Nothing owed from before the ledger — the ordinary case for any school
    // that started here. No entry to post.
    if (outstanding <= 0) return null;

    return this.post(tenantId, {
      entryDate: new Date(),
      memo: 'Opening receivables balance at ledger start',
      sourceType: 'opening',
      lines: [
        {
          account: SYSTEM_ACCOUNT.AR_CONTROL,
          debit: outstanding,
          description: 'Outstanding fee invoices at ledger start',
        },
        {
          account: SYSTEM_ACCOUNT.OPENING_EQUITY,
          credit: outstanding,
          description: 'Opening balance equity',
        },
      ],
      postedBy: userId ?? null,
    });
  }

  // ---- Reads -----------------------------------------------------------

  async listEntries(
    tenantId: string,
    query: {
      from?: string;
      to?: string;
      sourceType?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Prisma.JournalEntryWhereInput = { tenantId };
    if (query.from || query.to) {
      where.entryDate = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.sourceType) where.sourceType = query.sourceType;

    const take = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const skip = Math.max(query.offset ?? 0, 0);

    const [rows, total] = await Promise.all([
      this.client.journalEntry.findMany({
        where,
        include: { lines: { include: { account: true } } },
        orderBy: [{ entryDate: 'desc' }, { entryNumber: 'desc' }],
        take,
        skip,
      }),
      this.client.journalEntry.count({ where }),
    ]);

    return {
      data: rows.map((entry) => ({
        ...entry,
        totalDebit: entry.lines.reduce((s, l) => s + l.debit, 0),
        totalCredit: entry.lines.reduce((s, l) => s + l.credit, 0),
      })),
      total,
      limit: take,
      offset: skip,
    };
  }

  async getEntry(tenantId: string, id: string) {
    const entry = await this.client.journalEntry.findFirst({
      where: { id, tenantId },
      include: { lines: { include: { account: true } }, period: true },
    });
    if (!entry) throw new NotFoundException('Journal entry not found');
    return entry;
  }

  /**
   * Trial balance — every account with its debit and credit totals and a signed
   * balance on its normal side. If `outOfBalance` is ever non-zero the ledger
   * has been written by something other than `post()`.
   */
  async trialBalance(tenantId: string, query: { from?: string; to?: string }) {
    await this.ensureChart(tenantId);
    await this.ensureOpeningBalance(tenantId);

    const entryWhere: Prisma.JournalEntryWhereInput = { tenantId };
    if (query.from || query.to) {
      entryWhere.entryDate = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const [accounts, grouped] = await Promise.all([
      this.client.chartOfAccount.findMany({
        where: { tenantId },
        orderBy: [{ code: 'asc' }],
      }),
      this.client.journalLine.groupBy({
        by: ['accountId'],
        where: { tenantId, entry: entryWhere },
        _sum: { debit: true, credit: true },
      }),
    ]);

    const sums = new Map(grouped.map((g) => [g.accountId, g._sum]));
    let totalDebit = 0;
    let totalCredit = 0;

    const rows = accounts.map((account) => {
      const debit = sums.get(account.id)?.debit ?? 0;
      const credit = sums.get(account.id)?.credit ?? 0;
      totalDebit += debit;
      totalCredit += credit;
      const balance =
        account.normalBalance === 'debit' ? debit - credit : credit - debit;
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        systemKey: account.systemKey,
        normalBalance: account.normalBalance,
        debit,
        credit,
        balance,
      };
    });

    return {
      rows,
      totalDebit,
      totalCredit,
      outOfBalance: totalDebit - totalCredit,
    };
  }

  /** The balance of one system account — what reconciliation compares against. */
  async systemAccountBalance(
    tenantId: string,
    key: SystemAccountKey,
  ): Promise<number> {
    const chart = await this.ensureChart(tenantId);
    const account = chart.get(key);
    if (!account) return 0;
    const sum = await this.client.journalLine.aggregate({
      where: { tenantId, accountId: account.id },
      _sum: { debit: true, credit: true },
    });
    const debit = sum._sum.debit ?? 0;
    const credit = sum._sum.credit ?? 0;
    return account.normalBalance === 'debit' ? debit - credit : credit - debit;
  }
}
