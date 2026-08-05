# Workbench 2 — Academic structure + student lifecycle

**Why now:** the [dependency map](../plan/06-roadmap-and-discussion-guide.md#dependency-map) puts a real academic structure before results (WB4), admissions conversion (WB3) and daily-work (WB8) — you cannot publish a result, register an intake, or run a class workspace until every student sits in an _explainable_ structure with history. Phase-1 `F1` (Person) and `F6` (curriculum/profile-version) are `done` and **ADR-02** (class/offering/registration) + **ADR-03** (curriculum) are accepted, so the model is settled — this workbench builds it.

**Consolidates / replaces (incumbent):** the labeled-bag `Class`/`Course` + name-parsing ("SS1 SCIENCE") + the ad-hoc promotion/transfer flows (C036–C038, #30, #31, #32, #36, #37, #38, #58). **Replaces** parsing a display string with structured dimensions, and replaces delete-and-retype lifecycle changes with durable, explainable transitions that keep history across years.

**Builds on WB1-6:** `Campus` (the operating unit within a tenant, ADR-11 Option A) is the top dimension of the ADR-02 model — a class/section belongs to a campus, and the WB1-6 access-scope primitive (`AccessScopeService`) is what lets a campus-scoped bursar/registrar act only within their campus once these rows carry a `campusId`. WB2 is where campus scope becomes visible end-to-end.

## Workbench acceptance (all must pass)

1. Two cohorts at one campus in different **streams** (SS1 ARTS vs SS1 SCIENCE) model **without name-parsing**; no code path derives stage/arm/stream from a label.
2. A **K-12** profile (class-based `Enrollment`) and a **tertiary** profile (per-course `CourseRegistration`) both resolve student→subject correctly, chosen by the tenant's `AcademicProfileVersion` (F6).
3. A student **transfers** section mid-year; the record keeps **both** placements with dates (history, not overwrite). A **withdrawal/graduation** is a lifecycle transition, never a delete.
4. An end-of-year **promotion** runs with a **preview + exceptions** (repeat/withhold), commits next-year enrollments, and leaves the prior year **untouched**.
5. An admin can **explain a student's placement**: campus → stage → year-level → stream → section → offerings, and the year-over-year history behind it.

Items `WB2-1..WB2-4` on the [board](TASK-BOARD.md). All depend on `F1`+`F6` (`done`) and ADR-02/03 (accepted); WB2-1 additionally depends on **`Campus`** (WB1-6).

---

## WB2-1 · Academic structure model (ADR-02) — `XL` (deps F6, ADR-02/03, Campus[WB1-6])

**Job:** store the structure as **dimensions**, never a parsed label — the fix for the dirtiest data source in the incumbent.
**Domain (new `academic-structure` tables, additive over the legacy `Class`/`Course`):** `Stage` · `YearLevel` · `Pathway`/`Stream` · `ClassSection`/`Arm` (all under a `Campus`), a `displayLabel` that is **stored, not parsed**, and **`SubjectOffering`/`CourseOffering`** that link an F6 curriculum subject to a class/cohort in a term. A **guided class-builder** (structured picker) replaces free-text class names.
**Scope/permissions:** `academics.structure.view` / `.manage` (context-scoped); campus-scoped via WB1-6 (`ClassSection.campusId`).
**Acceptance:** SS1 ARTS and SS1 SCIENCE at one campus model as distinct rows; grepping the codebase finds **no** class/subject-label parsing; `db:rls:check` green on the new tables.

## WB2-2 · Enrollment + course-registration + electives — `L` (deps WB2-1, F6)

**Job:** join students to what they study, the way their profile demands.
**Domain:** extend `Enrollment` (K-12: a student joins a `ClassSection` and takes its offerings as a set) **and** add `CourseRegistration` (tertiary/TVET: per-course), with the tenant's **`AcademicProfileVersion` (F6)** selecting which applies; **`StudentSubjectElection`** over offerings for elective choice (C036); **teacher assignment** to sections/offerings (#30).
**Acceptance:** a K-12 profile resolves student→subjects via class enrollment; a tertiary profile via per-course registration; an elective references an **offering**, not a free-text subject; a teacher is assigned to an offering, not a label.

## WB2-3 · Student lifecycle: registration · transfer · withdrawal · graduation — `L` (deps WB2-2, F1)

**Job:** every change to where a student sits is a durable, explainable **lifecycle event** with history — never a delete-and-retype.
**Domain:** admission-independent **student registration** into a section/cohort; **identifier allocation** + controlled credential issue (reuse WB1-3 secure provisioning — no generated-password); **transfer** (section↔section, campus↔campus), **withdrawal**, **graduation**, each an effective-dated transition writing a `StudentPlacementHistory` row (#31, #32).
**Acceptance:** a mid-year transfer shows both placements with dates; a withdrawal/graduation flips lifecycle state and is auditable; prior placements are never destroyed.

## WB2-4 · Promotion workbench (year rollover) — `L` (deps WB2-3)

**Job:** move a cohort to the next year in one reviewable operation, on the F3 job substrate for large cohorts.
**Reuse:** F3 durable jobs + the F8 `WorkbenchLayout`/`ApprovalPanel`; the maker-checker/step-up pattern from WB1-6 for the commit.
**Domain:** a **promotion run** with a **preview** (who advances, to which year-level/section) + **exceptions** (repeat / withhold / manual placement), then a commit that creates **next-year** enrollments and leaves the prior year immutable; consumes **result/promotion input** from WB4 when present (#58).
**Acceptance:** a promotion preview lists the cohort with proposed placements; marking an exception changes only that student; commit creates next-year rows and the prior year is untouched (scenario 4).

---

### Deferred to backlog (not in Workbench 2)

- Timetable/period modeling (#…) → WB8 (daily-work) — offerings here are the anchor it will hang on.
- Result cycles / broadsheets → WB4 (results parity) — WB2 provides the offerings + promotion input WB4 reads.
- The migration of real legacy class strings → structured rows → WB7 (migration cockpit), via a reversible label mapping.

### Definition of Done (whole workbench)

All five acceptance scenarios pass end-to-end; the legacy labeled-bag class model is replaced by the structured ADR-02 model with no label-parsing; campus scope is honoured on academic rows via WB1-6; full validation contract + `pnpm ci:quick` green; board + `AI_HANDOFF.md` updated.
