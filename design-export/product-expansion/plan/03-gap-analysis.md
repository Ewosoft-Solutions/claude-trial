# 03 · Gap analysis — requirements + live code vs incumbent

This compares three things: **(1)** SchoolWithEase requirements (authoritative), **(2)** the incumbent capability visible in the corpus, **(3)** the **current implementation** as verified in the repository on 31 Jul 2026. A route name is not proof of a finished workflow.

## Status legend

| Status       | Meaning                                                           |
| ------------ | ----------------------------------------------------------------- |
| **Strong**   | Data/security/service/UI substrate exists and can be extended.    |
| **Partial**  | Real data + surfaces exist, but the parity job is incomplete.     |
| **Thin**     | One aggregate/list supports a demo, not incumbent depth.          |
| **Req-only** | Required (often permissioned) but no domain implementation found. |
| **Stub**     | Surface/endpoint present, operation not implemented.              |
| **Absent**   | No meaningful implementation found.                               |

## Verified baseline (self-checked, not quoted)

71 web routes · 24 API modules / 45 controllers · **58 Prisma models / 22 files** · **305 permissions / 28 categories / 11 pools (clearance 0–10)**. The 58 models, by file:

`academic-structure`(5): AcademicYear, Term, Course, Class, ClassTeacher · `admissions`(1): AdmissionApplication · `ai`(5): AiSettings, AiUsageMonthly, AiConcurrencyLease, ChatSession, ChatMessage · `assessment-grading`(6): Assessment, AssessmentQuestion, AssessmentSubmission, Question, Grade, GradingSystem · `attendance`(1): AttendanceRecord · `audit-logging`(1): AuditLog · `communication`(3): Message, MessageReadReceipt, Announcement · `events`(2): SchoolEvent, EventAttendee · `finance`(2): FeeInvoice, Payment · `health`(1): HealthRecord · `hr`(2): StaffPayrollRecord, StaffLeaveRequest · `learning`(3): Lesson, LessonMaterial, MaterialChunk · `library`(1): LibraryBook · `profile`(3): User, Session, + MFA/security · `roles-permissions`(6): Role, Permission, PermissionPool, PermissionPoolPermission, RolePermissionPool, UserTenantRole … · `security-policy`(3): SchoolSecurityPolicy, SensitiveOperationPolicy(+ChangeRequest) · `student-management`(3): Student, Enrollment, StudentGuardian · `tenant`(1): Tenant · `transport`(1): TransportAssignment · `user-management`(7): UserTenant, UserTenantPermission, MakerCheckerRequest, LoginAttempt, PasswordHistory …

**Doc drift to resolve:** `requirements/permissions.md`=274, `CURRENT_PHASE.md`/scorecard=297, **seed=305**; `AI_CONTEXT.md` says "mock data" but routes are wired to services. Use **requirements for intent, code for state**.

---

## People, identity & access

| Job                                  | Req basis                    | Incumbent (C)              | Current evidence (R)                                                                                  | Status → decision                                                                                |
| ------------------------------------ | ---------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Provision users (invite/direct/bulk) | multi-tenant onboarding      | C001–C014                  | tenant invite APIs, accept-invite route, `settings/users`                                             | **Partial.** Add bulk-invite, resend/expiry, person-matching, delivery tracking.                 |
| Staff directory                      | staff management             | C025–C027                  | `hr/directory` derives people from `StaffPayrollRecord`                                               | **Thin.** No first-class `Employment`/staff profile.                                             |
| User directory                       | account management           | C132                       | `settings/users` + modern list                                                                        | **Partial.** Merge with staff into one People dir; add detail, sessions, access timeline.        |
| Teaching allocation                  | teacher assignment           | C015                       | `ClassTeacher`, `classes/teachers` (active/history)                                                   | **Strong.** Extend to subject load, dates, substitution.                                         |
| Granular RBAC                        | 300+ resource/action/context | C004–C010 (VIEW/EDIT only) | **305 perms**, `resource.action.context`, clearance, pools, `UserTenantPermission` overrides          | **Architecturally ahead.** We already model `.own/.children/.own_classes/.medical_info/.export`. |
| Role-management UX                   | custom roles, inheritance    | (matrix in invite)         | `settings/roles` is a **read-only list**; "Add role" **unwired**; `role-management.controller` exists | **Stub. P0 governance gap.**                                                                     |
| Maker–checker + step-up              | explicit requirement         | not visible                | `MakerCheckerRequest`, `SensitiveOperationPolicy`, `step-up.controller`                               | **Strong.** Extend to finance/results/signatures/role changes.                                   |
| Effective-access preview             | least-privilege intent       | not visible                | —                                                                                                     | **Absent. P1.** Build "why does this user have X" explainer.                                     |
| Periodic access review               | audit intent                 | not visible                | —                                                                                                     | **Absent. P1.**                                                                                  |

