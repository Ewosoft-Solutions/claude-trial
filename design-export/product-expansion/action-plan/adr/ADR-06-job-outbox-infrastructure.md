# ADR-06 — Durable job queue + transactional outbox

- **Status:** Proposed — 2026-07-31
- **Deciders:** engineering. **Owner sign-off:** not required.
- **Unblocks:** F2 (import platform), F4 (documents), F5 (delivery), F9 (export); and every later batch job (result publication, payroll runs, reconciliation, analytics refresh).

## Context

Several parity-critical operations are long-running and/or must happen **exactly once**: bulk imports (students, opening debt C091, photos C039), batch report generation ("batch of 20", C052), SMS/email delivery (19,539-message history, C107), result publication, and reconciliation. Today the repo's background work is **process-local** (`AI_HANDOFF.md` records the queue is in-process; auth MFA still has provider TODOs). Process-local work has three failure modes we cannot ship to schools:

- **Lost work** — a dyno/process restart (routine on Render) drops in-flight jobs.
- **Duplicated side effects** — a naive retry re-sends a payment receipt, re-publishes a result, or double-charges SMS units.
- **No observability** — an operator can't see why a batch failed; "support can diagnose failed jobs without DB access" is an explicit Phase-2 exit gate ([06](../../plan/06-roadmap-and-discussion-guide.md)).

The **transactional outbox** pattern is the standard fix for the "mutate the DB _and_ trigger a side effect, atomically" problem: the side-effect intent is written **in the same transaction** as the domain change, then a worker delivers it idempotently.

**What breaks if we guess wrong:** every platform above (import/documents/delivery/export) and every batch feature inherits the reliability of this choice. Getting it wrong means per-domain retry hacks and duplicated money/result/message effects — exactly the class of bug the platform-scope work already had to fix once (self-approval / unaudited reads).

## Options

1. **Postgres-backed `Job` + `OutboxEvent`, polled by in-app workers (recommended).** No new infrastructure; the outbox row and the domain write share one Prisma transaction, so atomicity is free; works within the existing Render/Postgres topology and RLS model. Trade-off: polling latency (seconds) and DB load — acceptable for school workloads (imports/reports/messages, not high-frequency events).
2. **External queue (BullMQ/Redis or SQS).** Better throughput/scheduling. Trade-off: adds a Redis/broker dependency to provision, secure, and pay for; **still needs an outbox** for atomicity (you can't enqueue-and-commit atomically across two systems), so it's strictly more moving parts for our current scale.
3. **Keep process-local.** Rejected — the three failure modes above are disqualifying for financial/result/message work.

## Decision

Adopt **Option 1**: a **Postgres-backed durable job system with a transactional outbox**.

- `Job` — `id, tenantId, type, actorId, idempotencyKey (unique), status (queued|running|succeeded|failed|dead), attempts, progress, rowCounts, resultArtifactId?, error?, scheduledAt, timestamps`.
- `OutboxEvent` — `id, tenantId, aggregate, aggregateId, type, payload(jsonb), createdAt, publishedAt?`.
- **Command pattern:** a domain command mutates the aggregate, writes an `AuditLog` row, and writes the `OutboxEvent`/enqueues the `Job` — **all in one Prisma transaction** — then commits. A worker loop consumes queued jobs / unpublished outbox rows and performs the side effect **idempotently** (keyed by `idempotencyKey`), with retry + backoff and a `dead` terminal state.
- **Tenant safety:** jobs carry `tenantId`; the worker **sets tenant context explicitly** before touching tenant data (it does **not** use the privileged client to bypass RLS — `check:privileged-db` stays green).
- Reassess Option 2 only when a measured throughput ceiling is hit.

## Consequences

- **Enables** F2/F4/F5/F9 and all batch features to share one reliable substrate; unblocks the "retry doesn't duplicate a financial/result/message command" Phase-1 exit gate.
- **Constrains** side-effect latency to poll interval (fine for our jobs); adds two tables + a worker bootstrap.
- **Migration impact:** additive tables (hand-written SQL + `db:generate` + `db:rls:check`); no change to existing rows.
- **Idempotency keys become a cross-cutting convention** — every externally-visible command (payment, publication, send) must supply one.

## Validation

- Unit: enqueue → kill worker mid-run → restart → job completes **once**, no duplicate side effect.
- Unit: a command retried with the same `idempotencyKey` is a no-op.
- Integration: outbox row + domain row commit/rollback **together** (no orphan events).
- Gate: `check:privileged-db` green (workers use the runtime client + set tenant context); `db:rls:check` green for the new tables.
