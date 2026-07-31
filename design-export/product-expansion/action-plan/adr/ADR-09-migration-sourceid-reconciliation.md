# ADR-09 — Migration source-ID + reconciliation contract

- **Status:** Accepted — 2026-08-01 _(the source-ID + reconciliation contract; history scope/tolerances Q29–32 confirmed per-school at onboarding)_
- **Deciders:** engineering + product. **Owner sign-off:** how much history moves + reconciliation tolerances + retention window ([Q29–32](../../plan/06-roadmap-and-discussion-guide.md#h--migration--launch)).
- **Unblocks:** F2 (import platform), WB7 (migration cockpit); underwrites every "replacement-ready" claim.

## Context

A parity is judged on whether **history survives**: brought-forward debt to 2021/22 (C091), 776 missing photos + scanned docs (C039), 19,539 SMS / 589 result emails (C104/C107), historical wallet/fee/result data, and dirty subject/grade catalogs (C080/C114). Our current state: **no migration domain**. The roadmap makes migration + reconciliation **P0** and a non-negotiable release principle ("no migration wave accepted by screenshots; totals + sampled records reconcile", [06](../../plan/06-roadmap-and-discussion-guide.md)).

Two hard requirements fall out: **re-runnability** (discovery → trial → pilot → delta → cutover means the _same_ records import repeatedly) and **proof** (counts alone can't validate money or results).

**What breaks if we guess wrong:** without stable source IDs, a delta/cutover import **duplicates** records; without reconciliation gates, "it looks migrated" is the whole assurance — and a fee/result discrepancy surfaces after go-live, when trust is highest-stakes.

## Options

1. **Immutable source-ID on every migrated aggregate + a reconciliation contract, on the shared import platform F2 (recommended).** Idempotent re-runs + provable cutover. Trade-off: discipline (every importer carries source refs + reconciliation rules).
2. **One-time scripted import, no source IDs.** Rejected — can't delta/re-run, can't reconcile, can't roll back cleanly.
3. **Trust-by-screenshot / manual sign-off only.** Rejected — explicitly a non-negotiable "no".

## Decision

Adopt **Option 1**:

- **Stable source reference on every migrated aggregate:** `sourceSystem` + `sourceId` (a `SourceRef` on the row or a side table), unique per tenant. **Import commit is idempotent** keyed by `(sourceSystem, sourceId)` — a re-run **upserts**, never duplicates. These IDs also drive **dedup/merge** (ADR-01 Persons) and delta loads.
- **Reconciliation gates** (signed reports per wave), at minimum: student/staff/guardian counts by campus/status/class; enrollment by year/term/offering; **result counts + aggregate score checks** by cycle/subject/class; attendance totals; **invoice gross / discounts / payments / outstanding / unapplied credit**; receipt-number uniqueness + totals; wallet opening/closing; **attachment count + checksum** (ADR-08); user/role assignment review; **sampled artifact comparison** (a migrated report card vs the legacy system original).
- **Tolerances:** **exact control totals for money**; deterministic aggregates + record samples for results; **named school sign-off** per wave.
- **Exception queues** for invalid/unmatched rows — **valid rows are never silently committed around bad ones** (fixes the class of import bug).
- **Clean on the way in:** subject de-dup via ADR-03 aliases; corrupted grades normalized via ADR-04 versioned scales.
- **Cutover:** dry-run → pilot → **delta rehearsal (same source IDs)** → freeze/parallel → final delta → reconcile → go/no-go; **rollback** is a planned controlled path, never an improvised reverse import. A **read-only legacy archive** is retained for a contractual window with a closure certificate.
- Runs on **ADR-06 jobs** via the **F2** import platform.

## Consequences

- **Enables** repeatable delta loads, provable cutover, rollback, and audit — the evidence behind "replacement-ready" (Phase-2 exit gate).
- **Constrains:** every importer must carry source refs + reconciliation rules; adds a `SourceRef` dimension across migrated domains.
- **Migration impact:** this _is_ the migration contract; additive `SourceRef`/reconciliation tables; RLS.
- Depends on **ADR-06** (jobs), **F2** (import platform), **ADR-01** (dedup keys), **ADR-08** (attachment checksums); owner sets history scope + tolerances (Q29–31).

## Validation

- Re-run an import with the same source IDs → **idempotent** (no duplicates); a delta load adds only changed records.
- An import with invalid rows + unknown students → valid rows are **not** committed around the bad ones; exceptions queue.
- Money reconciles to an **exact** control total; a result wave reconciles by deterministic aggregate + sampled artifact.
- A dedup **merge** preserves evidence; an attachment **checksum mismatch** is flagged, not trusted.
