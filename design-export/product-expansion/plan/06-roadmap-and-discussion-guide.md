# 06 · Inclusion roadmap & discussion guide

## Planning conclusion

Do **not** recreate the legacy system's menu. Guarantee the **jobs and records** schools depend on, then expose them through a smaller number of cohesive Aurora workspaces. The parity is viable because our platform already has broad scaffolding and a stronger access/isolation/audit concept than the screenshots show. It is **not yet safe** to call the product a full replacement, because several high-consequence domains are page- or aggregate-thin: admissions, result publication, finance allocation, staff records, communications delivery, imports, reporting, and operations.

Manage the programme on two axes:

1. **Continuity** — can a school move without losing data, history, controls, or a recurring job?
2. **Superiority** — is the migrated job faster, clearer, safer, more connected, more accessible?

A feature satisfying only superiority isn't parity-ready; one satisfying only continuity is an expensive clone.

## Non-negotiable release principles

1. SchoolWithEase requirements remain the constitution.
2. Replacement scope = user jobs, records, controls — **not** page count.
3. No critical workflow ships as UI without a durable domain lifecycle.
4. No bulk mutation ships without preview + validation + idempotency + partial-failure reporting + audit.
5. No result/receipt/transcript/approval/permission state silently mutates after publication.
6. No high-risk permission is trusted because a button is hidden — enforcement is server-side + scope-aware.
7. No migration wave is accepted by screenshots — totals + sampled records reconcile.
8. No school is forced to adopt all modules at once.
9. Nigerian use cases are first-class; international variation via profiles + versioned policy.
10. Every phase has a measurable operator outcome.

## Delivery sequence

### Phase 0 — Scope lock & parity laboratory

Name the first replacement segment + two design-partner schools; confirm which incumbent modules each actually uses; collect **redacted** exports/report cards/receipts/workflow samples; approve the target IA + vocabulary; **resolve the 274/297/305 permission drift and the stale "mock data" note**; choose canonical identity/person, class/offering, result-publication, and finance-ledger models; write the ADRs from [04](04-target-product-and-architecture.md); create parity/migration/acceptance scorecards; name privacy/retention/AI owners.
**Exit:** each P0 job has an owner, current artefact, target workflow, acceptance test; source export formats + limits known; no unresolved decision would force a core-table redesign.

### Phase 1 — Shared foundations

`Person`/identity/profile/membership separation + relationship history; campus/arm scope model; academic-profile + policy-version framework; **shared import pipeline**; **durable job queue + transactional outbox + idempotency**; **document/attachment service** (scan/classify/retain); **communication delivery abstraction + attempt ledger + cost + preference**; governed search; audit expansion; data-export/retention/privacy primitives; shared Aurora patterns for **directory / workbench / lifecycle / policy / approval** (see [08](08-design-system-bridge.md)).
**Exit:** two unrelated domains reuse import/documents/jobs/comms without custom copies; retry never duplicates a financial/result/message command; tenant + campus isolation tests pass; permissions enforced through one policy path.

### Phase 2 — Replacement runway (streams may overlap once Phase-1 contracts are stable)

- **2A People/users/staff:** unified People directory (Student/Guardian/Staff/User/Prospect views); invitations + activation/suspension + password reset; staff employment/assignment/qualification/reporting-line; guardianship authority/priority; **role editor + resource/action/context matrix + permission search + presets**; campus/data scope + expiry + temporary cover + access-review; maker–checker + step-up for high-risk access. → _Find a person once, understand all relationships, grant only what's needed._
- **2B Academic structure + student lifecycle:** curriculum/profile version + year/term + subject/course catalog; class/arm/offering + teacher assignment + **elective election**; registration + rollover + transfer/withdrawal/graduation; identifier allocation + controlled credential issue; **promotion workbench with preview + exceptions**. → _Every student belongs to an explainable structure and keeps history across years._
- **2C Admissions:** form/version builder + portal + responses; list/board + saved views + assignments; document checklist/verification; assessment/interview scheduling + structured review; capacity/quota + decision + offer/waitlist + acceptance; **finance-linked** charge/receipt; **one-command reviewable conversion**. → _Run an intake without spreadsheets or retyping into student records._
- **2D Results parity:** result-cycle workbench + configurable CA components; **direct entry + Excel import in one flow**; validation + missing/absent/exempt semantics + completeness; remarks/comment bank + affective/psychomotor (or framework-appropriate); moderation + approval + publication policy; **immutable report-card/broadsheet/transcript artifact**; SMS/email/portal notification via Engagement; amendment/supersession; promotion input + historical replay. → _Reproduce and explain the published result a family received._
- **2E Finance parity:** fee-item catalog + schedule versions + charge applicability; invoice lines + family/student accounts + **opening balances**; payment + **partial allocation + overpayment/unapplied credit + refunds**; discount/scholarship/waiver/debt-adjustment approval; receipt numbering + reprint history + verification; daily collection/outstanding/aging/reconciliation reports; legacy balance/transaction import; **GL build-vs-integrate decision**. → _Opening balances + post-cutover activity reconcile; every allocation is traceable._
- **2F Engagement + operational reporting:** audience builder over authorized saved views; template/version + channel policy; **SMS/email/in-app delivery attempts + cost + retries + provider response**; notification preference/consent; result/payment/absence **SecureLinks** with expiry + access control; scheduled export jobs; core admin/academic/finance/audit reports with definition/version. → _Know who should receive a message, who did, what it cost, what failed._
- **2G Migration cockpit:** source-object mapping + stable legacy IDs; staged imports + validation + repair; identity dedup/merge with evidence; attachment ingest + checksum; reconciliation dashboard by entity + financial/result aggregate; dry-run/delta/cutover/rollback runbook; legacy read-only archive + retention. → _The replacement claim is backed by repeatable reconciliation._

