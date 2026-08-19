import { Injectable } from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { LedgerService, SYSTEM_ACCOUNT } from './ledger.service';
import {
  INVOICE_FINANCIALS_INCLUDE,
  computeFinancials,
} from '../invoice-financials';
import type { AgingQueryDto, CollectionsQueryDto } from '../dto/report.dto';

/** Standard receivables aging buckets, by days past due. */
const AGING_BUCKETS = [
  { key: 'current', label: 'Not yet due', from: -Infinity, to: 0 },
  { key: 'd1_30', label: '1–30 days', from: 1, to: 30 },
  { key: 'd31_60', label: '31–60 days', from: 31, to: 60 },
  { key: 'd61_90', label: '61–90 days', from: 61, to: 90 },
  { key: 'd90_plus', label: 'Over 90 days', from: 91, to: Infinity },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Most entries one export will assemble before it says it stopped. */
const EXPORT_ENTRY_CAP = 20_000;

/**
 * The three questions a bursar is asked every week — what came in, what is
 * still owed and how old it is, and do the books agree with the bills — plus
 * the journal export for a school that keeps its books elsewhere (ADR-12: we
 * hand over a file, we never take their accounting credentials).
 */
@Injectable()
export class FinanceReportingService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  // ---- Collections ------------------------------------------------------

  /** What was received in a window, by day or by method. */
  async collections(tenantId: string, query: CollectionsQueryDto) {
    const where: Prisma.PaymentWhereInput = { tenantId, status: 'completed' };
    if (query.from || query.to) {
      where.paidAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const receipts = await this.client.payment.findMany({
      where,
      select: {
        id: true,
        amount: true,
        method: true,
        paidAt: true,
        allocations: { select: { amount: true } },
      },
      orderBy: [{ paidAt: 'asc' }],
    });

    const groupBy = query.groupBy ?? 'day';
    const groups = new Map<
      string,
      { key: string; label: string; receipts: number; total: number; allocated: number }
    >();

    let total = 0;
    let allocated = 0;
    for (const receipt of receipts) {
      const receiptAllocated = receipt.allocations.reduce(
        (s, a) => s + a.amount,
        0,
      );
      total += receipt.amount;
      allocated += receiptAllocated;

      const key =
        groupBy === 'method'
          ? receipt.method
          : receipt.paidAt.toISOString().slice(0, 10);
      const bucket = groups.get(key) ?? {
        key,
        label: key,
        receipts: 0,
        total: 0,
        allocated: 0,
      };
      bucket.receipts += 1;
      bucket.total += receipt.amount;
      bucket.allocated += receiptAllocated;
      groups.set(key, bucket);
    }

    return {
      groupBy,
      groups: Array.from(groups.values()).sort((a, b) =>
        a.key.localeCompare(b.key),
      ),
      totals: {
        receipts: receipts.length,
        total,
        allocated,
        // What these receipts did not settle at the time they were taken. It is
        // NOT the credit balance held today — that has since been drawn down by
        // later invoices, and it is the `credit` control on the reconciliation
        // report. Naming it "heldAsCredit" invited exactly that confusion.
        unallocated: Math.max(0, total - allocated),
      },
    };
  }

  // ---- Aging ------------------------------------------------------------

  /**
   * Outstanding debt by how long it has been outstanding. An invoice with no
   * due date is treated as current — it has not been asked for by a date yet,
   * so calling it overdue would be an accusation the data does not support.
   */
  async aging(tenantId: string, query: AgingQueryDto) {
    const asOf = query.asOf ? new Date(query.asOf) : new Date();
    const groupBy = query.groupBy ?? 'student';

    const invoices = await this.client.feeInvoice.findMany({
      where: { tenantId, status: { notIn: ['draft', 'cancelled', 'paid'] } },
      include: {
        ...INVOICE_FINANCIALS_INCLUDE,
        household: { select: { name: true } },
      },
    });

    const buckets = new Map(
      AGING_BUCKETS.map((b) => [b.key, { ...b, total: 0, invoices: 0 }]),
    );
    const rows = new Map<
      string,
      {
        key: string;
        label: string;
        total: number;
        buckets: Record<string, number>;
      }
    >();
    let total = 0;

    for (const invoice of invoices) {
      const balance = computeFinancials(invoice).balance;
      if (balance <= 0) continue;

      const daysPastDue = invoice.dueDate
        ? Math.floor((asOf.getTime() - invoice.dueDate.getTime()) / DAY_MS)
        : 0;
      const bucket =
        AGING_BUCKETS.find(
          (b) => daysPastDue >= b.from && daysPastDue <= b.to,
        ) ?? AGING_BUCKETS[0];

      const tally = buckets.get(bucket.key)!;
      tally.total += balance;
      tally.invoices += 1;
      total += balance;

      const key =
        (groupBy === 'household' ? invoice.householdId : invoice.studentId) ??
        'unassigned';
      const label =
        (groupBy === 'household'
          ? invoice.household?.name
          : invoice.studentName) ?? 'Unassigned';
      const row = rows.get(key) ?? {
        key,
        label,
        total: 0,
        buckets: Object.fromEntries(AGING_BUCKETS.map((b) => [b.key, 0])),
      };
      row.total += balance;
      row.buckets[bucket.key] = (row.buckets[bucket.key] ?? 0) + balance;
      rows.set(key, row);
    }

    return {
      asOf: asOf.toISOString().slice(0, 10),
      groupBy,
      buckets: Array.from(buckets.values()).map((b) => ({
        key: b.key,
        label: b.label,
        total: b.total,
        invoices: b.invoices,
      })),
      rows: Array.from(rows.values()).sort((a, b) => b.total - a.total),
      total,
    };
  }

  // ---- Reconciliation ---------------------------------------------------

  /**
   * Does the ledger agree with the bills? Three control totals, each with the
   * subledger figure, the GL figure and the difference. A non-zero difference
   * is the signal that something wrote money outside the posting rules — which
   * is exactly what a control account is for.
   */
  async reconciliation(tenantId: string) {
    await this.ledger.ensureChart(tenantId);
    await this.ledger.ensureOpeningBalance(tenantId);

    const [invoices, creditSum, postedReceipts, trial] = await Promise.all([
      this.client.feeInvoice.findMany({
        where: { tenantId, status: { notIn: ['draft', 'cancelled'] } },
        include: INVOICE_FINANCIALS_INCLUDE,
      }),
      this.client.accountCredit.aggregate({
        where: { tenantId, status: { not: 'void' } },
        _sum: { remaining: true },
      }),
      // Only receipts the ledger actually knows about: one taken before the
      // ledger existed was never posted (its effect is inside the opening
      // balance), and a reversed one has been withdrawn from the books. Summing
      // every receipt ever would show a school that upgraded a permanent,
      // meaningless cash difference equal to its entire payment history.
      this.client.journalEntry.findMany({
        where: { tenantId, sourceType: 'receipt', status: 'posted' },
        select: { sourceId: true },
      }),
      this.ledger.trialBalance(tenantId, {}),
    ]);

    const postedReceiptIds = postedReceipts
      .map((entry) => entry.sourceId)
      .filter((id): id is string => !!id);
    const receiptSum = postedReceiptIds.length
      ? await this.client.payment.aggregate({
          where: {
            tenantId,
            status: 'completed',
            id: { in: postedReceiptIds },
          },
          _sum: { amount: true },
        })
      : { _sum: { amount: 0 } };

    const subledgerReceivable = invoices.reduce(
      (sum, invoice) => sum + computeFinancials(invoice).balance,
      0,
    );

    const [glReceivable, glCredit, glCash] = await Promise.all([
      this.ledger.systemAccountBalance(tenantId, SYSTEM_ACCOUNT.AR_CONTROL),
      this.ledger.systemAccountBalance(
        tenantId,
        SYSTEM_ACCOUNT.UNAPPLIED_CREDIT,
      ),
      this.ledger.systemAccountBalance(tenantId, SYSTEM_ACCOUNT.CASH),
    ]);

    const controls = [
      {
        key: 'receivable',
        label: 'Accounts receivable',
        subledger: subledgerReceivable,
        ledger: glReceivable,
        difference: subledgerReceivable - glReceivable,
        explanation: 'Sum of every open invoice balance vs the AR control account.',
      },
      {
        key: 'credit',
        label: 'Unapplied credit held',
        subledger: creditSum._sum.remaining ?? 0,
        ledger: glCredit,
        difference: (creditSum._sum.remaining ?? 0) - glCredit,
        explanation: 'Credit not yet drawn down vs the fees-in-advance account.',
      },
      {
        key: 'cash',
        label: 'Cash received',
        subledger: receiptSum._sum.amount ?? 0,
        ledger: glCash,
        difference: (receiptSum._sum.amount ?? 0) - glCash,
        explanation:
          'Receipts the ledger has posted vs the cash account. Receipts taken before the ledger opened sit inside the opening balance instead.',
      },
    ];

    return {
      controls,
      trialBalance: {
        totalDebit: trial.totalDebit,
        totalCredit: trial.totalCredit,
        outOfBalance: trial.outOfBalance,
      },
      balanced:
        trial.outOfBalance === 0 && controls.every((c) => c.difference === 0),
    };
  }

  // ---- Export (ADR-12 accounting adapter) --------------------------------

  /**
   * The journal as CSV, one row per line — the format every accounting package
   * can take in. This is the whole of the "integrate" half of ADR-10 for now:
   * a school that keeps books in QuickBooks/Sage/Xero exports from here rather
   * than handing us their accounting login.
   */
  async exportJournalCsv(
    tenantId: string,
    query: { from?: string; to?: string },
    userId?: string | null,
  ): Promise<string> {
    const where: Prisma.JournalEntryWhereInput = { tenantId };
    if (query.from || query.to) {
      where.entryDate = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    // Bounded: a multi-year tenant's whole journal would otherwise be
    // assembled in memory. The cap is reported in the file and in the audit
    // row rather than silently truncating — a short export that looks complete
    // is worse than one that says it is short.
    const entries = await this.client.journalEntry.findMany({
      where,
      include: { lines: { include: { account: true } } },
      orderBy: [{ entryDate: 'asc' }, { entryNumber: 'asc' }],
      take: EXPORT_ENTRY_CAP + 1,
    });
    const truncated = entries.length > EXPORT_ENTRY_CAP;
    const exported = truncated ? entries.slice(0, EXPORT_ENTRY_CAP) : entries;

    const header = [
      'entry_number',
      'entry_date',
      'status',
      'source_type',
      'source_id',
      'memo',
      'account_code',
      'account_name',
      'debit_kobo',
      'credit_kobo',
      'line_description',
      'invoice_id',
      'student_id',
    ];

    const rows = [header.join(',')];
    for (const entry of exported) {
      for (const line of entry.lines) {
        rows.push(
          [
            entry.entryNumber,
            entry.entryDate.toISOString().slice(0, 10),
            entry.status,
            entry.sourceType,
            entry.sourceId ?? '',
            entry.memo ?? '',
            line.account.code,
            line.account.name,
            String(line.debit),
            String(line.credit),
            line.description ?? '',
            line.invoiceId ?? '',
            line.studentId ?? '',
          ]
            .map((cell) => csvCell(cell))
            .join(','),
        );
      }
    }
    if (truncated) {
      rows.push(
        csvCell(
          `TRUNCATED: this export stops at ${EXPORT_ENTRY_CAP} entries. Narrow the date range to export the rest.`,
        ),
      );
    }

    // The journal is financial data leaving the building, so the export is
    // audited the way every other governed export in the product is.
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.USER_ACTION,
      action: 'finance_journal_exported',
      resource: 'journal_entry',
      actorId: userId ?? null,
      description: `Journal exported (${exported.length} entries, ${rows.length - 1} lines)`,
      metadata: {
        from: query.from ?? null,
        to: query.to ?? null,
        entries: exported.length,
        truncated,
      },
    });

    return rows.join('\n');
  }
}

/** Quote a CSV cell, and defang anything a spreadsheet would treat as a formula. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
