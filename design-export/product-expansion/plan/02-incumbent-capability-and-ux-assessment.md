# 02 · Incumbent capability & UX assessment

The legacy system is treated here as **evidence of what schools have learned to depend on**, not as a target architecture. For each domain: the **job**, the **visible capability**, the **interaction debt**, and the **SchoolWithEase pattern** that should absorb the job.

## Capability map at a glance

| Domain                       | Visible depth                                                                          | Parity importance | Screens                    |
| ---------------------------- | -------------------------------------------------------------------------------------- | ----------------- | -------------------------- |
| Identity, users, permissions | invite/direct/bulk, campus access, VIEW/EDIT matrix, enable/disable                    | Critical          | C001–C015, C025–C027, C132 |
| Admissions                   | applicants + full pipeline (forms/responses/interviews/payments/quizzes/notifications) | Critical          | C016–C024                  |
| Student information          | register (online/Excel), lifecycle, photos/docs, 3 search pages, guardians             | Critical          | C032–C043                  |
| Results & reporting          | entry/import, remarks, spreadsheets, batch reports, delivery, publish/lock, config     | Critical          | C044–C055, C112–C130       |
| Attendance                   | daily/subject entry + view + reports                                                   | Critical          | C056–C057                  |
| CBT & homework               | exam config, 5 import paths, scripts; targeted homework                                | High              | C059–C066                  |
| Lessons & curriculum         | authoring, templates, supervision at scale, curriculum + AI pedagogy                   | High              | C067–C081                  |
| Finance & accounting         | wallets, fee catalog, discounts, debt; income/expense/budget/payroll/inventory         | Critical          | C082–C102                  |
| Engagement                   | Communication + SMS + Email, DND/cost, delivery logs, feedback                         | Critical          | C028–C031, C103–C111       |
| Dashboards                   | school + teacher, learning progress, 40+ gauges, AI                                    | Medium–high       | C058, C131, C133           |
| Configuration                | subjects, classes, grading, ranking, promotion, remarks, signatures, template          | Critical          | C112–C130                  |

---

## 1 · Identity, provisioning & access

**Visible capability.** Three provisioning paths (invite / direct-create / bulk, C001); staged wizards with async validation (C014) and review-before-send (C013); staff flag, "receive all mail" flag, and **multi-campus access** in one flow (C011–C012); a large permission matrix (C004–C010); staff/user directories with per-row enable/disable + QR (C026); staff→subject/class allocation with an assignment log (C015).

**What's genuinely good.** Schools onboard people differently, and the legacy system acknowledges it; the invite path does **not** transmit a password (C013); campus/arm access is real; async email/Staff-ID availability reduces errors.

**Interaction debt.**

- **Identity, employment, teaching allocation and authorization are fused** into one wizard (C003, C011) — they are related but distinct records.
- The matrix **looks** precise but is a coarse **VIEW/EDIT** binary (C006) over **incoherent buckets** — Library, Transport, Census, Attendance all under "Academics" (C008); Facility + Appointments under "Human Resource" (C009).
- No **verbs beyond view/edit** (no create/delete/approve/publish/refund/export), no **scope** (own class, own child, campus), no **effective-access explanation**, no **separation-of-duties**, and a one-click **"Select All"** (C005) with no risk preview.
- Duplicate directories (All Staff C026 vs All Users C132) and **account-enable conflated with employment status** (C026).
- Contact PII (email/phone/gender) shown by default in wide tables (C026, C132).

**SchoolWithEase pattern.** One **People** platform of linked records (person → auth identity → tenant membership → staff/student/guardian profiles → teaching allocation → effective access). Creation starts from the _job_ ("add a relationship"), applies a **role template**, narrows **scope**, adds exceptions, then **previews effective access** and routes risky grants through step-up/maker–checker. Our `resource.action.context` catalog already supports this; the missing piece is the management UX (see [04](04-target-product-and-architecture.md) §Authorization).

## 2 · Admissions