**Phase 2 exit:** a design-partner completes a full term-cycle simulation; P0 parity jobs pass acceptance; historical results + balances reconcile; published documents + receipts independently verifiable; high-risk access + finance/result corrections pass audit; support can diagnose failed jobs without DB access.

### Phase 3 — Daily-work superiority

Teacher "Today" queue (attendance, lessons, homework, marking, incomplete results); **class workspace** joining roster/timetable/attendance/materials/assignments/results/communication (absorbs BClass); lesson author/review/publish lifecycle; homework submissions + rubrics + feedback; CBT question bank + delivery + accommodations + grading; attendance intervention + guardian acknowledgement + escalation; curriculum coverage + outcome evidence; parent/student mobile workflows; calendar/events with reminders + audience rules; report scheduling + governed dashboards; PWA resilience + background sync + performance hardening.
**Exit:** common teacher jobs need fewer context switches than the legacy system; critical mobile flows pass low-bandwidth/interrupted tests; no page duplicates a directory/workbench just to add search/import/archive.

### Phase 4 — Operational depth & ecosystem

Library circulation ledger; transport routes/fleet/trips/notifications; health encounters + medication + emergency actions; safeguarding/incident case management; HR leave/appraisal/attendance/payroll inputs; inventory/store/asset movements + approvals; hostel/boarding where validated; OneRoster import/export; LTI 1.3 launch; payment/accounting/identity/messaging integrations; API/webhook DX + integration health.

### Phase 5 — Responsible intelligence & scale

Exception/risk views with explainable inputs; AI-assisted lesson/question/remark drafting **with human approval**; curriculum-mapping assistance + provenance; operational recommendations with configurable thresholds; benchmarking only with lawful, protected data; AI registry/evaluations/model governance/cost controls; multi-region/data-location where commercially justified.

## Dependency map

| Capability                  | Must precede                                                    | Why                                               |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| Person/profile model        | admissions conversion, staff records, guardian authority, dedup | avoids conflicting identities                     |
| Academic profile/versioning | curriculum, results, promotion, fee applicability               | historical records reference the governing policy |
| Durable jobs/outbox         | imports, publication, payroll, messaging                        | prevents lost/duplicate side effects              |
| Document platform           | admissions, staff, health, lessons, reports                     | security/retention shouldn't vary by module       |
| Communication ledger        | result/attendance/finance/admissions notices                    | delivery evidence + cost are shared               |
| Result publication snapshot | report cards, transcripts, amendment, result links              | a live table can't prove what was published       |
| Finance ledger/allocation   | wallet, discount, debt, refunds, receipts                       | otherwise these features contradict each other    |
| Data-scope policy           | role editor, reports, exports, saved audiences                  | verbs alone don't stop cross-campus exposure      |
| Migration source IDs        | dedup, delta loads, reconciliation                              | re-runs need stable correspondence                |

## Parity scorecard (score jobs, not screens: 0–4)

0 not represented · 1 page/prototype only · 2 basic happy path, lifecycle/history missing · 3 production workflow with audit/errors/permissions/migration · 4 replacement-ready + demonstrably superior. For each job record: personas + profiles · incumbent C-IDs · our route/model/service · required records + transitions · permission/scope/approval · imports/exports/migration · offline/mobile/a11y states · acceptance scenario + reconciliations · owner + release · score + evidence date. **A phase isn't complete by averaging away a zero in a critical job.**

