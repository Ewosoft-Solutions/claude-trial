# 07 · Capability parity matrix (decision-grade)

One consolidated, sortable table so planning can argue about **jobs**, not screenshots. Every incumbent capability → the job → incumbent evidence (`Cxxx`) → our current model/route → **decision** → **effort** → **phase**.

**Decision:** `Critical` (parity-critical — must ship) · `Adjacent` (deliver via a more general capability) · `Redesign` (keep job, replace interaction) · `Defer` · `Reject`.
**Effort** (net-new build on top of what exists): `S` ≤1wk-ish · `M` · `L` · `XL` (new bounded context / cross-cutting).
Phases per [06](06-roadmap-and-discussion-guide.md).

## People, identity & access

| #   | Job                                                 | Incumbent (C) | Our current (R)                                        | Decision        | Effort | Phase |
| --- | --------------------------------------------------- | ------------- | ------------------------------------------------------ | --------------- | ------ | ----- |
| 1   | Invite / direct / bulk provisioning                 | C001–14       | invite APIs + `settings/users`                         | Redesign        | M      | 2A    |
| 2   | Async validation on create                          | C014          | partial                                                | Adjacent (keep) | S      | 2A    |
| 3   | Multi-campus access per user                        | C012          | `UserTenant`                                           | Adjacent        | S      | 2A    |
| 4   | Unified People directory (retire Staff/Users split) | C025/26/132   | `students/directory`, `hr/directory`, `settings/users` | Redesign        | L      | 2A    |
| 5   | First-class staff employment                        | C026          | `StaffPayrollRecord` (derived)                         | Critical        | L      | 2A    |
| 6   | Teaching allocation + history                       | C015          | `ClassTeacher`, `classes/teachers`                     | Adjacent        | M      | 2B    |
| 7   | Role editor + effective-access preview              | C004–10       | `settings/roles` (read-only), 305 perms                | Critical        | L      | 2A    |
| 8   | Scope + expiry + separation-of-duties               | (absent)      | `resource.action.context` + pools                      | Critical        | L      | 2A    |
| 9   | Maker–checker / step-up on high-risk                | (absent)      | `MakerCheckerRequest`, `step-up`                       | Adjacent        | M      | 2A    |
| 10  | Access-review campaigns                             | (absent)      | —                                                      | Adjacent        | M      | 4     |
| 11  | Per-row enable/disable + status                     | C026/132      | user status                                            | Adjacent        | S      | 2A    |
| 12  | QR / per-staff codes                                | C026          | —                                                      | Defer           | S      | 4     |
| 13  | Generated-password SMS/email                        | C034          | invitations + MFA                                      | **Reject**      | —      | —     |

## Admissions

| #   | Job                                        | Incumbent (C) | Our current (R)                        | Decision        | Effort | Phase |
| --- | ------------------------------------------ | ------------- | -------------------------------------- | --------------- | ------ | ----- |
| 14  | Application pipeline (stages)              | C019/20       | `AdmissionApplication`(stage/decision) | Critical        | L      | 2C    |
| 15  | Versioned form + responses                 | C019/20       | —                                      | Critical        | L      | 2C    |
| 16  | Document checklist + verification          | C039          | —                                      | Critical        | M      | 2C    |
| 17  | Review / scoring / decision history        | C020          | strings only                           | Critical        | M      | 2C    |
| 18  | Interview/exam scheduling + outcome        | C021          | —                                      | Critical        | M      | 2C    |
| 19  | Admission quiz                             | C023          | `Assessment` (reuse)                   | Adjacent        | S      | 2C    |
| 20  | Admission fee/payment                      | C018/22       | Finance (link)                         | Adjacent        | M      | 2C    |
| 21  | Applicant notifications + delivery log     | C024          | Engagement (reuse)                     | Adjacent        | M      | 2C    |
| 22  | Offer/acceptance/deposit                   | C020          | —                                      | Critical        | M      | 2C    |
| 23  | One-command conversion → student           | (implied)     | —                                      | Critical        | M      | 2C    |
| 24  | Full Admission Pro. nested in legacy shell | C019          | n/a                                    | **Reject** (IA) | —      | —     |

## Student information

