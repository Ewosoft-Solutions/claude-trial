# 04 · Target product & architecture

**Objective:** enough incumbent parity that a school migrates without losing a recurring job or a historical record, while every added capability strengthens **one** cohesive SchoolWithEase platform. The NestJS / Next.js / PostgreSQL / Prisma monorepo is the right base; the need is **deeper aggregates and firmer domain boundaries**, not microservices.

## Design principles

1. Requirements are constitutional; legacy-system parity is an input.
2. One fact, one owner (a payment, an enrollment, a publication, a delivery has one authoritative domain).
3. Records before pages; pages are views + commands over durable records.
4. Histories, not only mutable current state — academic/financial/access decisions stay reproducible.
5. Configuration is **versioned, effective-dated policy** (grade scales, curricula, fee schedules, remarks, promotion, templates).
6. High-risk changes are **workflows** (approval, step-up, audit, correction) — reusing our `MakerCheckerRequest` + `SensitiveOperationPolicy`.
7. Shared platforms absorb channels/variants (import, documents, jobs, delivery, reporting, search).
8. Polymorphism is **profile-driven** (nursery/primary/JSS/SSS/university/TVET/boarding/multi-campus are configuration).
9. Low-connectivity resilience is an application invariant.
10. Migration fidelity is a product capability.

## Global shell

Role-shaped nav · school/campus + profile switcher · academic-context bar (tenant/campus/year/term) · **global search / command palette** (extend `search.controller`) · inbox/notifications · **approvals/tasks** (surface `MakerCheckerRequest`) · account/security · sync/offline indicator. The persistent "Pay Now" nag is **removed from operational surfaces** — billing lives in account settings only.

## Primary workspaces → what they consolidate

| Workspace              | Absorbs (incumbent)                                                        | Detail record                        | Key commands                                        |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------- |
| Overview               | teacher/school dashboards (C058/C131/C133)                                 | task/exception                       | resume, approve, resolve                            |
| People                 | Users/All-Staff/Search-Staff/All-Users/guardians/applicants (C025–27/C132) | person + profiles                    | add relationship, invite, enroll, allocate, suspend |
| Academics              | classes/subjects/curriculum/timetable/calendar (C077–81/C116–17)           | offering/class                       | plan year, publish structure, assign                |
| Teaching               | lessons/materials/homework/CBT/review/BClass (C059–76)                     | learning activity                    | author, review, publish, grade                      |
| Results                | 13 result + 15 config pages (C044–55/C112–30)                              | result cycle                         | import, validate, moderate, approve, publish, amend |
| Attendance & wellbeing | attendance (C056–57) + health + behaviour                                  | register / case                      | mark, excuse, notify, escalate                      |
| Admissions             | Applicants + Full Admission Pro. (C016–24)                                 | application                          | review, interview, offer, convert                   |
| Finance                | Payment (12) + Full Account (C082–102)                                     | family/student account + transaction | bill, allocate, discount, refund, reconcile         |
| Engagement             | Communication + SMS + Email (C103–11)                                      | conversation/campaign/delivery       | compose, schedule, retry, respond                   |
| Insights               | analytics/spreadsheets/export (C054/C101/C131)                             | report definition/run                | filter, export, schedule                            |
| Settings & governance  | Tools ▸ Configuration (30+), roles, branding, audit                        | policy/version                       | draft, compare, approve, activate                   |

### Patterns that replace incumbent fragmentation

| Incumbent                                        | SchoolWithEase                                                |
| ------------------------------------------------ | ------------------------------------------------------------- |
| Search page + list page (C025/C040)              | one directory + search + filters + saved views + URL state    |
| Online entry + Excel entry (C044/C045)           | one workbench with _entry_ and _import_ commands              |
| Send SMS + Send Email + Send Result (C103/06/09) | one engagement action with channel policy                     |
| Create + Archive page (C028/C029)                | one lifecycle with status views                               |
| Separate admission payment (C018/C022)           | finance transaction linked to the application                 |
| BClass hub (C075)                                | class workspace with activity tabs + conferencing integration |
| Long config table (C120–25)                      | policy set with versions, clone, comparison, activation       |
| Manual collate → re-save (C063)                  | transactional command + event with validation                 |

---

## Bounded contexts and the concrete data-model deltas

For each context: what it **owns**, and the **current → target** delta against our 58 models.

### 1 · Identity & access — _strong, finish the UX_

Owns auth identity, tenant memberships, roles/pools, grants/denies, scope + expiry, step-up, maker–checker, access-review.
**Have:** `Role, Permission(305), PermissionPool(11), UserTenantRole, UserTenantPermission, MakerCheckerRequest, SensitiveOperationPolicy`.
**Add:** `RoleTemplate` (job-function bundles), an **access-grant model with explicit scope + constraints** (below), `AccessReviewCampaign`, and an **effective-access evaluator that returns a decision + human explanation**.

