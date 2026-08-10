# Workbench 3 — Admissions

**Why now:** admissions is the front door — a prospective student's journey from application to a registered, enrolled student. The [dependency map](../plan/06-roadmap-and-discussion-guide.md) puts it after People (F1/WB1) and the academic structure + lifecycle (WB2), because a real admission **ends by converting an applicant into a registered student** sitting in an explainable structure. F1 (Person), F4 (documents), F5 (delivery) and WB2-3 (student lifecycle) are all `done`, so the pipeline can be built end-to-end.

**Consolidates / replaces (incumbent):** the flat, page-first `AdmissionApplication` stub — `applicantName`/`applyingFor`/`guardian*` with **strings-only** `stage`/`decision` and a **grandfathered privileged-client** read — and the ad-hoc admission flows (C018–C024, matrix 07 jobs 14–23). **Replaces** a labelled bag of strings with a durable, Person-linked pipeline whose stage + decision history is auditable and never overwritten, and whose accepted applicants become students in **one command**.

## Workbench acceptance (all must pass)

1. An application is a **durable, Person-linked** record moving through explicit stages, with an **auditable stage history** (an effective-dated event per transition — never a silent overwrite).
2. A reviewer records a **scored decision** (`AdmissionReview`: score + recommendation + note); the review history is kept (job 17 was "strings only").
3. An accepted applicant is **offered** a place, and on **acceptance** a **one command** converts them into a **registered student** — creating the Person + profile + `Student` (with an allocated student number) and **registering them into a class section via the WB2-3 lifecycle**, so the new student shows a proper registration placement span (job 23).
4. Tenant isolation (RLS) + campus scope (WB1-6, on the conversion's target section) + server-side permissions hold; **no privileged client** (the stub's grandfathered read is removed).

Items `WB3-1..WB3-5` on the [board](TASK-BOARD.md). This session builds **WB3-1 + WB3-2** (the acceptance-critical core); WB3-3/4/5 are detailed-but-backlog (WB3-5 blocked on WB5 Finance).

---

## WB3-1 · Admissions pipeline + decision history — `L` (deps F1, WB1)

**Job:** make an application a durable, explainable pipeline record — the fix for the strings-only stub.
**Domain (additive over `admissions.AdmissionApplication`):** extend the application with a Person link, a real stage machine (`enquiry → applied → screening → interview → offer → accepted → enrolled` + `rejected`/`withdrawn`), target campus/section/year, offer/accept/decision timestamps and a resulting-student link; new **`AdmissionStageEvent`** (effective-dated stage history) and **`AdmissionReview`** (scored decision history). Rewrite `AdmissionsService` onto `TenantDbService` only (remove the `DatabaseService` fallback). A guided **pipeline board** replaces the stub UI.
**Scope/permissions:** `admissions.view` / `admissions.create` / `admissions.review` (exist) + new `admissions.decide`.
**Acceptance:** stage transitions write history; a review is scored + kept; `db:rls:check` green on the new tables; no new privileged-client usage.

## WB3-2 · Offer → acceptance → one-command conversion → student — `M` (deps WB3-1, WB2-3, F1)

**Job:** turn an accepted applicant into a registered student in one command.
**Domain:** `makeOffer` / `recordAcceptance` / `reject` state transitions, then **`convertToStudent`** — creates a Person (F1) + a login-less profile (`User`+`UserTenant`) + a `Student` (student number allocated via the WB2-3 `suggestStudentNumber`) and **registers the student into a `ClassSection` via `StudentLifecycleService.registerStudent`** (WB2-3), all on the tenant-scoped client in one tx, audited, campus-scoped. Idempotent (refuses a second conversion). F5 offer notification + F4 offer document are light hooks / follow-ups.
**Acceptance:** an accepted application converts once → a `Student` exists + is enrolled in the chosen section (a registration placement span) + the application flips to `enrolled` with `resultingStudentId`; converting a non-accepted or already-converted application is rejected.

---

### Deferred to backlog (detailed just-in-time)

- **WB3-3** versioned application form + typed responses (job 15).
- **WB3-4** interview/exam scheduling + outcome (job 18) + admission quiz reusing `Assessment` (job 19).
- **WB3-5** admission fee/deposit — **blocked on WB5 (Finance)** (job 20).
- Applicant notifications + delivery log (job 21) reuse **F5**; wired as a light hook here, fully in WB6.

### Definition of Done (this session)

WB3-1 + WB3-2 acceptance scenarios pass end-to-end; the flat stub + its privileged read are replaced; conversion reuses WB2-3; full validation contract + `pnpm ci:quick` green; board + `AI_HANDOFF.md` updated.

---

## WB3-3 + WB3-4 shipped — `2026-08-11` (branch `feat/wb3-forms-interviews`)