| #   | Job                                        | Incumbent (C) | Our current (R)                        | Decision | Effort | Phase |
| --- | ------------------------------------------ | ------------- | -------------------------------------- | -------- | ------ | ----- |
| 25  | Online registration                        | C032          | `Student` + JSONB                      | Redesign | M      | 2B    |
| 26  | Excel import + template                    | C033          | —                                      | Critical | L      | 1/2G  |
| 27  | 3 search pages → 1 directory               | C040–43       | `students/directory`                   | Redesign | M      | 2B    |
| 28  | Photo + admission-doc capture (776 queue)  | C038/39       | —                                      | Critical | M      | 2B/2G |
| 29  | Guardian relationships                     | C049          | `StudentGuardian` (**already better**) | Adjacent | S      | 2B    |
| 30  | Elective/optional subjects                 | C036          | —                                      | Critical | M      | 2B    |
| 31  | Status lifecycle (split the 12-value enum) | C040          | 6-value `enrollmentStatus`             | Redesign | M      | 2B    |
| 32  | Return-to-class / rollover                 | C035          | —                                      | Critical | M      | 2B    |
| 33  | Sport house / boarding                     | C032          | —                                      | Defer    | S      | 4     |
| 34  | Transcript per student                     | C043          | `.../transcripts` (computed)           | Critical | M      | 2D    |

## Academics, curriculum & teaching

| #   | Job                                         | Incumbent (C) | Our current (R)                  | Decision                                        | Effort | Phase |
| --- | ------------------------------------------- | ------------- | -------------------------------- | ----------------------------------------------- | ------ | ----- |
| 35  | Years/terms/classes/courses                 | throughout    | `AcademicYear/Term/Course/Class` | Adjacent                                        | —      | 2B    |
| 36  | Class taxonomy (stage/arm/stream)           | C041/116      | class name string                | Redesign                                        | M      | 2B    |
| 37  | Subject catalog + milestones                | C113          | `Course`                         | Redesign                                        | M      | 2B    |
| 38  | Curriculum framework/version/overlay        | C077–81       | `Lesson` content                 | Critical                                        | XL     | 2B    |
| 39  | Topic/scheme/outcome hierarchy              | C079/80       | —                                | Adjacent                                        | L      | 2B/3  |
| 40  | AI pedagogy with provenance                 | C081          | AI tutor                         | Redesign                                        | M      | 5     |
| 41  | Timetable                                   | C008          | `classes/timetable` (no model)   | Adjacent                                        | M      | 3     |
| 42  | Academic calendar + special terms           | C028/117      | `SchoolEvent` + dates            | Adjacent                                        | S      | 2B    |
| 43  | Lesson authoring + supervisor               | C067          | `Lesson`                         | Adjacent                                        | M      | 3     |
| 44  | Lesson/notes review lifecycle (2,647)       | C069–74       | `LessonMaterial.reviewStatus`    | Adjacent                                        | M      | 3     |
| 45  | Lesson templates                            | C068          | —                                | Adjacent                                        | S      | 3     |
| 46  | Homework (targeted, timed)                  | C064–66       | `Assessment`(homework)           | Adjacent                                        | M      | 3     |
| 47  | Homework submissions/feedback/rubric        | (thin C066)   | —                                | Critical                                        | M      | 3     |
| 48  | CBT config + attempts + reshuffle           | C059          | `Assessment`                     | Adjacent                                        | M      | 3     |
| 49  | Question import (Excel/Aiken) + AI          | C060          | `Question` bank                  | Adjacent                                        | M      | 3     |
| 50  | CBT→gradebook handoff                       | C063 (manual) | submissions write grades         | Redesign (atomic)                               | S      | 3     |
| 51  | Exam scheduling/invigilation/accommodations | C059          | 12 `exams.*` perms               | Adjacent                                        | L      | 3     |
| 52  | BClass hub                                  | C075          | —                                | **Reject** silo → class workspace + integration | M      | 3/4   |

## Results & grading

| #   | Job                                       | Incumbent (C) | Our current (R)          | Decision                           | Effort | Phase      |
| --- | ----------------------------------------- | ------------- | ------------------------ | ---------------------------------- | ------ | ---------- |
| 53  | 13 result pages → one workbench           | C044–55       | `Grade`, gradebook UI    | Redesign                           | XL     | 2D         |
| 54  | Direct entry + Excel import (one flow)    | C044/45       | entry only               | Critical                           | M      | 2D         |
| 55  | CA scheme (CA1–4/EXAM) versions           | C053          | `Assessment` type/weight | Critical                           | M      | 2D         |
| 56  | Grade scale (WAEC + custom) versions      | C114          | `GradingSystem` JSON     | Redesign                           | M      | 2D         |
| 57  | Remark rule sets (replace 724 prose rows) | C120–25       | notes only               | Critical                           | M      | 2D         |
| 58  | Promotion policy (leave prose)            | C118/124      | —                        | Critical                           | M      | 2D         |
| 59  | Result publication snapshot + lock        | C112          | —                        | Critical                           | L      | 2D         |
| 60  | Per-student result blocking               | C112          | —                        | Redesign → audited `FinancialHold` | M      | 2D/2E      |
| 61  | Amendment/supersession                    | (absent)      | —                        | Critical                           | M      | 2D         |
| 62  | Batch report generation (of 20)           | C052          | report-card route        | Critical                           | M      | 2D         |
| 63  | Report/broadsheet/transcript artifacts    | C043/51/55    | computed routes          | Critical                           | L      | 2D         |
| 64  | Skill-area analytics + interventions      | C054          | —                        | Adjacent                           | M      | 3/Insights |
| 65  | Ranking/position toggle                   | C115          | —                        | Redesign → policy, default-off     | S      | 2D         |
| 66  | Historical reproducibility                | implied       | mutable configs          | Critical                           | XL     | 2D         |

