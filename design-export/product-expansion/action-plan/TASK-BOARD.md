# TASK BOARD — the legacy system parity

**The coordination point.** Claim a `ready` item (deps `done`) by setting Owner + Status → `claimed` in a `board: claim <ID>` commit _before_ coding. Mechanics: [`WORKFLOW.md`](WORKFLOW.md). Contract/DoD: [`/AGENTS.md`](../../../AGENTS.md). `#N` = row in [parity matrix 07](../plan/07-capability-parity-matrix.md).

**Status:** `backlog` · `ready` · `claimed` · `in-progress` · `in-review` · `done` · `blocked`
**Effort:** `S` · `M` · `L` · `XL`

## ▶ Ready to claim right now

**Foundations ready to build:** `F1` (Person) · `F2` (import) · `F4` (documents) · `F5` (delivery) · `F7` (search) · `F8` (Aurora patterns). _(`F3` jobs/outbox **done** — unblocks F2/F4/F5.)_
_(`P0-1` **decided** + **build-first** — see [`release-1-promise.md`](release-1-promise.md); `P0-2` resequenced to onboarding. `P0-3`: **7/12 ADRs accepted** (01/02/06/07/08/09/12) → `F1` unblocked; **5 owner-gated** — ADR-03 (Q11), ADR-04 (Q13–16), ADR-05 (Q20–23), ADR-10 (Q20), ADR-11 (Q6), so their dependents (F6, WB2/4/5, multi-campus) stay blocked until the owner signs.)_

---

## Hygiene (do early — unblocks trust & the states everything reuses)

