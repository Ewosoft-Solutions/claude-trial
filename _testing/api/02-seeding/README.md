# 2. Seeding the Platform

The seed script populates your database with the foundational data the platform needs to function: system roles, permission pools, 274 granular permissions, their relationships, and a **platform Architect account** that can bootstrap the entire system.

## 2.1 What Gets Seeded

The seed runs in **6 sequential phases**:

| Phase | What                          | Count  | Description                                                      |
| ----- | ----------------------------- | ------ | ---------------------------------------------------------------- |
| 1     | System Roles                  | 11     | Architect through Guest (clearance levels 10→0)                  |
| 2     | Permission Pools              | 11     | One pool per clearance level                                     |
| 3     | Permissions                   | 274    | Across 25 categories (students, courses, grades, platform, etc.) |
| 4     | Permission → Pool assignments | ~1673  | Each permission assigned to pools at/below its clearance level   |
| 5     | Pool → Role assignments       | 11     | Each role gets its matching permission pool                      |
| 6     | Platform Bootstrap            | —      | Architect user, platform tenant, and role assignment             |

Plus a bonus step that seeds sample guardian/student data for the `sample-school` tenant.

### Phase Dependencies

```
Phase 1: System Roles (no deps)
   ↓
Phase 2: Permission Pools (no deps)
   ↓
Phase 3: Permissions (no deps)
   ↓
Phase 4: Permission → Pool links (needs Phase 2 + Phase 3)
   ↓
Phase 5: Pool → Role links (needs Phase 1 + Phase 2)
   ↓
Bonus: Sample guardian/student data (needs Phase 1 roles)
   ↓
Phase 6: Platform Bootstrap (needs Phase 1 Architect role)
```

## 2.2 Run the Seed Script

```bash
# From the repository root
pnpm db:seed

# Or from the database package
cd packages/database
pnpm run db:seed
```

The script logs progress for each phase. A successful run ends with:

```
📋 Phase 6: Bootstrapping platform Architect account...
  ✅ Platform tenant: Platform Administration (platform)
  ✅ Architect user: architect@schoolwithease.com
  ✅ Architect profile linked to platform tenant with Architect role

  🔑 Platform bootstrap credentials:
     Email:    architect@schoolwithease.com
     Password: Architect@2025!
     ⚠️  Change this password immediately after first login in production!

✨ Seed completed successfully!

📊 Summary:
  - System Roles: 11
  - Permission Pools: 11
  - All Permissions: 274
  - Permission-Pool Assignments: 1673
  - Role-Pool Assignments: 11
  - Platform Architect: architect@schoolwithease.com
```

### Idempotent (Safe to Re-Run)

The seed uses **upsert** operations throughout, so running it multiple times is safe. Existing records are updated; nothing is duplicated.

## 2.3 Verify the Seed

After seeding, run the verification script to confirm everything was created correctly:

```bash
cd packages/database
pnpm run db:verify
```

This checks 7 things:
1. 11 system roles exist
2. 11 permission pools exist
3. >= 274 permissions exist
4. >= 200 permission-pool assignments exist
5. >= 11 role-pool assignments exist
6. All clearance levels 0-10 are covered
7. Platform bootstrap is complete (Architect user with password, linked to platform tenant with Architect role)

A passing run ends with:

```
🎉 All verifications passed! Seed data is correct.
```

## 2.4 Platform Bootstrap (Phase 6)

This is the most important phase for getting started. It creates the **originator account** — the first user who can log in and bootstrap the entire system.

### What Gets Created

| Entity           | Value                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| Tenant           | `Platform Administration` (slug: `platform`)                                  |
| User             | `architect@schoolwithease.com` with a hashed password                         |
| Profile          | Links the Architect user to the platform tenant                               |
| Role assignment  | Architect role (clearance level 10) on the platform tenant profile            |

### Default Credentials