### 2 · People & relationships — _unify identity vs employment vs allocation_

**Have:** `User, UserTenant, Student, StudentGuardian`.
**Add:** `Person` (name parts, flexible), `ContactPoint` (+verification), `Address` (country-subdivision adapter), `StaffProfile`/`Employment` (retire "payroll = directory"), `StudentIdentifier` (issuer/type/effective period), `StudentDocument`/`StudentPhoto` (type/verification/consent/checksum), `HouseMembership`, `StudentSubjectElection`, `ConsentRecord`. Move `Student.personalInfo/academicInfo` JSONB → typed, searchable columns for governed attributes (State/LGA, DOB, religion where lawful).

### 3 · Academic structure

**Have:** `AcademicYear, Term, Course, Class, ClassTeacher, Enrollment`.
**Add:** separate **stage / arm / stream / campus / display-label** from the class name (never parse "SS1 SCIENCE"); `SubjectOffering`/`CourseOffering`; `TimetableSlot`/`Room`; `AcademicProfileVersion` (the polymorphism bundle — see [05](05-academic-nigeria-international.md)).

### 4 · Curriculum — _new domain_

`CurriculumAuthority, CurriculumFramework, CurriculumVersion, CurriculumStage, CurriculumSubject, CurriculumNode(strand/topic), LearningOutcome, CurriculumAdoption(cohort/effective-dated), CurriculumMapping(old↔new names), TenantCurriculumOverlay`. National content immutable once imported; tenant edits are overlays; AI-authored nodes carry `provenance{model, prompt, source, reviewer}` (fixes C081).

### 5 · Teaching & learning

**Have:** `Lesson, LessonMaterial(reviewStatus/reviewer), MaterialChunk, Assessment, Question, AssessmentQuestion, AssessmentSubmission`.
**Add:** a shared `LearningActivity` view + `ActivitySubmission` (file/text, late status, accommodations, feedback), `LessonTemplate`, `ReviewAssignment`(SLA/priority — the C069–74 workflow), question-import adapters (Excel/Aiken), and exam controls (`ExamWindow`, `Accommodation`).

### 6 · Assessment & results — _the biggest build_

**Have:** `Grade, GradingSystem`.
**Add:** `AssessmentSchemeVersion` + `AssessmentComponent` (CA1–4/EXAM weights, C053), `GradeEntry` + `GradeEntryVersion`, `ModerationCase`, `GradingScaleVersion` (WAEC + custom, C114), `RemarkRuleSetVersion` (band→comment, typed Subject/Principal — **replaces 724 prose rows**, C120–25), `PromotionPolicyVersion` (rules→recommendation→approval — **removes "Promoted to SS 3" from remark text**, C124), `ResultCycle`, `ResultApproval`, `ResultPublication` (immutable snapshot), `PublishedStudentResult`, `ResultAmendment`, `DocumentArtifact`, `TranscriptRecord`, `SigningAuthority` + `SignatureUse` (fixes C126–28), and a `FinancialHold` that gates result _visibility_ explicitly and audibly (replaces silent per-student blocking, C112).
**Invariants:** component weights valid/complete for scope; one active grade version (old retained); publication references immutable config versions + passes completeness/exception checks; maker ≠ checker; amendments never overwrite the snapshot; artifacts are checksum-addressed; signature use is authorized per artifact.

### 7 · Attendance & wellbeing

**Have:** `AttendanceRecord`, `HealthRecord` (enveloped narrative + blind-index flags — keep this design).
**Add:** `AttendanceSession`(mode) + `AttendanceMark` + `AttendanceCorrection`, `AbsenceCase`, `ExcuseRequest`, and restricted subdomains `HealthVisit, MedicationOrder/Administration, ImmunizationRecord, HealthIncident, SafeguardingCase, BehaviourIncident, InterventionPlan` — each with **its own** permissions (a teacher marking attendance must not read clinical/safeguarding narrative).

### 8 · Admissions

**Add:** `Intake(capacity/eligibility)`, `FormSchemaVersion` + `ApplicationResponse`, `DocumentRequirement` + `SubmittedDocument`, `ApplicationReview`/`Score`, `InterviewEvent` + `Attendee` + `Outcome`, `Decision`/`Offer`(conditions/expiry/acceptance), `WaitlistEntry`, and a **conversion** command → Person/Guardian/Student/Enrollment preserving the source application id. Admission charges use Finance; quizzes use Assessment.

### 9 · Finance — _deepen the subledger, decide on the GL_