## Pilot shape

Choose partners that reveal variation, not three near-identical schools: (1) a NG primary/secondary using results + fees + messaging + admissions deeply; (2) a multi-campus/boarding school with scoped admins; (3) an international/blended or tertiary/TVET only when committed to scope. Run four rehearsals: **historical** (import a closed year, reproduce samples), **live-cycle** (admission → enrollment → bill/payment → attendance → assessment → result), **cutover** (freeze/delta + reconciliation + go/no-go), **failure** (provider outage, duplicate import, publication error, revoked access, rollback). Start live rollout with one bounded school/campus.

## Acceptance scenarios that matter

- **Access:** a staff member who is also a guardian uses one identity with two profiles; a bursar posts payments for Campus A but can't export Campus B debtors; a substitute gets 5-day class access that expires; a payroll-export grant needs step-up + second approval; an admin can explain effective access (inheritance/override/scope/expiry).
- **Admissions:** an applicant resumes a draft form version, uploads a corrected document, attends an interview, pays a charge, accepts a conditional offer, and converts without retyping; capacity is reached while two decisions are pending and the policy resolves it visibly.
- **Results:** two cohorts at one campus use different curriculum versions; an absent learner has no score but isn't zeroed; imported marks with invalid values/unknown students don't silently commit valid rows around them; a published result is corrected by approved amendment with both artifacts + notification history retained; a transfer learner's source grades stay distinct from an equivalence decision.
- **Finance:** a family pays once for two siblings with explicit allocation; a transfer exceeds the invoice, leaving unapplied credit (no fake income); an approved discount changes the outstanding balance but not the original charge; a refund + reversed gateway payment keep linked auditable entries; opening balances + post-cutover activity reconcile to control totals.
- **Communication:** a guardian opts out of a non-essential campaign but still receives a lawful critical notice; a provider times out and retry doesn't duplicate a confirmed delivery; the operator sees recipient resolution + channel + template version + cost + failure reason.
- **Resilience/a11y:** a teacher starts attendance offline, reconnects, resolves a conflict, sees final sync state; a keyboard + screen-reader user completes invitation, result entry, and payment lookup; a low-cost phone renders the parent payment/result flows.

---

## Decision workshop — questions to settle

Each ends with a named owner, date, decision, evidence, default-if-unresolved, and affected ADR/epic. Recommended defaults are shown.

### A · Market & parity promise

1. **Which schools must Release 1 replace end-to-end?** _Default:_ NG K-12 as the first full profile; keep architecture extensible; validate tertiary/TVET/international as separate scope.
2. **What does "retire the legacy system" contractually mean?** _Default:_ guarantee all critical jobs the partner schools actually use; publish an explicit supported/excluded matrix.
3. **Which evidence outranks a screenshot?** _Default:_ screenshots for discovery; require operational evidence (interviews/exports/observed workflows) for high-risk behavior.

### B · Product shape & terminology

4. **Do we approve the workspace IA?** Can Search-Staff/All-Staff/All-Users become People views (C025/C026/C132), and Online/Excel results become commands in one workbench (C044/C045)? _Default:_ yes; preserve saved URLs + permissions, drop duplicate pages.
5. **Which terminology is tenant-configurable vs canonical?** (learner/student/pupil; class/arm/section; subject/course/module; term/semester) _Default:_ one canonical domain vocabulary in code/API + profile-driven display terms.
6. **Where is the tenant boundary?** School group = one tenant with campuses/arms (as C012), or one tenant per school? What is shared at group level? _Default:_ explicit commercial/security policy; never infer from branding.

### C · People & access

7. **Do we adopt one Person with multiple profiles?** _Default:_ yes — separate person, auth identity, tenant membership, dated domain profiles.
8. **What does campus/class/data scope look like?** Which roles need own-record / assigned-class / campus / arm / department / programme / tenant-wide? _Default:_ reusable scope constraints, required in API authorization + query construction.
9. **Which access changes need maker–checker / step-up / expiry?** (payroll export, result publication, role admin, finance reversal, bulk student export, health/safeguarding access) _Default:_ approve a high-risk command register before building the role editor.
10. **Who owns periodic access review, at what interval?** _Default:_ role-specific reviewers; quarterly privileged + termly assignment review.

### D · Academic scope & results

