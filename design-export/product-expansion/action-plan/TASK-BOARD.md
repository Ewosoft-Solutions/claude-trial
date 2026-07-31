# TASK BOARD — the legacy system parity

**The coordination point.** Claim a `ready` item (deps `done`) by setting Owner + Status → `claimed` in a `board: claim <ID>` commit _before_ coding. Mechanics: [`WORKFLOW.md`](WORKFLOW.md). Contract/DoD: [`/AGENTS.md`](../../../AGENTS.md). `#N` = row in [parity matrix 07](../plan/07-capability-parity-matrix.md).

**Status:** `backlog` · `ready` · `claimed` · `in-progress` · `in-review` · `done` · `blocked`
**Effort:** `S` · `M` · `L` · `XL`

## ▶ Ready to claim right now

`H1` `H2` `H3` · `ADR-01…12` (all drafted → **review→accept**, `P0-3`) · `F3` `F7` `F8`
_(Everything else is `backlog`/`blocked` until its dep or ADR lands. Owner decisions `P0-1/P0-2` gate the profile-specific scope.)_

---

## Hygiene (do early — unblocks trust & the states everything reuses)

| ID  | Title                                                                                                                                                  | #    | Effort | Deps | Owner | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------ | ---- | ----- | ------ |
| H1  | Reconcile status-doc drift: permission counts (274/297/**305**) + fix stale "mock data" line in `AI_CONTEXT.md` + `CURRENT_PHASE.md`                   | —    | S      | —    | codex | claimed |
| H2  | Permission-denied + empty/error/loading/offline states in `packages/ui` `custom/states`; wire `unauthorized` route (replaces the legacy system "OOPS") | #115 | M      | —    | —     | ready  |
| H3  | Remove commercial/"Pay Now"-style nags from workspace surfaces; keep billing in account settings                                                       | #116 | S      | —    | —     | ready  |

## Phase 0 — scope-lock + ADRs (decisions before code; no feature code)

| ID   | Title                                                                                                                       | Effort | Deps | Owner     | Status          |
| ---- | --------------------------------------------------------------------------------------------------------------------------- | ------ | ---- | --------- | --------------- |
| P0-1 | Confirm Release-1 school profile + contractual "retire the legacy system" definition                                        | S      | —    | **owner** | blocked (owner) |
| P0-2 | Recruit 2 design partners; inventory their actually-used jobs; collect redacted exports (report cards/receipts/broadsheets) | M      | —    | **owner** | blocked (owner) |
| P0-3 | Draft + accept the 12 ADRs (below)                                                                                          | L      | —    | —         | ready           |
| P0-4 | Stand up parity/migration/acceptance scorecards (from [06 §5](../plan/06-roadmap-and-discussion-guide.md))                  | S      | —    | —         | ready           |

### ADRs (see [`adr/README.md`](adr/README.md); draft now, some need P0-1 owner sign-off)

| ID     | Decision                                                                           | Effort | Status               |
| ------ | ---------------------------------------------------------------------------------- | ------ | -------------------- |
| ADR-01 | Person / auth-identity / profile / tenant-membership separation                    | M      | ready                |
| ADR-02 | Class / section / offering / course-registration model (don't parse "SS1 SCIENCE") | M      | ready                |
| ADR-03 | Curriculum version + tenant overlay + cohort adoption                              | M      | ready                |
| ADR-04 | Result publication snapshot + amendment (immutability)                             | M      | ready                |
| ADR-05 | Finance ledger + family credit/wallet + allocation semantics                       | M      | ready                |
| ADR-06 | Durable job/outbox infrastructure                                                  | M      | ready                |
| ADR-07 | Communication delivery-provider abstraction (DND/cost/consent)                     | S      | ready                |
| ADR-08 | Document/signature asset security (SigningAuthority)                               | S      | ready                |
| ADR-09 | Migration source-ID + reconciliation contract                                      | M      | ready                |
| ADR-10 | General-ledger **build vs integrate**                                              | M      | blocked (owner, Q20) |
| ADR-11 | Tenant vs campus/arm boundary                                                      | S      | blocked (owner, Q6)  |
| ADR-12 | OneRoster / LTI / Ed-Fi adoption scope                                             | S      | ready                |

## Phase 1 — shared foundations (every later module reuses these)

| ID  | Title                                                                                                             | #           | Effort | Deps       | Owner | Status           |
| --- | ----------------------------------------------------------------------------------------------------------------- | ----------- | ------ | ---------- | ----- | ---------------- |
| F1  | `Person`/identity/profile/membership separation + relationship history                                            | —           | XL     | ADR-01     | —     | blocked (ADR-01) |
| F2  | Shared **import & migration** platform (ImportJob/mapping/validate/commit/reconcile)                              | #26,#113    | XL     | F3, ADR-09 | —     | blocked          |
| F3  | Durable **job queue + transactional outbox + idempotency**                                                        | —           | L      | —          | —     | ready            |
| F4  | **Document/attachment** service (scan/classify/retain/signed URLs)                                                | #28,#110    | L      | F3         | —     | blocked (F3)     |
| F5  | **Communication delivery** abstraction + `DeliveryAttempt` ledger (DND/cost/failure) + preferences + `SecureLink` | #97,#98,#99 | L      | F3, ADR-07 | —     | blocked          |
| F6  | **Academic-profile + policy-version** framework (effective-dated)                                                 | —           | L      | ADR-03     | —     | blocked (ADR-03) |
| F7  | Governed **search + saved-views + URL-state directory** pattern                                                   | #105,#27    | M      | —          | —     | ready            |
| F8  | Shared Aurora patterns: **Directory / Workbench / Lifecycle / Policy / Approval** in `packages/ui`                | —           | M      | —          | —     | ready            |
| F9  | Data-**export/retention/privacy** primitives (`DataExportJob`, retention)                                         | #104        | M      | F3, F4     | —     | blocked          |

**Phase 1 exit gate:** two unrelated domains use import + documents + jobs + delivery without custom copies; retry never duplicates a financial/result/message command; tenant + campus isolation tests pass; permissions enforced through one policy path.

## Workbench 1 — Shared foundations + People (first feature slice)

| ID    | Title                                                                                                           | #      | Effort | Deps       | Owner | Status  |
| ----- | --------------------------------------------------------------------------------------------------------------- | ------ | ------ | ---------- | ----- | ------- |
| WB1-1 | Unified **People directory** (Student/Guardian/Staff/User/Prospect views)                                       | #4     | L      | F1, F7, F8 | —     | backlog |
| WB1-2 | First-class **staff employment/profile** (retire payroll-as-directory)                                          | #5     | L      | F1         | —     | backlog |
| WB1-3 | **Invitations + activation/suspension + password reset** (secure; no generated-password)                        | #1,#13 | M      | F1, F5     | —     | backlog |
| WB1-4 | **Guardianship** authority/priority/consent extension                                                           | #29    | M      | F1         | —     | backlog |
| WB1-5 | **Role editor** + `resource.action.context` matrix + permission search + presets + **effective-access preview** | #7,#8  | L      | F1, ADR-01 | —     | backlog |
| WB1-6 | **Scope + expiry + temporary cover** + maker-checker/step-up for high-risk access changes                       | #8,#9  | L      | WB1-5      | —     | backlog |

**Workbench-1 acceptance:** a staff member who is also a guardian uses **one** identity with two profiles; a bursar posts payments for Campus A but can't export Campus B debtors; a substitute gets 5-day class access that auto-expires; an admin can explain effective access (inheritance/override/scope/expiry). _(from [06 §Acceptance](../plan/06-roadmap-and-discussion-guide.md#acceptance-scenarios-that-matter))_

## Later workbenches (outlined in [`BACKLOG.md`](BACKLOG.md); detailed just-in-time)

| ID      | Workbench                                                                           | Phase | Blocked on           |
| ------- | ----------------------------------------------------------------------------------- | ----- | -------------------- |
| WB2-\*  | Academic structure + student lifecycle                                              | 2B    | F1, F6, ADR-02/03    |
| WB3-\*  | Admissions                                                                          | 2C    | F1, F4, F5, WB1      |
| WB4-\*  | Results parity (ResultCycle)                                                        | 2D    | F6, ADR-04           |
| WB5-\*  | Family Account + Finance                                                            | 2E    | ADR-05, F2           |
| WB6-\*  | Engagement + operational reporting                                                  | 2F    | F5, F9               |
| WB7-\*  | Migration cockpit                                                                   | 2G    | F2, F4, ADR-09       |
| WB8-\*  | Daily-work superiority (teacher today, class workspace)                             | 3     | WB1–4                |
| WB9-\*  | Operational depth + ecosystem (library/transport/health/HR/inventory/OneRoster/LTI) | 4     | F-platforms          |
| WB10-\* | Responsible intelligence + scale                                                    | 5     | data provenance done |

---

## Change log (board edits — newest first)

- `2026-07-31` — **ADR batch 3 drafted — ALL 12 ADRs now drafted.** ADR-05 (finance subledger), ADR-12 (interop) as full ADRs; ADR-10 (GL build-vs-integrate) + ADR-11 (tenant/campus) as **owner decision-briefs**. Next: review→accept (`P0-3`); owner sign-off outstanding on ADR-03/04/05/10/11. _(claude)_
- `2026-07-31` — **ADR batch 2 drafted** (ADR-02 class/offering, ADR-03 curriculum, ADR-04 result publication, ADR-09 migration) — `Proposed`. **9 of 12 ADRs now drafted**; only ADR-05 (finance), ADR-10 (GL build-vs-integrate, owner), ADR-11 (tenant/campus, owner), ADR-12 (interop) remain. _(claude)_
- `2026-07-31` — **ADR batch 1 drafted** (ADR-01 person, ADR-06 job/outbox, ADR-07 delivery, ADR-08 document/signature) — `Proposed`, awaiting review/acceptance. Accepting them flips `F1`, `F4`, `F5` (and their dependents) `blocked → ready`. _(claude)_
- `2026-07-31` — Board created from parity matrix + roadmap. All near-term items seeded; Phase-0 ADRs opened; owner-gated items marked blocked. _(claude)_