**Have:** `FeeInvoice(amountDue/amountPaid kobo), Payment(→one invoice)`.
**Add (billing/receivables):** `FeeItem, FeeScheduleVersion, FeeScheduleLine, ChargeAssignmentRule, InvoiceLine, DiscountPolicy/Grant, Scholarship, PaymentPlan, AccountHold`.
**Add (cash/allocation):** `PaymentReceipt, PaymentAllocation` (one receipt → many invoices/siblings, C082), `UnappliedCredit`, `FamilyCreditAccount`/`CreditLedgerEntry` (the "wallet", C084), `Refund, Chargeback, ReconciliationBatch`, plus a `PaymentGateway` adapter with signed idempotent webhooks (C084 failures).
**Accounting (build-vs-integrate decision):** `ChartOfAccount, AccountingPeriod(lockable), Journal/JournalLine, Vendor, ExpenseClaim, Budget/BudgetLine, BankStatementImport` — or an accounting integration adapter.
**Invariants:** money in minor units (already kobo); unique tenant-scoped receipt numbers; allocations ≤ available; **posted entries corrected by reversal, never edited/deleted** (fixes C090/C096); discounts/refunds above threshold need approval; financial hold ≠ enrollment status.

### 10 · HR & payroll

`Employment, Position, Department, Qualification, LeaveRequest(have), PayProfile, EarningType/DeductionType, PayPackage, PayrollRun/Calculation/Payslip` — jurisdiction- and effective-date-aware (NG PAYE/pension/NHF), with approval + payslip privacy. **Payroll stops being the staff directory.**

### 11 · Operations (feature-toggled modules)

Library (Title/Copy/Loan/Reservation/Fine — replace `LibraryBook` current-borrower), Transport (Route/Stop/Vehicle/Driver/Trip/Incident — replace `TransportAssignment` labels), Inventory/Assets (Item/Location/Movement/Requisition/FixedAsset/Depreciation — C100), Facilities, Events (extend `SchoolEvent` with recurrence/consent/check-in), Cafeteria, Sports/Clubs.

### 12 · Engagement — _new production domain_

`AudienceDefinition, ContactPreference, MessageTemplate + Version, Campaign/CampaignRecipient, Conversation/Message(have), Notification, DeliveryAttempt, ProviderEvent, SecureLink, SurveyDefinition/Response`. `DeliveryAttempt` carries channel, provider, provider-message-id, status, **failure classification, cost/units, DND flag** (C107), redacted destination. `SecureLink` (expiring, access-controlled) replaces public result URLs (C108).

### 13 · Reporting & analytics — _finish the stubs_

`MetricDefinition, ReportDefinition, ReportParameterSchema, ReportRun, ExportArtifact, ReportSchedule, DashboardDefinition, DataQualityIssue`. Long generation runs as **jobs**; published artifacts immutable; AI queries only approved read-models. Every tile carries definition/scope/period/freshness/lineage.

---

## Shared platform capabilities (build once, reuse everywhere)

- **Import & migration platform:** `ImportDefinition, ImportJob, SourceFile, ColumnMapping, TransformRule, ImportRow, ValidationIssue, DuplicateCandidate, ImportCommit, ReconciliationRule/Result`. Flow: _Upload → identify source/version → map → validate → resolve exceptions → dry-run → approve → commit idempotently → reconcile → sign off._ Requirements: virus scan, checksum + source metadata, resumable upload, row-level error download, **stable external/source IDs**, deterministic transforms, no partial silent commit, maker–checker for financial/grade/history imports, totals reconciliation, rollback.
- **Document & media platform:** logical record vs stored versions; encrypted storage; checksum/MIME/scan; thumbnail/preview; type + visibility policy; retention + legal hold; **signed short-lived downloads**; consent/provenance; authorized signature/seal use.
- **Durable job platform:** outbox-enqueued, idempotency key, retry/backoff + dead-letter, progress + row counts, actor/tenant/context, result artifact, user notification. Use for imports, report batches, SMS/email, result publication, document processing, payment reconciliation, curriculum imports, analytics refresh — **replacing the current process-local queue.**
- **Search platform:** tenant + permission filtered; domain-owned projections; **never index unrestricted health/safeguarding narrative**; result types + actions; recent/saved searches; URL state; privacy-safe snippets.

## Authorization architecture (finish what's strong)

Keep clearance levels, system/custom roles, pools, `resource.action.context`, per-profile overrides, maker–checker, step-up, audit, tenant isolation. **Add** explicit scope + constraints to each grant:

```
subject: user | profile | role
effect: allow | deny
permission: resource.action[.context]
scope: tenant | campus | department | programme | class/offering | subject | self | child
constraints: validFrom/validUntil · businessHours · threshold · requiresStepUp · requiresApproval
source: system role | custom role | direct | delegated | emergency
```

The evaluator returns a decision **plus explanation** for admin preview: _"Allowed: `grades.edit` · Scope: Mathematics offerings taught by this profile at Campus A · Source: Teacher role → Level-3 Academic pool · Constraint: only while allocation active."_