## Admissions

| Job                             | Req                      | Incumbent (C)  | Current (R)                                                      | Status → decision                      |
| ------------------------------- | ------------------------ | -------------- | ---------------------------------------------------------------- | -------------------------------------- |
| Application pipeline            | full admissions workflow | C016–C024      | `AdmissionApplication`(stage/decision/notes) + `admissions` list | **Thin.** Insufficient for parity.     |
| Configurable forms + responses  | online forms             | C019–C020      | none                                                             | **Absent. P0.**                        |
| Document checklist/verification | doc management           | C039 (implied) | none                                                             | **Absent. P0.**                        |
| Review/scoring/decision history | review/approve/waitlist  | C020           | only current `stage`/`decision` strings                          | **Thin. P0.**                          |
| Interviews/exams                | explicit                 | C021           | none                                                             | **Absent. P0/P1.**                     |
| Admission quiz                  | assessment tools         | C023           | `Assessment` exists, no app link                                 | **Reuse. P1.**                         |
| Admission fee/payment           | fees                     | C018, C022     | Finance exists, no app link                                      | **Partial. P1.** Reuse finance ledger. |
| Offer → enrollment conversion   | app→student              | C020           | none                                                             | **Absent. P0.**                        |

## Student information

| Job                        | Req                  | Incumbent (C)        | Current (R)                                                             | Status → decision                                                                         |
| -------------------------- | -------------------- | -------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Student record             | full profile         | C032                 | `Student` + JSONB personal/academic/health/emergency/specialNeeds       | **Partial.** Type + index searchable/governed attrs.                                      |
| Guardian relationships     | family               | C049 (Father/Mother) | `StudentGuardian`(relationship/isPrimary/legalGuardian/contactPriority) | **Strong — already beats incumbent.** Add custody/consent/verification/date-range.        |
| Enrollment history         | transfers/withdrawal | C035, C037           | `Student` status dates + `Enrollment`                                   | **Partial.** Add `EnrollmentStatusEvent` + rollover workflow.                             |
| Bulk import                | data import          | C033                 | none                                                                    | **Absent. P0.**                                                                           |
| Photos & documents         | digital storage      | C038–C039            | none                                                                    | **Absent. P0** (migration + parity).                                                      |
| Directory + saved search   | search/usability     | C040–C043 (3 pages)  | `students/directory` w/ search/status filters                           | **Good redesign base.** Add URL state, server filters, saved views, bulk, column privacy. |
| Elective/optional subjects | subject enrollment   | C036                 | class-based only                                                        | **Absent. P0** (secondary).                                                               |
| Houses/boarding/pathways   | polymorphism         | C032 (sport house)   | none                                                                    | **Req-adjacent. P1** by profile.                                                          |
| Promotion/rollover         | progression          | C035, C118           | none complete                                                           | **Absent. P0** seasonal.                                                                  |
| Secure activation          | security             | C034 (generated pw)  | invitations + MFA                                                       | **Advantage.** Do not copy password distribution.                                         |

## Academic structure & curriculum

