/**
 * WB5 · Receipts + allocations, unapplied credit, and the double-entry ledger —
 * behavioural proof on the app_runtime (RLS-enforcing) client.
 *
 * Acceptance (workbench-5):
 *   - a parent pays ONCE for two children and the receipt says which invoice
 *     each naira settled;
 *   - a part-payment leaves a real outstanding balance that an approved waiver
 *     finishes — and the waiver never touches the original charge;
 *   - an overpayment becomes CREDIT, not income, and lands on the next invoice
 *     when it is issued;
 *   - every one of those events has a balanced journal entry behind it, the
 *     trial balance nets to zero, and the AR control account agrees with the
 *     sum of open invoices to the kobo;
 *   - a closed period refuses to take a posting;
 *   - RLS isolates tenants; HTTP 401 at the boundary.
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { FinanceService } from '../src/finance/services/finance.service';
import { FinanceReceiptService } from '../src/finance/services/finance-receipt.service';
import { FinanceCreditService } from '../src/finance/services/finance-credit.service';
import { FinanceAdjustmentService } from '../src/finance/services/finance-adjustment.service';
import { FinanceReportingService } from '../src/finance/services/finance-reporting.service';
import { LedgerService, SYSTEM_ACCOUNT } from '../src/finance/services/ledger.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('Finance — receipts, allocations, credit and the ledger (WB5)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let finance: FinanceService;
  let receipts: FinanceReceiptService;
  let credits: FinanceCreditService;
  let adjustments: FinanceAdjustmentService;
  let reporting: FinanceReportingService;
  let ledger: LedgerService;

  const stamp = Date.now();
  const A = `wb5-a-${stamp}`;
  const B = `wb5-b-${stamp}`;

  let tenantAId: string;
  let tenantBId: string;
  // A school that was billing BEFORE the ledger existed — the upgrade case.
  let tenantCId: string;
  // A third, used only by the opening-balance race.
  let raceTenantId = '';
  let makerId: string;
  let checkerId: string;
  let householdId: string;
  let feeItemId: string;

  // Two siblings on one family account, plus a third bill issued later.
  const chidiId = `stu-chidi-${stamp}`;
  const adaId = `stu-ada-${stamp}`;
  let chidiInvoiceId: string;
  let adaInvoiceId: string;
  let laterInvoiceId: string;

  /**
   * Receipt dates are relative to today, not hard-coded: a receipt is dated
   * when the money arrived, and the writer refuses a date more than a day
   * ahead — so fixed future dates would make this suite fail by the calendar.
   */
  const daysAgo = (days: number) =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

  const maker = () => ({ userId: makerId, clearanceLevel: 7 });
  const checker = () => ({ userId: checkerId, clearanceLevel: 7 });

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, makerId, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, makerId, fn);

  /** A draft invoice with one line, billed to a student on the family account. */
  let seq = 0;
  async function makeInvoice(
    studentId: string,
    studentName: string,
    amount: number,
    dueDate: string,
  ) {
    seq += 1;
    const invoice = await owner.feeInvoice.create({
      data: {
        tenantId: tenantAId,
        invoiceNumber: `SEED-${stamp}-${seq}`,
        householdId,
        studentId,
        studentName,
        termName: 'First Term',
        dueDate: new Date(dueDate),
        amountDue: amount,
        status: 'draft',
      },
    });
    await owner.feeInvoiceLine.create({
      data: {
        tenantId: tenantAId,
        invoiceId: invoice.id,
        feeItemId,
        description: 'Tuition',
        amount,
        quantity: 1,
      },
    });
    return invoice.id;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    finance = app.get(FinanceService);
    receipts = app.get(FinanceReceiptService);
    credits = app.get(FinanceCreditService);
    adjustments = app.get(FinanceAdjustmentService);
    reporting = app.get(FinanceReportingService);
    ledger = app.get(LedgerService);

    const [ta, tb, tc, mk, ck] = await Promise.all([
      owner.tenant.create({
        data: { name: 'WB5 A', slug: A, status: 'active', schoolType: 'secondary' },
      }),
      owner.tenant.create({
        data: { name: 'WB5 B', slug: B, status: 'active', schoolType: 'secondary' },
      }),
      owner.tenant.create({
        data: {
          name: 'WB5 C',
          slug: `wb5-c-${stamp}`,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.user.create({
        data: { email: `wb5-maker-${stamp}@a.test`, isActive: true },
      }),
      owner.user.create({
        data: { email: `wb5-checker-${stamp}@a.test`, isActive: true },
      }),
    ]);
    tenantAId = ta.id;
    tenantBId = tb.id;
    tenantCId = tc.id;
    makerId = mk.id;
    checkerId = ck.id;

    const household = await owner.billingHousehold.create({
      data: {
        tenantId: tenantAId,
        name: 'Okonkwo family',
        primaryPayerName: 'Mrs Adaeze Okonkwo',
      },
    });
    householdId = household.id;
    await owner.householdPayer.createMany({
      data: [
        {
          tenantId: tenantAId,
          householdId,
          guardianId: `gdn-${stamp}`,
          payerName: 'Mrs Adaeze Okonkwo',
          role: 'primary',
        },
      ],
    });
    await owner.householdMember.createMany({
      data: [
        { tenantId: tenantAId, householdId, studentId: chidiId, studentName: 'Chidi Okonkwo' },
        { tenantId: tenantAId, householdId, studentId: adaId, studentName: 'Ada Okonkwo' },
      ],
    });

    const feeItem = await owner.feeItem.create({
      data: { tenantId: tenantAId, code: 'tuition', name: 'Tuition' },
    });
    feeItemId = feeItem.id;

    chidiInvoiceId = await makeInvoice(chidiId, 'Chidi Okonkwo', 200_000, '2026-09-15');
    adaInvoiceId = await makeInvoice(adaId, 'Ada Okonkwo', 150_000, '2026-09-15');
  });

  afterAll(async () => {
    if (owner) {
      await owner.tenant
        .deleteMany({
          where: {
            id: { in: [tenantAId, tenantBId, tenantCId, raceTenantId] },
          },
        })
        .catch(() => undefined);
      await owner.user
        .deleteMany({ where: { id: { in: [makerId, checkerId] } } })
        .catch(() => undefined);
      await owner.$disconnect();
    }
    await app?.close();
  });

  it('issuing a bill posts the charge: receivable up, fee income up', async () => {
    await inA(async () => {
      await finance.updateInvoice(tenantAId, chidiInvoiceId, { status: 'issued' }, makerId);
      await finance.updateInvoice(tenantAId, adaInvoiceId, { status: 'issued' }, makerId);

      const trial = await ledger.trialBalance(tenantAId, {});
      expect(trial.outOfBalance).toBe(0);

      const receivable = trial.rows.find((r) => r.systemKey === SYSTEM_ACCOUNT.AR_CONTROL);
      const income = trial.rows.find((r) => r.systemKey === SYSTEM_ACCOUNT.FEE_INCOME);
      expect(receivable?.balance).toBe(350_000);
      expect(income?.balance).toBe(350_000);
    });
  });

  it('one payment settles two siblings, and the receipt says which naira went where', async () => {
    const receipt = await inA(() =>
      receipts.recordReceipt(
        tenantAId,
        {
          householdId,
          method: 'transfer',
          paidAt: daysAgo(9),
          amount: 250_000,
          reference: 'TRF-0001',
          allocations: [
            { invoiceId: chidiInvoiceId, amount: 200_000 },
            { invoiceId: adaInvoiceId, amount: 50_000 },
          ],
        },
        makerId,
      ),
    );

    // A sequenced, year-scoped receipt number — not a timestamp.
    expect(receipt.receiptNumber).toMatch(/^RCT-\d{4}-\d{6}$/);
    expect(receipt.payerName).toBe('Mrs Adaeze Okonkwo');
    expect(receipt.coveredStudents.sort()).toEqual(['Ada Okonkwo', 'Chidi Okonkwo']);
    expect(receipt.allocatedAmount).toBe(250_000);
    expect(receipt.unallocatedAmount).toBe(0);

    await inA(async () => {
      const chidi = await finance.getInvoice(tenantAId, chidiInvoiceId);
      const ada = await finance.getInvoice(tenantAId, adaInvoiceId);

      // Chidi's bill is settled in full; Ada's keeps a real outstanding balance.
      expect(chidi.status).toBe('paid');
      expect(chidi.financials.balance).toBe(0);
      expect(ada.status).toBe('partial');
      expect(ada.financials.balance).toBe(100_000);

      // The ledger moved cash in and receivables down by the same 250,000.
      const cash = await ledger.systemAccountBalance(tenantAId, SYSTEM_ACCOUNT.CASH);
      const receivable = await ledger.systemAccountBalance(
        tenantAId,
        SYSTEM_ACCOUNT.AR_CONTROL,
      );
      expect(cash).toBe(250_000);
      expect(receivable).toBe(100_000);
    });
  });

  it('refuses to settle more than an invoice owes, or more than was received', async () => {
    await expect(
      inA(() =>
        receipts.recordReceipt(
          tenantAId,
          {
            householdId,
            method: 'cash',
            paidAt: daysAgo(8),
            amount: 500_000,
            allocations: [{ invoiceId: adaInvoiceId, amount: 500_000 }],
          },
          makerId,
        ),
      ),
    ).rejects.toThrow(/only has 100000 kobo outstanding/);

    await expect(
      inA(() =>
        receipts.recordReceipt(
          tenantAId,
          {
            householdId,
            method: 'cash',
            paidAt: daysAgo(8),
            amount: 10_000,
            allocations: [{ invoiceId: adaInvoiceId, amount: 50_000 }],
          },
          makerId,
        ),
      ),
    ).rejects.toThrow(/more than the money received/);
  });

  it('an approved waiver clears the rest without touching the original charge', async () => {
    await inA(async () => {
      const pending = await adjustments.requestAdjustment(tenantAId, maker(), {
        invoiceId: adaInvoiceId,
        type: 'waiver',
        amount: 100_000,
        reason: 'Hardship — agreed with the head',
      });
      expect(pending.status).toBe('pending');

      // The maker cannot sign off their own waiver.
      await expect(
        adjustments.approveAdjustment(tenantAId, maker(), pending.id),
      ).rejects.toBeTruthy();

      await adjustments.approveAdjustment(tenantAId, checker(), pending.id);

      const ada = await finance.getInvoice(tenantAId, adaInvoiceId);
      expect(ada.status).toBe('paid');
      expect(ada.financials.balance).toBe(0);
      // The bill still says what was billed; the discount sits beside it.
      expect(ada.financials.gross).toBe(150_000);
      expect(ada.financials.discounts).toBe(100_000);

      const receivable = await ledger.systemAccountBalance(
        tenantAId,
        SYSTEM_ACCOUNT.AR_CONTROL,
      );
      expect(receivable).toBe(0);
    });
  });

  it('an overpayment is held as credit, not booked as income', async () => {
    const receipt = await inA(() =>
      receipts.recordReceipt(
        tenantAId,
        {
          householdId,
          method: 'cash',
          paidAt: daysAgo(7),
          amount: 80_000,
          notes: 'Paid ahead for next term',
        },
        makerId,
      ),
    );
    expect(receipt.unallocatedAmount).toBe(80_000);

    await inA(async () => {
      const held = await credits.availableCredit(tenantAId, { householdId });
      expect(held).toBe(80_000);

      const income = await ledger.systemAccountBalance(
        tenantAId,
        SYSTEM_ACCOUNT.FEE_INCOME,
      );
      const creditHeld = await ledger.systemAccountBalance(
        tenantAId,
        SYSTEM_ACCOUNT.UNAPPLIED_CREDIT,
      );
      // Income is unchanged by money received in advance; the liability rose.
      expect(income).toBe(350_000);
      expect(creditHeld).toBe(80_000);
    });
  });

  it('the held credit lands on the next invoice the moment it is issued', async () => {
    laterInvoiceId = await makeInvoice(chidiId, 'Chidi Okonkwo', 120_000, '2027-01-15');

    await inA(async () => {
      await finance.updateInvoice(tenantAId, laterInvoiceId, { status: 'issued' }, makerId);

      const later = await finance.getInvoice(tenantAId, laterInvoiceId);
      expect(later.financials.credited).toBe(80_000);
      expect(later.financials.balance).toBe(40_000);
      expect(later.status).toBe('partial');

      const remaining = await credits.availableCredit(tenantAId, { householdId });
      expect(remaining).toBe(0);
    });
  });

  it('the books agree with the bills — trial balance and every control total', async () => {
    await inA(async () => {
      const report = await reporting.reconciliation(tenantAId);
      expect(report.trialBalance.outOfBalance).toBe(0);
      for (const control of report.controls) {
        expect({ [control.key]: control.difference }).toEqual({ [control.key]: 0 });
      }
      expect(report.balanced).toBe(true);
    });
  });

  it('ages what is still owed, and reports what was collected', async () => {
    await inA(async () => {
      const aging = await reporting.aging(tenantAId, { asOf: '2027-02-15' });
      // Only the later invoice is still open: 40,000, 31 days past its due date.
      expect(aging.total).toBe(40_000);
      expect(aging.buckets.find((b) => b.key === 'd31_60')?.total).toBe(40_000);

      const collections = await reporting.collections(tenantAId, {});
      expect(collections.totals).toMatchObject({
        receipts: 2,
        total: 330_000,
        allocated: 250_000,
        unallocated: 80_000,
      });
    });
  });

  it('a closed period refuses a posting, and reopening lets it through', async () => {
    await inA(async () => {
      const period = await ledger.createPeriod(tenantAId, {
        name: `Closed window ${stamp}`,
        startDate: '2027-03-01',
        endDate: '2027-03-31',
      });
      await ledger.setPeriodStatus(tenantAId, period.id, 'closed', makerId);

      const postIntoClosed = () =>
        ledger.post(tenantAId, {
          entryDate: new Date('2027-03-15'),
          memo: 'Late correction',
          sourceType: 'manual',
          lines: [
            { account: SYSTEM_ACCOUNT.CASH, debit: 1_000 },
            { account: SYSTEM_ACCOUNT.AR_CONTROL, credit: 1_000 },
          ],
        });

      await expect(postIntoClosed()).rejects.toThrow(/is closed/);

      await ledger.setPeriodStatus(tenantAId, period.id, 'open', makerId);
      const entry = await postIntoClosed();
      expect(entry.periodId).toBe(period.id);

      // …and that correction is undone by a reversal, never by an edit.
      const reversal = await ledger.reverse(tenantAId, entry.id, makerId, 'Test correction');
      expect(reversal.reversalOfId).toBe(entry.id);
      const trial = await ledger.trialBalance(tenantAId, {});
      expect(trial.outOfBalance).toBe(0);
    });
  });

  it('exports the journal for an external accounting system', async () => {
    const csv = await inA(() => reporting.exportJournalCsv(tenantAId, {}));
    const lines = csv.split('\n');
    expect(lines[0]).toContain('entry_number,entry_date');
    // Every receivables event we exercised is in the file.
    expect(csv).toMatch(/,invoice,/);
    expect(csv).toMatch(/,receipt,/);
    expect(csv).toMatch(/,adjustment,/);
    expect(csv).toMatch(/,credit_application,/);
  });

  it('refuses to issue the same invoice twice, so the charge posts once', async () => {
    await inA(async () => {
      // `laterInvoiceId` is `partial` — held credit settled part of it.
      await expect(
        finance.updateInvoice(
          tenantAId,
          laterInvoiceId,
          { status: 'issued' },
          makerId,
        ),
      ).rejects.toThrow(/only a draft can be issued/);

      const entries = await ledger.listEntries(tenantAId, {
        sourceType: 'invoice',
      });
      const forInvoice = entries.data.filter(
        (entry) => entry.sourceId === laterInvoiceId,
      );
      expect(forInvoice).toHaveLength(1);
    });
  });

  it('will not waive more than an invoice still owes', async () => {
    await inA(async () => {
      await expect(
        adjustments.requestAdjustment(tenantAId, maker(), {
          invoiceId: laterInvoiceId,
          type: 'waiver',
          amount: 999_999,
          reason: 'Too much',
        }),
      ).rejects.toThrow(/kobo outstanding/);
    });
  });

  it('opens the books exactly once, even when two readers race for it', async () => {
    // A school that WAS billing before the ledger existed, so there is a real
    // opening to post — the previous version of this test used a tenant with
    // nothing outstanding, so `ensureOpeningBalance` returned early and the
    // assertion held with the guard and the unique index both removed.
    const raceTenant = await owner.tenant.create({
      data: {
        name: 'WB5 race',
        slug: `wb5-race-${stamp}`,
        status: 'active',
        schoolType: 'secondary',
      },
    });
    raceTenantId = raceTenant.id;
    const item = await owner.feeItem.create({
      data: { tenantId: raceTenantId, code: 'tuition', name: 'Tuition' },
    });
    const legacy = await owner.feeInvoice.create({
      data: {
        tenantId: raceTenantId,
        invoiceNumber: `RACE-${stamp}`,
        studentId: `stu-race-${stamp}`,
        status: 'issued',
        amountDue: 300_000,
      },
    });
    await owner.feeInvoiceLine.create({
      data: {
        tenantId: raceTenantId,
        invoiceId: legacy.id,
        feeItemId: item.id,
        amount: 300_000,
        quantity: 1,
      },
    });

    // Two readers arriving together — a bursar with /finance/ledger open in one
    // tab and /finance/reports in another.
    const results = await Promise.allSettled([
      tenantDb.runScoped(raceTenantId, makerId, () =>
        ledger.trialBalance(raceTenantId, {}, makerId),
      ),
      tenantDb.runScoped(raceTenantId, checkerId, () =>
        reporting.reconciliation(raceTenantId, checkerId),
      ),
    ]);

    // One may lose the race and be told to retry; what must never happen is two
    // openings, because the trial balance cannot see that — both entries
    // balance, and the school's whole pre-existing debt is counted twice.
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    const openings = await tenantDb.runScoped(raceTenantId, makerId, () =>
      ledger.listEntries(raceTenantId, { sourceType: 'opening' }),
    );
    expect(openings.total).toBe(1);
    expect(openings.data[0]!.totalDebit).toBe(300_000);

    await tenantDb.runScoped(raceTenantId, makerId, async () => {
      const report = await reporting.reconciliation(raceTenantId, makerId);
      expect(report.controls.map((c) => c.difference)).toEqual([0, 0, 0]);
    });
  });

  it('will not let two cashiers settle the same invoice twice', async () => {
    // The row lock is the only thing standing between two tills and a
    // double-settled invoice: without it both transactions read the same
    // outstanding balance, both pass the check, and both write.
    const contested = await makeInvoice(
      chidiId,
      'Chidi Okonkwo',
      90_000,
      '2027-06-01',
    );
    await inA(() =>
      finance.updateInvoice(tenantAId, contested, { status: 'issued' }, makerId),
    );

    const takePayment = () =>
      tenantDb.runScoped(tenantAId, makerId, async () => {
        const receipt = await receipts.recordReceipt(
          tenantAId,
          {
            householdId,
            method: 'cash',
            paidAt: daysAgo(1),
            amount: 90_000,
            allocations: [{ invoiceId: contested, amount: 90_000 }],
          },
          makerId,
        );
        // Hold the lock briefly so the second transaction genuinely overlaps.
        await new Promise((resolve) => setTimeout(resolve, 250));
        return receipt;
      });

    const [first, second] = await Promise.allSettled([
      takePayment(),
      new Promise((resolve) => setTimeout(resolve, 60)).then(takePayment),
    ]);

    const settled = [first, second].filter((r) => r.status === 'fulfilled');
    const refused = [first, second].filter((r) => r.status === 'rejected');
    expect(settled).toHaveLength(1);
    expect(refused).toHaveLength(1);

    await inA(async () => {
      const invoice = await finance.getInvoice(tenantAId, contested);
      // Paid exactly once, and the ledger agrees.
      expect(invoice.financials.paid).toBe(90_000);
      expect(invoice.financials.overpaid).toBe(0);
      const report = await reporting.reconciliation(tenantAId, makerId);
      expect(report.balanced).toBe(true);
    });
  });

  it('refuses to reverse a subledger entry from the ledger surface', async () => {
    await inA(async () => {
      const receipts = await ledger.listEntries(tenantAId, {
        sourceType: 'receipt',
      });
      const entry = receipts.data[0];
      expect(entry).toBeTruthy();

      // Reversing it here would withdraw the accounting effect and leave the
      // allocation standing — the invoice would still read paid with no cash.
      await expect(
        ledger.reverse(tenantAId, entry!.id, makerId, 'Wrong family'),
      ).rejects.toThrow(/cancel or adjust that record instead/);
    });
  });

  it('cancelling withdraws the charge AND anything posted against it', async () => {
    const cancelId = await makeInvoice(adaId, 'Ada Okonkwo', 90_000, '2027-05-01');

    await inA(async () => {
      await finance.updateInvoice(
        tenantAId,
        cancelId,
        { status: 'issued' },
        makerId,
      );
      const waiver = await adjustments.requestAdjustment(tenantAId, maker(), {
        invoiceId: cancelId,
        type: 'waiver',
        amount: 30_000,
        reason: 'Partial hardship',
      });
      await adjustments.approveAdjustment(tenantAId, checker(), waiver.id);

      const before = await reporting.reconciliation(tenantAId);
      expect(before.balanced).toBe(true);

      await finance.updateInvoice(
        tenantAId,
        cancelId,
        { status: 'cancelled' },
        makerId,
      );

      // Reversing only the charge would leave the waiver's credit standing and
      // put receivables permanently below the invoices.
      const after = await reporting.reconciliation(tenantAId);
      expect(after.controls.map((c) => c.difference)).toEqual([0, 0, 0]);
      expect(after.balanced).toBe(true);
    });
  });

  it('cancels a bill that predates the ledger without stranding its discount', async () => {
    // The upgrade case: this school was billing before double-entry existed, so
    // the invoice has no charge entry — its receivable arrives inside the
    // opening balance instead. Reversing "the charge" here would find nothing,
    // and undoing the waiver on top would put the discount back into
    // receivables that nothing withdraws.
    const feeItem = await owner.feeItem.create({
      data: { tenantId: tenantCId, code: 'tuition', name: 'Tuition' },
    });
    const legacy = await owner.feeInvoice.create({
      data: {
        tenantId: tenantCId,
        invoiceNumber: `LEGACY-${stamp}`,
        studentId: `stu-legacy-${stamp}`,
        studentName: 'Legacy Student',
        status: 'issued',
        amountDue: 500_000,
      },
    });
    await owner.feeInvoiceLine.create({
      data: {
        tenantId: tenantCId,
        invoiceId: legacy.id,
        feeItemId: feeItem.id,
        amount: 500_000,
        quantity: 1,
      },
    });

    await tenantDb.runScoped(tenantCId, makerId, async () => {
      // Opening the books brings the pre-existing debt in.
      await ledger.ensureOpeningBalance(tenantCId, makerId);
      expect(
        await ledger.systemAccountBalance(tenantCId, SYSTEM_ACCOUNT.AR_CONTROL),
      ).toBe(500_000);

      const waiver = await adjustments.requestAdjustment(tenantCId, maker(), {
        invoiceId: legacy.id,
        type: 'waiver',
        amount: 200_000,
        reason: 'Legacy hardship',
      });
      await adjustments.approveAdjustment(tenantCId, checker(), waiver.id);
      expect(
        await ledger.systemAccountBalance(tenantCId, SYSTEM_ACCOUNT.AR_CONTROL),
      ).toBe(300_000);
      expect((await reporting.reconciliation(tenantCId)).balanced).toBe(true);

      await finance.updateInvoice(
        tenantCId,
        legacy.id,
        { status: 'cancelled' },
        makerId,
      );

      // The invoice is gone from the subledger, and gone from receivables — to
      // the kobo, with the waiver's own entry left standing because it is part
      // of what the withdrawal accounted for.
      expect(
        await ledger.systemAccountBalance(tenantCId, SYSTEM_ACCOUNT.AR_CONTROL),
      ).toBe(0);
      const report = await reporting.reconciliation(tenantCId);
      expect(report.controls.map((c) => c.difference)).toEqual([0, 0, 0]);
      expect(report.balanced).toBe(true);
    });
  });

  it('isolates tenants via RLS and rejects anon at the HTTP boundary', async () => {
    // Tenant B sees none of tenant A's receipts, credits or ledger.
    await inB(async () => {
      const list = await receipts.listReceipts(tenantBId, {});
      expect(list.data).toHaveLength(0);

      const entries = await ledger.listEntries(tenantBId, {});
      expect(entries.total).toBe(0);

      const held = await credits.listCredits(tenantBId, {});
      expect(held.data).toHaveLength(0);
      expect(held.total).toBe(0);
    });

    // …and cannot reach into tenant A's rows by id. Use a real RECEIPT id from
    // tenant A — passing an invoice id would throw NotFound even with RLS off,
    // so it proved nothing.
    const aReceipt = await inA(() => receipts.listReceipts(tenantAId, {}));
    const receiptId = aReceipt.data[0]!.id;
    await expect(
      inB(() => receipts.getReceipt(tenantBId, receiptId)),
    ).rejects.toBeTruthy();

    // …and cannot WRITE into tenant A either: allocating tenant A's invoice
    // from tenant B's scope must not find it.
    await expect(
      inB(() =>
        receipts.recordReceipt(
          tenantBId,
          {
            method: 'cash',
            paidAt: daysAgo(2),
            amount: 1_000,
            allocations: [{ invoiceId: chidiInvoiceId, amount: 1_000 }],
          },
          makerId,
        ),
      ),
    ).rejects.toBeTruthy();

    const http = app.getHttpServer();
    await request(http).get('/finance/receipts').expect(401);
    await request(http).post('/finance/receipts').send({}).expect(401);
    await request(http).get('/finance/ledger/trial-balance').expect(401);
    await request(http).get('/finance/reports/aging').expect(401);
  });
});