**Permission-management UX (not 305 checkboxes):** pick role template → show capabilities in plain language → choose scope → add exceptions by searching a job/action → surface sensitive actions separately → show **separation-of-duties** conflicts → preview effective access with examples → show who's affected → require reason/step-up/approval → version + rollback.
**Separation-of-duties examples:** configure fee ≠ approve fee; record payment ≠ reconcile bank; grant discount ≠ approve large discount; prepare payroll ≠ approve/pay; enter grades ≠ approve/publish results; upload signature ≠ authorize its use; create role ≠ approve high-clearance role; import history ≠ sign reconciliation.

## Multi-tenancy, consistency & offline

- Every tenant-owned row carries non-null `tenant_id`; **RLS stays a mandatory backstop** (already the pattern); tenant-local unique keys lead with `tenant_id`; background workers set tenant context explicitly; object-storage keys + encryption context include tenant.
- Campus/arm = organizations **within** one tenant (matches C012), not separate tenants; policies inherit + override within safe bounds; a truly independent school = a separate tenant.
- **Transactional command pattern** for important mutations: authn + tenant/profile → evaluate permission/scope/feature/policy → validate invariants → step-up/approval if triggered → mutate in one tx → write audit → write outbox event → commit → workers deliver downstream idempotently. Outbox events: `StudentEnrolled, ApplicationSubmitted, InvoiceIssued, PaymentCompleted, PaymentAllocated, ResultApproved, ResultPublished, ResultAmended, RoleAssignmentChanged, DocumentArtifactGenerated`.
- **Must be transactionally consistent:** payment receipt + ledger effect; result approval/publication snapshot; grade handoff from a submitted assessment (fixes C063); role change + approval/audit; import commit within its batch; signature authorization for an artifact.
- **Offline classes:** read-cache (timetable, published lesson, report card) · safe queued write (attendance/lesson-note draft) · online-required (payment, publication, role change, payroll approval) · resumable transfer (photos/documents/imports). Never imply a queued op is complete — always expose local/syncing/synced/conflicted/failed.

## Integration (adapters, not core contamination)

OneRoster 1.2 (roster/gradebook/resources), LTI 1.3 (tool launch + grade return), Ed-Fi (where a market demands it), CSV/XLSX contracts, payment-gateway adapter with signed webhooks, SMS/email/push provider ports, **accounting adapter instead of Sage credential capture (C094)**, OIDC/SAML SSO for enterprise tenants, and signed/versioned webhooks with delivery logs. The canonical model stays richer than any interchange format.

## Migration & cutover (P0 capability)

Domains to migrate: tenants/campuses/config · people/users/contacts · staff/employment/allocations · students/guardians/identifiers/status history · **photos/documents (776 pending, C039)** · years/terms/subjects/classes/enrollments/electives · curriculum + lesson content (where exportable) · attendance history · assessments/grades/remarks/results/report artifacts · admissions history · **fee items/schedules/invoices/opening debt (C091)/discounts/wallet credits/payments/receipts** · messages/delivery logs (589 emails/19,539 SMS, C104/C107) · library/transport/health/ops · audit/provenance.
Phases: discovery → mapping → trial (sandbox tenant) → pilot (one campus/cohort) → delta rehearsal → cutover (freeze/parallel + reconcile + go/no-go) → hypercare → legacy read-only archive.
**Reconciliation gates:** student/staff/guardian counts by campus/status/class; enrollment by year/term/offering; result counts + aggregate score checks; attendance totals; **invoice gross / discounts / payments / outstanding / unapplied credit**; receipt-number uniqueness + totals; wallet opening/closing; attachment count + checksum; access review; sampled artifact comparison. **Clean the dirty catalogs on the way in** (duplicate subjects C080, corrupted grades C114, split names).

## ADRs to record before build

Person/identity/profile separation · class/section/offering/registration model · curriculum version + tenant overlay · result publication snapshot + amendment · finance ledger + family credit/wallet semantics · durable job/outbox infra · communication delivery-provider abstraction · document/signature security · migration source-ID + reconciliation contract · **general-ledger build vs accounting integration** · tenant vs campus/arm boundary · OneRoster/LTI/Ed-Fi scope.

## Definition of done (for any included feature)

Job + lifecycle defined · data ownership + invariants defined · tenant/privacy classification defined · permission/scope/step-up/approval enforced **server-side** · command + audit implemented · empty/loading/error/offline/permission states exist · mobile + keyboard usable · import/export/migration addressed · analytics events + observability · tests cover happy-path, invalid transition, unauthorized scope, tenant isolation, retry/idempotency, audit · a school operator completes the end-to-end job in acceptance testing.