**Visible capability.** A genuine pipeline embedded as "Full Admission Pro." (C019): **Forms · Responses · Interviews/Exams · Payments · Quizzes · Notifications**, with named stages (Pending/Shortlisted/Invited/Interviewed/Admitted/Rejected, C020), interview scheduling + outcomes (C021), payment collection (C022), reusable admission quizzes (C023), and email delivery stats (C024).

**Interaction debt.** The modern product is **nested inside** the legacy shell and **duplicates** the older Applicants page (C016 vs C019); admissions **payment is a silo** twice over (C018, C022) rather than a finance-ledger entry; quizzes are a **separate assessment engine**; no visible document checklist/verification, duplicate-applicant matching, offer/acceptance/deposit, waitlist order, or one-command **conversion** to student.

**SchoolWithEase pattern.** Make the application an **aggregate** (form version + response snapshot, documents + verification, review/scoring, interview/exam event, **finance-linked** charge, decision/offer/acceptance, **reviewable conversion**), presented as a board/list toggle over **one lifecycle** with permissioned, timestamped, audited stage transitions.
**Our current state (R):** `AdmissionApplication` holds only `applicantName, applyingFor, guardian{Name,Email,Phone}, stage(application|interview|decision), decision(pending|accepted|waitlisted|rejected), notes` — **thin MVP**, insufficient for parity.

## 3 · Student information & enrollment

**Visible capability.** Long online registration with Nigerian demographics (State/LGA, religion, sport house, health, guardian — C032); Excel import with a template and connectivity guidance ("batch of 200", siblings share phone — C033); rollover (C035), elective allocation (C036), status change (C037), single/bulk photo + admission-doc upload with a **776-item missing-photo queue** (C038–C039), and three search/list pages (C040–C043).

**Interaction debt.** One form owns identity+admission+enrollment+guardian+demographics+health+house (C032); the **status enum mixes lifecycle + reason + finance ("Defaulting") + archival** (C040); **three** search destinations; guardian phone exposed in list rows; photo import relies on **filename matching**; and **Generate-Password-via-SMS/email** (C034) is security debt.

**SchoolWithEase pattern.** One **Student Directory** (server-side search/filter/sort, saved views, URL state, privacy-aware columns, bulk-action bar) over explicit histories: `StudentProfile`, `StudentIdentifier`, `Enrollment` + `EnrollmentStatusEvent`, `GuardianRelationship`, `StudentDocument`/`StudentPhoto`, `HouseMembership`, `StudentSubjectElection`, with **financial hold** and **medical/safeguarding** as separate restricted domains.
**Our current state (R):** clean 6-value `enrollmentStatus`; `StudentGuardian` already models `relationship/isPrimary/legalGuardian/contactPriority` (**better than Father/Mother**, C049) — but personal/academic/health live in **untyped JSONB**, and there are no document/photo/identifier/election models.

## 4 · Results, grading & academic records

**Visible capability.** The deepest domain: online + Excel entry (C044–C045), subject/class/session spreadsheets (C046, C054–C055), remark entry + comment bank (C047), **SMS + link result delivery** (C048–C050), single + **batch (of 20)** reports (C051–C052), mid-term CA search (**CA1–CA4/EXAM**, C053), skill-area analytics with intervention lists (C054), and full **result configuration**: WAEC + custom grade scales (C114), ranking toggle (C115), promotion cutoff (C118), per-class compulsory subjects (C119), 724+ remark rules (C120–C125), logo/signatures/template (C126–C130), and **publish/lock/unpublish with per-student blocking** (C112).

**Interaction debt.**

- **A menu of ~13 operations replaces a result lifecycle** — entry/import/validate/moderate/approve/publish/notify/correct never form one flow (C044–C055).
- Context (division/class/term/session) is re-selected on nearly every page.
- **Manual CBT→gradebook re-save** (C063) risks inconsistency.
- No visible **calculation-version snapshot**: changing grade thresholds/remarks/subjects could silently alter historical reports.
- Publication is **single-actor** (C112), and **per-student result blocking** couples finance to academic truth.
- Guardian targeting is **Father/Mother/Both** (C049); ranking is a blunt **on/off toggle** (C115); promotion decisions are **hardcoded into remark prose** ("Promoted to SS 3", C124); grade scales carry **corrupted migrated values** ("Exce", "A ve", C114); the template page can throw a bare **"OOPS"** (C130).