| Job                            | Req                  | Incumbent (C)     | Current (R)                                       | Status → decision                                          |
| ------------------------------ | -------------------- | ----------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| Years/terms/classes/courses    | core                 | throughout        | `AcademicYear, Term, Course, Class, ClassTeacher` | **Strong.**                                                |
| Timetable                      | scheduling/conflict  | C008 (perm)       | `classes/timetable` route, no timetable model     | **Stub. P1.**                                              |
| Subject catalog                | subject mgmt         | C113              | `Course` + `classes/subjects`                     | **Partial.** Add authority, aliases, versions, milestones. |
| National/tenant curriculum     | mapping/polymorphism | C077–C081 (9,427) | `Lesson` content only                             | **Absent as a domain. P0/P1.**                             |
| Topic/scheme/outcome hierarchy | mapping              | C079–C080         | lesson order/content                              | **Absent. P1.**                                            |
| Curriculum overlay/versioning  | tenant customization | C078 (fork)       | none                                              | **Absent. P1.**                                            |
| Academic calendar              | terms/holidays/dates | C028–C029, C117   | `SchoolEvent` + year/term dates                   | **Partial.** Add types/recurrence/closure + special terms. |
| University/TVET structures     | polymorphism         | not shown         | class/course oriented                             | **Req gap.** programme/department/credit/registration.     |

## Teaching, lessons, homework & CBT

| Job                                         | Req                 | Incumbent (C)     | Current (R)                                                   | Status → decision                                                                                            |
| ------------------------------------------- | ------------------- | ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Lesson authoring                            | planning            | C067              | `Lesson`(rich content, class) + `LessonMaterial`              | **Strong, partial parity.** Add template/version/curriculum/priority/due.                                    |
| Lesson review                               | oversight           | C069–C074 (2,647) | `LessonMaterial.reviewStatus/reviewer/note`, `classes/review` | **Strong.** Add assignment/SLA/history/bulk routing.                                                         |
| Learning materials                          | resources           | C069              | `LessonMaterial` (+`MaterialChunk` for extraction)            | **Strong.**                                                                                                  |
| Homework/assignment                         | assignment tracking | C064–C066         | `Assessment`(assignment/homework), attempts, due date         | **Partial.** Add file/text submissions, class-default audience, rubric, feedback, resubmission, late policy. |
| Question bank                               | assessment tools    | C060              | `Question`, `AssessmentQuestion` (MCQ/TF/short/essay)         | **Strong.**                                                                                                  |
| Question import (Excel/Aiken)               | bulk ops            | C060              | no production import adapters found                           | **Gap. P1.**                                                                                                 |
| Online assessment                           | exams               | C059, C062        | duration/attempts/auto-mark/manual handoff, taking UI         | **Strong, partial controls.**                                                                                |
| Exam scheduling/invigilation/accommodations | 12 `exams.*` perms  | C059              | no timetable/room/invigilator/accommodation models            | **Req-only. P1.**                                                                                            |
| Result handoff from CBT                     | grade mgmt          | C063 (manual)     | submissions can write grades                                  | **Advantage.** Keep atomic/audited transfer.                                                                 |
| Video/live classroom                        | LMS                 | C075 (BClass)     | material can store video; no conferencing                     | **Integrate, don't rebuild. P2.**                                                                            |
| AI item/pedagogy generation                 | AI phase            | C081, C060        | AI tutor/analytics; no authoring-provenance                   | **Partial. P2 after governance.**                                                                            |

## Assessment, results & transcripts

