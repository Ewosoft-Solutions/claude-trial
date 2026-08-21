# Self-approval audit — no one approves their own request

**Ground rule.** An approval request must never be approvable by the person who
raised it. The request itself may stay visible to the requester — seeing the
state of your own request is the point — but the **approve / reject actions are
gated on both the API and the UI**, and only appear for someone eligible to
decide. An approval a requester can grant themselves is not an approval.

This holds for every kind of request: security, permissions, finance, academic
records, bulk data, platform. "I hold the permission" is not eligibility; the
permission says _what_ you may decide, separation of duties says _whose_.

---

## How it is enforced where it works

`MakerCheckerService` (`apps/api/src/auth/services/maker-checker.service.ts`) is
the shared implementation. `approveRequest` refuses when the approver is the
requester — `You cannot approve your own request` — and also enforces a checker
clearance floor. Domains that raise a request through `createApprovalRequest`
and settle it through `approveRequest` / `rejectRequest` inherit both.

Rejecting your own request is deliberately allowed: that is a withdrawal, not a
self-grant.

## Status

| #   | Flow                                    | Endpoint                                                | API guard         | UI gate   | Status     |
| --- | --------------------------------------- | ------------------------------------------------------- | ----------------- | --------- | ---------- |
| 1   | Platform tenant approvals               | `POST /tenants/approvals/:requestId/approve\|reject`    | maker-checker     | **gated** | **Fixed**  |
| 2   | Access grants (permissions)             | `POST /access/grants/:requestId/approve\|reject`        | maker-checker     | **gated** | **Fixed**  |
| 3   | Finance adjustments (discounts/waivers) | `POST /finance/adjustments/:id/approve\|reject`         | maker-checker     | **gated** | **Fixed**  |
| 4   | Promotion runs                          | `POST /promotion/runs/:id/approve`                      | maker-checker     | **gated** | **Fixed**  |
| 5   | Result publication                      | `POST /results/cycles/:id/approve-publish`              | maker-checker     | **gated** | **Fixed**  |
| 6   | Result amendments                       | `POST /results/amendments/:amendmentId/approve`         | maker-checker     | **gated** | **Fixed**  |
| 7   | AI settings change requests             | `POST /ai/settings/change-requests/:id/approve\|reject` | maker-checker     | **gated** | **Fixed**  |
| 8   | **Lesson review**                       | `POST /learning/lessons/:id/approve\|reject`            | **guarded**       | **gated** | **Fixed**  |
| 9   | **Material review**                     | `POST /learning/materials/:id/approve\|reject`          | **guarded**       | **gated** | **Fixed**  |
| 10  | **Curriculum overlay**                  | `POST /curriculum/overlays/:id/approve`                 | **guarded**       | n/a       | **Fixed**  |
| 11  | **Bulk import approval**                | `POST /imports/jobs/:id/approve`                        | **guarded**       | n/a       | **Fixed**  |
| 12  | Admissions decision                     | `POST /admissions/applications/:id/reject`              | n/a               | n/a       | **Review** |
| 13  | Step-up policy change requests          | `PATCH /platform/security/step-up-change-requests/:id`  | requester refused | **gated** | **Fixed**  |

---

## Correction — the UI column was never assessed for rows 1–7

The first pass marked the seven maker-checker flows **OK** on the strength of
the API alone and left their UI column as `—`, meaning _unassessed_. That was
then read as _safe_, and the UI work was scoped to only the four API gaps.

It is not safe. Those screens offer Approve/Reject to the requester and rely on
the API to refuse — the exact "walk the user into a 403" behaviour the ground
rule exists to prevent. Two examples found by inspection:

- Invoice detail gates the adjustment buttons on `canManage && status ===
'pending'` — nothing about who raised it.
- Promotion derives `canApprove` from
  `permissions.includes('academics.promotion.approve')` — a permission, not
  separation of duties. Holding the permission is what lets you decide; it is
  not what makes you eligible to decide _this_ one.

The rule is both-sides: **the API refuses, and the UI does not offer.** A row is
only OK when both are true.

### Two things the sweep itself corrected

- **Row 2 was never broken.** `access-scope-panel` already passes
  `isSelfRequest={req.makerId === currentUserId}`. Marking it a gap was an error
  in the first pass, not a defect in the code.
- **Row 13 was missing entirely.** Step-up policy change requests are an
  approval flow the endpoint sweep did not catch, because the decision route is
  a `PATCH` on the request rather than an `/approve` path. Its API was already
  correct — "the requester cannot review their own policy proposal" — but its
  console offered the buttons.

### The recipe, as applied

Every row now follows the same three steps:

