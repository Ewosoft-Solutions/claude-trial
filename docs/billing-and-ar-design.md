# School billing & accounts-receivable — design

Status: **BUILT — P1–P4 all shipped (WB5).** P1 (itemised invoices + adjustments)
and P2 (households) landed in [#76]/[#77]; **P3 (receipts + allocations) and P4
(unapplied credit) shipped with WB5-3/5-4**, together with the double-entry
ledger underneath them (ADR-10) — see
[`finance-posting-rules.md`](finance-posting-rules.md) for how each event
reaches the books. Supersedes the narrower `family-payments-plan.md`.
Owner-driven 2026-08-06; phasing updated 2026-08-19.

This grew out of "family/checkout payments" but the owner's decisions (drop the
single-invoice link, family-first grouping, partial payments with real
outstanding balances + discounts/waivers, and over-payment credit) make it a
proper **accounts-receivable (AR) subsystem**. It aligns with the roadmap's
"auditor-grade GL" finance expansion (WB5).

## 1. Vocabulary

- **Bill / Invoice** — the same thing: the *demand* for payment ("student X owes
  ₦Y for these items by date Z"). Created **before** money moves; represents a
  **receivable**.
- **Receipt** — proof money was **received** ("₦Y from payer P on date D, applied
  to invoices A/B/C"). Created **after** payment.
- **Allocation** — the link that applies part of a payment to an invoice. The
  many-to-many is real and temporal: one invoice → many receipts (installments);
  one receipt → many invoices (family checkout).
- **Adjustment** — a discount / waiver / scholarship / correction that reduces
  what's owed.
- **Credit** — money received beyond what's owed, parked on the account for
  future invoices (or refund).

## 2. Core principle — the balance is DERIVED, never edited

An invoice's balance is a running tally of everything applied to it, so partial
payments, installments, and waivers all reconcile without overwriting anything:

```
invoice.gross        = Σ line items
invoice.adjustments  = Σ approved discounts / waivers on the invoice (or its lines)
invoice.paid         = Σ payment allocations to the invoice
invoice.balance      = gross − adjustments − paid            (never < 0)
invoice.status       = draft → issued → partial → paid → overdue   (derived)
settled              = balance == 0, by ANY mix of payment + adjustment
```

The owner's real-world case — *pay part now, the rest stays pending, a waiver or
a later payment reconciles it* — is exactly this: the payment adds an allocation,
the remainder stays as `balance > 0` (`partial`), and nothing is lost or mutated.

## 3. Data model

### Billing household (the durable family account)

```
BillingHousehold        id, tenantId, name, primaryPayerName (snapshot), createdAt
HouseholdMember         householdId, studentId, effectiveFrom, effectiveTo?   -- temporal
HouseholdPayer          householdId, guardianId, role (primary|secondary),
                        effectiveFrom, effectiveTo?                            -- temporal
```

- Persistent id that invoices / payments / credits attach to, so history survives
  guardianship transfers.
- Membership + payer are **temporal** (effective ranges), answering "who was in
  this family / who paid, on date D".
- **Auto-created/maintained** from shared-primary-guardian clusters (so the
  family picker always has something to pre-load), **plus an operator merge/split
  tool** for blended families, wards, and multi-guardian edge cases.
- Finance persists the snapshot rather than re-deriving from live guardianships.
- Not a genealogy tree — a billing account with membership + payer history.

### Invoices (itemized)

```
FeeItem        id, tenantId, code, name (Tuition|Bus|Books|Lab|Uniform|Exam|…),
               defaultAmount?, active            -- managed catalogue, pre-seeded
FeeInvoice     id, tenantId, householdId?, studentId, studentName (snapshot),
               invoiceNumber, termName/…, issuedDate, dueDate, status, notes
               -- gross/adjustments/paid/balance are DERIVED (view or computed)
FeeInvoiceLine invoiceId, feeItemId, description?, amount, qty
```

- Today's single `amountDue` becomes `Σ` of `FeeInvoiceLine.amount` (migration
  creates one line per existing invoice, mapped to a seeded "Tuition/General"
  `FeeItem`).
- `FeeItem` is a tenant-managed catalogue pre-seeded with common NG K-12 items,
  so invoicing is consistent and reportable (revenue by fee type) and policies
  can target an item.
- Keeps the `studentName` snapshot already shipped (2026-08-06) for
  search/sort/decoupling.

### Adjustments (discounts / waivers) + authority

```
DiscountPolicy   id, tenantId, type (discount|scholarship), name, condition (rule),
                 amount|percent, active, createdBy   -- the standing authority
FeeAdjustment    id, invoiceId (or lineId), type (discount|waiver|scholarship|correction),
                 source (policy|discretionary), amount|percent, reason,
                 policyId?,                              -- when source = policy
                 status (pending|approved|rejected|applied),
                 requestedBy, approvedBy?, approvedAt?, appliedAt?  -- when discretionary
```

- **Policy-driven**: auto-applied when a `DiscountPolicy.condition` matches; the
  policy is the authority (no per-use sign-off). **Creating/activating the policy
  itself is a maker-checker action** (it's a standing financial authority).
  Auditable by `policyId`.
- **Discretionary**: requires **maker-checker approval** (reuse WB1-6 +
  step-up); `requestedBy ≠ approvedBy` (separation of duties). Only takes effect
  on approval.
- Immutable once `applied`; a reversal is a new `correction` adjustment, never an
  edit. `type` is the reporting dimension; `source`/authority is the audit
  dimension.

### Payments (receipts) + allocations — the checkout

```
Payment            id, tenantId, householdId?, receiptNumber, payerName (snapshot),
                   method, paidAt, amount (total), status
                   -- NO invoiceId / studentId (dropped, per owner)
PaymentAllocation  paymentId, invoiceId, amount        -- partial + many-over-time
```

- A payment allocates its total across one or more invoices (family checkout),
  each allocation ≤ that invoice's balance.
- `studentNames` shown on the receipt are derived from the allocated invoices'
  students (a snapshot is stored on the receipt for immutability).

### Credit (over-payment)

```
AccountCredit   id, tenantId, householdId? / studentId, source (overpayment|refund-in|…),
                amount, remaining, reason, createdFromPaymentId, createdAt
CreditApplication  creditId, invoiceId, amount, appliedAt
```

- When a payment exceeds the covered balances, the excess creates an
  `AccountCredit` on the **household** (or student), **auto-applied to future
  invoices** (append-only `CreditApplication` rows). **Cash refunds are deferred
  beyond P4** — v1 never pays money back out.

## 4. Key flows

1. **Record payment (family checkout)** — pick a household → it lists every
   member's outstanding invoices → operator selects invoices and (v1: full
   balance; later: partial amounts) → one `Payment` + `PaymentAllocation`s in a
   single transaction → invoices' balances/status recompute → excess → credit →
   one receipt listing every child + invoice + amount.
2. **Partial / installment** — a payment allocates < an invoice's balance; the
   invoice sits at `partial`; later payments/adjustments finish it.
3. **Discretionary discount/waiver** — staff requests a `FeeAdjustment`
   (`pending`) → approver signs off (maker-checker) → `applied` → balance drops.
4. **Policy discount** — auto-applied at invoice issue when the policy condition
   matches; visible as a `FeeAdjustment { source: policy }`.

## 5. Migration (from today)

Additive + phased; today's finance stays working throughout.

1. Add `BillingHousehold` + membership/payer, seeded from guardianships.
2. Add `FeeInvoiceLine`; backfill one line per existing `FeeInvoice` from its
   `amountDue`; keep `amountDue`/`amountPaid` as derived/compat during transition.
3. Add `FeeAdjustment` + `DiscountPolicy`.
4. Add `PaymentAllocation`; backfill one allocation per existing `Payment` from
   its `invoiceId`/`amount`; **then drop** `Payment.invoiceId`/`studentId`.
5. Add `AccountCredit`.
6. Switch reads (list, reports, student-fees) to derived balances; retire compat
   columns.

## 6. Reconciliation & audit rules

- Balance never stored-and-edited; always `gross − adjustments − paid`.
- Every money/adjustment row is append-only; reversals are new rows.
- Every adjustment carries its authority (policyId or approver + timestamp).
- Payments + receipts snapshot payer + covered students for immutable history.
- Separation of duties on discretionary adjustments (requester ≠ approver).

## 7. Phasing (build order — all four shipped)

- **P1 ✅ — itemized invoices + adjustments (approval)**: lines, policy +
  discretionary adjustments w/ maker-checker, derived balances. (Unblocks correct
  billing even before multi-pay.)
- **P2 ✅ — households + family-aware picker**: household account, temporal
  membership from guardianships.
- **P3 ✅ — payments = allocations (checkout)**: `PaymentAllocation`;
  `Payment.invoiceId`/`studentId` dropped after backfill; family checkout UI +
  receipt drawer with audited reprints; the payments list is server-driven.
  Receipt numbers moved to a gap-aware yearly sequence (Q23).
- **P4 ✅ — credit / over-payment**: `AccountCredit` + `CreditApplication`,
  auto-applied when the family's next invoice is issued. Cash refunds remain
  deliberately out of scope.
- **Underneath all four**: every event posts a balanced journal entry into the
  internal general ledger (ADR-10), with trial balance, period close, contra
  reversals, control-total reconciliation and a journal CSV export.

## 8. Decisions (settled 2026-08-06)

- **Refunds (cash-out of credit): DEFERRED beyond P4.** v1 credit only
  auto-applies to the household's future invoices; paying money *out* is its own
  later feature with dedicated payout approval + reconciliation.
- **Fee items: a managed catalogue, PRE-SEEDED** with common NG K-12 items
  (Tuition, Bus, Books, Lab, Uniform, Exam, …). Invoice lines reference a
  `FeeItem`; policy conditions can target an item ("10% off Bus").
- **Household lifecycle: AUTO from shared-primary-guardian clusters, + an
  operator merge/split tool** for blended families, wards, and multi-guardian
  edge cases. So the family picker always has something to pre-load, and wrong
  groupings are fixable.
- **Activating a `DiscountPolicy`: YES, maker-checker.** A policy is a standing
  financial authority (silently reduces revenue for all who qualify), so
  creating/activating one needs a second-authority sign-off — same control as a
  discretionary adjustment.