## Attendance & wellbeing

| #   | Job                                      | Incumbent (C) | Our current (R)                       | Decision | Effort | Phase  |
| --- | ---------------------------------------- | ------------- | ------------------------------------- | -------- | ------ | ------ |
| 67  | Daily attendance                         | C056          | `AttendanceRecord` + daily UI         | Adjacent | —      | (done) |
| 68  | Subject/period attendance                | C056          | one class/date                        | Adjacent | M      | 3      |
| 69  | Date-driven register (not term shell)    | C056          | class/term shell                      | Redesign | M      | 3      |
| 70  | Excuses / reasons / correction           | C056          | `excused`                             | Adjacent | M      | 3      |
| 71  | Offline attendance + sync                | connectivity  | SW base                               | Adjacent | L      | 3      |
| 72  | Absence alerts to guardians              | C048 impl.    | push client                           | Critical | M      | 2F/3   |
| 73  | Health profile                           | C032          | `HealthRecord` (**encrypted, ahead**) | Adjacent | S      | (done) |
| 74  | Visits/medication/immunization/incidents | (not shown)   | —                                     | Adjacent | L      | 4      |
| 75  | Safeguarding/behaviour cases             | C131 metric   | —                                     | Adjacent | L      | 4      |

## Finance & operations

| #   | Job                                                  | Incumbent (C) | Our current (R)                | Decision                       | Effort | Phase  |
| --- | ---------------------------------------------------- | ------------- | ------------------------------ | ------------------------------ | ------ | ------ |
| 76  | Invoice + payment                                    | C083/85       | `FeeInvoice`+`Payment` (kobo)  | Adjacent                       | —      | (base) |
| 77  | Fee catalog/schedule/lines                           | C087          | aggregate amount only          | Critical                       | L      | 2E     |
| 78  | Discounts/waivers (reversible)                       | C090          | —                              | Critical                       | M      | 2E     |
| 79  | Brought-forward / opening debt                       | C091          | —                              | Critical                       | M      | 2E/2G  |
| 80  | Family account + payment allocation (siblings)       | C082/84       | one payment→one invoice        | Critical                       | L      | 2E     |
| 81  | Wallet / unapplied credit                            | C084          | —                              | Critical                       | M      | 2E     |
| 82  | Refunds/chargebacks (linked entries)                 | C084          | refund status                  | Critical                       | M      | 2E     |
| 83  | Receivables/defaulters/statements                    | C086/89       | `finance/reports`              | Critical                       | M      | 2E     |
| 84  | Bill send/print                                      | C089          | —                              | Adjacent (Engagement)          | S      | 2F     |
| 85  | Payment gateway + idempotent webhooks                | C084 failures | `Payment.reference`            | Critical                       | L      | 2E     |
| 86  | Income/expense/budget                                | C096–98       | —                              | Adjacent                       | L      | 4      |
| 87  | General ledger                                       | C095          | —                              | **Defer/Integrate** (decision) | XL     | 4      |
| 88  | Payroll engine (packages/allowances/deductions/runs) | C099          | `StaffPayrollRecord`           | Adjacent                       | L      | 4      |
| 89  | NG statutory payroll (PAYE/pension/NHF)              | (absent)      | —                              | Adjacent                       | M      | 4      |
| 90  | Inventory + fixed assets + depreciation              | C100/102      | perms only                     | Adjacent                       | L      | 4      |
| 91  | Library circulation ledger                           | (perm)        | `LibraryBook` current-borrower | Adjacent                       | M      | 4      |
| 92  | Transport routes/fleet/trips                         | C008          | `TransportAssignment` labels   | Adjacent                       | M      | 4      |
| 93  | Events (recurrence/consent/check-in)                 | C028          | `SchoolEvent`+attendees        | Adjacent                       | M      | 3/4    |
| 94  | Sage credential capture                              | C094          | —                              | **Reject** → OAuth adapter     | —      | —      |
| 95  | Negative-amount reversals                            | C096/97       | kobo, no reversal model        | **Reject** → contra entries    | S      | 2E     |

