# ADR-05 — Finance subledger: family credit + payment allocation

- **Status:** Proposed — 2026-07-31 (money-semantics choices flagged for **owner sign-off**)
- **Deciders:** engineering + **product/finance owner** — [Q20–23](../../plan/06-roadmap-and-discussion-guide.md#f--finance--accounting).
- **Scope note:** this ADR covers the **billing/receivables subledger** (fees, discounts, receipts, allocation, family credit). Whether we also build a full **general ledger** (chart of accounts/journals/statements) is a **separate** decision — see **ADR-10**.
- **Unblocks:** WB5 (Family Account + Finance), and result-visibility `FinancialHold` (ADR-04).

## Context

Our current finance is a **strong, honest MVP but structurally one-to-one**: `FeeInvoice(invoiceNumber, studentId, classId, term…, amountDue, amountPaid — in kobo, status)` + `Payment(receiptNumber, invoiceId → exactly one invoice, studentId, method, amount kobo, reference, status)`, with tenant-unique receipt/invoice numbers. Money is already in **minor units (kobo)** — so we already avoid the legacy system's negative-amount reversal anti-pattern by design.

But the corpus shows jobs our model can't express: a parent **pays once for several children of the same parent** (C082/C084, wallet keyed by shared phone); a **fee catalog** with compulsory flags + targeted charges (C087); **per-charge discounts** (editable/deletable in the legacy system — C090); **brought-forward opening debt** (C091); and Full Account reversals done as **negative amounts** (C096). Our `Payment.invoiceId` (one payment → one invoice) cannot do sibling/family allocation; there are no fee items/lines, discounts, unapplied credit, or family account.

**What breaks if we guess wrong:** every finance job (billing, allocation, discounts, refunds, statements, reconciliation, opening-balance migration) references this model, and result-visibility holds (ADR-04) reference a financial state. A one-to-one payment model or mutable discounts becomes a correctness + audit failure the first time a family pays for two kids or a discount is reversed.

## Open questions for the owner (recommended defaults in **bold**)

- **Q20 — what does "wallet" mean?** Stored value / unapplied family credit / gateway balance / a label. **Default: model explicit _unapplied family credit_ (an accounting construct), not stored value** — avoids e-money/regulatory scope.
- **Q21 — at what level does money belong?** Student / **family/payer account** / sponsor. Can one payment cover several students/invoices? **Default: a payer/family account with explicit invoice-line allocations + beneficiary links; yes, one receipt allocates across siblings/invoices.**
- **Q22 — which commands need approval?** Discount, waiver, write-off, backdated posting, refund, reversal, receipt cancellation, opening-balance adjustment. **Default: policy thresholds + separation-of-duties + immutable linked entries (reuse maker-checker/step-up).**
- **Q23 — receipt-numbering policy?** Per tenant/campus/account/fiscal-year/channel; reusable? **Default: gap-aware, never-reused, policy-versioned sequences + reprint verification** (we already have tenant-unique receipt numbers).

## Options

1. **Payer/family account + a receipt-and-allocation subledger, contra reversals (recommended).** Serves sibling payment, unapplied credit, reversible discounts, opening-balance migration. Trade-off: several new entities + a refactor of `Payment` (one-to-one → allocation).
2. **Keep one-payment→one-invoice + negative-amount reversals (the legacy system/status quo).** Rejected — can't do family allocation, hides reversal semantics, discounts mutable.
3. **Full double-entry general ledger from day one.** Deferred to **ADR-10** (build-vs-integrate); over-scoped for Release-1 receivables.

## Decision

Adopt **Option 1** — a receivables subledger, corrected only by reversal/contra:

```
Billing:  FeeItem · FeeScheduleVersion · FeeScheduleLine · ChargeAssignmentRule
          Invoice · InvoiceLine · DiscountPolicy · DiscountGrant(reversible) · Scholarship/AidAward · PaymentPlan · AccountHold
Cash:     PaymentReceipt(money received) ─▶ PaymentAllocation(receipt → many invoices/lines/siblings)
          UnappliedCredit · FamilyCreditAccount + CreditLedgerEntry  ("wallet" = unapplied family credit)
          Refund · Chargeback · ReconciliationBatch · PaymentGateway adapter (signed idempotent webhooks)
```

- **`Payment` evolves from one-to-one to `PaymentReceipt` + `PaymentAllocation`** — a receipt is money received into a family/payer account, then allocated across invoices/lines/beneficiaries. Overpayment lands in **`UnappliedCredit`** (no fake income).
- **Money stays in minor units (kobo);** **posted entries are corrected by reversal/contra, never edited or deleted** (fixes C090 discounts + C096 negatives, #95); allocations cannot exceed available receipt or open balance without an explicit credit policy.
- **Discounts/refunds above thresholds require approval** (maker-checker/step-up); **financial hold ≠ enrollment status** and feeds ADR-04 result visibility only as an explicit audited decision.
- **Opening balances** (brought-forward debt, C091) import via **ADR-09** as invoices/credits with source refs.
- **Gateway** payments arrive via a signed adapter with **idempotent webhooks** (ADR-06 jobs) — fixes the visible gateway-failure/"Incomplete Transaction" states (C084).

## Consequences

- **Enables** sibling/family payment, wallet-as-unapplied-credit, reversible discounts, refunds with linked entries, opening-balance migration, and reconciliation to control totals (Phase-2E exit).
- **Constrains:** finance mutations become append-only (reversal/contra) with approval on sensitive ops.
- **Migration impact:** additive tables + a `Payment` refactor with back-compat; opening balances + historical payments imported with source refs (ADR-09).
- Depends on **ADR-01** (family = Persons), **ADR-06** (webhooks/reconciliation as jobs), **ADR-09** (opening balances); **GL is ADR-10**.

## Validation

- A family pays once for two siblings → **explicit allocation** across their invoices.
- An overpayment leaves **unapplied credit**, not fake income.
- An approved discount changes the **outstanding balance** but not the **original charge**; deleting a discount is impossible — it is reversed.
- A refund + a reversed gateway payment keep **linked, auditable** entries.
- Opening balances + all post-cutover activity **reconcile to an exact control total** (ADR-09).
