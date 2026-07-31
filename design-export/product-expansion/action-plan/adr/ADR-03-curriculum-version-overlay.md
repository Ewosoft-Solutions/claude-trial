# ADR-03 — Curriculum version + tenant overlay + cohort adoption

- **Status:** Proposed — 2026-07-31
- **Deciders:** engineering + **academic owner**. **Owner sign-off:** required — an academic owner approves which framework versions a tenant may activate ([Q11](../../plan/06-roadmap-and-discussion-guide.md#d--academic-scope--results)).
- **Unblocks:** F6 (academic-profile/policy framework), WB2 (subject catalog), WB4 (results reference a curriculum version), WB8 (curriculum coverage/outcomes).

## Context

The legacy system treats curriculum as a **single mutable list** that can be forked per tenant ("Create Curriculum", C078), edited inline (C080), and AI-authored ("Pedagogy with AI", C081) — with **no version, source, license, effective date, or provenance**, and a **dirty catalog** (duplicate "Cultural & Creative Arts" vs "Cultural And Creative Arts", C080/C113; "Diction" 500 students). It claims `National Curriculum Content 9,427` (C077) with no lineage.

Nigeria's NERDC Sept-2025 revision rolls out by **entry cohort** — Primary 1, Primary 4, JSS 1, SS 1 — so **several curriculum versions are simultaneously valid** in one campus during transition ([05](../../plan/05-academic-nigeria-international.md)). A single `currentCurriculum` value cannot express that, and mutating a shared list silently changes historical reports. Our current state: `Lesson` content only, no curriculum domain.

**What breaks if we guess wrong:** results reproducibility (a report card must reference the curriculum that governed it), the 2025 rollout, blended frameworks ("Nigeria-British", C073), and international schools — plus we'd inherit the legacy system's dirty catalog with no way to reconcile old↔new subject names.

## Options

1. **Versioned framework + tenant overlays + cohort-effective-dated adoption + provenance (recommended).** National content immutable once imported; tenant edits are overlays; AI/imported nodes carry provenance; subject aliases map old↔new names. Trade-off: a real domain to build + seed.
2. **Single mutable subject list per tenant (the legacy system / status quo).** Rejected — no transition, no reproducibility, dirty by construction.
3. **Copy-fork per tenant, no version link (the legacy system "Create Curriculum").** Rejected — loses provenance and any connection to the official source; can't apply official updates.

## Decision

Adopt **Option 1**:

```
CurriculumAuthority (e.g. NERDC, Cambridge, tenant)
  └─ CurriculumFramework ─ CurriculumVersion (effective-dated, approval state, provenance)
       └─ CurriculumStage ─ CurriculumSubject ─ CurriculumNode (strand/topic) ─ LearningOutcome
CurriculumAdoption   ── tenant/campus/programme + entry cohort + level range + version + effective dates
TenantCurriculumOverlay ── tenant-approved additions/edits layered over an immutable national version
CurriculumMapping    ── subject/name aliases (old ↔ current) for transfer + migration de-dup
```

- **National content is immutable once imported;** tenant changes are **overlays**, never mutations of the source.
- **Cohort adoption is effective-dated** — Primary 1 / Primary 4 / JSS 1 / SS 1 can run the 2025 version while others run the prior version, in the same campus.
- **AI-authored or imported nodes carry `provenance{authority|model, prompt?, source, license?, reviewer, reviewedAt}`** — nothing AI-generated becomes teaching content without a named human approver (fixes C081; aligns with the AI-governance rules in [05](../../plan/05-academic-nigeria-international.md)).
- **Subject aliases** map the legacy system's dirty/duplicate names to canonical subjects on migration (feeds WB7).
- A lesson/activity/offering **cites** one or more `LearningOutcome`s; a published result references the **`CurriculumVersion`** in force (with ADR-04).
- An **academic owner** approves tenant activation of any framework version.

## Consequences

- **Enables** the 2025 NERDC cohort rollout, blended/international frameworks, reproducible reports, curriculum-coverage analytics, and clean migration of the dirty catalog.
- **Constrains:** curriculum edits go through overlays + versions, not free-text mutation; activation is gated by an academic owner.
- **Migration impact:** seed official NERDC framework versions as data; import the tenant's curriculum as an overlay + aliases; de-duplicate subjects via `CurriculumMapping`. Additive tables; national content is read-only reference data (still `tenant_id`-scoped where a tenant overlay exists; national reference rows are shared read-only).
- Depends on **ADR-02** (offerings reference curriculum subjects) and feeds **F6**; pairs with **ADR-04** (results reference a version).

## Validation

- Two cohorts at one campus run **different curriculum versions** simultaneously; a prior published result is unaffected when a new version activates.
- An AI-authored node cannot be published without provenance + a named reviewer.
- A legacy the legacy system subject name resolves to a canonical subject via an alias.
- `db:rls:check` green; seed of an official version verified by `db:verify`.
