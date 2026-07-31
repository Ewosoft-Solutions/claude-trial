# 05 · Academic, Nigerian & international considerations

Parity is only safe if the resulting records still make sense across Nigerian nursery → SSS → TVET/NCE/polytechnic/university, **and** international/blended schools (British, Cambridge, IB, Montessori, American, proprietary). The corpus proves this is not hypothetical — one tenant already mixes **Basic/Primary/JSS/SSS + British "Year" + Montessori "Reception/Practical Life Exercises" + a "Nigeria-British" curriculum** (C041, C116, C119, C073). The product must model **education policy as versioned data**, never encode one school's terminology into columns.

> Sources below were validated by the parallel assessment on 30 Jul 2026 and should be **re-checked by an academic owner + Nigerian counsel** before scope lock; this document is product/architecture analysis, not legal, curriculum-licensing, or examination-integration specification.

## 1 · The academic profile is a versioned configuration bundle

Assign each tenant/campus/programme/cohort an `AcademicProfileVersion` (effective-dated) that selects or overrides:

| Concern          | Options the model must express                                                 | Corpus evidence                      |
| ---------------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| Education stage  | early-years, primary, JSS, SSS, undergraduate, diploma, NCE, vocational        | C041, C116                           |
| Framework        | NG national, state adaptation, British, Cambridge, IB, American, proprietary   | C073 "Nigeria-British"               |
| Calendar         | **3 terms** (NG default), 2 semesters, quarters, rolling cohorts               | C028, C117 (term/session everywhere) |
| Hierarchy        | level → class → **arm** (gemstone); programme → level → offering               | C041 "BASIC 7 EMERALD"               |
| Curriculum       | framework version, subjects, strands, outcomes, **trade subjects**, electives  | C077–81, C119                        |
| Assessment       | **CA (CA1–4 + EXAM)**, competency, standards, GPA/CGPA, pass/fail              | C053                                 |
| Result artifact  | report card, broadsheet, transcript, statement of result                       | C051–55, C043                        |
| Attendance grain | daily, period/subject, event, boarding roll-call                               | C056                                 |
| Progression      | automatic, rules-based, moderation board, manual                               | C118, C120–25                        |
| Ranking          | on/off + tie/privacy rules (**default off** where inappropriate)               | C115                                 |
| Terminology      | pupil/student/learner; class/arm/section; subject/course/module; term/semester | C032, C041                           |

Profiles are **cloned + versioned**; activating a new version must never rewrite historical enrollments, results, curricula, or report cards.

## 2 · Nigerian curriculum support

### 2.1 Represent the 2025 curriculum change as **cohorts, not a global toggle**

NERDC's Sept 2025 notice implements the revised curriculum starting at **Primary 1, Primary 4, JSS 1, and SS 1** entry cohorts — so several curriculum versions are valid in the same campus during transition. Store `CurriculumVersion` + `CohortCurriculumAssignment(entry cohort, level range, effective dates, tenant overlays)`. A single mutable subject list (as the legacy system has, C113) cannot express this and is already producing dirty data (duplicate "Cultural" subjects C080/C113, garbled grades C114).

### 2.2 Revised subject structures the catalog must express (without hard-coding as columns)

