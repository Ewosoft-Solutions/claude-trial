# Family / checkout payments — design spec

> **Superseded by [`billing-and-ar-design.md`](billing-and-ar-design.md)** (2026-08-06).
> The owner's decisions (drop the single-invoice link, family-first grouping,
> partial payments + discounts/waivers, over-payment credit) grew this into a
> full accounts-receivable design. This file is kept for history; build from the
> AR design.

Status: **proposed — awaiting owner sign-off before build.**
Owner-flagged 2026-08-06 while migrating the finance lists to server-driven.

## Why

A single payment often settles fees for **several children in one family** — a
guardian pays once at the desk and it clears three siblings' invoices. Today
`Payment` links to exactly one `invoiceId` + one `studentId`, so this is either
recorded as three disconnected payments or mis-recorded against one child. We
want a payment to **say what was paid for and for whom**, and to derive the
affected students exactly — a "checkout" over the family's outstanding invoices.

This also unblocks the finance **list** migration: the payments list needs to
show/search the affected students, and finance is decoupled from the student
schema by design (the "finance is not a custodian" ADR — `FeeInvoice`/`Payment`
hold a bare `studentId`, no relation). A denormalized `studentNames` snapshot on
the payment gives the list something searchable/sortable without a cross-schema
join, mirroring the existing `hr.PayrollRecord.staffName` snapshot pattern.

## Model

Keep `FeeInvoice` **per student** (unchanged; invoices bill one student). Make
`Payment` a **transaction** that allocates its amount across one or more
invoices:

```
Payment (the receipt / transaction)
  id, tenantId, receiptNumber, method, paidAt, amount (total), status
  payerName?        // who handed over the money (guardian), optional snapshot
  studentNames      // denormalized snapshot, e.g. "Ada Okafor, Chidi Okafor" — for the list
  studentCount      // convenience for "Ada +2" style rendering
  allocations: PaymentAllocation[]

PaymentAllocation  (the checkout line items)
  id, tenantId, paymentId → Payment, invoiceId → FeeInvoice, amount (kobo)
  studentId          // snapshot copied from the invoice at allocation time
```

- **Affected students** = `distinct(allocations.studentId)` — always accurate,
  never inferred.
- **What was paid for** = the allocation lines (invoice + amount).
- **Invariant**: `sum(allocations.amount) == payment.amount`. Each invoice's
  `amountPaid` is incremented by its allocation; status recomputed
  (paid/partial) as today.
- `studentNames` / `studentCount` are set at record time from the allocated
  invoices' students, so the payments list stays server-side searchable/sortable
  (search `studentNames` OR `receiptNumber`).

### Compatibility with existing data

- Keep `Payment.invoiceId` / `studentId` for now (nullable or "primary"), OR
  drop them once all reads move to allocations. Recommend: **keep during
  migration, deprecate after.**
- **Backfill**: for every existing `Payment`, create one `PaymentAllocation`
  `{ invoiceId, studentId, amount }` and populate `studentNames`/`studentCount`
  from that single student. One row per legacy payment → nothing breaks.

## Record-payment "checkout" flow

1. Operator picks a **family / guardian** (or a starting student).
2. UI lists that family's **outstanding invoices** across all their children.
3. Operator selects invoices and enters an amount per line (default = full
   balance; supports partial). Running total shown.
4. One **Payment** is created with those allocations in a single transaction;
   invoices' `amountPaid`/status update atomically; one **receipt** is issued
   listing every child + invoice + amount.

Over-allocation (paying more than an invoice's balance) is rejected; leftover
credit is out of scope for v1 (note as a follow-up: student/family credit
balance).

## Surfaces affected

- **Schema**: new `PaymentAllocation` model + `studentNames`/`studentCount` (and
  optional `payerName`) on `Payment`; migration + backfill (hand-written SQL per
  the repo's additive-migration convention — `prisma migrate dev` wants a reset).
- **API**: `RecordPaymentDto` gains `allocations: [{ invoiceId, amount }]`;
  `recordPayment` writes the payment + allocations + invoice updates in one
  transaction; `listPayments` returns `{ data, pagination }` with allocation
  summary + `studentNames` (searchable/sortable), consistent with the other
  server-driven lists.
- **Web**: a checkout UI for record-payment; the payments **list** migrates to
  the server-driven `DirectoryTable` pattern (search receipt #/student, filter
  by method/status, sort, paginate) — this is the deferred half of the finance
  list migration.
- **Receipts**: render all allocations (per-child breakdown).
- **Reporting**: `finance/reports` aggregates should read allocations (a payment
  can touch multiple students/classes), not the single legacy `studentId`.

## Open questions for sign-off

1. Keep or drop the legacy `Payment.invoiceId`/`studentId` after backfill?
2. Is a "family" a first-class grouping (guardianships across students), or does
   the operator just multi-select invoices ad hoc? (Affects the picker.)
3. Partial allocations in v1, or full-invoice-only to start?
4. Handle over-payment / credit now, or defer?

## Sequencing

This is a **feature**, not part of the list-pagination correctness work. Suggest
building it after the clean list migrations land, as its own branch, once the
four questions above are answered.
