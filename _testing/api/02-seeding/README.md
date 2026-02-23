# 2. Seeding the Platform

The seed script populates your database with the foundational data the platform needs to function: system roles, permission pools, 274 granular permissions, and their relationships. Without this data, authentication and authorization will not work.

## 2.1 What Gets Seeded

The seed runs in **5 sequential phases** plus a bonus sample data step:

| Phase | What                          | Count  | Description                                                      |
| ----- | ----------------------------- | ------ | ---------------------------------------------------------------- |
| 1     | System Roles                  | 11     | Architect through Guest (clearance levels 10→0)                  |
| 2     | Permission Pools              | 11     | One pool per clearance level                                     |
| 3     | Permissions                   | 274    | Across 25 categories (students, courses, grades, platform, etc.) |
| 4     | Permission → Pool assignments | ~1200+ | Each permission assigned to pools at/below its clearance level   |
| 5     | Pool → Role assignments       | 11     | Each role gets its matching permission pool                      |
| Bonus | Sample Guardian Data          | —      | A sample school, parent user, student user, and guardian link    |

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
Bonus: Sample Data (needs Phase 1 roles, creates tenant + users)
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
✨ Seed completed successfully!

📊 Summary:
  - System Roles: 11
  - Permission Pools: 11
  - All Permissions: 274
  - Permission-Pool Assignments: <count>
  - Role-Pool Assignments: 11
```

### Idempotent (Safe to Re-Run)

The seed uses **upsert** operations throughout, so running it multiple times is safe. Existing records are updated; nothing is duplicated.

## 2.3 Verify the Seed

After seeding, run the verification script to confirm everything was created correctly:

```bash
cd packages/database
pnpm run db:verify
```

This checks 6 things:
1. 11 system roles exist
2. 11 permission pools exist
3. >= 274 permissions exist
4. >= 200 permission-pool assignments exist
5. >= 11 role-pool assignments exist
6. All clearance levels 0-10 are covered

A passing run ends with:

```
🎉 All verifications passed! Seed data is correct.
```

## 2.4 What the Seed Creates (Detail)

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

### Sample Data (Bonus Phase)

The seed creates a `sample-school` tenant with two users for testing guardian relationships:

| Entity          | Value                                                  |
| --------------- | ------------------------------------------------------ |
| Tenant          | `Sample School` (slug: `sample-school`)                |
| Parent user     | `parent@example.com` (no password set — see note)      |
| Student user    | `student@example.com` (no password set — see note)     |
| Student record  | ID `STU-TEST-001`                                      |
| Guardian link   | Parent → Student (relationship: `mother`, primary)     |

**Important:** These sample users do **not** have passwords set, so you cannot log in with them directly. They exist to exercise the guardian-student data model. To create users you can actually log in with, see [Creating Your First Test User](./creating-a-test-user.md).

## 2.5 Browsing Seeded Data

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
- `Tenant` — the `sample-school` tenant
- `User` — the sample parent and student users

## 2.6 Resetting Everything

If you need a clean slate (drops and recreates all tables, then re-seeds):

```bash
cd packages/database
npx prisma migrate reset
```

This runs all migrations from scratch and then triggers the seed script automatically (configured in `prisma.config.ts`).

## What's Next

The platform data is ready, but you still need a user with a password to log in. Proceed to [Authentication](../03-authentication/README.md) to learn how to create a test user and get tokens.
