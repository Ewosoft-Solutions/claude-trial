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

| #   | Flow                                    | Endpoint                                                | API guard     | UI gate | Status        |
| --- | --------------------------------------- | ------------------------------------------------------- | ------------- | ------- | ------------- |
| 1   | Platform tenant approvals               | `POST /tenants/approvals/:requestId/approve\|reject`    | maker-checker | —       | **OK**        |
| 2   | Access grants (permissions)             | `POST /access/grants/:requestId/approve\|reject`        | maker-checker | —       | **OK**        |
| 3   | Finance adjustments (discounts/waivers) | `POST /finance/adjustments/:id/approve\|reject`         | maker-checker | —       | **OK**        |
| 4   | Promotion runs                          | `POST /promotion/runs/:id/approve`                      | maker-checker | —       | **OK**        |
| 5   | Result publication                      | `POST /results/cycles/:id/approve-publish`              | maker-checker | —       | **OK**        |
| 6   | Result amendments                       | `POST /results/amendments/:amendmentId/approve`         | maker-checker | —       | **OK**        |
| 7   | AI settings change requests             | `POST /ai/settings/change-requests/:id/approve\|reject` | maker-checker | —       | **OK**        |
| 8   | **Lesson review**                       | `POST /learning/lessons/:id/approve\|reject`            | **guarded**   | pending | **API fixed** |
| 9   | **Material review**                     | `POST /learning/materials/:id/approve\|reject`          | **guarded**   | pending | **API fixed** |
| 10  | **Curriculum overlay**                  | `POST /curriculum/overlays/:id/approve`                 | **guarded**   | pending | **API fixed** |
| 11  | **Bulk import approval**                | `POST /imports/jobs/:id/approve`                        | **guarded**   | pending | **API fixed** |
| 12  | Admissions decision                     | `POST /admissions/applications/:id/reject`              | n/a           | n/a     | **Review**    |

---

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

**Still open: the UI half.** The API now refuses, so the hole is closed, but the
buttons are still offered and simply fail. Next step is to expose eligibility on
the read (`createdBy`, or a computed `canDecide`) and hide the action — see the
second trap below for why the client cannot do this today.

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
