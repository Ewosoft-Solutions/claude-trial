# Phase 1 — shared foundations

**Goal:** build the platforms every later module reuses, so we never rebuild import/documents/jobs/delivery/search per domain. Items `F1..F9` on the [board](TASK-BOARD.md). **Start now:** `F3`, `F7`, `F8` (no ADR dep). The rest unblock as their ADR lands.

**Exit gate:** two unrelated domains use import + documents + jobs + delivery **without custom copies**; retry never duplicates a financial/result/message command; tenant + campus isolation tests pass; permissions run through one policy path.

Each item below is a starter spec — expand into a [`work-item.md`](templates/work-item.md) card on claim.

---

## F3 · Durable job queue + transactional outbox + idempotency — `L`, ready

**Job:** long/critical work (imports, report batches, SMS/email, publication, reconciliation) runs reliably, exactly once, observably. Replaces today's process-local queue.
**Domain:** `Job`(type, tenantId, actor, idempotencyKey, status, progress, rowCounts, resultArtifactId, error), `OutboxEvent`(aggregate, type, payload, publishedAt). Command pattern: mutate + write audit + write outbox **in one tx**; workers consume idempotently.
**Permissions/scope:** jobs carry tenant context; workers set it explicitly (never bypass RLS).
**Acceptance:** enqueue a job, kill the worker mid-run, restart → it completes once (no dup side effect); a retried command with the same idempotency key is a no-op.
**Validation:** unit tests for idempotency + retry; `check:privileged-db` green (workers use runtime client + set tenant context).

## F7 · Governed search + saved-views + URL-state directory pattern — `M`, ready

**Job:** one reusable "directory" surface (server-side page/filter/sort, saved views, URL-persisted state, privacy-aware columns, bulk-action bar) that every entity list uses — kills the legacy system's 3-search-pages pattern (#27) and extends our `search.controller` (#105).
**UI (Aurora):** `custom/tables` DataTable + `StatusBadge` + `Meter` + masked-contact preset + `custom/states` empties; a `useDirectoryState` hook for URL sync.
**Scope:** search projections are tenant + permission filtered; **never index health/safeguarding narrative.**
**Acceptance:** the Students list uses it with a saved view + shareable URL + a bulk action; a user without `students.view.personal_info` sees masked contact.
**Validation:** vitest on the hook + projection filter; a11y check (keyboard + non-colour status).

## F8 · Shared Aurora workspace patterns — `M`, ready

**Job:** codify the five reusable shells in `packages/ui` so every workbench looks like one product: **Directory · Workbench (context-bar + tabs) · Lifecycle (status views) · Policy (versioned config with clone/compare/activate) · Approval (maker-checker surface)**. From [design bridge 08](../plan/08-design-system-bridge.md).
**Acceptance:** two different workspaces (People + a stub) render from the same shells with only content differences; all pass light/dark/classic-dark parity + WCAG focus/contrast.
**Validation:** vitest component tests; visual check in dev (:3001) across the 3 themes.

## F1 · Person / identity / profile / membership separation — `XL`, blocked ADR-01

**Job:** one human = one `Person`, with linked auth identity, tenant membership(s), and dated domain profiles (student/staff/guardian) — so a staff-who-is-also-a-guardian is one identity, and dedup is tractable.
**Domain (delta on our 58 models):** add `Person`, `ContactPoint`(+verification), `Address`; relate existing `User`/`UserTenant`/`Student`/`StudentGuardian` to `Person`; add `RelationshipHistory`. Migrate `Student.personalInfo` JSONB → typed searchable columns for governed attributes.
**Migration:** back-fill `Person` from existing users/students/guardians with a stable source key (feeds F2/WB7).
**Acceptance:** create a person, attach a staff **and** guardian profile, resolve a duplicate → history preserved.
**Validation:** tenant-isolation + RLS tests on new tables; `db:rls:check` green; `db:verify`.

## F2 · Shared import & migration platform — `XL`, blocked F3+ADR-09

**Job:** all bulk import (students, staff, opening debt #91, photos #28, grades) reuses one pipeline: _upload → identify source/version → map → validate → resolve exceptions → dry-run → approve → commit idempotently → reconcile → sign off_.
**Domain:** `ImportDefinition, ImportJob, SourceFile, ColumnMapping, TransformRule, ImportRow, ValidationIssue, DuplicateCandidate, ImportCommit, ReconciliationRule/Result` (runs on F3 jobs).
**Rules:** virus scan + checksum + **stable external IDs**; row-level error download; no partial silent commit; maker-checker for financial/grade/history imports; totals reconciliation; rollback.
**Acceptance:** import a CSV with invalid rows + unknown students → valid rows are **not** silently committed around the bad ones; a re-run with the same source IDs is idempotent; totals reconcile.

## F4 · Document/attachment service — `L`, blocked F3

**Job:** logical document record vs stored versions; encrypted storage; checksum/MIME/scan; thumbnail; type + visibility policy; retention + legal hold; **signed short-lived downloads**; consent/provenance; **authorized signature/seal use** (kills the 104 raw signature images #110).
**Domain:** `Document, DocumentVersion, DocumentType, SigningAuthority, SignatureUse`.
**Acceptance:** upload a doc → signed expiring URL works, an unauthorized role can't fetch it; a signature is usable on an artifact only via an authorized `SignatureUse`.

## F5 · Communication delivery abstraction + attempt ledger — `L`, blocked F3+ADR-07

**Job:** one delivery layer behind all channels with a **`DeliveryAttempt`** per send carrying provider, message-id, status, **failure classification, cost/units, DND flag** (#97,#98), + `SecureLink` (expiring, access-controlled) replacing public result URLs (#99), + contact preferences/consent.
**Domain:** `MessageTemplate/Version, Campaign, DeliveryAttempt, ProviderEvent, SecureLink, ContactPreference` (sends run on F3 jobs).
**Acceptance:** a send records cost + DND classification; a provider timeout retried via idempotency key does **not** double-send a confirmed delivery; a result `SecureLink` expires + denies an unauthorized fetch.

## F6 · Academic-profile + policy-version framework — `L`, blocked ADR-03

**Job:** effective-dated policy bundles (calendar, curriculum, assessment, grade, publication, attendance, fee) that every decision/result references by version — the change that makes historical report cards reproducible.
**Domain:** `AcademicProfileVersion` + versioned policy records; `PolicyActivation`(effective dates).
**Acceptance:** two cohorts at one campus run different curriculum/grade versions simultaneously; activating a new version does **not** rewrite a prior published result.

## F9 · Data export/retention/privacy primitives — `M`, blocked F3+F4

**Job:** governed `DataExportJob`(requester, scope, approval, expiry, download audit) + retention/disposition + the NDPA record types (`ConsentOrAuthorization, DisclosureLog, RetentionPolicyVersion`) — real Excel/CSV export (fixes our stubbed reporting #104) via F3 jobs.
**Acceptance:** an approved export produces a signed expiring artifact with an audited download; retention disposition runs as a job; a data-subject access request assembles a package.

---

### Notes

- Build order within Phase 1: **F3 → (F7, F8 in parallel) → F4/F5 → F1 → F2/F6/F9.**
- Every new table: non-null `tenant_id`, RLS policy in the migration (with `set_config` in a DO block for any RLS row writes), `db:rls:check` green **before** the item is `done`.