## Engagement, reporting & platform

| #   | Job                                        | Incumbent (C)       | Our current (R)                 | Decision | Effort | Phase      |
| --- | ------------------------------------------ | ------------------- | ------------------------------- | -------- | ------ | ---------- |
| 96  | 3 messaging channels → 1 composer          | C103/06/09          | `Message`/`Announcement`        | Redesign | L      | 2F         |
| 97  | Delivery attempt ledger (DND/cost/failure) | C105–08             | read receipts only              | Critical | L      | 1/2F       |
| 98  | SMS balance/credit + budgets               | C105/107            | —                               | Critical | M      | 2F         |
| 99  | SecureLink for result/payment              | C108 (public)       | —                               | Critical | M      | 2F         |
| 100 | Notification preferences/consent           | (absent)            | perm only                       | Adjacent | M      | 3          |
| 101 | Parent feedback / surveys                  | C030/31             | perms only                      | Defer    | M      | 4          |
| 102 | School dashboard (task-first)              | C131/58             | `overview`                      | Redesign | L      | 3          |
| 103 | Governed metrics + drilldown               | C131/133            | `reporting-analytics`           | Adjacent | L      | 3/Insights |
| 104 | Report export (Excel) + schedule           | C101                | **stubbed**                     | Critical | M      | 2F         |
| 105 | Global search                              | (3 search pages)    | `search.controller` (**ahead**) | Adjacent | S      | 1          |
| 106 | Embedded AI assistant                      | C058/133            | AI modules                      | Adjacent | M      | 5          |
| 107 | Feature toggles per tenant                 | (module privileges) | tenant features (**ahead**)     | Adjacent | —      | (done)     |

## Configuration & governance

| #   | Job                                      | Incumbent (C) | Our current (R)        | Decision                                       | Effort | Phase       |
| --- | ---------------------------------------- | ------------- | ---------------------- | ---------------------------------------------- | ------ | ----------- |
| 108 | 15+ config pages → versioned policy sets | C112–30       | `settings/*`           | Redesign                                       | L      | 2D/Settings |
| 109 | Tenant branding (logo/theme)             | C126          | `settings/branding`    | Adjacent                                       | S      | 2           |
| 110 | Officer/staff signatures (104 images)    | C126–28       | —                      | **Reject** → SigningAuthority + authorized use | M      | 2D          |
| 111 | Result template selection                | C130          | `.../report-cards`     | Adjacent                                       | M      | 2D          |
| 112 | Audit log                                | (limited)     | `AuditLog` (**ahead**) | Adjacent                                       | S      | 1           |
| 113 | Migration + reconciliation workbench     | C091/39       | —                      | Critical                                       | XL     | 2G          |
| 114 | Read-only legacy archive                 | historical    | —                      | Critical                                       | M      | 2G          |
| 115 | "OOPS"/permission-denied UX              | C130          | `unauthorized` route   | Redesign                                       | S      | 1           |
| 116 | "Pay Now" nag in work areas              | C016+         | n/a                    | **Reject** (IA)                                | S      | 1           |

## Roll-up

- **Critical (parity-critical):** ~34 jobs — dominated by **Results (53–63,66), Finance (77–85), Admissions (14–23), People (5,7,8), Engagement delivery (97–99), Migration (113–114), imports (26)**. These define "replacement-ready".
- **Redesign (keep job, replace interaction):** ~14 — the fragmentation wins (directories, one composer, one result workbench, versioned policy sets, atomic CBT handoff, ranking-as-policy).
- **Adjacent (via general capability):** ~40 — mostly extensions of existing strong foundations (teaching, attendance, HR/ops, analytics, search, audit).
- **Defer:** wallet-QR, sport house, feedback/surveys, GL depth, some ops.
- **Reject (7):** generated-password SMS (13), nested sub-app IA (24), BClass silo (52), Sage credential capture (94), negative-amount reversals (95), unguarded signatures (110), "Pay Now" nag (116) — plus the per-student result blocking **redesigned** into an audited hold (60).

**XL builds to sequence first:** curriculum versioning (38), result workbench + reproducibility (53/66), finance allocation/ledger (80/87), migration cockpit (113) — each an ADR in [04](04-target-product-and-architecture.md).