11. **Which NG curriculum versions + entry cohorts ship as maintained seed data, and who verifies changes?** (NERDC/exam bodies/tenant overlays) _Default:_ seed official versions, assign by cohort, require an academic owner to approve tenant activation.
12. **Which result modes are truly Release 1?** (numeric marks, grade bands, traits, competency, early-years narrative, GPA/CGPA, standards) _Default:_ only the modes the first segment needs; never simulate unsupported modes with free-text columns.
13. **Is class/subject position a product commitment or a tenant option (C115)?** _Default:_ configurable, **default off** where inappropriate, with tie/rounding/privacy rules explicit.
14. **What makes a result "published" (C112)?** A status on mutable rows, or an immutable artifact after validation/moderation/approval? _Default:_ immutable snapshot + document, corrected only by amendment.
15. **How are promotion/repetition decided (C118/C124)?** Automatic, recommendation + board approval, or manual with evidence? _Default:_ rules generate an explainable recommendation; authorized humans approve exceptions/final decisions — **promotion logic leaves the remark text.**
16. **Do we couple finance to result visibility (C112 blocking)?** _Default:_ only via an explicit, audited `FinancialHold` policy — never a silent per-student block.

### E · Admissions

17. **Is the application form a versioned tenant builder or a fixed form + custom fields?** _Default:_ governed schema versions with reusable field blocks + strict sensitive-field classification.
18. **What is an admissions payment (C018/C022)?** Application charge, deposit, first fee — when refundable/allocatable? _Default:_ Finance owns every transaction; Admissions references the purpose + workflow state.
19. **Which selection controls are permitted?** (capacity, sibling priority, catchment, score thresholds, quota, waitlist) _Default:_ explicit versioned policy, structured reasons, role-limited evidence, no opaque AI ranking.

### F · Finance & accounting

20. **Subledger or full general ledger?** the legacy system shows income/expense/accounting (C095–102); we are receivables-first. _Default:_ build an excellent fees/receivables subledger first; **integrate accounting** unless validated schools require an internal GL.
21. **What does "wallet" mean (C082/C084)?** Stored value, unapplied family credit, gateway balance, or a label? _Default:_ model explicit **unapplied credit + allocation**; use "wallet" only if legal/accounting semantics are agreed.
22. **At what level does money belong?** Student / family / sponsor / payer account — can one payment cover several students/invoices (C082)? _Default:_ payer/family account + explicit invoice-line allocations + beneficiary links.
23. **Which financial commands require approval?** (discount, waiver, write-off, backdated posting, refund, reversal, receipt cancellation, opening-balance adjustment) _Default:_ policy thresholds + separation of duties + immutable linked entries.
24. **Receipt-numbering + document policy?** Per tenant/campus/account/fiscal-year/channel — can a number ever be reused? _Default:_ gap-aware, never-reused, policy-versioned sequences + reprint verification.

### G · Communication & reporting

25. **Which channels are contractual for Release 1?** (SMS, email, in-app, push, WhatsApp) _Default:_ SMS/email/in-app first behind one delivery abstraction; add others via reviewed adapters.
26. **Who pays/controls messaging spend (C105/C107)?** School balance, monthly invoice, per-campus budget, approval threshold, emergency override? _Default:_ cost estimation + budgets/limits + approval thresholds + reconciled provider usage.
27. **Which reports are records vs live views?** _Default:_ classify as operational view / scheduled snapshot / statutory extract / signed artifact — only the latter two are immutable.
28. **Do schools get a report builder in the parity release?** _Default:_ curated parameterized catalog first, semantic layer second, governed builder later.

### H · Migration & launch

29. **What source access can customers provide?** (DB, CSV/Excel, PDFs, attachments, browser-only) Are source IDs stable? _Default:_ require a discovery export before a commercial migration commitment.
30. **How much history moves?** (active year only, all detail, summarized balances/results, documents, audit, messages) _Default:_ per-record retention tiers; don't promise detail the source can't reliably export.
31. **What are the reconciliation tolerances, and who signs off?** _Default:_ exact control totals for money; deterministic result aggregates + record samples; named school sign-off.
32. **How long is the legacy system retained read-only, who controls/pays, and how is disposition proven?** _Default:_ contractual read-only window + limited access + export evidence + closure certificate.
33. **What is the rollback decision?** How late can go-live stop, and what happens to post-cutover transactions? _Default:_ explicit go/no-go gates + controlled parallel/delta — never an improvised reverse import.

### I · Privacy, safety & AI