| ID  | Title                                                                                                                                                  | #    | Effort | Deps | Owner | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------ | ---- | ----- | ------ |
| H1  | Reconcile status-doc drift: permission counts (274/297/**305**) + fix stale "mock data" line in `AI_CONTEXT.md` + `CURRENT_PHASE.md`                   | —    | S      | —    | codex | done   |
| H2  | Permission-denied + empty/error/loading/offline states in `packages/ui` `custom/states`; wire `unauthorized` route (replaces the legacy system "OOPS") | #115 | M      | —    | codex | done   |
| H3  | Remove commercial/"Pay Now"-style nags from workspace surfaces; keep billing in account settings                                                       | #116 | S      | —    | codex | done   |

## Phase 0 — scope-lock + ADRs (decisions before code; no feature code)

| ID   | Title                                                                                                                                                         | Effort | Deps | Owner  | Status                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---- | ------ | --------------------------------------------------- |
| P0-1 | Confirm Release-1 school profile + contractual "retire the legacy system" definition ([`release-1-promise.md`](release-1-promise.md))                         | S      | —    | owner  | done                                                |
| P0-2 | Design-partner validation + per-school redacted exports — **resequenced to onboarding** (reconcile that school before its live cutover); not a pre-build gate | M      | —    | owner  | backlog                                             |
| P0-3 | Draft + accept the 12 ADRs (below)                                                                                                                            | L      | —    | claude | in-progress · 7/12 accepted (owner: 03/04/05/10/11) |
| P0-4 | Stand up parity/migration/acceptance scorecards (from [06 §5](../plan/06-roadmap-and-discussion-guide.md))                                                    | S      | —    | —      | ready                                               |

### ADRs (see [`adr/README.md`](adr/README.md); draft now, some need P0-1 owner sign-off)

| ID     | Decision                                                                           | Effort | Status                  |
| ------ | ---------------------------------------------------------------------------------- | ------ | ----------------------- |
| ADR-01 | Person / auth-identity / profile / tenant-membership separation                    | M      | **accepted**            |
| ADR-02 | Class / section / offering / course-registration model (don't parse "SS1 SCIENCE") | M      | **accepted**            |
| ADR-03 | Curriculum version + tenant overlay + cohort adoption                              | M      | blocked (owner, Q11)    |
| ADR-04 | Result publication snapshot + amendment (immutability)                             | M      | blocked (owner, Q13–16) |
| ADR-05 | Finance ledger + family credit/wallet + allocation semantics                       | M      | blocked (owner, Q20–23) |
| ADR-06 | Durable job/outbox infrastructure                                                  | M      | **accepted**            |
| ADR-07 | Communication delivery-provider abstraction (DND/cost/consent)                     | S      | **accepted**            |
| ADR-08 | Document/signature asset security (SigningAuthority)                               | S      | **accepted**            |
| ADR-09 | Migration source-ID + reconciliation contract                                      | M      | **accepted**            |
| ADR-10 | General-ledger **build vs integrate**                                              | M      | blocked (owner, Q20)    |
| ADR-11 | Tenant vs campus/arm boundary                                                      | S      | blocked (owner, Q6)     |
| ADR-12 | OneRoster / LTI / Ed-Fi adoption scope                                             | S      | **accepted**            |

## Phase 1 — shared foundations (every later module reuses these)

| ID  | Title                                                                                                             | #           | Effort | Deps       | Owner  | Status           |
| --- | ----------------------------------------------------------------------------------------------------------------- | ----------- | ------ | ---------- | ------ | ---------------- |
| F1  | `Person`/identity/profile/membership separation + relationship history                                            | —           | XL     | ADR-01     | claude | claimed          |
| F2  | Shared **import & migration** platform (ImportJob/mapping/validate/commit/reconcile)                              | #26,#113    | XL     | F3, ADR-09 | claude | claimed          |
| F3  | Durable **job queue + transactional outbox + idempotency**                                                        | —           | L      | —          | claude | done             |
| F4  | **Document/attachment** service (scan/classify/retain/signed URLs)                                                | #28,#110    | L      | F3         | claude | claimed          |
| F5  | **Communication delivery** abstraction + `DeliveryAttempt` ledger (DND/cost/failure) + preferences + `SecureLink` | #97,#98,#99 | L      | F3, ADR-07 | —      | ready            |
| F6  | **Academic-profile + policy-version** framework (effective-dated)                                                 | —           | L      | ADR-03     | —      | blocked (ADR-03) |
| F7  | Governed **search + saved-views + URL-state directory** pattern                                                   | #105,#27    | M      | —          | —      | ready            |
| F8  | Shared Aurora patterns: **Directory / Workbench / Lifecycle / Policy / Approval** in `packages/ui`                | —           | M      | —          | —      | ready            |
| F9  | Data-**export/retention/privacy** primitives (`DataExportJob`, retention)                                         | #104        | M      | F3, F4     | —      | blocked          |

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

- `2026-08-01` — **F4 + F1 + F2 claimed (claude).** Building Phase-1 foundations F4 (document/attachment service, ADR-08), F1 (Person/identity/profile/membership, ADR-01), and F2 (import & migration platform, ADR-09) to DoD on a single branch `feat/phase1-foundations-f1-f2-f4`. Build order F4 → F1 → F2 (F2 reuses Person + Document). Owner steers: foundation-to-DoD (models + RLS migration + server-side services/enforcement + tests + minimal REST; workbench UI deferred to WB items), full F2 entity set. _(claude)_
- `2026-08-01` — **F3 done → F2/F4/F5 unblocked.** Durable job queue + transactional outbox + idempotency shipped (ADR-06): new `jobs` schema (`jobs.jobs`, `jobs.outbox_events`) with RLS + `app_runtime` grants + `db:rls:check` coverage; `JobService.enqueue` (atomic-with-domain, idempotent via ON CONFLICT), `OutboxService.emit`, and a `JobWorker` that claims under the audited `app.is_platform` scope and runs handlers under per-job tenant scope with handler+completion in one tx (exactly-once), retry/backoff→`dead`, stale-lock reclaim. Coexists with the legacy in-memory `QueueService`. e2e 7/7 (idempotency, exactly-once, retry→dead, tx-atomic, RLS isolation); check:privileged-db + db:rls:check + ci:quick green. _(claude)_
- `2026-08-01` — **P0-3: 7 non-owner ADRs accepted → `F1` unblocked.** Reviewed + accepted ADR-01/02/06/07/08/09/12 (`Accepted — 2026-08-01`). Flips **F1 (Person) → ready** and confirms the design for the already-ready `F3`/`F7`/`F8`; F2/F5 now blocked only on F3. Reconciled a doc drift: **ADR-04 is owner-gated** (Q13–16 result-publication policy — the index had mislabelled it "no"), so the batch is **7/12**; **5 stay owner-gated** — ADR-03 (Q11), ADR-04 (Q13–16), ADR-05 (Q20–23), ADR-10 (Q20), ADR-11 (Q6) — keeping F6 + WB2/4/5 blocked. Phase-1 foundations `F1`/`F3`/`F7`/`F8` are now buildable. _(claude)_
- `2026-08-01` — **Build-first sequencing (owner).** Legacy-system screenshots are our sample of what schools use → we build from those learnings + seed data to a fully-functional demo, sell on it, then tweak per school. **P0-2 resequenced** from a pre-build gate to **onboarding** (per-school redacted exports reconcile that school before its live cutover — the Q3 rule, applied per-school at go-live). Phase-0 exit gate + [`release-1-promise.md`](release-1-promise.md) (new _Sequencing_ section) updated. Build path is unblocked; nothing waits on partner recruitment. _(claude)_
- `2026-07-31` — **P0-1 decided → done.** Owner approved the recommended defaults for decision Q1–Q3: **NG K-12** is the first full profile (tertiary/TVET/international = separate scope); "retire the legacy system" = **capability parity on the critical jobs a partner actually uses**, published as a supported/excluded matrix, not menu parity; **operational evidence + reconciliation outrank screenshots** for high-consequence behaviour. Deliverable: [`release-1-promise.md`](release-1-promise.md). Unblocks profile-specific scope in every workbench + P0-2's export requirement. **Still open:** ADR-10 (Q19–20) + ADR-11 (Q6) remain owner-gated; the definitive per-partner matrix awaits **P0-2**. _(claude)_
- `2026-07-31` — **H3 approved → done.** Audited authenticated workspaces: no commercial subscription nag ships today. Added a regression guard that rejects subscription/trial/upgrade/renewal/premium nags and the legacy expiry-linked “Pay Now” signature while preserving school-fee and finance actions. PR [#36](https://github.com/Ewosoft-Solutions/claude-trial/pull/36). _(codex)_
- `2026-07-31` — **H2 implemented; draft PR #35 open.** Added explicit Aurora permission-denied and full-surface offline presets, state-system tests, design-system examples, and shared-state wiring for `/unauthorized`. Awaiting review/merge. _(codex)_
- `2026-07-31` — **H1 implemented; draft PR #34 open.** Current status docs now reflect the wired web/API system and active product-expansion initiative; operational permission references and verification use the enforced 305-permission catalog (9 persisted categories, 28 seed groups). Root validation aliases were restored. Awaiting review/merge. _(codex)_
- `2026-07-31` — **ADR batch 3 drafted — ALL 12 ADRs now drafted.** ADR-05 (finance subledger), ADR-12 (interop) as full ADRs; ADR-10 (GL build-vs-integrate) + ADR-11 (tenant/campus) as **owner decision-briefs**. Next: review→accept (`P0-3`); owner sign-off outstanding on ADR-03/04/05/10/11. _(claude)_
- `2026-07-31` — **ADR batch 2 drafted** (ADR-02 class/offering, ADR-03 curriculum, ADR-04 result publication, ADR-09 migration) — `Proposed`. **9 of 12 ADRs now drafted**; only ADR-05 (finance), ADR-10 (GL build-vs-integrate, owner), ADR-11 (tenant/campus, owner), ADR-12 (interop) remain. _(claude)_
- `2026-07-31` — **ADR batch 1 drafted** (ADR-01 person, ADR-06 job/outbox, ADR-07 delivery, ADR-08 document/signature) — `Proposed`, awaiting review/acceptance. Accepting them flips `F1`, `F4`, `F5` (and their dependents) `blocked → ready`. _(claude)_
- `2026-07-31` — Board created from parity matrix + roadmap. All near-term items seeded; Phase-0 ADRs opened; owner-gated items marked blocked. _(claude)_
