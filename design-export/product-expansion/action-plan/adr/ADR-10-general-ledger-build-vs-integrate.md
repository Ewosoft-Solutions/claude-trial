# ADR-10 — General ledger: build vs integrate · **OWNER DECISION BRIEF**

- **Status:** Proposed — **owner decision pending** (2026-07-31). Not draftable to "Accepted" by engineering alone.
- **Deciders:** **product owner** (+ finance) — [Q19](../../plan/06-roadmap-and-discussion-guide.md#f--finance--accounting).
- **Relationship:** **ADR-05** builds the fees/receivables **subledger** regardless of this decision. This brief is only about whether we also build a full **general ledger** (chart of accounts, journals, period locks, financial statements) **inside** SchoolWithEase or **integrate** an external accounting system.

## Context

The legacy system ships a whole accounting suite — income/expense/budget/payroll/inventory + a finance dashboard with cash flow, **depreciation**, and a 6-month trend (C095–C102) — and links **Sage** (via unsafe credential capture, C094). We are **receivables-first** (`FeeInvoice` + `Payment`). A full internal GL is an **XL** domain (double-entry, period close, audited statements) that many private schools already handle in QuickBooks/Sage/Xero/Zoho with their own accountant.

## Options

| Option                                 | What it means                                                                                                                                             | Pros                                                                                                   | Cons                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **A · Build GL internally**            | Chart of accounts, journals, period locks, financial statements in-product                                                                                | One system; no external accounting seat cost; full control; matches the legacy system's "Full Account" | XL build; long; duplicates tools schools already pay for; audit-grade accounting is a specialist domain |
| **B · Integrate accounting (adapter)** | Push receivables/payroll/expense summaries to the school's accountant tool via a **signed** adapter (never credential capture)                            | Fast; schools keep their accountant + tool; we focus on school-specific finance                        | Depends on the customer's system; cross-system reconciliation; per-integration work                     |
| **C · Hybrid (recommended default)**   | Ship the excellent **fees/receivables subledger (ADR-05) now**; **integrate** a GL initially; revisit an internal GL only if validated schools require it | Fastest path to parity value; avoids premature XL build; keeps the door open                           | Some schools may still want in-product statements at Release-1                                          |

## Recommendation

**Option C (Hybrid).** Build the receivables subledger (already committed in ADR-05), integrate accounting via a signed adapter (ADR-12), and defer an internal GL unless a committed design-partner requires bookkeeping _inside_ the platform. This matches the roadmap default and de-risks Phase 2.

## What we need from the owner

1. Do the **target schools do their own accounting** in an external tool today, or do they need bookkeeping **inside** SchoolWithEase?
2. Which accounting systems do the **design-partner schools** actually use (QuickBooks / Sage / Xero / Zoho / spreadsheets)?
3. Is **"financial statements inside SchoolWithEase"** a Release-1 **sales requirement**, or a later differentiator?
4. Any **regulatory/audit** obligation that forces an internal ledger?

## Consequences by choice

- **A** → a new XL bounded context (ChartOfAccount, Journal/JournalLine, AccountingPeriod, Budget, statements) with period locks + audit; pushes Release-1 out.
- **B/C** → ADR-12 accounting adapter + reconciliation; Release-1 stays focused on receivables/payroll/inventory summaries.

**Blocks:** WB5's ledger scope and the Phase-2E finance boundary. Until decided, WB5 proceeds on the **ADR-05 subledger** and treats GL as out-of-scope.
