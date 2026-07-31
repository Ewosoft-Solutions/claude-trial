# ADR-02 — Class / section / offering / course-registration model

- **Status:** Proposed — 2026-07-31
- **Deciders:** engineering + product. **Owner sign-off:** confirm terminology config (class/arm/section; subject/course/module) — [Q5](../../plan/06-roadmap-and-discussion-guide.md#b--product-shape--terminology).
- **Unblocks:** WB2 (academic structure + student lifecycle), elective election, promotion, transfer; feeds WB4 (results are per offering).

## Context

The legacy system encodes **stage + arm + stream into the class name**: "BASIC 7 EMERALD", "SS1 SCIENCE" (C041), created as **free text** across many conventions in one tenant — Basic/Primary/JSS/SSS + British "Year 1–12" + Montessori "Reception" + gemstone arms (Diamond/Emerald/Jasmine) + WAEC/NECO (C116). Our current models (`AcademicYear, Term, Course, Class, ClassTeacher, Enrollment`) treat a class as a labeled unit, and `Student.gradeLevel` is a bare string.

If semantics are parsed from a label, we cannot do the things the product requires: polymorphic school types (nursery → university/TVET, `AI_CONTEXT.md`), senior-secondary **streams**, **elective** choice (C036), promotion/repetition, transfer, or clean migration of thousands of messy class strings. Tertiary needs **per-course registration**; K-12 needs **class-based enrollment** where a class carries its subjects. One model must serve both.

**What breaks if we guess wrong:** every academic feature (offerings, timetable, results, promotion, transcripts) and the migration of the legacy system's class/subject data reference this structure. A label-parsing shortcut becomes a core-table redesign the moment a second school profile appears.

## Options

1. **Structured stage/section/stream + a Subject-definition → Offering → Class/cohort → Enrollment/Registration split (recommended).** Serves K-12 and tertiary; label is stored, never parsed. Trade-off: more entities than "a class is a row".
2. **Keep `Class` as a labeled bag and parse the name.** Status-quo-adjacent, zero migration — rejected: can't represent stage/arm/stream/pathway distinctly, breaks polymorphism + promotion + transfer.
3. **Course-registration everywhere (tertiary model for all).** Clean for university; rejected — over-complex for K-12, where "the class" is the operational unit and students take the class's subjects as a set.

## Decision

Adopt **Option 1**. Store the dimensions separately and never derive meaning from a display label:

```
Campus · Stage (e.g. JSS/SSS/Primary) · YearLevel · Pathway/Stream (ARTS/SCIENCE…) · Section/Arm (Emerald…)
         │
Subject/Course DEFINITION  ──offered as──▶  SubjectOffering / CourseOffering (in a term, to a class/cohort)
                                                     │ taught to
                                             ClassSection / Cohort
                                                     │ joined through
                                    Enrollment (K-12, class-based)  |  CourseRegistration (tertiary, per-course)
```

- **`displayLabel` is stored, not parsed.** "BASIC 7 EMERALD" = {stage: Basic, yearLevel: 7, section: Emerald, label: "BASIC 7 EMERALD"}.
- **Two join types over offerings:** `Enrollment` (a student joins a class and takes its offerings as a set — extends today's `Enrollment`) and `CourseRegistration` (a student registers per course — tertiary/TVET). A tenant's `AcademicProfileVersion` (F6) selects which applies.
- **`StudentSubjectElection`** references offerings (elective choice, C036).
- **Terminology (class/arm/section; subject/course/module) is a display concern** driven by the profile; the canonical model names are fixed (Q5).
- Subject _definitions_ come from Curriculum (ADR-03); an offering links a curriculum subject to a class/term.

## Consequences

- **Enables** polymorphic profiles, streams, electives, promotion/transfer, timetable, and per-offering results/transcripts; a class-based K-12 school and a registration-based tertiary school both model cleanly.
- **Constrains:** creating a class requires structured fields (guided picker), not free text — this is the point; it kills the dirty-data source.
- **Migration impact:** map each the legacy system class string → (campus, stage, yearLevel, pathway, section, label) via a mapping table (WB7); additive tables; `tenant_id` + RLS.
- Depends on **ADR-01** (students/staff are Persons/profiles) and **ADR-03** (offerings reference curriculum subjects); pairs with **F6** (profile selects enrollment vs registration).

## Validation

- Two cohorts at one campus in different **streams** (SS1 ARTS vs SS1 SCIENCE) model without name-parsing.
- A K-12 profile (class-based) and a tertiary profile (course-registration) both resolve student→subject correctly.
- No code path parses a class/subject **label** to derive stage/arm/stream.
- Migration maps a sample of real the legacy system class strings to structured rows with a reversible label; `db:rls:check` green.
