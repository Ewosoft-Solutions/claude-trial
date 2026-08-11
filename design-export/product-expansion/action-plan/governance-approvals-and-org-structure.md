# Governance — configurable approval workflows + organisation structure

**Status:** captured / proposed — **build after WB3** (owner-directed, 2026-08-11). This is the durable
capture of a design direction so future tasks align with it (and so admissions is built to accept it).

## Why

Today a "sensitive action" is gated by a **hard-coded, two-party maker-checker** (`MakerCheckerService`
with `MakerCheckerRequest`): one maker, one clearance-gated checker, **single step**, keyed by a string
`operation` (used by promotion, finance adjustments, platform approvals). A school **cannot reorganise
who approves what, or in what order.** The owner wants schools to **configure their own approval
workflows** — targeted at roles, one-step or multi-step, N-of-a-role, or a **chain of command** — and to
attach them to **any** sensitive action (the admissions decision, leave, finance, results, …).

Chain-of-command needs an org hierarchy richer than today's single `StaffProfile.reportsToStaffProfileId`
line + free-text `department`. That org structure is itself a wanted capability: teams/functions,
managers, groups, and **multiple organograms per school** (staff, PTA, club, committee…), with
communications directed at a group/function and extra info attached to people (including parents).

Both are **generalisations of primitives that already exist**, not greenfield.

---

## Initiative A — Approval Workflow module (generalises maker-checker)

A school-configurable approval engine layered on the existing `MakerCheckerRequest` substrate.

- **Config (new):** `ApprovalWorkflow` (per tenant, attached to a sensitive `operation` or category) →
  ordered `ApprovalWorkflowStep`s. Each step declares its **approver target**:
  - a **specific role**, or
  - **N approvers of a role** (e.g. two of "Head"), or
  - a **chain of command** — "the actor's function lead → their manager → …", resolved through the
    organogram (Initiative B). Leave-approval is the canonical example.
  - Step options: quorum, **separation of duties** (maker ≠ any approver), step expiry, escalation.
- **Runtime lifecycle (the pattern the owner described):** the action is **drafted — recorded but not
  binding** → a workflow instance opens → each step raises a targeted `MakerCheckerRequest` → the
  approver **accepts or rejects** → on final approval the action is **committed and logged**; any
  rejection stops it. Fully audited. **A one-step config reproduces today's maker-checker exactly**, so
  nothing regresses.
- **Reuse:** `MakerCheckerRequest` as the per-step record; the F8 `ApprovalPanel` UI; the sensitive-op
  catalog as the menu of attachable actions.
- **Setup UI:** a workflow builder — pick an action → add steps → target role / N-of-role / chain →
  SoD + expiry.

## Initiative B — Organisation structure / organogram (generalises `StaffProfile.reportsTo`)

- **Multiple organograms per tenant:** `OrgChart` (kind: `staff | pta | club | committee | custom`).
  Each has `OrgUnit`s (teams / functions / groups) in a hierarchy, each with a designated **manager /
  lead** and **members**. A Person — **including a non-staff parent** — can be a member of units across
  charts, with an attached title / role / metadata.
- **Uses:** chain-of-command resolution for approval workflows; **group-targeted communications** (send
  to a unit / function / role, riding on F5); directory grouping; parents attached to a PTA/club group
  with extra info.
- **Setup UI:** an organogram builder — add a chart → build units → assign managers → add members.
- **Supersedes** the thin `StaffProfile.department` (free text) + single `reportsTo` line (migrate in).

## Initiative C — Role customisation (revisit, later, smaller)

WB1-5 custom roles are seeded from a `RoleTemplate`'s permission pools, but the **individual permissions
can't be checked/unchecked afterward** — so a "custom" role is a template replica, not truly custom.
Make the role editor allow **per-permission add/remove within the role's clearance ceiling**.
Self-contained; do after A + B.

---

## Admissions now — leave an approval seam (do while building admissions)

While building the admissions consolidation/refinement, design the **decision (offer / accept / reject)**
so a workflow can wrap it later **without a refactor** — and so the same seam works for every other
sensitive action:

1. **One guardable service method per decision transition** (already the case) — the single interception
   point an approval layer slots into.
2. **Register `admissions.decision.*` in the sensitive-op catalog** as candidate attachable actions,
   **defaulting to no workflow** (today's single-permission behaviour), so nothing changes until a school
   configures one.
3. **Model the decision as draftable** — a transition can be _requested_ (drafted, not binding) then
   _committed_, so the approval runtime can sit between. **Mirror the promotion pattern** that already
   works this way: `requestCommit` → `approveAndCommit`.

This is what "focus on admissions now such that approvals can be factored in later" means concretely.

---

## Sequencing (after WB3)

**Organogram (B) → Approval Workflow (A, uses B for chains) → attach to the admissions decision + other
sensitive ops → Role customisation (C).** _(Order **owner-confirmed 2026-08-11**: F11 before F10, so
chain-of-command approvals have a hierarchy to traverse.)_ Group-targeted comms rides on B + F5. Each is a candidate
`F`-series foundation (proposed **F10** Approval Workflow, **F11** Org Structure) pending owner sign-off
on scope/sequencing.

## Existing building blocks (accurate references)

- `MakerCheckerRequest` — `packages/database/prisma/models/roles-permissions.prisma` (single maker +
  clearance-gated checker, `operation` string, `requestData` Json, expiry).
- `MakerCheckerService` + consumers: `academic-structure/services/promotion.service.ts`,
  `finance/services/finance-adjustment.service.ts`, `tenant/services/platform-approval.service.ts`.
- Org seed: `StaffProfile.department` + `StaffProfile.reportsToStaffProfileId` (self-relation) —
  `packages/database/prisma/models/person.prisma`.
- Roles: `RoleTemplate` + WB1-5 role editor (same file / `roles-permissions.prisma`).