34. **Who is accountable for privacy configuration at each school (NDPA)?** _Default:_ named institutional owner/DPO; SchoolWithEase supplies controls + evidence.
35. **Which records are "restricted" vs "highly restricted"?** (health, safeguarding, disability, hardship, discipline, ID documents) _Default:_ approve a data-classification + disclosure matrix before those modules expand.
36. **Which AI use cases are allowed first, and may customer data go to third-party providers (C060/C081/C133)?** _Default:_ low-consequence authoring assistance with human review; tenant opt-in + provider allowlist + minimization; **no autonomous consequential decisions.**

### J · Commercial & operational readiness

37. **What migration/config work is productized vs professional service?** _Default:_ standard packages + explicit limits + reusable mappings + priced exceptions.
38. **What SLOs during result publication, payroll, and fee deadlines (seasonal peaks)?** _Default:_ define SLOs + load tests + operational dashboards + escalation before the first live cycle.
39. **Who may enable unfinished modules?** _Default:_ capability flags + profile-based availability + honest readiness labels (don't let scaffolding look like a commitment).
40. **What proof earns "replacement-ready"?** _Default:_ reconciled migration + acceptance of every critical job + one successfully supported live term.

## Workshop format

Three 90-minute sessions, not one all-day feature debate. **Session 1 (Promise & boundaries):** Q1–10 → target profile, parity contract, IA, tenant boundary, access model. **Session 2 (Academic & financial truth):** Q11–24 → curriculum/result policy, admissions model, finance boundary, high-risk command list. **Session 3 (Operations & launch):** Q25–40 → channels/reports, migration contract, privacy/AI policy, rollout gates, proof of readiness. For every unresolved question capture _Decision / Owner / Due / Evidence / Default-if-unresolved / Affected ADR-epic_. Don't turn unresolved architectural questions straight into tickets.

## Immediate next actions

1. Approve/amend the Release-1 school profile + parity definition.
2. Recruit two design partners; inventory their actually-used jobs.
3. Obtain redacted the legacy system exports + artifacts (report cards, receipts, broadsheets).
4. Run the three workshops.
5. Create the ADRs (identity, academic structure, publication, finance, jobs, comms, migration).
6. Turn P0 matrices ([03](03-gap-analysis.md) + [07](07-capability-parity-matrix.md)) into scored job cards.
7. Prototype only four end-to-end workbenches first: **People, Admissions, Results, Family Account.**
8. Implement shared import/jobs/documents/communication contracts before module-specific bulk actions.
9. Define migration reconciliation + pilot acceptance before promising a go-live date.
10. Keep the legacy system screenshots as traceability evidence, not design specs.

## Executive summary (for the discussion)

- **What the legacy system has:** a broad, operationally-seasoned surface — people/permissions, a real admissions pipeline, student administration, CA results with publication, attendance, CBT, homework, supervised lessons, curriculum, two finance generations (fees/wallets + accounting/payroll/inventory), metered SMS/email, and ~30 config pages. Strength: administrative granularity. Weakness: duplicated destinations, fragmented workflows, dense PII-exposing tables, weak context, inconsistent lifecycle, and no cohesion across two visual generations.
- **What we already have:** broad domain scaffolding on a modern monorepo; multi-tenant + RLS; a **stronger** `resource.action.context` permission vocabulary (305) with clearance pools; maker–checker + step-up; audit; feature toggles; PWA base; enveloped-encryption health data; kobo money; a token-driven Aurora design system.
- **What we lack:** not menu coverage — **domain depth + operational proof**: versioned admissions + conversion; immutable result publication/amendment; a coherent finance allocation/ledger; staff employment depth; delivery ledgers + durable background work; mature imports/reporting/migration reconciliation; longitudinal library/transport/health/ops; and a finished permission-administration UX.
- **What to build:** shared foundations first, then replacement-critical workbenches around durable records, with academic profiles + versioned policy for NG/international variation, and privacy/accessibility/low-connectivity/data-scope/audit/migration as core behavior.
- **What not to copy:** separate search/list, direct/Excel, send-SMS/send-email, create/archive, or module-specific payment pages; hundreds of checkboxes as an access model; every legacy-system label as a new table/enum; and every reject in [02](02-incumbent-capability-and-ux-assessment.md) (generated passwords, unguarded signatures, credential capture, mutable posted finance).
- **The decision in front of the team is not "which screenshot do we code first?" It is:** _which school profile and set of critical jobs will SchoolWithEase guarantee, what durable records + controls make those jobs trustworthy, and what reconciled evidence will prove a school can retire the legacy system?_
