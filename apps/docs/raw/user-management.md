## User Management Model

This doc summarizes how user accounts, profiles, roles, and permissions are modeled and used across tenants (schools).

### Core Concepts

- User (account): `user-management.User`. Global identity with single email/password/MFA. Can belong to many schools.
- Profile (user-tenant membership): `profile.UserTenant`. A user’s membership in one tenant. All auth/permission checks are scoped to a profile.
- Roles: `profile.UserTenantRole`. Attached to a profile; multiple roles per profile are allowed. Clearance level is taken from the roles assigned to that profile.
- Permissions: Derived from role permissions plus per-profile overrides (`profile.UserTenantPermission`). Stored as a map in the permission context.
- Session: `user-management.Session`. Binds an authenticated token to a specific profile (`userTenantId`) and user (`userId`), locking context to one tenant at a time.

### Multi-Tenant Behavior

- One account, many profiles: A single `User` can have multiple `UserTenant` rows (one per school).
- Cross-tenant role variance: The same account can be a Parent in School A and a Teacher in School B by having different roles on different profiles.
- Multi-role per profile: A single profile can carry multiple roles (e.g., Teacher + Parent in the same school) via `UserTenantRole` rows.
- Context isolation: Every request resolves `userId`, `tenantId`, `profileId` via `TenantQueriesService.getUserTenantProfile`, and permission checks operate on that profile’s roles/permissions/clearance only.

### Role & Permission Model (recap)

- Roles live in `roles-permissions.Role` with clearance levels and role types (`platform`, `system`, `custom`).
- Role-permission links: `RolePermission`.
- Permission pools: `PermissionPool` + `RolePermissionPool` (for pool-based inheritance and custom-role constraints).
- Profile overrides: `UserTenantPermission` can grant/deny individual permissions for a profile.
- Effective context from `PermissionService.getUserPermissionContext`:
  - `userId`, `tenantId`, `profileId`
  - `roles` and `roleIds`
  - `permissionPoolIds`
  - `permissions` map: permission name -> { granted, requiredClearanceLevel? }
  - `clearanceLevel`: max clearance across the profile’s roles

### Session & Context Resolution

- Login authenticates the `User` and selects a `UserTenant` profile; the session stores `userId` and `userTenantId`.
- Guards/services use the profile to enforce tenant isolation, clearance, and permissions; there is no cross-profile leakage.
- AI mediator and other downstream services read the same context to derive access scope.

### Current Gaps / TODO (relevant to user relationships)

- Parent/guardian linkage: switch to a relational link table (below); stop relying on `guardianInfo` JSONB.
- Department linkage: No department membership model is present; `department` context checks are stubs.
- Context resolvers: `PermissionService.checkContextAwarePermission` has TODOs for `own_classes`, `children`, `department`; implementation and tests are pending.

### Common Scenarios (supported by current model)

- Single account, multiple schools: One `User`, multiple `UserTenant` rows. Choose the active profile at login/session creation.
- Multiple roles in one school: Add multiple `UserTenantRole` entries to the same `UserTenant`.
- Role differences by school: Assign different roles on different `UserTenant` rows; clearance and permissions remain tenant-specific.

## Parent / Guardian Management (plan)

### Data Model (relational, replacing JSON)

- New table: `student_management.student_guardians`
  - `id` (pk), `tenant_id` (fk), `student_id` (fk -> Student), `user_tenant_id` (fk -> UserTenant for guardian in same tenant)
  - `relationship` (parent | guardian | other), `is_primary` (bool), `legal_guardian` (bool), `contact_priority` (int), `notes` (text), audit fields.
  - Unique constraint: `(student_id, user_tenant_id)`; enforce tenant match.
- `Student.guardianInfo` removed; all guardian links must use `student_guardians`.

### Lifecycle / Flows

- Student onboarding/admissions: attach guardians while creating the student or immediately after; support selecting existing `User` or inviting a new one (create `User`, create `UserTenant` with Parent role, then link).
- Maintenance: add/remove/update guardians via dedicated endpoints; audit who changed what.
- Bulk ops: bulk student CSV/Excel import that can include guardians (create/update links). Also bulk guardian updates for existing students (idempotent by `(student_number|student_id, guardian_email, relationship)`).

### APIs (proposed)

- Manage guardians:
  - `POST /students/:studentId/guardians` – add/link guardian (existing or invite).
  - `PATCH /students/:studentId/guardians/:guardianLinkId` – update relationship flags.
  - `DELETE /students/:studentId/guardians/:guardianLinkId` – unlink.
  - `GET /students/:studentId/guardians` – list guardians for a student.
- Bulk:
  - `POST /students/bulk-import` – accept file; supports guardian columns (e.g., guardian_email, relationship, is_primary, legal_guardian). Creates users/profiles/links as needed.
  - `POST /students/guardians/bulk-upsert` – idempotent bulk guardian links for existing students.
- Discovery:
  - `GET /guardians` – list all guardian profiles in tenant (filter by name/email, pagination).
  - `GET /guardians/:userTenantId/students` – list students linked to a guardian.

### Bulk Import/Upsert Contract (guardians)

- Accepted file: CSV or Excel.
- Key columns (idempotent keys in **bold**):
  - **student_number** (or student_id)
  - guardian_email (required)
  - guardian_first_name (optional)
  - guardian_last_name (optional)
  - display_name (optional; otherwise derived as below)
  - relationship (parent|guardian|other; default parent)
  - is_primary (boolean, default false)
  - legal_guardian (boolean, default false)
  - contact_priority (int, optional)
- Display name derivation (if display_name not provided):
  - If first + last exist → "First Last"
  - If only one exists → that one
  - Else → email prefix or fallback "Guardian"
- Behavior:
  - If guardian user does not exist: create User, create UserTenant (Parent role), then link.
  - If guardian exists in tenant: reuse UserTenant; ensure Parent role assigned.
  - Upsert StudentGuardian by (student_id, user_tenant_id).
  - Student lookup by student_number within tenant (or direct student_id if provided).
  - All operations tenant-scoped; reject cross-tenant references.

### AuthZ

- Parent role: ensure tenant-scoped role(s) with appropriate clearance (likely low).
- `children` context resolver: check guardian link existence `(student_id, userTenantId)` within tenant. Deny if no link.
- Management endpoints: protect with admin/registrar permissions (e.g., `students.guardians.manage`, `students.bulk_import`, `students.guardians.bulk_upsert`).

### Implementation Notes / Next Steps

- Add Prisma model + migration for `student_guardians`.
- Implement `children` resolver in `PermissionService` against the link table; add tests.
- Extend seed data with sample parent profile and guardian link.
- Add bulk import parsing/validation for guardian data; ensure idempotent upsert.
- Update UI/API docs later in Next.js docs app; for now this raw doc is source of truth.
