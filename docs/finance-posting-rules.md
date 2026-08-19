# Finance posting rules — how the subledger reaches the ledger

Status: **implemented (WB5-3..WB5-6)**. Companion to
[ADR-05](../design-export/product-expansion/action-plan/adr/ADR-05-finance-ledger-family-credit-allocation.md)
(the receivables subledger) and
[ADR-10](../design-export/product-expansion/action-plan/adr/ADR-10-general-ledger-build-vs-integrate.md)
(build an internal ledger **and** offer an export).

This is the one page to read before changing anything that moves money. If you
add a new financial event, it belongs here before it belongs in code.

## The two layers

- **Subledger (receivables)** — what a family owes and what they have paid:
  `fee_invoices` + `fee_invoice_lines`, `fee_adjustments`, `payments` (receipts)
  + `payment_allocations`, `account_credits` + `credit_applications`.
- **Ledger (general)** — the double-entry record: `chart_of_accounts`,
  `accounting_periods`, `journal_entries`, `journal_lines`.

Every subledger event posts a **balanced** entry into the ledger through
`LedgerService.post()`, which is the only writer. It refuses an entry that does
not balance, a negative amount, a line that is both a debit and a credit, and
anything dated into a **closed** period.

## The accounts the rules resolve by role

Posting never hard-codes an account number; it resolves by `system_key`, so a
school can renumber or rename its chart without breaking anything.

| `system_key`             | Default code | Type      | What it holds                              |
| ------------------------ | ------------ | --------- | ------------------------------------------ |
| `cash`                   | 1000         | asset     | Money received (bank/cash/card/cheque)     |
| `ar_control`             | 1100         | asset     | Fees billed and not yet settled            |
| `unapplied_credit`       | 2100         | liability | Money received in advance of a bill        |
| `opening_balance_equity` | 3000         | equity    | The contra side of the opening balance     |
| `fee_income`             | 4000         | income    | Fees billed                                |
| `discounts_allowed`      | 5000         | expense   | Discounts, waivers and scholarships given  |

## The rules

| Event                       | Debit                              | Credit                              |
| --------------------------- | ---------------------------------- | ----------------------------------- |
| Invoice **issued**          | `ar_control` (gross)               | `fee_income` (gross)                |
| Adjustment **applied**      | `discounts_allowed`                | `ar_control`                        |
| Receipt **recorded**        | `cash` (total received)            | `ar_control` per allocation, and `unapplied_credit` for anything unallocated |
| Credit **applied**          | `unapplied_credit`                 | `ar_control`                        |
| Invoice **cancelled**       | reversal of its issue entry        | —                                   |
| Opening balance (once)      | `ar_control` (pre-ledger debt)     | `opening_balance_equity`            |

A receipt posts **one** entry with a credit line per invoice it settled, so the
ledger can still answer "which child did this naira settle?".

## Corrections

A posted entry is never edited or deleted. `LedgerService.reverse()` posts a
contra entry (the sides swapped) that points back at the original with
`reversal_of_id`, and marks the original `reversed`. This is the redesign of the
legacy negative-amount reversal (parity job #95), and it is why closing a period
is meaningful: a correction after close has to be dated in an open period.

## The opening balance

A school that had invoices before this release would otherwise show a permanent
reconciliation difference equal to its pre-existing debt. The first time any
financial mutation runs, `ensureOpeningBalance` posts one entry for the
outstanding total of invoices **whose charge was never posted**.

Two properties matter, and both were learned from a bug:

1. It counts only invoices with no `invoice`-sourced entry, so a school that
   started life with the ledger opens with nothing (its bills are already there).
2. It is called **before** the subledger rows are written, so the opening figure
   is the debt as it stood before whatever is about to happen.

## Reconciliation

`/finance/reports/reconciliation` compares three control totals — receivables,
credit held, and cash — with the ledger, and reports the trial balance's
`outOfBalance`. All four are zero when the books agree with the bills. A
non-zero difference means something wrote money outside these rules; that is
exactly what a control account is for.

## Numbering

Receipt, invoice and journal numbers come from `finance_number_sequences`: one
counter per tenant + kind + year, taken with a single atomic increment inside
the caller's transaction (`RCT-2026-000042`). A rolled-back transaction leaves a
**gap** rather than releasing the number — a missing receipt number is visible
to an auditor, a duplicated one is not.

## Not built yet

- **Payment gateway ingestion** (WB5-7) — blocked on an owner decision: which
  provider, and the signing secret per environment.
- **Payroll, AP/expense, budgets, financial statements** — the ADR-10
  fast-follow surface. They post into these same tables when they land.
- **Cash refunds** — paying credit back out is deliberately out of scope for v1
  (ADR-05); credit can only be drawn down onto a later invoice.
