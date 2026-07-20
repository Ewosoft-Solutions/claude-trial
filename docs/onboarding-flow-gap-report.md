# School Onboarding Flow — End-to-End Test & Gap Report

**Date:** 2026-07-12
**Scope:** Platform Architect onboards a new school → invites a School Owner
representative → representative is onboarded and signs in.
**Method:** Real endpoints exercised against the running API + a controlled API
instance on `:3031` (to capture the console-logged MFA code) sharing the
`schoolsys` dev DB; browser UI driven on the web app (`:3000`).

**Test artifacts created (left in the DB, `DEV`-labelled):**
- Tenant: `DEV Onboarding Test Academy` (`dev-onboarding-test`, id
  `f8ceeab3-8f5d-440e-a6b4-4b7c7cb007b1`), status `active`.
- Representative user: `owner.rep@devonboarding.test` / role **Owner** (id
  `b8313a88-4402-4bed-ae52-ecea3d543fa1`), profile `ACTIVE`.

---

## Outcome

The flow **can** be completed end-to-end, but **only after two backend fixes**
and **only via the API** — several steps have no working UI and one step
(invite delivery) has no working backend. A real operator following the
documented product flow through the browser today would be blocked at the very
first step (architect cannot register a school in the UI) and again at invite
delivery and acceptance.

Two code fixes were required just to get the API path working (details in
§Fixes-applied). They are in the working tree, **uncommitted**, on branch
`claude`.

---

## What works (confirmed)

- Architect authentication: `login → MFA (email) → select-school → access token`.
- Tenant registration + **per-tenant JWT secret auto-generation** (after fixes);
  `jwt-secrets.tenant_jwt_configs` row created.
- Tenant activation via `PATCH /tenant/:id/status`.
- Invitation **creation** and **acceptance** service logic; profile → `ACTIVE`.
- Representative login (no MFA) → select-school → lands in tenant dashboard.
- **Tenant isolation / branding correct**: dashboard shows the right school name
  ("DEV Onboarding Test Academy") and user ("Ada Obi"); no cross-tenant leak.
- **RBAC clearance enforcement** (once the guard is attached): the Owner rep gets
  `200` on own-tenant reads / tenant user list (clearance ≤8) and correctly
  `403` on "list all tenants" (clearance 9).
- Operational pages (e.g. Students) render correct **tenant-scoped empty states**
  ("No students yet", "0 of 0 students in DEV Onboarding Test Academy").

---

## Gaps

### G1 — CRITICAL (security): `TenantController` has no `ClearanceLevelGuard`
- **File:** `apps/api/src/tenant/controllers/tenant.controller.ts:58`
- The class was guarded only by `@UseGuards(JwtAuthGuard)`. Every
  `@RequireClearanceLevel(7|8|9)` on its methods is **dead metadata** — no guard
  reads it. So any *authenticated* user (a Student at clearance 1) could call
  tenant-management endpoints: list **all** tenants, create/bulk-create users,
  add users to a tenant, change tenant status, **rotate JWT secrets**.
- Same root cause also **populates `req.userContext`** (the guard sets it), so
  without the guard `userContext` is `undefined` and registration always failed.
- **Evidence:** with the guard attached, the Owner rep now correctly receives
  `403` on `GET /tenant` (clearance 9) while retaining `200` on lower-clearance
  reads.

### G2 — HIGH (bug): registration role check compares a UUID to a role *name*
- **Files:** `tenant.controller.ts:88` passes `userContext.roleId` (a UUID);
  `tenant-registration.service.ts` calls `canRegisterTenant(...)` /
  `isPlatformAdminRole(...)` which compare against role **names**
  (`'Architect'`, `'Owner'`) — `packages/api/src/types/enums/roles.enums.ts:162`.
- A UUID can never equal `'Architect'`, so **no one** — not even the Architect —
  could register a school (`400 "Only platform admins or school owners can
  register schools"`). `isPlatformAdminRole` also gates JWT-secret auto-gen, so
  that silently never ran either.
- `UserPermissionContext` (`permission.service.ts:30`) carries `roleId` +
  `clearanceLevel` but **no role name**, so the call site has no name to pass.

### G3 — HIGH (missing): no web UI to register/onboard a school
- `POST /tenant/register` is API-only. There is no page in `apps/web` and no BFF
  proxy route (only `app/api/tenant/features/route.ts` exists). A Platform
  Architect **cannot onboard a school from the browser** at all.

### G4 — HIGH (missing backend): invitation email is a no-op stub
- **Files:** `apps/api/src/tenant/services/user-invitation.service.ts:128`
  enqueues `'invitation-email'` into `common/queue/queue.service.ts`, which is an
  in-memory `Map` with **no worker/consumer**. The job is logged and never
  processed.