1. **The read tells the client.** Add an `isOwnRequest` boolean, computed on the
   server from `requestedBy` (or the flow's equivalent) against the viewer's
   user id. Send a boolean, never the requester's id: the browser has no
   reliable identity of its own, and eligibility is a rule the server owns.
2. **The UI stops offering.** Replace the Approve control with a short line
   saying why, and label what remains **Cancel request** rather than Reject —
   the requester is withdrawing, not refusing. `ApprovalPanel` already models
   this via `isSelfRequest`; consumers simply were not passing it.
3. **A spec pins it**, including that a null requester reads as _not_ own work,
   so pre-existing rows do not become unapprovable. Every read that carries the
   flag now has one, and they bite: stubbing the flag to a constant fails them.

The UI says this by WITHHOLDING the action, not by explaining itself. An
absent Approve beside a Cancel is the message; a line of prose on every pending
row is clutter, and it repeats on each surface.

Note that `canApprove` in the promotion and results workbenches means "holds the
approve permission" and must NOT be overloaded to mean this — holding the
permission is what lets you decide, not what makes you eligible to decide _this_
one. They need a second, per-row flag.

## What has been fixed

**Server-side guards are in** for rows 8–11. Each refuses the requester at the
service boundary, each has a spec, and the import guard was mutation-tested —
removing it fails exactly the two tests that assert it, so the coverage is not
vacuous.

Rejecting your own work is still allowed throughout: that is a withdrawal, the
same line `MakerCheckerService` draws.

| Flow               | Guard                                                          | Identity compared             |
| ------------------ | -------------------------------------------------------------- | ----------------------------- |
| Lesson review      | `reviewLesson` refuses self-approval                           | `createdBy` vs `actor.userId` |
| Material review    | `reviewMaterial` refuses self-approval                         | `createdBy` vs `actor.userId` |
| Curriculum overlay | `approve` refuses the author                                   | `createdBy` vs profile id     |
| Bulk import        | `approve` refuses the uploader, checked BEFORE the status gate | `createdBy` vs user id        |

A null `createdBy` is treated as unknown authorship, not self-approval — pre-guard
rows stay approvable rather than becoming stuck.

**The UI half is done too.** The review queue's reads now carry `isOwnWork`,
derived from the SAME predicate as the guard, so what the client is told and
what the server enforces cannot drift. The Approve button is disabled for your
own work and says why; Reject stays available, because that is a withdrawal.

The client is told a boolean rather than an author id: it has no reliable
identity of its own to compare against (the web session carries no user id), and
eligibility is a rule the server owns.

Curriculum overlays and bulk imports have **no web surface at all** — both are
API-only today — so there is no button to hide. When a UI is built for either,
it needs the same treatment, and the audit row is the reminder.

---

## The gaps, with evidence

### 8 · Lesson review — a teacher can approve their own lesson

`LearningService.reviewLesson` loads only `{ id, reviewStatus }` and writes the
decision. It never reads the author, so nothing can compare them. Anyone holding
`lessons.approve` can approve a lesson they wrote.

- API: `apps/api/src/learning/services/learning.service.ts` → `reviewLesson`
- UI: `apps/web/app/(app)/classes/review/review-client.tsx` gates the buttons on
  `busy` / `note` only
- Data: `Lesson.createdBy` exists, so the guard needs no migration

### 9 · Material review — identical

`reviewMaterial`, same file, same shape: selects `{ id, reviewStatus }`, no
uploader comparison. `LearningMaterial.createdBy` exists.

### 10 · Curriculum overlay approval

`CurriculumOverlayService.approve` selects `{ id }` and stamps `approvedBy`.
Whoever holds `curriculum.manage` can approve their own overlay — and an overlay
edits the curriculum spine every class is taught against.

- API: `apps/api/src/curriculum/services/curriculum-overlay.service.ts`
- Data: `TenantCurriculumOverlay.createdBy` and `.approvedBy` exist

### 11 · Bulk import approval — highest blast radius

`ImportService.approve` checks only that the job reached `validated` / `dry_run`
before stamping `approvedBy`. The uploader can approve their own import, and an
import writes rows in bulk. It is step-up gated (clearance 7), which raises the
bar on _who_ but says nothing about _whose_.

- API: `apps/api/src/imports/services/import.service.ts` → `approve`
- Data: `ImportJob.createdBy` and `.approvedBy` exist

### 12 · Admissions decision — different shape, still worth a decision

The applicant here is an external prospect, not a user account, so there is no
self-approval in the mechanical sense the others have. The real conflict is a
staff member deciding on an application for their own child. That cannot be
caught by comparing ids; it needs a declared-interest rule. Flagged so the
decision is deliberate rather than overlooked.

---

## Two traps for whoever implements these

**1 · Compare the right identity, or the guard is a no-op.** Learning stores
`createdBy: actor.userId` but `reviewedBy: actor.profileId` — a `UserTenant` id.
A guard written as `lesson.createdBy === actor.profileId` compiles, reads
correctly, and never matches, so every self-approval sails through while the
code looks defended. Check which id each table actually stores before comparing.

**2 · The UI cannot gate what the API does not send.** The review projection
does not expose the author at all, so the client has nothing to hide the buttons
on. Each fix is therefore two-sided: refuse on the server, and expose enough
(`createdBy`, or a computed `canDecide`) for the client to not offer the action.

## Rollout

Server first — that is the boundary that matters, and it closes the hole even
while the UI still offers a button that now fails. Then expose eligibility on
the read, and hide the action. Each flow wants a spec proving the requester is
refused; the maker-checker path already has that pattern to copy.