| Field    | Value                           |
| -------- | ------------------------------- |
| Email    | `architect@schoolwithease.com`  |
| Password | `Architect@2025!`               |

**Change this password immediately in production environments.**

### What the Architect Can Do

With clearance level 10, the Architect can:
- Register new schools (`POST /tenant/register`, requires 8+)
- List all tenants (`GET /tenant`, requires 9+)
- Change tenant status (`PATCH /tenant/:id/status`, requires 9+)
- Rotate JWT secrets (`POST /tenant/:id/jwt-secret/rotate`, requires 9+)
- Access platform security policies and breach response
- Create SuperAdmin and Owner users in any tenant
- Everything else in the system

### How to Use It

After seeding, the Architect account is ready to log in immediately:

```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "architect@schoolwithease.com",
    "password": "Architect@2025!"
  }'

# 2. Select the platform tenant (use tenantId and profileId from the response)
curl -X POST http://localhost:3000/auth/select-school \
  -H "Authorization: Bearer <token-from-login>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "<platform-tenant-uuid>",
    "profileId": "<architect-profile-uuid>"
  }'

# 3. Now use the accessToken to register your first real school
curl -X POST http://localhost:3000/tenant/register \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Greenfield Academy",
    "slug": "greenfield-academy"
  }'
```

See [Authentication](../03-authentication/README.md) for the full flow with detailed examples.

## 2.5 Sample Guardian Data (Bonus Phase)

The seed also creates a `sample-school` tenant with two users for testing guardian-student relationships:

| Entity          | Value                                                  |
| --------------- | ------------------------------------------------------ |
| Tenant          | `Sample School` (slug: `sample-school`)                |
| Parent user     | `parent@example.com` (no password — not loginable)     |
| Student user    | `student@example.com` (no password — not loginable)    |
| Student record  | ID `STU-TEST-001`                                      |
| Guardian link   | Parent → Student (relationship: `parent`, primary)     |

These users exist for data model testing only. Use the Architect account to create real, loginable users.

## 2.6 What the Seed Creates (Detail)

### System Roles

| Role        | Clearance Level | Type     |
| ----------- | --------------- | -------- |
| Architect   | 10              | platform |
| SuperAdmin  | 9               | platform |
| Owner       | 8               | school   |
| Management  | 7               | school   |
| ITSupport   | 6               | school   |
| Finance     | 5               | school   |
| Operations  | 4               | school   |
| Teacher     | 3               | school   |
| Parent      | 2               | school   |
| Student     | 1               | school   |
| Guest       | 0               | school   |

### Permission Categories (25 total)

`students`, `courses`, `grades`, `attendance`, `fees`, `messages`, `staff`, `reports`, `settings`, `platform`, `library`, `transportation`, `cafeteria`, `health`, `facilities`, `events`, `sports`, `clubs`, `parent_portal`, `inventory`, `safety`, `compliance`, `timetable`, `exams`, `admissions`

## 2.7 Browsing Seeded Data

Use Prisma Studio to visually inspect what was created:

```bash
pnpm db:studio
```

Key tables to check:
- `Role` — 11 system roles
- `PermissionPool` — 11 pools
- `Permission` — 274 permissions
- `PermissionPoolPermission` — the many-to-many link table
- `RolePermissionPool` — role-to-pool assignments
- `Tenant` — the `platform` and `sample-school` tenants
- `User` — the Architect, sample parent, and sample student users
- `UserTenant` — profile linking Architect to platform tenant
- `UserTenantRole` — Architect role assignment

## 2.8 Resetting Everything

If you need a clean slate (drops and recreates all tables, then re-seeds):

```bash
cd packages/database
npx prisma migrate reset
```

This runs all migrations from scratch and then triggers the seed script automatically (configured in `prisma.config.ts`).

## What's Next

The platform is ready. You have a loginable Architect account. Proceed to [Authentication](../03-authentication/README.md) to log in and get tokens.
