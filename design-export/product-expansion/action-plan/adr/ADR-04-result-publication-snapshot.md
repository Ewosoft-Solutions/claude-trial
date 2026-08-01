# ADR-04 — Result publication snapshot + amendment (immutability)

- **Status:** Accepted — 2026-08-01
- **Deciders:** engineering + product. **Owner sign-off:** granted 2026-08-01 (Option 1 — "published" = an immutable snapshot; corrections via amendment; finance never silently blocks a result). Owner also requested **external verifiable anchoring (blockchain)** of published results — deferred to **[ADR-13](ADR-13-verifiable-anchored-records.md)** (results now, financial receipts later); the snapshot + checksum design here is intentionally anchor-ready ([Q13–16](../../plan/06-roadmap-and-discussion-guide.md#d--academic-scope--results)).
- **Unblocks:** WB4 (results parity), transcripts, report-card/broadsheet artifacts, promotion input.

## Context

Results are the legacy system's deepest domain and its biggest integrity risk. Publication is a **status with locking** on otherwise-mutable data, plus **per-student blocking** (C112); grade scales and 724+ remark rules are **freely editable** (C114, C120–125), so changing a threshold or remark could silently alter a **historical** report card; CBT scores reach the gradebook via a **manual collate→re-save** (C063); promotion decisions are **hardcoded into remark prose** ("Promoted to SS 3", C124); and the template page can throw a bare **"OOPS"** (C130). Our current state: `Grade` + `GradingSystem` (JSON scale) — **no result-cycle, publication snapshot, remark ruleset, or promotion workflow.**

A school's trust hinges on one thing: **can it reproduce and explain the exact result it gave a family?** With mutable rows + editable config, it cannot.

**What breaks if we guess wrong:** transcripts, amendments, promotion, notifications, and migration of historical published results all depend on this. If "published" is a boolean on live rows, historical truth is unprovable and corrections are destructive.

## Options

1. **Immutable `ResultPublication` snapshot referencing immutable policy versions + amendment/supersession (recommended).** Reproducible + auditable + correctable without destruction. Trade-off: a snapshot model + a result-cycle state machine.
2. **Publish = a boolean/lock on live `Grade` rows (the legacy system).** Rejected — not reproducible; any later config edit rewrites history.
3. **Generate a PDF only, no structured snapshot.** Rejected — you can render but can't structurally re-verify, amend, or drive transcripts/analytics from it.

## Decision

Adopt **Option 1**. A **`ResultCycle`** workbench drives one lifecycle:

```
Configure → Open entry → Validate → Moderate → Approve → Publish (snapshot) → Notify → Amend → Archive
```

- **`ResultPublication`** is an **immutable snapshot** that references **immutable versions** of: academic year/term, class/offering + enrollment roster, subject codes, assessment scheme + weights (CA1–4/EXAM), grade scale, **remark rule set**, **promotion policy**, template, and **authorized signature use** — all via F6 policy versions + ADR-03 curriculum version.
- **`PublishedStudentResult`** rows are the per-student snapshot; the report card/broadsheet/transcript are **checksum-addressed `DocumentArtifact`s** (ADR-08) signed via an authorized **`SignatureUse`** (no raw signature images).
- **Corrections create a `ResultAmendment`** (new version/supersession) — the original snapshot is **never overwritten**; notification history is retained.
- **Remark rule sets are structured** (band → comment, typed Subject/Principal) replacing 724 prose rows; **promotion is a separate policy** (rules → explainable recommendation → approval) — promotion text leaves the remark (fixes C124).
- **Publish is gated** by completeness/exception checks (missing/absent/exempt handled; an absent learner is **not** zeroed) + **maker ≠ checker** + step-up (reuse `MakerCheckerRequest`/`SensitiveOperationPolicy`); it runs as an **ADR-06 job**, notifies via **ADR-07**.
- **Finance never silently blocks a result.** Result _visibility_ may be gated only by an explicit, audited **`FinancialHold`** policy (redesign of C112, #60) — a deliberate, logged decision, not a hidden per-student block.
- CBT→gradebook becomes an **atomic, audited transfer** (fixes C063), not a manual re-save.

## Consequences

- **Enables** "reproduce the published result", transcripts, safe amendments, promotion input, and migration of historical results as read-only snapshots.
- **Constrains:** publication requires accepted policy versions (F6/ADR-03) + signatures (ADR-08) + approval — deliberately heavier than a boolean.
- **Migration impact:** import each historical the legacy system published result as a read-only `ResultPublication` snapshot with source refs (WB7); clean corrupted grade codes via versioned scales (ADR-03/ADR-09).
- Depends on **F6, ADR-03, ADR-06, ADR-07, ADR-08**.
- **Future extension (owner-requested):** publish also **anchors the snapshot's checksum** to an external verifiable ledger for tamper-evident authenticity (an employer or another school verifies a transcript without trusting us) — see **[ADR-13](ADR-13-verifiable-anchored-records.md)**. Anchor **hashes only, never PII**; each publication + amendment is anchored, so the on-chain history mirrors this ADR's snapshot + amendment model. Deferred; the architecture stays anchor-ready via the checksum-addressed artifacts above.

## Validation

- Publish a cycle → the snapshot is immutable; editing a grade scale afterward leaves the prior snapshot **unchanged**.
- Correct a published result via an approved **amendment** → both artifacts + notification history remain.
- An **absent** learner has no score and is **not** treated as zero.
- **maker ≠ checker** on publish is enforced (regression test kept from the platform-scope fix).
- A `FinancialHold` on visibility is an audited policy decision, never a silent row flag.