| Job                        | Req                         | Incumbent (C)      | Current (R)                                                              | Status → decision                                                 |
| -------------------------- | --------------------------- | ------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Grade entry                | entry + validation/approval | C044–C045          | `Grade` + gradebook UI                                                   | **Partial.** Add import/validation/moderation/approval.           |
| CA/component schemes       | polymorphic grading         | C053 (CA1–4/EXAM)  | `Assessment` type/weight; `GradingSystem` JSON                           | **Foundation.** Needs named effective-dated scheme + constraints. |
| Grade scale                | polymorphic                 | C114 (WAEC/custom) | `GradingSystem` JSON scale                                               | **Strong.** Add version/effective scope + overlap validation.     |
| Remarks/comment bank       | report cards                | C120–C125 (724+)   | `Grade` feedback/notes only                                              | **Absent structured. P0/P1.**                                     |
| Report cards               | automated reports           | C051–C052          | `students/gradebook/report-cards` route (computed)                       | **Partial/presentation.** Add artifact/snapshot/job/template.     |
| Transcripts                | official records            | C043               | `students/gradebook/transcripts` route + `Enrollment` finalGrade/credits | **Partial/presentation.** Add official artifact + verification.   |
| Publication/lock           | explicit PRD                | C112               | none first-class                                                         | **Absent. P0** (parity + integrity).                              |
| Promotion                  | progress                    | C118               | none governed                                                            | **Absent. P0.**                                                   |
| Ranking/position           | configurable                | C115               | none                                                                     | **Optional P1; off by default.**                                  |
| Batch generation/delivery  | reports + comms             | C052, C104         | none orchestrated                                                        | **Absent. P0/P1.**                                                |
| Historical reproducibility | academic history            | implied            | mutable configs not linked to published artifacts                        | **Critical architecture gap. P0.**                                |

## Attendance & wellbeing

| Job                                      | Req                | Incumbent (C)         | Current (R)                                                  | Status → decision                                   |
| ---------------------------------------- | ------------------ | --------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| Daily attendance                         | manual/bulk/mobile | C056                  | `AttendanceRecord` + `attendance/daily`                      | **Strong MVP.**                                     |
| Lesson/subject attendance                | per-class          | C056                  | one class/date record                                        | **Gap. P1.**                                        |
| Absence reasons/excuses                  | explicit           | C056                  | `excused` + notes                                            | **Thin. P1.**                                       |
| Parent alerts                            | explicit           | C048 (impl.)          | push client; no fan-out                                      | **Absent end-to-end. P0/P1.**                       |
| Offline attendance                       | PWA                | C033/C059 constraints | SW/PWA base; no offline register/sync                        | **Partial. P1.**                                    |
| Health profile                           | health records     | C032                  | `HealthRecord` (**encrypted narrative + blind-index flags**) | **Strong privacy foundation, thin clinical scope.** |
| Visits/medication/immunization/incidents | explicit           | not assessed          | none                                                         | **Req-only. P1.**                                   |
| Safeguarding/behaviour                   | safety             | C131 (metric)         | none                                                         | **Absent. P1, sensitive.**                          |

## Finance & operations

| Job                                      | Req                  | Incumbent (C)  | Current (R)                                                   | Status → decision                                                |
| ---------------------------------------- | -------------------- | -------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| Invoice/payment                          | billing              | C083, C085     | `FeeInvoice`+`Payment` (kobo), `finance/*` pages              | **Strong MVP.**                                                  |
| Fee catalog/schedule/lines               | fee structure        | C087           | invoice has aggregate `amountDue` only                        | **Critical gap. P0.**                                            |
| Discounts/waivers/scholarships           | aid                  | C090           | none                                                          | **Absent. P0/P1.**                                               |
| Opening/brought-forward debt             | parity               | C091           | none                                                          | **Absent. P0 migration.**                                        |
| Family wallet/credit                     | parent payment       | C082, C084     | none                                                          | **Absent. P1** (validate demand + accounting treatment).         |
| Allocation/refunds/chargebacks           | processing           | C082           | `Payment.invoiceId` → **one** invoice; refund status only     | **Thin. P0/P1.**                                                 |
| Receivables/reminders/statements         | management           | C086, C089     | `finance/reports`; no statement/campaign                      | **Partial. P0/P1.**                                              |
| General ledger                           | reporting            | C095           | none                                                          | **Absent. P1 or integrate — strategic decision.**                |
| Income/expense/budget                    | finance              | C096–C098      | none                                                          | **Req-only. P1.**                                                |
| Finance reporting/export                 | analytics            | C101–C102      | `reporting-analytics` marks export/schedule/custom **stub**   | **Stub. P0/P1.**                                                 |
| Staff profile/employment                 | employee records     | C026           | none; HR derived from payroll                                 | **Critical HR gap. P0/P1.**                                      |
| Payroll                                  | payroll              | C099           | `StaffPayrollRecord` (1/staff/period) + `StaffLeaveRequest`   | **Thin. P1.** Add packages/allowances/deductions/runs/statutory. |
| Inventory/assets                         | inventory            | C100           | permissions only (`INVENTORY_PERMISSIONS`=7); no models       | **Req-only. P1/P2.**                                             |
| Library circulation                      | library              | (perm)         | `LibraryBook` stores current borrower/due; `library/loans` UI | **Thin.** Add copy/title/loan/reservation/fine/history.          |
| Transport ops                            | route/driver/vehicle | C008 (perm)    | `TransportAssignment` (route/stop/time/vehicle labels)        | **Thin.** Add route/stop/vehicle/driver/trip/incident.           |
| Events                                   | events               | C028           | `SchoolEvent`+`EventAttendee`                                 | **Good MVP.** Add recurrence/audience/consent/check-in.          |
| Cafeteria/facilities/sports/clubs/safety | explicit             | (perm buckets) | permissions only (each 6–8)                                   | **Req-only. P2/profile-gated.**                                  |