**SchoolWithEase pattern.** A **ResultCycle workbench**: `Configure → Open entry → Validate → Moderate → Approve → Publish (immutable snapshot) → Notify → Amend → Archive`, keeping academic context once selected, where every published artifact references **immutable versions** of year/term, roster, subjects, assessment scheme, grade scale, remark rules, promotion policy, and authorized signatures — corrected only by amendment.
**Our current state (R):** `Grade`, `GradingSystem` (JSON scale), class gradebook UI exist; **no result-cycle/publication-snapshot/remark-ruleset/promotion-workflow** models — the critical reproducibility gap.

## 5 · Attendance

**Visible capability.** Daily + subject attendance, view, and reports (C056–C057).

**Interaction debt.** Four separate destinations; a fundamentally **date-based** job forced through a **Class/Session/Term** shell with no visible date navigation; no absence reasons/late minutes/evidence/excuse review/guardian notification in the captured screens.

**SchoolWithEase pattern.** One **register** with a mode (school-day / period / event / transport / boarding), date-driven, present-by-default with keyboard/bulk editing, offline queue + sync-conflict handling, excuse review, correction history, intervention thresholds, and a daily-completeness dashboard.
**Our current state (R):** `AttendanceRecord(date, status, notes, excused)` + daily UI — strong MVP; add period/subject grain, offline sync, notification fan-out.

## 6 · CBT, homework, lessons & curriculum

**Visible capability.** Rich CBT config (duration, attempts, reshuffle, online/offline, marking type, **60-question bandwidth cap**, C059) with **five authoring paths** (Excel, Aiken, reuse, **AI-generate**, online — C060) and multi-exam attach (C061); targeted, time-bound homework with a rich editor (C064–C066); a genuinely well-designed **lesson-plan** module — curriculum-linked authoring with supervisor + priority (C067), templates (C068), and a real **review lifecycle at scale** (156 → 2,647 plans; Awaiting/Approved/Needs-Revision/Withdrawn; overdue tracking; one engine over plans + notes — C069–C074); curriculum authoring (Class→Subject→Topic, forkable, **9,427 national items**, AI pedagogy — C077–C081); and a parallel **BClass** hub (C075).

**Interaction debt.** **BClass duplicates** homework/CBT/e-note/comm-book instead of unifying them (C075); "Student Notes" is ambiguous (C069); curriculum has **no version/source/license/effective-date** and AI content has **no provenance/approval** (C081); the CBT list is an **18-column** table (C062); the manual **collate→re-save** persists (C063); homework lacks a real submission/feedback/resubmission/rubric flow (C066).

**SchoolWithEase pattern.** A shared `LearningActivity` substrate (lesson / material / assignment / quiz / discussion / live-link) with common audience, schedule, curriculum alignment, draft→review→publish lifecycle, submissions, feedback, versioning — keeping specialized engines but **no independent navigation silos**; BClass becomes a **class workspace** with a conferencing _integration_.
**Our current state (R):** `Lesson`, `LessonMaterial` (with `reviewStatus/reviewer/note`), `Assessment`/`Question`/`AssessmentSubmission`, AI tutor — **strong foundation**; add curriculum versioning, submission workflow, and content-governance depth.

## 7 · Finance, accounting, payroll & inventory

