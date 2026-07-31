# ADR-01 — Person / auth-identity / profile / tenant-membership separation

- **Status:** Proposed — 2026-07-31
- **Deciders:** engineering + product. **Owner sign-off:** not required (a data-model choice), but confirm the tenant-boundary reading with ADR-11.
- **Unblocks:** F1 (Person foundation), WB1-1 (People directory), WB1-2 (staff employment), WB1-4 (guardianship), WB1-5 (role editor), and admissions conversion (WB3).

## Context

Today four concerns are fused across our models:

- `User` (`profile.prisma`) — auth identity (credentials/MFA/sessions), platform-level.
- `UserTenant` (`user-management.prisma`) — a user's membership in a tenant, currently also carrying profile-ish data.
- `Student` (`student-management.prisma`) — enrollment profile, with personal/health data in **JSONB**.
- `StudentGuardian` — links a guardian `UserTenant` to a student.
- Staff have **no first-class record** — the HR directory is derived from `StaffPayrollRecord`.

This fusion causes the exact problems the corpus shows: a human who is **both staff and guardian** would be two accounts (the legacy system keeps duplicate directories, All-Staff C026 vs All-Users C132, and conflates account-enable with employment status); a **guardian who never logs in** has nowhere to live except as an account; and student PII is trapped in unsearchable JSONB. Requirements demand one identity with role-shaped profiles (`AI_CONTEXT.md` personas; `requirements/access-control.md`).

**What breaks if we guess wrong:** admissions→student conversion, duplicate resolution, guardian authority, and staff records all reference "a person." If "person" isn't a clean anchor, every one of those domains invents its own, and dedup becomes intractable — a core-table redesign later.

**Tenant-boundary tension (must be explicit):** a `Person` holds PII. Making it platform-global would silently link a human's data **across tenants** — a privacy violation and against tenant isolation (`requirements/multi-tenant-architecture.md`). So the boundary question (ADR-11) matters here.

## Options

1. **`Person` as a tenant-scoped human anchor; `User` stays the platform-level login; profiles hang off `Person` (recommended).** Cleanly separates human ≠ account ≠ employment/enrollment; a login is optional. Trade-off: one more indirection; back-fill required.
2. **Keep `UserTenant` as the de-facto person (status quo).** No migration, but can't represent a human without an account, can't cleanly hold two profiles, and keeps PII fused with membership — rejected.
3. **Platform-global `Person` shared across tenants.** Enables cross-tenant dedup, but links PII across tenant boundaries by default — rejected on privacy/isolation grounds. (Cross-tenant reconciliation, if ever needed, is a deliberate platform-scoped, audited operation — not the default.)

## Decision

Adopt **Option 1**:

```
User (platform)            ── auth identity: credentials, MFA, sessions
  └─ UserTenant            ── membership of a User in a tenant (account at a school)

Person (tenant-scoped)     ── a human as known to ONE tenant; holds PII; login OPTIONAL
  ├─ ContactPoint(+verify) ── typed, verifiable email/phone (masked by default)
  ├─ Address               ── country-subdivision adapter (NG State/LGA … international)
  ├─ 0..1 UserTenant link  ── if this human has an account here
  ├─ StudentProfile        ── (replaces raw Student anchoring)
  ├─ StaffProfile/Employment
  └─ GuardianRelationship  ── to a student's Person
```

- **`Person` is tenant-scoped.** The same human at two schools is two `Person`s, reconciled only through the shared platform `User` if they log in — no cross-tenant PII linkage by default.
- **A `Person` need not have an account** (young students, non-login guardians) — solves the legacy system's generated-password-for-everyone anti-pattern (C034).
- **Within a tenant, one human = one `Person` with many profiles** — this is the "staff who is also a guardian = one identity, two profiles" acceptance scenario (WB1).
- Governed, searchable student attributes (State/LGA, DOB, religion where lawful) move from `Student.personalInfo` JSONB → typed columns; genuinely tenant-extensible attributes stay JSON with a schema.
- Existing `StudentGuardian` (already `relationship/isPrimary/legalGuardian/contactPriority`) is re-pointed at `Person` and extended in WB1-4.

## Consequences

- **Enables** the unified People directory, first-class staff employment, non-login guardians, and clean admissions conversion (create/link Person → profiles → enrollment, preserving source id).
- **Constrains:** every domain that said "a user" must say "a Person and/or a UserTenant" — a one-time refactor of read paths.
- **Migration impact:** back-fill `Person` from existing `User`/`Student`/`StudentGuardian`/payroll-derived staff with a **stable `sourceKey`** (feeds F2/WB7 dedup). Additive tables + FKs; `tenant_id` non-null; RLS on new tables; `db:rls:check` green before done. No destructive change to existing rows.
- Depends on **ADR-11** to confirm the tenant-vs-campus boundary (campus is an org _within_ the tenant, so `Person` is tenant-scoped, not campus-scoped).

## Validation

- Create a Person → attach a Staff profile **and** a Guardian relationship → both resolve to one Person; the People directory shows one identity, two profiles.
- A guardian with no `UserTenant` exists and can be a result/fee recipient.
- Tenant-isolation test: a Person in tenant A is invisible to tenant B (RLS); no query links Persons across tenants except the audited platform path.
- `db:rls:check` + tenant-isolation unit tests green.