## Communication, reporting, integrations & PWA

| Job                               | Req         | Incumbent (C)           | Current (R)                                                                           | Status → decision                                                     |
| --------------------------------- | ----------- | ----------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| In-app messaging                  | messaging   | (implied)               | `Message`/`MessageReadReceipt`                                                        | **Strong foundation.**                                                |
| Announcements                     | explicit    | (implied)               | `Announcement`(targets/schedule/priority)                                             | **Strong.**                                                           |
| SMS/email delivery                | explicit    | C105–C110               | email abstraction; auth SMS/email have provider **TODOs**; no delivery-attempt domain | **Not parity-ready. P0.**                                             |
| Delivery observability (DND/cost) | comms       | C107                    | read receipts only; no channel/provider attempt ledger                                | **Gap. P0/P1.**                                                       |
| Notification preferences/consent  | explicit    | not visible             | permission exists; no model                                                           | **Gap. P1.**                                                          |
| Parent portal                     | explicit    | C049 targeting          | `parent-portal` module + children endpoint                                            | **Partial.** Needs coherent parent home + statements/reports/consent. |
| Feedback/surveys                  | engagement  | C030–C031               | permissions only; no survey model                                                     | **Absent. P2** unless migration-critical.                             |
| Global search                     | usability   | (3 search pages)        | `search.controller` + global search UI                                                | **Advantage.** Extend indexes/commands/privacy scopes.                |
| Reports dashboard                 | reporting   | C101, C131              | `reports/*`, `reporting-analytics`                                                    | **Partial.** Govern definitions + drill-down.                         |
| Export/schedule/custom report     | explicit    | C101 (Excel)            | **stubbed** in `reporting-analytics.service`                                          | **Stub. P0/P1.**                                                      |
| Payment gateway                   | integration | C084 (online, failures) | `Payment.reference` only; no gateway/webhook state                                    | **Gap. P0/P1.**                                                       |
| SIS/LMS/API/webhooks/SSO          | explicit    | C094 (Sage), C075       | internal APIs; no public integration/webhook/LTI/OneRoster                            | **Req gap. P1/P2.**                                                   |
| PWA install/offline/push          | strategy    | connectivity notes      | manifest/SW/push client; delivery backend pending                                     | **Partial foundation.**                                               |

## Branding, configuration, governance & migration

