# ADR-05 — Finance subledger: family credit + payment allocation

- **Status:** Accepted — 2026-08-01 (Option 1, with the owner amendments below)
- **Deciders:** engineering + **product/finance owner** — [Q20–23](../../plan/06-roadmap-and-discussion-guide.md#f--finance--accounting). **Owner sign-off:** granted 2026-08-01.
- **Owner amendments (2026-08-01):** (1) **We are not a payment custodian and there is no stored-value wallet** — gateways (Paystack etc.) settle payments into the **school's own account**, and accountants can **record off-app (cash/bank) payments** manually; "family credit" is an **accounts-receivable credit balance** (advance / overpayment to apply to future invoices), never money we hold. (2) **Billing is a checkout/cart** flow — parents/applicants add fee items + discounts to a cart that becomes an invoice, then pay. (3) The subledger **posts double-entry journal entries into the internal general ledger** — see **[ADR-10](ADR-10-general-ledger-build-vs-integrate.md)** (owner chose to **build** an internal auditor-grade GL + integrate, not defer it).
- **Scope note:** this ADR covers the **billing/receivables subledger** (fees, discounts, receipts, allocation, family credit). It is a **subledger that posts into the internal general ledger** decided in **ADR-10**.
- **Unblocks:** WB5 (Family Account + Finance), and result-visibility `FinancialHold` (ADR-04).

## Context

Our current finance is a **strong, honest MVP but structurally one-to-one**: `FeeInvoice(invoiceNumber, studentId, classId, term…, amountDue, amountPaid — in kobo, status)` + `Payment(receiptNumber, invoiceId → exactly one invoice, studentId, method, amount kobo, reference, status)`, with tenant-unique receipt/invoice numbers. Money is already in **minor units (kobo)** — so we already avoid the legacy system's negative-amount reversal anti-pattern by design.

But the corpus shows jobs our model can't express: a parent **pays once for several children of the same parent** (C082/C084, wallet keyed by shared phone); a **fee catalog** with compulsory flags + targeted charges (C087); **per-charge discounts** (editable/deletable in the legacy system — C090); **brought-forward opening debt** (C091); and Full Account reversals done as **negative amounts** (C096). Our `Payment.invoiceId` (one payment → one invoice) cannot do sibling/family allocation; there are no fee items/lines, discounts, unapplied credit, or family account.

**What breaks if we guess wrong:** every finance job (billing, allocation, discounts, refunds, statements, reconciliation, opening-balance migration) references this model, and result-visibility holds (ADR-04) reference a financial state. A one-to-one payment model or mutable discounts becomes a correctness + audit failure the first time a family pays for two kids or a discount is reversed.

## Open questions for the owner (recommended defaults in **bold**)

- **Q20 — what does "wallet" mean?** Stored value / unapplied family credit / gateway balance / a label. **Resolved (owner, 2026-08-01): NOT a wallet and NOT stored value.** We are not a payment custodian — gateways settle to the school's account and accountants record off-app payments; model only an **unapplied-credit AR balance** (an accounting construct), which avoids all e-money / custody scope. Drop "wallet" as a product term.
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
          UnappliedCredit · FamilyCreditAccount + CreditLedgerEntry  (unapplied-credit AR balance; NOT stored value / not custodial)
          Refund · Chargeback · ReconciliationBatch · PaymentGateway adapter (signed idempotent webhooks)
```

- **`Payment` evolves from one-to-one to `PaymentReceipt` + `PaymentAllocation`** — a receipt is money received into a family/payer account, then allocated across invoices/lines/beneficiaries. Overpayment lands in **`UnappliedCredit`** (no fake income).
- **Money stays in minor units (kobo);** **posted entries are corrected by reversal/contra, never edited or deleted** (fixes C090 discounts + C096 negatives, #95); allocations cannot exceed available receipt or open balance without an explicit credit policy.
- **Billing is a checkout/cart:** parents/applicants assemble `FeeItem`s (+ eligible `DiscountGrant`s) into a cart that becomes an `Invoice` with `InvoiceLine`s, then pay — the same model backs staff-raised invoices.
- **Every receivables event posts balanced double-entry journal lines into the GL** (ADR-10) — invoices, receipts, allocations, discounts, credits, refunds — so the books are auditor-grade and reconcile to control totals.
- **Discounts/refunds above thresholds require approval** (maker-checker/step-up); **financial hold ≠ enrollment status** and feeds ADR-04 result visibility only as an explicit audited decision.
- **Opening balances** (brought-forward debt, C091) import via **ADR-09** as invoices/credits with source refs.
- **Gateway** payments (Paystack etc.) **settle into the school's own account**; we ingest them via a signed adapter with **idempotent webhooks** (ADR-06 jobs) and **reconcile** — we record, we do not hold funds. Accountants can also **post off-app (cash/bank) receipts** manually. Fixes the visible gateway-failure/"Incomplete Transaction" states (C084).

## Consequences

- **Enables** sibling/family payment, wallet-as-unapplied-credit, reversible discounts, refunds with linked entries, opening-balance migration, and reconciliation to control totals (Phase-2E exit).
- **Constrains:** finance mutations become append-only (reversal/contra) with approval on sensitive ops.
- **Migration impact:** additive tables + a `Payment` refactor with back-compat; opening balances + historical payments imported with source refs (ADR-09).
- Depends on **ADR-01** (family = Persons), **ADR-06** (webhooks/reconciliation as jobs), **ADR-09** (opening balances); **posts into the internal GL — ADR-10** (owner chose build + integrate). Financial-record verifiable anchoring is future work — **[ADR-13](ADR-13-verifiable-anchored-records.md)**.

## Validation

- A family pays once for two siblings → **explicit allocation** across their invoices.
- An overpayment leaves **unapplied credit**, not fake income.
- An approved discount changes the **outstanding balance** but not the **original charge**; deleting a discount is impossible — it is reversed.
- A refund + a reversed gateway payment keep **linked, auditable** entries.
- Opening balances + all post-cutover activity **reconcile to an exact control total** (ADR-09).