The corpus already carries the new subjects — **Basic Digital Learning** (C048/C113), **Citizenship & Heritage** (C113), **Digital Technologies**, **Social & Citizenship Studies** (C070) — alongside legacy ones. The catalog must support, per stage: NG language(s), Basic Science/Tech, PHE, CRS/IS, Nigerian History, Social & Citizenship Studies, Cultural & Creative Arts, Pre-vocational/**trade subjects**, French/Arabic electives — and let **official updates + school variants** land without a schema migration.

### 2.3 Nigerian academic objects to support

School **arms/campuses** without treating each arm as a tenant (C012); nursery/reception observation records (Montessori — C119); streams **ARTS/COMMERCIAL/SCIENCE** at SSS (C041); JSS/SSS subject choices + trade subjects + departments; **CA components + affective/psychomotor traits + teacher/principal remarks**; moderation, broadsheets, cumulative summaries, **position only where policy allows** (C115); promotion/repetition/transfer/withdrawal/graduation/alumni histories; **examination numbers + candidate registration** without an exam body owning the student identity; boarding/day/house/hostel/exeat as optional modules; **fee schedules by arm/class/residency/programme/cohort** (C087–88); NG address hierarchy (State→LGA, C032) + international addresses; **NGN + kobo money, DND-aware SMS (C107), Nigerian phone E.164 normalization (C014), bank/transfer reference + gateway reconciliation (C084)**.

### 2.4 External examination & tertiary frameworks (versioned adapters, not core enums)

| Context                  | Product treatment                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **WAEC / NECO**          | candidate-data prep, subject-code mapping, consent notice, validation, export, result-reference capture (the catalog already lists WAEC/NECO as class types, C116) |
| **JAMB** admissions data | optional identifier + import/export mapping; never the internal primary key                                                                                        |
| **NUC CCMAS**            | programme/course framework + institutional overlays, credit units, prerequisites, outcomes, versions                                                               |
| **NBTE**                 | programme/module framework for technical/vocational + practical/competency evidence                                                                                |
| **NCCE**                 | NCE programme framework, course versions, credit/progression, teaching-practice records                                                                            |
| **UBEC / state EMIS**    | governed reporting extracts with definitions, snapshot dates, validation, disclosure logs                                                                          |

Store issuer + scheme + version + code + label + mappings + effective dates; never copy an external code into an enum.

## 3 · International & blended support

A `CurriculumFramework` must support programmes/stages; subjects/courses/modules/strands/standards/outcomes; hierarchical + cross-cutting outcomes; prerequisites/co-requisites/credit units/instructional hours; required/elective/optional/alternative groups; local overlays + equivalence mappings; content/language variants (the corpus has **French** notes, C072); effective versions + approval; provenance (official/licensed/tenant/imported/AI); and framework-to-framework mappings for transfer. **Do not assume** three terms, numeric marks, subject rank, or year-end promotion.

**Assessment modes the one engine must accommodate:** mark/percentage (points, weighting, rounding, missing/exempt/absent); grade band (threshold version, boundary inclusivity, grade point — C114); standards/outcomes (evidence, proficiency, observation date, assessor); competency (not-yet-competent/competent, rubric, verifier); GPA/CGPA (credit units, repeats, transfer credit — our `Enrollment.gpaPoints/creditsEarned` already anticipates this); narrative/early-years (observation, developmental indicator, media, next step — Montessori C119); pass/fail; external assessment (issuer, session, subject code, candidate reference, verified result). Every score retains source + assessor + timestamp + definition version + calculation version + moderation/correction trail.

**Calendars & time:** academic years with terms/semesters/quarters; overlapping short-course cohorts; campus-specific holidays + closures + **special terms** (C117); teaching weeks + bell schedules; per-campus time zones; DST-aware timestamps; enrollment/registration validity independent of term labels. Users see locale-aware formatting; storage stays unambiguous (note the incumbent's **inconsistent MM/DD vs DD/MM labels**, C092).

**Transfer, equivalence & transcript integrity:** retain original institution/framework/subject-code/title/mark/credit/scheme; store an **equivalence decision** rather than rewriting the source; identify decision-maker/rule/evidence/date; distinguish transferred vs awarded credit; generate verifiable transcripts from **immutable publication snapshots**; correct by amendment, never silent replacement.

## 4 · Admissions & learner lifecycle

Structure that serves both a NG primary intake and an international programme: `Intake(programme/stage/campus/session/capacity/eligibility/dates/fee/workflow version)` → `Application` → `FormSchemaVersion`/`ApplicationResponse` → `DocumentRequirement`/`SubmittedDocument` → `Assessment`/`Interview`/`Reference`/`Decision` → `Offer(conditions/expiry/acceptance)` → conversion creating Person/Guardian/Student/Enrollment. Admission charges use **Finance** (not the C018/C022 silos). Capacity/quota controls are policy-driven + auditable; protected data isn't exposed to decision-makers who don't need it.

## 5 · Inclusion, wellbeing & safeguarding

Use neutral, configurable language and **separate** learning-support need / formally-assessed need / accommodation / medical alert / safeguarding concern / temporary adjustment — access to each differs (a subject teacher may need the accommodation but not the diagnosis). Capabilities: accommodations attached to learner/subject/assessment/date-range; extra time, reader/scribe, assistive tech, seating, language support; individual targets + review meetings + responsible staff; consent/legal basis + disclosure limits; **audit of views/exports** for highly sensitive records; **emergency "break-glass"** with reason + post-event review. Attendance is more than daily marks: reasons + evidence, correction request/approval, late/early, completeness queue, threshold rules by stage/jurisdiction, absence cases + outreach + safeguarding escalation, guardian notification with delivery proof, aggregate metrics with denominators + policy version — **never auto-label a child "truant"**. Health & safeguarding are distinct, strictly-disclosed modules; the app must not imply clinical diagnosis. Our `HealthRecord` (encrypted narrative + keyed blind-index flags) is the right foundation to extend.

## 6 · Privacy & child-data protection (NDPA 2023)

The Nigeria Data Protection Act 2023 is directly relevant. Support: versioned **privacy notices** + presentation evidence; lawful processing + **data minimization** (purpose-bound fields, masked views, configurable retention — contrast the legacy system exposing parent phone/email by default, C026/C043/C111); **sensitive-data controls** (classification, stronger authz, encryption, view/export audit, restricted analytics); **child consent/capacity** (guardian authority, age rules, consent evidence — Section 31 addresses child data); data-subject rights (access package, correction, objection, deletion/anonymization with legal-hold exceptions); **DPIA register**; DPO/processing register/audit export; **breach register + notification clocks**; cross-border processor/subprocessor register + transfer basis. Records to add: `ProcessingPurpose, LawfulBasisAssessment, PrivacyNoticeVersion, ConsentOrAuthorization, DataSubjectRequest, RetentionPolicyVersion, DPIA, DataBreachIncident, Processor/Subprocessor, DisclosureLog, DataExportJob`. Consent must be granular, revocable where lawful, and **distinct from acknowledgement/contract/public-task/legitimate-interest**. International markets get **policy packs**, not a global "compliant" switch (e.g. FERPA is a tenant policy overlay). SchoolWithEase supplies controls + evidence; institutions + counsel make the legal decisions.

## 7 · AI in education (govern before scale)

The legacy system already embeds AI (dashboard assistant C133, AI curriculum pedagogy C081, AI question generation C060) with only a light "AI can make mistakes" note and **no provenance/approval**. Our controls: approved use-case registry (owner/purpose/model/provider/data-classes/risk tier); prohibit sensitive/high-risk data to unapproved providers; tenant opt-in + role/feature availability; disclose AI assistance in authoring; **human review + named approver before publication or consequential use**; retain prompt/output/model-version/reviewer/edits where proportionate; citations/provenance for imported curriculum claims; **no autonomous admission, discipline, safeguarding, promotion, or final-grade decisions**; bias/quality/accessibility evaluation; red-team for prompt injection + cross-tenant leakage; deletion/retention for prompts/outputs; provider fallback; cost/usage controls + model allowlist; appeal route for AI-influenced conclusions. UNESCO's generative-AI-in-education guidance (human-centred, privacy-protective) and the NIST AI RMF (govern/map/measure/manage) inform the control plane without replacing local review. Our `AiSettings/AiUsageMonthly/AiConcurrencyLease` models are a good base for cost/quotas.

## 8 · Interoperability & portability

Adopt standards selectively behind a canonical model: **OneRoster 1.2** (users/orgs/classes/enrollments/courses/sessions/gradebook — preserve external source IDs), **LTI 1.3** (secure tool launch + grade return — treat keys/consent as security config), **Caliper** (event telemetry — minimized + purpose-limited), **Ed-Fi** (K-12 exchange where a market demands it), **ISO 21001** (organizational framing, not a software certification). Also: documented versioned REST + **signed webhooks**; CSV/XLSX import/export with schema templates + validation reports; signed expiring bulk exports; idempotency keys; source-system IDs + reconciliation status; integration-scoped permissions; tenant-visible sync status + replay; deprovisioning on removal.

## 9 · Localization & real operating conditions

**Nigeria-first:** resumable imports + autosaved drafts + compressed assets + retry + visible sync (the corpus proves the need — C033 "batch of 200", C059 "60 questions", C052 "batch of 20"); shared-device sign-out + short inactivity for sensitive roles + privacy-safe notifications; mobile-first teacher/guardian jobs (fix the legacy system's desktop-only lesson editor, C067); **SMS/email cost visibility + DND classification + consent + sender identity + retry** (C105–08); bank transfer + gateway reconciliation + partial/overpayment/allocation + printable receipts (C082–85); correct **NGN formatting with kobo semantics** (already our design); NG phone E.164 without rejecting international guardians (C014); **flexible names** (no fixed first/middle/last) + multiple non-parent caregivers with relationship/authority/priority/date-range (beyond Father/Mother, C049); campus/arm/ownership-group reporting; **Excel migration as a governed workflow, not something to hide** (C033/C091). **International:** Unicode throughout; locale-aware dates/numbers/currency/collation; configurable week start + time zone; translated labels with fallback + status; RTL-ready primitives; internationally flexible names/addresses/phones; accessible language + alternate formats.

## 10 · Accessibility (WCAG 2.2 AA baseline)

Every control has an accessible name; forms use real labels + inline error association; visible focus + dialog focus restoration; all primary workflows keyboard-operable; adequate touch targets on low-cost phones; **colour is never the only signal** (the legacy system relies on colour-only status pills, C026); results/finance/attendance tables have semantic headings + responsive alternatives; loading/empty/error/offline/permission/partial states designed (replace the bare "OOPS", C130); reduced-motion respected; destructive ops describe consequence + recovery; generated report cards accessible where the format permits. Accessibility also means **lower cognitive load**: saved filters, familiar vocabulary, progressive disclosure, stable locations, summaries before dense detail, no memorizing IDs between pages (the opposite of the 11-page student menu, C032–43).

## 11 · Academic policy services (versioned, used by all channels)

Calendar · enrollment/progression · curriculum · assessment · grade · publication · attendance · fee · privacy/retention · communication. Each decision/result references the **policy version** that produced it — the single change that makes historical report cards reproducible after configuration changes.

## 12 · Product decisions to make now

Seed the 2025 NG curriculum as **versioned framework data with cohort assignment**; deepen our educational-profile concept into effective-dated policy bundles; separate `Person`/auth-identity/profiles/tenant-membership; model curricula/assessment-rules/grades/remarks/report-layouts/promotion as **distinct versioned concepts**; add **immutable result-publication + transcript artifacts before expanding result screens**; add form-version/document/interview/decision/offer aggregates **before calling admissions complete**; build **attendance intervention + accommodations into the model, not after**; treat privacy/DPIA/disclosure/child-authorization as product records; integrate external standards via mapping layers; require **human approval + provenance** for AI-assisted academic content.

### Authoritative reference set (re-validate at scope lock)

NDPC — Nigeria Data Protection Act 2023 · NERDC revised-curriculum notice (8 Sep 2025) + curriculum portal · Federal Ministry of Education (senior school) · WAEC online · NUC CCMAS · NBTE downloads · NCCE Acts/functions · UBEC EMIS · W3C WCAG 2.2 · 1EdTech OneRoster 1.2 + LTI 1.3 + Caliper · Ed-Fi Data Standard · ISO 21001 · UNESCO generative-AI-in-education guidance · NIST AI RMF · US ED FERPA/health-records guidance.