- The invitation token is returned **only** in the API response to the creator;
  the invitee never receives anything. Onboarding cannot complete without
  sharing the token out-of-band.

### G5 — HIGH (bug): the "public" accept-invitation endpoint is not public
- **File:** `tenant.controller.ts:257` (`POST /tenant/invitations/accept`,
  commented "public endpoint"). It inherits the class-level `JwtAuthGuard`, and
  the codebase has **no `@Public()` mechanism** (`jwt-auth.guard.ts` has no
  bypass). An invitee — who has no account or token yet — gets **`401`**.
- **Evidence:** unauthenticated accept → `401`. To finish the E2E I accepted with
  an authenticated call (the service authorizes by invitation token, not caller
  identity), which is a workaround, not the intended path.

### G6 — HIGH (missing): no web UI for invitation acceptance
- No accept-invite / set-password page exists in `apps/web`. Even if the token
  were delivered, the invitee has nowhere in the browser to accept and set a
  password.

### G7 — MEDIUM (missing): in-tenant "Invite user" button is non-functional
- **File:** `apps/web/app/(app)/settings/users/page.tsx:98` — the `Invite user`
  button has **no `onClick`/handler** and there is no invitations BFF route. The
  page *reads* real users (`GET /tenant/:id/users`) but cannot *invite*. So even
  onboarding additional staff inside a tenant isn't wired in the UI.

### G8 — MEDIUM (data integrity): overview dashboards render hardcoded mock data
- **Files:** `apps/web/app/(app)/overview/dashboards/admin-dashboard.tsx:35,44,66,74`
  (and the sibling `*-dashboard.tsx` files) hardcode `1,420` students, `₦12.4M`
  revenue, `Spring Term 2025 / Week 6 of 13`, `38 admission applications`, etc.
- A freshly onboarded **empty** school shows a fully fabricated dashboard.
  Sidebar nav badges (`Enrollment 42`, `Directory 1.2k`, `Fees 7`) are hardcoded
  too. This contradicts the 2026-07-09 "runtime mock/dev-seed cleanup"
  (`CURRENT_PHASE.md`) — the overview surface was missed. (Operational pages were
  cleaned correctly, so the issue is isolated to the overview dashboards + nav
  counts.)

### G9 — MEDIUM (UX/blocker in real envs): architect MFA code is only `console.log`'d
- **File:** `apps/api/src/auth/services/mfa-email.service.ts:64` logs
  `[MFA Email] Code for …: NNNNNN`; there is no email-provider integration
  (`sendEmail` is an empty placeholder). The code is stored **hashed**, so it's
  unrecoverable from the DB.
- The bootstrap **Architect** account has email MFA enrolled. In any environment
  without console access (staging/prod), the account that onboards every school
  **cannot log in**. Affects all email-MFA users, but is most severe here.

### G10 — LOW (product): school type not captured at onboarding
- `RegisterTenantDto` has no `schoolType`; the tenant is created with
  `schoolType: null`. The product centres on nursery/primary/secondary/
  university/college polymorphism, but onboarding never asks. (Polymorphism is
  a "Parked" item per the plan — flagging for the onboarding UX specifically.)

### G11 — LOW (UX): no guided onboarding / activation is a separate manual step
- Registration yields `PENDING`; activation is a separate clearance-9 call. There
  is no onboarding checklist, no "activate + seed starter roles/terms/classes"
  step, and no first-run guidance for the new owner.

---

## Fixes applied (uncommitted, branch `claude`) — needed to unblock the E2E

1. `apps/api/src/tenant/controllers/tenant.controller.ts`
   — attach `ClearanceLevelGuard` at the class level
   (`@UseGuards(JwtAuthGuard, ClearanceLevelGuard)`) so clearance is enforced and
   `req.userContext` is populated. **(Addresses G1.)**
2. `apps/api/src/tenant/services/tenant-registration.service.ts`
   — resolve the incoming role **id → name** before `canRegisterTenant` /
   `isPlatformAdminRole` (backward compatible; falls back to the raw value).
   **(Addresses G2.)**

These are the minimum required to make `POST /tenant/register` function. They are
legitimate fixes but were made to unblock testing — review before keeping. Every
other gap above was **documented, not fixed**.

---

## Suggested priority order

1. **G1** (security hole — unprotected tenant admin endpoints) — fix immediately.
2. **G2** (registration completely broken) — fix with G1.
3. **G4 + G5 + G6** (invite delivery + public accept + accept UI) — the invite
   half of onboarding is unusable end-to-end without all three.
4. **G3 + G7** (registration UI + in-tenant invite UI).
5. **G9** (real email provider) — blocks login in non-dev envs.
6. **G8** (overview mock data) — misleading first impression for new schools.
7. **G10 / G11** (school type, guided onboarding) — product polish.