**Completes the workbench** — the two remaining unblocked backlog items. **Zero new permissions
(stays 352)**; new migration `20260811000000_admissions_forms_interviews` (+3 RLS
tables); no privileged client. Unit specs + **admissions-forms e2e 6/6 real-pg** (RLS isolation
proven); the WB3-1/2 admissions e2e stays 14/14.

- **WB3-3 · versioned application form + typed responses (job 15).** A school authors its own
  questionnaire beyond the fixed structured intake: **`AdmissionFormVersion`** (draft → published →
  archived; a published version is **immutable**, editing forks a new draft, one published version
  is "current") with ordered **typed field defs** (`text | paragraph | number | date | select |
  multiselect | boolean`), and **`AdmissionFormResponse`** — an application's answers **validated by
  field type** then **snapshotting** the version number + field defs (FK **RESTRICT**), so a later
  form edit never rewrites captured answers (same immutability ethos as WB4 results + the
  requirement snapshot). Form builder at `/admissions/forms` (`admissions.criteria`); a per-
  application form panel captures/updates the response (`admissions.create`).
- **WB3-4 · interview / exam scheduling + outcome + admission quiz (jobs 18+19).**
  **`AdmissionInterview`** — a scheduled `interview | exam | screening` with a structured outcome
  (`pass | fail | hold` + score + notes). An **exam** may carry an **inline question paper** (the
  admission quiz): the applicant's answers are **auto-marked server-side** by the SAME objective
  marker as classroom assessments — extracted to a shared `common/academics/objective-marking.ts`
  (`markObjective`) and reused by both `AssessmentTakingService` and the quiz (no class/enrollment
  needed, questions live inline). An essay parks `needsManualGrading` for a human to finalise via
  the outcome action. All gated `admissions.interviews` (existing). Scheduling + outcomes + quiz on
  the application detail page.
- **Also hardened:** `serverApiGet` now treats an empty `200` body as `null` (a nullable endpoint
  like "no published form yet" returns an empty body → `res.json()` used to throw "Unexpected end of
  JSON input"). Aligns with the defensive-data-access golden rule.

**Deferred:** WB3-5 admission fee/deposit — now `ready` (WB5 P1 landed), a finance-coupling
fast-follow. Applicant self-service portal for form-fill (staff capture now; public portal is a
later F5/WB6 surface).

---

## Structured-intake redesign — `2026-08-06` (owner-driven, branch `feat/wb3-admissions-structured-intake`)

**Why:** the free-text "Applying for" made admissions a parallel list a school had to reconcile with its real classes. The redesign sources intake from the school's **own** structure and captures the full applicant record up front, so an admit converts with **zero re-keying** and the school keeps no separate list.

**What shipped (extends WB3-1/2; toward WB3-3):**

- **Cascade intake.** `createApplication` validates the WB2-1 cascade (class = `YearLevel` → level = `Stage`, optional department = `Stream`, optional `Campus`) against the tenant's structure and **composes** the stored `applyingFor` label from it (never parsed). Applicant profile (DOB/gender/state/religion/health) captured. `GET /admissions/intake-structure` feeds the form.
- **Structured guardians.** New `AdmissionGuardian` (multi): relationship, phone + WhatsApp with a **same-as-phone reuse** (no re-typing), exactly-one-primary enforced server-side; legacy flat guardian fields mirror the primary.
- **Configurable requirements framework (the staggered reality).** `AdmissionRequirement` = a per-tenant, **editable** template — document / field / measurement / fee, each tagged to a **collection stage** (`application` up-front vs `acceptance`/etc. after an offer) so schools collect medicals, uniform measurements, acceptance fees, more IDs *when they actually do*. It is **snapshotted** onto each application as `AdmissionApplicationRequirement` (a later template edit never rewrites an in-flight file; FK **RESTRICT**), then **provided / uploaded / waived**. Default Nigerian checklist seeded on demand.
- **Real document storage (F4 → R2).** Requirement documents upload through the F4 `DocumentService` behind a new **Cloudflare R2** S3-compatible `StorageProvider` (auto-selected when the four `R2_*` env vars are set, else local disk); round-trip verified against the real bucket; env parity + a 20mb body limit for real uploads.
- **UI.** Full-width Applications table + search; structured **New Application** cascade form (side sheet); at-a-glance **drawer** on row-click; full **`/admissions/[id]`** detail/edit with the staged requirement checklist (upload/measure/fee/waive), history, reviews and the decision/convert actions.

**Permissions:** reuses existing admissions perms (`create`/`view`/`documents`/`criteria`) — **no count change (345)**. **No privileged client.** New migration `20260806010000_admissions_structured_intake` (+3 RLS tables). Independent review: all gates green + 10 findings all fixed; **admissions e2e 14/14 on real pg**.
