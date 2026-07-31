# Product-expansion — parity assessment

**Assessment date:** 31 July 2026
**Product:** SchoolWithEase (multi-tenant school OS)
**Incumbent under assessment:** **the legacy system** by **the legacy vendor** (footer confirmed on C045; tenant in the corpus = _a sample school tenant — Campus A_)
**Source corpus:** 135 PNGs — **133 product screens** (C001–C133) + **2 non-product MacBook Touch Bar artifacts** (C134–C135), reviewed image-by-image.
**Grounding:** every screen was reviewed visually; every SchoolWithEase claim was checked against the live repository (routes, Prisma models, permission seed, controllers) on the assessment date, not against status prose.

---

## Executive conclusion

The legacy system is **broad, battle-tested, and operationally complete**. Across 133 screens it covers user provisioning, staff allocation, a full admissions pipeline, student records, continuous-assessment results, attendance, CBT, homework, lesson-plan supervision, curriculum authoring, parent wallets, fee catalogs, discounts, brought-forward debt, a double-generation accounting suite (income/expense/budget/payroll/inventory/finance), SMS/email delivery with cost metering, result publication with locking, and ~30 configuration pages.

Its weakness is **not** missing features. It is that features accreted as **separate pages, sub-products, and menu branches with no shared interaction model**. The corpus shows two visual generations coexisting (a legacy green/gold sidebar app with a newer indigo product **embedded inside it** — "Full Admission Pro.", "Full Account"), the same job split across many destinations (11 student pages, 13 result pages, 15 result-config pages, 3 messaging channels, 3 student-search pages), a persistent "Pay Now" subscription nag bleeding into work areas, and dense tables that expose parent/staff contact data by default.

SchoolWithEase should therefore pursue **capability parity without information-architecture parity**:

1. Keep the SchoolWithEase requirements (`requirements/`) as the constitution.
2. Guarantee the **jobs and records** the legacy system customers depend on.
3. Reassemble them into a **small number of cohesive workspaces** built from one Aurora design system.
4. Make Nigerian academic and payment conventions **versioned, effective-dated configuration**, not hard-coded labels.
5. Keep — and finish — the foundations where we are already **architecturally ahead**: `resource.action.context` permissions, clearance pools, maker–checker, tenant RLS, enveloped-encryption health data, kobo-based money.
6. Treat **migration and reconciliation** as product features, because a parity is judged on whether history survives.

---

## Verified repository baseline (checked 31 Jul 2026, not quoted from docs)

| Dimension                 | Verified value                                                                        | Notes                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Authenticated web routes  | **71** `page.tsx` under `apps/web/app/(app)`                                          | full list in [03](03-gap-analysis.md)                                                                                                |
| API modules / controllers | **24 modules / 45 controllers** under `apps/api/src`                                  |                                                                                                                                      |
| Prisma models             | **58 models across 22 model files** in `packages/database/prisma/models`              | e.g. `AdmissionApplication`, `FeeInvoice`, `StudentGuardian`, `HealthRecord`                                                         |
| Permission catalog (seed) | **305 permissions, 28 categories, 11 pools (clearance 0–10)**                         | `packages/database/prisma/scripts/seed.ts` enforces `EXPECTED_PERMISSION_COUNTS.total = 305`                                         |
| Permission shape          | `resource.action.context` + `requiredClearanceLevel` + `category`                     | real examples: `students.view.medical_info`, `grades.edit.own_classes`, `grades.view.children`, `students.export`, `students.import` |
| Design system             | Aurora: `:root` light / `.dark` default / `.classic-dark`; token-driven `packages/ui` | canonical `StatusBadge`, `Meter`, `TrendChart`, neon avatars                                                                         |

**Source-of-truth drift to fix (governance task):** `requirements/permissions.md` says 274; `CURRENT_PHASE.md`/scorecard say 297; the seed enforces **305**. `AI_CONTEXT.md` still says the web app is on mock data, but the routes are wired to live services. Planning uses **requirements for intent, code for current state.**

---

## The five findings that matter most

1. **The parity gap is workflow depth, not menu breadth.** We have real foundations in every domain but several are one-aggregate-thin against what the legacy system ships: our `AdmissionApplication` holds only `stage/decision/notes` (C-verified) vs the legacy system's forms→responses→interviews→payments→quizzes→notifications pipeline (C019–C024); our `FeeInvoice(amountDue/amountPaid)+Payment` (one payment→one invoice) vs the legacy system's fee catalog + discounts + wallets + brought-forward debt (C082–C091); no result-publication snapshot vs the legacy system's publish/lock/unpublish with per-student blocking (C112).

2. **the legacy system's fragmentation is our concrete IA opportunity.** Search-Staff ≠ All-Staff (C025–C026); Search/Advance-Search/View-All students (C040–C043); 13 result pages (C044–C055); Online-vs-Excel entry everywhere; Communication/SMS/Email as three channels (C103–C110). Each collapses into **one directory + one workbench + saved views**.

3. **Our permission _engine_ is stronger; our permission _UX_ is unfinished.** the legacy system's "detailed" matrix is really a coarse **VIEW/EDIT** grid over incoherent buckets (Library/Transport/Census all under "Academics", C006–C008) with a risky "Select All" (C005) and no scope/verb granularity. We already model `.own/.children/.own_classes/.medical_info/.export/.create/.delete` across 305 permissions — but `settings/roles` is a read-only list and "Add role" is unwired. The win is **role templates + scope + effective-access preview + separation-of-duties**, not 305 checkboxes.

