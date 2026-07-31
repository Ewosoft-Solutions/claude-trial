# Release-1 Promise — parity contract & "retire the legacy system" definition

**P0-1 deliverable.** Settles [decision questions](../plan/06-roadmap-and-discussion-guide.md#decision-workshop--questions-to-settle) **1–3** (§A · Market & parity promise). This is the one-page promise the whole action plan scopes itself against: it names the first replacement segment, defines what "retire" contractually covers, and sets the evidence bar. Board item [`P0-1`](TASK-BOARD.md).

- **Status:** Accepted — 2026-07-31
- **Owner:** product owner (recommended defaults approved as-is)
- **Scope of this approval:** Q1–Q3 only. Q6 (tenant/campus boundary → ADR-11), Q19–Q20 (GL build-vs-integrate → ADR-10), and the remaining §B–J owner questions are **still open** and are **not** granted by this decision.

---

## The promise, in one sentence

SchoolWithEase Release 1 replaces a **Nigerian K-12 school** end-to-end for the **critical jobs its design partners actually run** — enrol, bill & collect, assess & publish results, and communicate — with a **published supported/excluded matrix** so no school is promised a capability we have not committed to, and every claim of "you can retire the legacy system" is backed by **reconciled operational evidence, not screenshots**.

---

## Decision records

### Q1 · Which schools must Release 1 replace end-to-end?

| Field                     | Value                                                                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decision**              | **NG K-12** (Nigerian primary/secondary) is the **first full profile**. Architecture stays profile-extensible; **tertiary / TVET / international are separate scope**, validated on their own.                                              |
| **Owner / Date**          | product owner / 2026-07-31                                                                                                                                                                                                                  |
| **Evidence**              | Roadmap [06 §Delivery-sequence Phase 0](../plan/06-roadmap-and-discussion-guide.md#delivery-sequence) + [§Pilot shape](../plan/06-roadmap-and-discussion-guide.md#pilot-shape); parity-matrix [07](../plan/07-capability-parity-matrix.md). |
| **Default-if-unresolved** | (Chosen default) NG K-12 first; extensible via profiles + versioned policy.                                                                                                                                                                 |
| **Affected ADR / epic**   | Profile-specific scope in **every workbench**; frames ADR-03 (curriculum), ADR-02 (class/offering). Does **not** by itself decide ADR-11.                                                                                                   |

### Q2 · What does "retire the legacy system" contractually mean?

| Field                     | Value                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decision**              | "Retire" = **capability parity on the critical jobs a partner actually uses** — not menu/page parity. We publish an explicit **supported / excluded / deferred** matrix per profile; a school retires the legacy system when every **supported** job it depends on passes acceptance **and** its data reconciles. No school is forced to adopt all modules at once. |
| **Owner / Date**          | product owner / 2026-07-31                                                                                                                                                                                                                                                                                                                                          |
| **Evidence**              | [06 §Planning-conclusion](../plan/06-roadmap-and-discussion-guide.md#planning-conclusion) (jobs & records, not menu) + [§Non-negotiable principles 2 & 8](../plan/06-roadmap-and-discussion-guide.md#non-negotiable-release-principles); thesis "capability parity **without** IA parity".                                                                          |
| **Default-if-unresolved** | (Chosen default) guarantee critical used-jobs; publish supported/excluded matrix.                                                                                                                                                                                                                                                                                   |
| **Affected ADR / epic**   | Defines the **acceptance register** (P0-4) and the exit gates of every Phase-2 workbench. The definitive per-partner job list is filled by **P0-2**.                                                                                                                                                                                                                |

### Q3 · Which evidence outranks a screenshot?

| Field                     | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decision**              | Screenshots are **discovery / traceability evidence only**. For any **high-consequence behaviour** (results publication, money movement & allocation, access grants, migration reconciliation) the authority is **operational evidence**: partner interviews, real redacted exports, and observed workflows — plus, at acceptance, **reconciled control totals + sampled records**. A screenshot never accepts a migration wave or a published artifact. |
| **Owner / Date**          | product owner / 2026-07-31                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Evidence**              | [06 §Non-negotiable principle 7](../plan/06-roadmap-and-discussion-guide.md#non-negotiable-release-principles) (no wave accepted by screenshots) + [§Immediate-next-actions 10](../plan/06-roadmap-and-discussion-guide.md#immediate-next-actions) ("keep screenshots as traceability, not specs").                                                                                                                                                      |
| **Default-if-unresolved** | (Chosen default) operational evidence for high-risk behaviour; screenshots for discovery.                                                                                                                                                                                                                                                                                                                                                                |
| **Affected ADR / epic**   | Sets the reconciliation contract (ADR-09) acceptance bar and P0-2's "redacted exports" requirement.                                                                                                                                                                                                                                                                                                                                                      |

---

## Release-1 profile: **NG K-12**

- **In profile:** Nigerian nursery/primary/secondary (junior & senior). Canonical domain vocabulary in code/API; NG display terms (learner/pupil, class/arm, term) via profile.
- **Out of profile (separate scope, separate promise):** tertiary/university, TVET/polytechnic, and non-NG/international deployments. These may be _validated_ later as their own profiles — architecture must not block them, but Release 1 makes them **no commitment**.
- **Adoption is modular:** a partner may go live on a subset of supported jobs; "retire" is asserted per-job and only claimed when the school's dependent jobs are all supported + accepted + reconciled.

## Supported / Excluded matrix (profile-level, Release 1)

The **definitive, per-partner** matrix is produced by **[P0-2](phase-0-scope-lock.md)** from each partner's actually-used-job inventory. This is the profile-level frame that P0-2 refines. Row scoring lives in the **parity scorecard** (P0-4); no critical job is "averaged away" to green.

| Area                                                             | Release-1 stance         | What that means                                                                                                                                       |
| ---------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| People / users / staff                                           | **Supported**            | Unified People directory, invitations/activation/reset, staff employment, guardianship, role editor + scope. (Phase 2A / WB1.)                        |
| Academic structure & lifecycle                                   | **Supported**            | Curriculum/profile version, class/arm/offering, registration/rollover/transfer, promotion workbench. (Phase 2B.)                                      |
| Admissions                                                       | **Supported**            | Versioned form → portal → review → decision/offer → **finance-linked** conversion, no retyping. (Phase 2C.)                                           |
| Results                                                          | **Supported**            | Result-cycle + CA components, entry + Excel import, moderation/approval, **immutable published artifact** + amendment. (Phase 2D.)                    |
| Finance (fees/receivables)                                       | **Supported**            | Fee catalog/schedules, invoices, family/student accounts, payment + **partial allocation + unapplied credit + refunds**, receipts, aging. (Phase 2E.) |
| Engagement / comms delivery                                      | **Supported**            | Audience over saved views; **SMS/email/in-app** with delivery attempts + cost + retries; preferences/consent; SecureLinks. (Phase 2F.)                |
| Migration & reconciliation                                       | **Supported**            | Source-ID mapping, staged import/validate/repair, reconciliation dashboard, cutover/rollback runbook. (Phase 2G.)                                     |
| Core operational reporting                                       | **Supported**            | Curated parameterized report catalog (admin/academic/finance/audit) with definition + version. (Phase 2F.)                                            |
| Full **general ledger** / accounting / payroll processing        | **Deferred / integrate** | Receivables-first subledger ships; internal GL is **ADR-10 (owner, Q19–20)** — integrate accounting unless a partner requires it.                     |
| Library / transport / health / hostel / inventory / HR ops       | **Excluded (Release 1)** | Phase 4 operational depth. Not part of the Release-1 "retire" promise.                                                                                |
| CBT depth, lesson/homework workspaces, teacher "Today"           | **Excluded (Release 1)** | Phase 3 daily-work superiority. Basic academic records are supported; the rich workspaces are not a Release-1 commitment.                             |
| Extra channels (WhatsApp/push), report **builder**, AI decisions | **Excluded (Release 1)** | SMS/email/in-app + curated catalog only; AI is human-approved authoring at most (Phase 5). No autonomous consequential decisions.                     |
| Multi-campus / school-group tenancy                              | **Conditional**          | Depends on the tenant/campus boundary — **ADR-11 (owner, Q6)**. Single-school NG K-12 is the safe Release-1 default until Q6 lands.                   |

**Reading the matrix:** _Supported_ = a Release-1 "retire" promise, gated by acceptance + reconciliation. _Deferred_ = on the roadmap but pending an owner decision (named). _Excluded_ = explicitly **not** promised for Release 1 — labelled honestly (capability flags / readiness labels, principle 39) so scaffolding never reads as a commitment. _Conditional_ = supported only after the named owner decision.

---

## Sequencing — demo-ready vs reconciled-live

**Decision (2026-08-01, owner):** build **from the legacy-system screenshots + seed data** (as we already seed) to a **fully-functional demo** first; sell on the working product; then tweak per school. Design-partner recruitment + real exports (**P0-2**) move to **onboarding** — they do **not** gate the build.

- **"Fully functional" (demo)** — every _supported_ job runs end-to-end on representative NG K-12 seed data: layouts, workflows, the full happy path. This is what earns the sale.
- **"Reconciled replacement" (a school's live go-live)** — that _specific_ school's real balances/results/records reconcile to control totals + sampled records (Q3). This is where its redacted exports re-enter, and where "you can retire the legacy system" becomes a backed claim rather than a demo.

**This is a hard environment boundary, not just a label.** The demo lives in its **own environment seeded with representative NG K-12 data**; **staging/production hold only real tenant data**, and **demo seeds never flow to staging/production**. So the demo↔reconciled-live split is enforced by data separation — no seed record can contaminate a school's reconciliation. (Seeding infrastructure must therefore be environment-guarded: seed commands target demo only, never staging/prod.) The demo is additionally labelled honestly (readiness labels / capability flags, principle 39) so a working prototype is never mistaken for a completed migration.

---

## What this unblocks / still gates

- **Unblocks now:** profile-specific scope in every workbench (target = NG K-12), the acceptance-register framing (P0-4), and P0-2's redacted-export requirement (Q3 evidence rule).
- **Still owner-gated (not granted here):** **ADR-11** (tenant vs campus, Q6) and **ADR-10** (GL build-vs-integrate, Q19–20) remain `blocked (owner)`. The multi-campus and full-GL matrix rows stay _Conditional/Deferred_ until those decisions are made.
- **No blocking dependency:** we **build from the screenshot learnings + seed data** to a fully-functional demo (see _Sequencing_ above). **[P0-2](phase-0-scope-lock.md)** is resequenced to **onboarding** — per-school exports reconcile that school before its live cutover — and no longer gates the build. The profile-level matrix here is our working scope; a signed school refines its own rows.

## Verification (Phase-0, no code)

- [x] P0-1 has an owner, a current artefact (this file), a target (NG K-12 + matrix), and an acceptance rule (Q3 evidence bar).
- [x] The Release-1 promise + supported/excluded matrix exists and is signed (owner-approved defaults, 2026-07-31).
- [ ] At least one partner's used-job inventory + redacted samples in hand — **P0-2** (open).
- [ ] `pnpm ci:quick` green after this docs change (run before PR).
