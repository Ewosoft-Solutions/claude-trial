# Workbench 1 — Shared foundations + People

**Why first:** the [dependency map](../plan/06-roadmap-and-discussion-guide.md#dependency-map) puts Person/profile before admissions conversion, staff records, guardian authority, and dedup — so People is the unlock. It also lets us **finish** our strongest-but-unfinished area (the 305-permission engine has no management UX; `settings/roles` "Add role" is unwired).

**Consolidates (incumbent):** All-Staff + Search-Staff + All-Users + guardians + the VIEW/EDIT matrix (C025–27, C132, C004–10). **Replaces** three directories + a coarse binary matrix with **one People directory + a scoped role editor**.

**Workbench acceptance (all must pass):**

1. A staff member who is also a guardian uses **one** identity with two contextual profiles.
2. A bursar posts payments for Campus A but **cannot** export Campus B debtors.
3. A substitute teacher gets class access for 5 days; it **auto-expires**.
4. A role change granting payroll export requires **step-up + a second approval**.
5. An admin can **explain effective access** — inheritance, override, scope, expiry.

Items `WB1-1..WB1-6` on the [board](TASK-BOARD.md). All depend on Phase-1 `F1` (+ `F7`/`F8` for UI); WB1-5/6 also depend on ADR-01.

---

## WB1-1 · Unified People directory — `L` (deps F1, F7, F8)

**Job:** find any person once; see all their relationships (student/guardian/staff/user/applicant) from one searchable directory with type views.
**UI:** the F7 directory + F8 shell; type tabs; `StatusBadge` for account/employment/enrollment status (distinct badges — never conflate account-enable with employment/lifecycle, the legacy system C026 bug); masked contact by default; bulk-action bar; detail route with a relationship timeline + domain tabs.
**Scope/permissions:** `users.view` / `students.view` / staff view, context-scoped; `.view.personal_info` gates contact reveal (audited).
**Acceptance:** search returns a person with both a staff and guardian profile; opening them shows one identity, two profiles; a scoped admin sees only their campus.

## WB1-2 · First-class staff employment/profile — `L` (deps F1)

**Job:** staff records are their own domain, not derived from `StaffPayrollRecord`.
**Domain:** `StaffProfile`/`Employment`(position, department, reporting line, dates, qualifications); relate to `Person` + `UserTenant`; migrate existing payroll-derived directory data across with source keys.
**Acceptance:** create/di­sable an employment independent of any payroll run; the People directory's Staff view reads `Employment`, not payroll.

## WB1-3 · Secure invitations + activation/suspension + reset — `M` (deps F1, F5)

**Job:** provision users the safe way — invite (no password transmitted), activate/suspend, self-service reset — **retiring generated-password-via-SMS/email (C034, #13, Reject).**
**Reuse:** existing invite/accept-invite routes + `password-input`/`password-strength` (already built) + F5 for delivery.
**Acceptance:** invite → user sets their own password via an expiring `SecureLink`; suspend blocks login + audits; **no code path emits a plaintext password.**

## WB1-4 · Guardianship authority/priority/consent — `M` (deps F1)

**Job:** model real caregiver relationships — beyond Father/Mother/Both (C049).
**Domain:** extend `StudentGuardian` (already has `relationship/isPrimary/legalGuardian/contactPriority`) with custody, contact-consent, verification, effective date-range; multiple non-parent caregivers.
**Acceptance:** a student has two guardians with distinct authority + contact priority; result/fee comms target by **relationship + consent**, not a gender label.

## WB1-5 · Role editor + effective-access preview — `L` (deps F1, ADR-01)

**Job:** the permission-management UX our engine has been missing — **role templates → plain-language capabilities → scope → exception search → sensitive-action surfacing → separation-of-duties conflicts → effective-access preview → who's-affected**. _Not_ 305 checkboxes (fixes the unwired `settings/roles` "Add role").
**Domain/API:** `RoleTemplate`; extend grants with the scope+constraints shape from [04 §authorization](../plan/04-target-product-and-architecture.md#authorization-architecture-finish-whats-strong); an **effective-access evaluator that returns a decision + human explanation.**
**UI:** F8 Policy shell; `toggle-group`/`checkbox` over `resource.action.context`; sensitive actions in `destructive` `StatusBadge`; SoD conflicts as a `--warning` callout.
**Acceptance:** build a "Bursar (Campus A)" role from a template + scope; the preview explains _"Allowed: `finance.view` · Scope: Campus A · Source: Bursar template → Level-N pool"_ and shows the Campus-B export as **denied**.
**Validation:** unit tests on the evaluator (allow/deny/scope/expiry/SoD); `db:verify` if any permission added (update `EXPECTED_PERMISSION_COUNTS`).

## WB1-6 · Scope + expiry + high-risk approval — `L` (deps WB1-5)

**Job:** time-boxed + maker-checker access changes for the risky grants.
**Reuse:** `MakerCheckerRequest` + `SensitiveOperationPolicy` + step-up (all exist).
**Acceptance:** a 5-day substitute grant auto-expires (scenario 3); granting payroll export triggers step-up + a **second-approver** (scenario 4); maker ≠ checker is enforced (the self-approval bug the platform work already fixed stays fixed — add a regression test).

---

### Deferred to backlog (not in Workbench 1)

- Access-review campaigns (#10) → Phase 4.
- Per-staff QR (#12) → defer.
- Import of a full staff/guardian dataset → via F2/WB7 once the import platform exists.

### Definition of Done (whole workbench)

All six acceptance scenarios pass end-to-end; the three the legacy system directories are replaced by one; `settings/roles` creates a working scoped role; full validation contract + `pnpm ci:quick` green; board + `AI_HANDOFF.md` updated.