**Visible capability.** Two generations. Legacy **Payment** (C082–C094): parent wallets (family = shared phone), fee catalog with compulsory flags + targeted charges (C087), per-charge discounts with reasons (C090), bills (C089), receipts (C085), defaulters (C086), **brought-forward debt import** (C091), and **Sage** linkage (C094). Newer **Full Account** (C095–C102): income (grants/donations + auto-imported fees), expenses by category, budgets (planned-vs-actual, fiscal year), **payroll** (salary/allowances/deductions/packages/runs/history — 75 staff), **inventory** (stock/sales/issue/**fixed assets**), plus a finance dashboard with cash flow, **depreciation**, break-even, and a 6-month trend + **Excel export**.

**Interaction debt.** Money is **split across two products** (C082 vs C095); **no visible double-entry / period close / immutable posting** — reversals use **negative amounts** (C096–C097) and discounts are **editable/deletable** (C090); wallet keyed by a **fragile shared-phone** heuristic; **Sage credential capture** (C094); "Defaulter" stigma (C086); per-student **result blocking** for debtors (C112); payroll shows no NG statutory (PAYE/pension/NHF) or approval.

**SchoolWithEase pattern.** One bounded finance context: **billing/receivables** (FeeItem, FeeScheduleVersion, InvoiceLine, DiscountGrant, PaymentPlan), **cash/allocation** (PaymentReceipt, PaymentAllocation, FamilyCreditAccount, Refund, ReconciliationBatch), **accounting** (ChartOfAccount, Journal, period locks, Budget), **payroll** (jurisdiction-aware), **inventory/assets** — corrected by **reversal/contra**, with step-up + maker–checker on sensitive ops.
**Our current state (R):** `FeeInvoice(amountDue/amountPaid in kobo)` + `Payment(invoiceId → one invoice)` — **strong MVP that already avoids the negative-reversal anti-pattern**, but has **no fee items, discounts, allocation, family account, wallet, or ledger**.

## 8 · Engagement (communication, delivery, feedback)

**Visible capability.** Result delivery in-app/email/SMS (C104, C108); a **prepaid, metered SMS** system with a top-up ledger and per-message cost (**DND = 2.5, Normal = 3 units**), and a **19,539-message** log with **DND vs Normal** classification (C105–C107); audience-based compose for SMS (C106) and Email (C109); large delivery logs with recipient breakdown (C104, C111); parent feedback ratings + request campaigns (C030–C031).

**Interaction debt.** **Three channels** (Communication / SMS / Email — C103/C106/C109) each with own compose+sent, plus admission notifications and result delivery — **five+ engagement surfaces**; Email "Sent Mails" and Communication "Sent Message" are the **same 589-email dataset** (C104, C110); result links are **tokenized but effectively public** (`api.the legacy system.net/url/?url=…`, C108); no visible contact preference / consent / quiet hours / retry / bounce handling.

**SchoolWithEase pattern.** One engagement platform: `AudienceDefinition`, `MessageTemplate` + versions, `Campaign`, `Conversation`/`Message`, `Notification`, and a per-channel **`DeliveryAttempt`** carrying provider, message ID, status, **failure classification, cost/units, DND flag**, and a redacted destination — with `SecureLink` (access-controlled, expiring) replacing public result URLs.
**Our current state (R):** `Message`/`MessageReadReceipt`/`Announcement` models; auth SMS/email still carry provider TODOs; **no general delivery-attempt/cost/consent domain** — P0 for parity credibility.

## 9 · Dashboards & analytics

**Visible capability.** A school dashboard with population + term trends, **Summative vs Formative** learning progress, **gendered multi-year foundational growth**, gender distribution (incl. **Not Specified**), payment/behaviour tiles, birthdays, and **40+ per-subject donut gauges** (C131, C133); a teacher dashboard with grade distribution, at-risk, formative, birthdays, and an **AI insight** button (C058); embedded **AI Assistance (Beta)** (C133).

**Interaction debt.** The school dashboard is a **chart museum** — tiny gauges, many unexplained zeros, no metric definitions/scope/freshness/drill-down; the teacher dashboard shows **0 classes but 706 assigned subject/class records** (C058), which destroys trust; AI sits beside metrics with only a light "can make mistakes" note and no source/action boundary.

**SchoolWithEase pattern.** **Task-first** dashboards (exceptions, approvals, today, progress-to-target) plus governed **Insights** where every tile carries name + plain definition, period, scope, freshness, numerator/denominator, and drill-down — with explicit empty/no-data/not-applicable states.
**Our current state (R):** `overview` + `reporting-analytics` modules and pages exist; export/schedule/custom-report are **stubbed** — govern definitions and finish export jobs.

---

## Cross-system UX assessment

**Information architecture.** Deep sidebar mixing domains + operations + configuration; separate pages for search / list / create / archive / entry-method / report-type; embedded sub-apps (Full Admission Pro., Full Account); repeated school/session/term/class filters; a persistent **"Pay Now"** subscription nag inside work areas (C016+). → **Object- and workflow-centred IA**: one directory per entity, one workbench per lifecycle, one detail route with a timeline, saved views instead of search pages, a context bar carrying tenant/campus/year/term, and commercial alerts kept out of operational surfaces.

**Tables & dense data.** Tiny striped rows, many columns, inline toggles, repeated View/Edit/Delete, contact PII shown by default, no column presets or saved views (C026, C043, C062, C107). → Server-side pagination/filter/sort, URL-backed views, role-based column presets, frozen identity columns, row-selection + bulk-action bar, **masked-by-default** contact, keyboard nav.

**Forms & validation.** Long single-page forms, placeholder-ish labels, repeated context selectors, checkbox "confirmations" instead of impact summaries (C032, C082, C090). → Persistent labels, correct input types, progressive sections by job, inline validation + error summary, autosave drafts, review page for high-impact submissions, typed confirmation for irreversible actions. (the legacy system already does async validation well, C014 — keep that.)

**States & feedback.** Blank pages, an unexplained **"OOPS"** (C130), data-zero states that read like success (C131), and the persistent expiry nag. → Explicit loading / empty / no-results / **permission-denied (with who-can-help)** / offline / partial / error / success states; background work with progress + retry + completion.

**Accessibility (visible risks).** Tiny text, low contrast, colour-only status pills, icon-only controls (QR/toggles), dense tables, ambiguous labels. → **WCAG 2.2 AA** baseline: semantic tables/dialogs/landmarks, accessible names, visible focus, non-colour status cues, ≥24px targets, accessible charts with text alternatives, locale-aware formatting.

**Nigerian operating conditions.** The corpus itself proves the constraints — "batch of 200 for internet speed" (C033), "Max 60 questions for network strength" (C059), "batch of 20 reports" (C052), prepaid SMS with DND economics (C107). → Read-first PWA caching, offline attendance/draft capture with visible sync state, resumable uploads, async exports/imports, idempotent submission, SMS-cost visibility, printable artifacts that are **not** permanent public links.

---

## Capabilities to retain, reframe, or reject

**Retain as explicit parity:** bulk student import + photo/doc matching; rollover + elective assignment; admissions forms/responses/interviews/payments/notifications; configurable CA/result cycles + batch reports; publish/lock/notify/amend; CBT import/reuse + online attempts; homework + lesson-plan supervision; versioned curriculum/topic mapping; fee schedules, discounts, opening debt, statements, receipts, receivables; SMS/email delivery observability incl. DND/cost; role/campus scope; official branding + authorized sign-off; governed export.

**Reframe through shared platforms:** every search page → directory + saved views; every send-SMS/send-email page → engagement composer; BClass → class workspace; admission quizzes → assessment engine; admission payments → finance ledger; result messages → engagement delivery; calendar archive → a lifecycle filter; student passwords → secure invitation + recovery; result spreadsheets → gradebook/report views; lesson/note reviews → content-review engine; fee/debt/payment pages → family/student accounts + ledger.

**Reject or materially alter:** emailing/SMSing generated passwords (C034); unmasked contact + **unguarded officer/staff signatures** (C126–C128); "Select All" access without risk preview (C005); vague VIEW/EDIT for sensitive modules (C006); **mutable/deletable posted finance** and negative-amount reversals (C090, C096); third-party **username/password capture** (C094); blank/"OOPS" states (C130); manual CBT→gradebook re-save (C063); Father/Mother-only guardian targeting (C049); **financial status encoded as student lifecycle** ("Defaulting", C040); hard-coded curriculum/grade semantics in labels (C114); ranking enabled without explicit policy (C115); and **per-student result blocking** without an explicit, audited financial-hold policy (C112).