4. **Nigerian academics must be versioned data, not columns.** The corpus shows the exact reasons: a 12-value student _status_ enum mixing lifecycle + reason + finance ("Defaulting") + archival (C040); class names encoding stage+arm ("BASIC 7 EMERALD", "SS1 SCIENCE") across Basic/Primary/JSS/SSS/British-Year/Montessori-Reception conventions (C041, C116); WAEC + per-class custom grade scales with **corrupted migrated grades** ("Exce", "A ve", C114); 724+ free-text remark rules that **encode promotion decisions in prose** ("Promoted to SS 3", C124); and new NERDC subjects (Basic Digital Learning, Citizenship & Heritage, Digital Technologies) sitting beside duplicate legacy ones (C048, C080, C113).

5. **Migration is part of parity.** Brought-forward debt (C091), 776 missing photos (C039), 19,539 SMS + 589 result emails (C104, C107), historical wallet/fee data to 2021/22, and dirty subject/grade catalogs mean a **migration + reconciliation workbench** is P0, not a deployment chore.

---

## Recommended target information architecture

| Workspace                  | Consolidates (incumbent screens)                                                                     | Primary record                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Overview**               | teacher/school dashboards, "today", approvals (C058, C131, C133)                                     | task / exception                     |
| **People**                 | Users, All-Staff, Search-Staff, All-Users, guardians, applicants (C025–C027, C132)                   | person + profiles                    |
| **Academics**              | classes, subjects, curriculum, teaching allocation, timetable, calendar (C015, C077–C081, C116–C117) | offering / class                     |
| **Teaching**               | lesson plans, materials/notes, homework, CBT, review, BClass (C059–C076)                             | learning activity                    |
| **Results**                | 13 result pages + 15 result-config pages (C044–C055, C112–C130)                                      | result cycle                         |
| **Attendance & wellbeing** | attendance (4 pages), health, behaviour (C056–C057, health)                                          | student-day / case                   |
| **Admissions**             | Applicants + Full Admission Pro. pipeline (C016–C024)                                                | application                          |
| **Finance**                | Payment (12 pages) + Full Account (income/expense/budget/payroll/inventory) (C082–C102)              | family/student account + transaction |
| **Engagement**             | Communication + SMS + Email + result delivery (C103–C111)                                            | conversation / campaign / delivery   |
| **Insights**               | analytics dashboards, spreadsheets, exports (C054, C101, C131)                                       | governed metric / report             |
| **Settings & governance**  | Tools ▸ Configuration (30+ pages), roles, branding, audit                                            | effective-dated policy               |

---

## Decision rule for inclusion

Every incumbent capability is classified in [07-capability-parity-matrix.md](07-capability-parity-matrix.md) as one of:

- **Parity-critical** — completes a recurring school job or preserves historical truth. Must ship.
- **Parity-adjacent** — valuable, delivered through a _more general_ SchoolWithEase capability.
- **Redesign** — keep the job, replace the interaction.
- **Defer** — low-frequency or better via integration.
- **Reject** — unsafe or contrary to our requirements (generated-password SMS, unguarded signatures, Sage credential capture, mutable posted finance).

---

## Documentation map

| Doc                                                                                          | What it gives you                                                                                         |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [01-screenshot-register.md](01-screenshot-register.md)                                       | One audited entry for every image C001–C135.                                                              |
| [02-incumbent-capability-and-ux-assessment.md](02-incumbent-capability-and-ux-assessment.md) | Domain-by-domain capability inventory + UX-debt critique.                                                 |
| [03-gap-analysis.md](03-gap-analysis.md)                                                     | Requirements + **live code** vs incumbent, with exact model/route/permission names.                       |
| [04-target-product-and-architecture.md](04-target-product-and-architecture.md)               | Target IA, bounded contexts, data-model deltas, permissions, jobs, migration.                             |
| [05-academic-nigeria-international.md](05-academic-nigeria-international.md)                 | NG + international curriculum, assessment modes, privacy (NDPA 2023), AI, accessibility.                  |
| [06-roadmap-and-discussion-guide.md](06-roadmap-and-discussion-guide.md)                     | Phased sequence, acceptance gates, and discussion-style planning questions.                               |
| [07-capability-parity-matrix.md](07-capability-parity-matrix.md)                             | **Decision-grade matrix**: feature → job → incumbent C-IDs → our model/route → decision → effort → phase. |
| [08-design-system-bridge.md](08-design-system-bridge.md)                                     | How each incumbent surface maps onto our **Aurora tokens + components**.                                  |

## Evidence classes

- **S — Screenshot:** a control/state/record is visibly present (proves a surface, not backend correctness). Cited as `Cxxx`.
- **R — Repository:** a route/model/permission/service is present in the reviewed code.
- **I — Inference/recommendation:** a conclusion or proposed design.

**Limits:** screenshots can't prove enforcement, accounting correctness, delivery, or accessibility semantics. C134–C135 are Touch Bar captures, excluded from feature counts. Legal/curriculum specifics need institution counsel and an academic owner.
