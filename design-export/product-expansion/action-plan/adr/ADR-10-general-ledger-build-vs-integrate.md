# ADR-10 — General ledger: build vs integrate · **OWNER DECISION BRIEF**

- **Status:** Accepted — 2026-08-01.
- **Deciders:** **product owner** (+ finance) — [Q19](../../plan/06-roadmap-and-discussion-guide.md#f--finance--accounting). **Owner decision (2026-08-01):** build an **internal double-entry general ledger AND** offer integration — _"if they don't have [an accounting tool], they use ours; if they have, they integrate."_ The app is explicitly positioned as an **auditor-grade platform** that records **every** financial transaction (operations, fees, payroll). This **supersedes the drafted Option-C recommendation** (which would have deferred an internal GL).
- **Relationship:** **ADR-05** builds the fees/receivables **subledger** regardless of this decision. This brief is only about whether we also build a full **general ledger** (chart of accounts, journals, period locks, financial statements) **inside** SchoolWithEase or **integrate** an external accounting system.

## Context

The legacy system ships a whole accounting suite — income/expense/budget/payroll/inventory + a finance dashboard with cash flow, **depreciation**, and a 6-month trend (C095–C102) — and links **Sage** (via unsafe credential capture, C094). We are **receivables-first** (`FeeInvoice` + `Payment`). A full internal GL is an **XL** domain (double-entry, period close, audited statements) that many private schools already handle in QuickBooks/Sage/Xero/Zoho with their own accountant.

## Options

| Option                                 | What it means                                                                                                                                             | Pros                                                                                                   | Cons                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **A · Build GL internally**            | Chart of accounts, journals, period locks, financial statements in-product                                                                                | One system; no external accounting seat cost; full control; matches the legacy system's "Full Account" | XL build; long; duplicates tools schools already pay for; audit-grade accounting is a specialist domain |
| **B · Integrate accounting (adapter)** | Push receivables/payroll/expense summaries to the school's accountant tool via a **signed** adapter (never credential capture)                            | Fast; schools keep their accountant + tool; we focus on school-specific finance                        | Depends on the customer's system; cross-system reconciliation; per-integration work                     |
| **C · Hybrid (recommended default)**   | Ship the excellent **fees/receivables subledger (ADR-05) now**; **integrate** a GL initially; revisit an internal GL only if validated schools require it | Fastest path to parity value; avoids premature XL build; keeps the door open                           | Some schools may still want in-product statements at Release-1                                          |

## Decision — Option D (build internal GL **and** integrate)

The owner chose a genuine **build + integrate** model, which the drafted brief did not offer as a single option:

- **Build an internal, auditor-grade double-entry general ledger** — chart of accounts, journals / journal lines, accounting periods with lock/close, trial balance + financial statements. It is the **accounting backbone**: the ADR-05 receivables subledger, payroll, and operational expense/AP all **post balanced journal entries** into it. This is what makes the app usable "as an auditing platform" — flexible enough to adapt, thorough enough for a professional auditor — the owner's stated goal.
- **Also provide a signed integration adapter** (ADR-12) to QuickBooks / Sage / Xero / Zoho for schools that already keep their books elsewhere — never credential capture. Schools with **no** accounting tool **use ours**; schools with one **integrate/export**.
- **We are not a payment custodian** (see ADR-05): gateways settle to the school's account and accountants can post off-app cash/bank entries; the GL **records and reconciles**, it does not hold funds.

### Recommended sequencing (engineering — protects Release-1)

An internal double-entry GL is an **XL** specialist domain, so commit the **architecture** now but **phase the surface** so Release-1 isn't held hostage:

- **Release-1 (Phase 2E finance):** receivables subledger (ADR-05) + gateway/manual receipts + **double-entry journal posting** (the backbone) + trial balance + reconciliation to control totals + the **integration/export adapter**. This already gives auditor-grade recording of the fee/payment flows and a clean export path.
- **Fast-follow (Phase 2F+):** payroll subledger, operational expense/AP capture, budgets, **period close/lock**, full financial statements (P&L, balance sheet, cash flow), depreciation — the rest of the legacy "Full Account" surface.

Building double-entry from day one (rather than a standalone receivables subledger bolted onto a GL later) means **no rework** when the later surface lands. If the owner wants a different Release-1 cut line, that is the one open sequencing lever.

## Owner input captured

- **Do target schools do their own accounting externally, or need it inside?** → **Both** must be supported; default to **ours** when they have none, **integrate** when they do.
- **Which accounting systems do partner schools use?** → _open_ — confirm per design-partner at onboarding (drives the first integration-adapter target).
- **Is "financial statements inside SchoolWithEase" a Release-1 sales requirement?** → Auditor-grade **recording** is a core value proposition; the full statement surface is phased (see sequencing) — confirm the Release-1 cut line.
- **Regulatory/audit obligation forcing an internal ledger?** → _open_ — validate, but the auditing positioning already justifies the internal GL.

## Consequences

- A new **XL bounded context** — ChartOfAccount, Journal/JournalLine, AccountingPeriod (lock/close), Budget, financial statements — with period locks + audit trail, **plus** the ADR-12 accounting adapter + reconciliation for integrators.
- The ADR-05 receivables subledger (and later payroll + AP) become **subledgers that post into this GL**; nothing records money without a balanced journal entry.
- **WB5 gains internal-GL scope** (previously out-of-scope). Given the size, WB5 is expected to **split** — receivables + journal backbone first (Release-1), then the GL surface (period close / statements / payroll / AP) as a fast-follow workbench. See the board.
- **Sequencing is the one open lever:** the double-entry backbone ships in Release-1; the full statement/close/payroll surface phases in — adjust the cut line with the owner if needed.