| Job                       | Req               | Incumbent (C)       | Current (R)                                             | Status → decision                                        |
| ------------------------- | ----------------- | ------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| Tenant branding           | logo/colour/theme | C126                | `settings/branding` + tenant settings                   | **Partial.** Add safe asset pipeline + report preview.   |
| Academic policy config    | polymorphic       | C112–C130           | `settings/general`, academic structure, `GradingSystem` | **Partial.** Consolidate as effective-dated policy sets. |
| Feature toggles           | explicit          | (module privileges) | tenant feature settings + nav gates                     | **Strong.**                                              |
| Audit                     | explicit          | limited             | `AuditLog`, platform + tenant audit pages/writer        | **Strong.** Extend event coverage.                       |
| Signature/seal governance | official docs     | C126–C128           | none                                                    | **Absent + high-risk. P0/P1.**                           |
| Data migration            | parity            | C091, C039          | none                                                    | **Critical absent. P0.**                                 |
| Reconciliation            | integrity         | C091                | none                                                    | **Critical. P0.**                                        |
| Read-only legacy archive  | continuity        | historical lists    | none                                                    | **P0 cutover decision.**                                 |

---

## Implementation risks found

1. **MVP labels overstate readiness.** `AdmissionApplication`=stage+decision+note; `StaffPayrollRecord` **is** the staff directory; `LibraryBook` stores current loan not a ledger; `TransportAssignment` stores labels not entities; `HealthRecord` is a current profile not visit history; `FeeInvoice` has an aggregate amount with no line items. Reasonable as vertical slices — **do not let them become the long-term model by field accretion.**
2. **Presentation-only actions create false confidence.** `settings/roles` "Add role", student "Export/Add", admissions "New application", invoice "Export/New", payroll "New run" are surfaces without the full command path. **Definition of done = permission → validation → mutation → audit → state → tests.**
3. **Reporting export/schedule/custom are explicitly stubbed** in `reporting-analytics.service` — directly contradicting the parity need for the legacy system's Excel export (C101) and batch artifacts (C052).
4. **Communication delivery is not a production domain.** Email abstraction + message models exist, but auth MFA carries provider TODOs, the queue is process-local, and there is no provider delivery-attempt/cost/retry/consent model. The legacy system makes delivery **highly visible** (C105–C107); schools will notice immediately.
5. **Status docs drift** (274/297/305; "mock data"). Replace prose completion claims with a capability catalog linked to executable checks + owners.

## Priority classification

**P0 — needed for credible migration or first term:** migration/import/reconciliation workbench; person/student/staff/guardian/document foundations; student import + photo/doc mapping + rollover + subject elections; admissions form/response/document/stage/offer/conversion core; fee catalog/schedule/lines + opening balances + discounts + payment allocation + statements; result-cycle (entry/import/validate/moderate/approve/publish-snapshot/batch/amend); comment/remark policy + authorized signing; production SMS/email/push delivery + logs; role-creation/effective-access UX; real report-export jobs; completion of presentational P0 commands.

**P1 — broad parity:** admissions interviews/exams/assessment link; curriculum framework/version/outcome hierarchy; lesson templates + supervision ops; assignment submissions/rubrics/resubmission; exam scheduling/invigilation/accommodations; subject/period attendance + excuses + alerts + offline; first-class HR/employment + payroll engine + leave; transport route/fleet + library circulation; income/expense/budget or approved accounting integration; inventory/assets; notification preferences + access-review campaigns; saved views + report scheduling.

**P2 — differentiators / profile-gated:** parent feedback/surveys; conferencing/LTI; cafeteria; facilities; sports/clubs; live GPS; AI pedagogy/item generation after governance; predictive analytics after metric quality; GL depth if build (vs integrate) is chosen.

## Verdict

SchoolWithEase is **not starting behind**: its horizontal platform (tokens/components, tenant RLS, scoped `resource.action.context` permissions, maker–checker, audit, feature toggles, PWA base, enveloped-encryption health, kobo money) is **stronger than the legacy system's visible design**. It is behind in the **vertical depth** that makes a school trust the system at term-end, during admissions, and at reconciliation. The fastest credible route is to **deepen a handful of shared aggregates** — People, Admission, ResultCycle, Student/Family Account+Ledger, Engagement Delivery, Curriculum Version, and Migration Job — rather than build one page per screenshot.
