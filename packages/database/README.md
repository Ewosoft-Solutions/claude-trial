# Prisma Schema Organization

The Prisma schema is organized into multiple files by context for better maintainability and clarity.

## ✅ Schema Status

**Schema Validation:** ✅ Passed  
**Format Check:** ✅ Passed  
**Linter Check:** ✅ No errors

## Structure

The schema is split into context-based files in the `prisma/` directory:

- **`schema.prisma`** - Main entry point file containing `datasource` and `generator` configuration
- **`user-management.prisma`** - User accounts, authentication, and security models
- **`roles-permissions.prisma`** - Roles, permissions, and access control models
- **`profile.prisma`** - User-tenant relationships (profiles) and profile-specific permissions
- **`tenant.prisma`** - Tenant (school) management models

## File Organization

### User Management (`user-management.prisma`)

- `User` - Core user account information
- `PasswordHistory` - Password reuse prevention
- `LoginAttempt` - Rate limiting and security monitoring
- `Session` - Active user sessions

### Roles & Permissions (`roles-permissions.prisma`)

- `Role` - System and custom roles with clearance levels
  - **Role Types:** `platform`, `system`, `custom`
  - **Clearance Levels:** 0-10 hierarchy (Architect=10, Guest=0)
  - **Custom Roles:** Limited to school-level clearance (0-7)
  - **Platform/System Roles:** Globally unique names
- `Permission` - Granular permissions (274 permissions) with UI metadata
  - **Structured Metadata:** key (name), label (display), description (details)
  - **Fields:** name, label, description, resource, action, context, category
  - **Permission Summary:** 274 permissions across 26 categories (see `packages/database/src/seed.ts` for full list)
- `RolePermission` - Many-to-many: Roles have permissions

### Profile (`profile.prisma`)

- `UserTenant` - User-school relationship (profile)
- `UserTenantRole` - Profile can have multiple roles per school
- `UserTenantPermission` - Profile-specific permissions (override role permissions)

### Tenant (`tenant.prisma`)

- `Tenant` - Schools (basic structure for multi-tenant architecture)

## Adding New Models

When adding new models:

1. **Choose the appropriate file** based on context:
   - User/auth-related → `user-management.prisma`
   - Academic (students, courses, grades) → Create `academic.prisma`
   - Financial (fees, payments) → Create `financial.prisma`
   - Communication (messages, announcements) → Create `communication.prisma`
   - etc.

2. **Maintain relationships** - Models can reference models in other files (Prisma handles this automatically)

3. **Keep related models together** - Group related models in the same file for clarity

## Prisma Multi-File Support

This schema uses Prisma's native multi-file support (available since Prisma 6.7.0+). Prisma automatically discovers all `.prisma` files in the same directory as the main `schema.prisma` file.

### Running Commands

All Prisma commands work from the root `prisma/` directory:

```bash
# Format schema
pnpm format

# Generate client
pnpm db:generate

# Push schema to database
pnpm db:push

# Run migrations
pnpm db:migrate

# Open Prisma Studio
pnpm db:studio
```

All commands will automatically discover all `.prisma` files in the `prisma/` directory.

## Benefits

- **Better Organization**: Related models grouped together
- **Easier Navigation**: Find models by context quickly
- **Reduced Conflicts**: Multiple developers can work on different files
- **Clearer Structure**: Each file has a single responsibility
- **Scalability**: Easy to add new context-based files as the app grows

## 🔗 Model Relationships

### User Management Flow

```
User → UserTenant (Profile) → UserTenantRole → Role
User → PasswordHistory
User → LoginAttempt
User → Session → UserTenant (Profile)
```

### Access Control Flow

```
Role → RolePermission → Permission
UserTenant → UserTenantRole → Role
UserTenant → UserTenantPermission → Permission
Tenant → Role (custom roles only)
Tenant → UserTenant
```

### Audit Trail

```
User → createdBy (User)
User → updatedBy (User)
Role → createdBy (User)
Role → updatedBy (User)
UserTenant → addedBy (User)
```

## ✅ Schema Validation Checklist

### Field Mappings

- ✅ All database columns use snake_case via `@map()`
- ✅ All Prisma fields use camelCase
- ✅ Consistent naming conventions across all models

### Indexes

- ✅ All foreign keys indexed
- ✅ All unique constraints indexed
- ✅ Query optimization indexes in place (email, status, clearance level, etc.)

### Relationships

- ✅ All foreign key relationships properly defined
- ✅ Cascade deletes configured where appropriate
- ✅ Self-referential relationships properly configured
- ✅ Many-to-many relationships properly implemented

### Constraints

- ✅ Unique constraints on appropriate fields
- ✅ Composite unique constraints (name + tenantId for roles)
- ✅ Default values set appropriately
- ✅ Nullable fields properly marked

## 🎯 Key Features Implemented

### Multi-Tenant Architecture

- ✅ Tenant isolation via `tenantId`
- ✅ Profile-based context switching
- ✅ School-specific custom roles
- ✅ Platform/system roles (global)

### Security Features

- ✅ Password history tracking
- ✅ Login attempt monitoring
- ✅ Account lockout mechanism
- ✅ Session management with profile context
- ✅ Profile-level suspension
- ✅ Invitation-based user addition

### Access Control

- ✅ Clearance level hierarchy (0-10)
- ✅ Role-based access control (RBAC)
- ✅ Permission-based access control (PBAC)
- ✅ Profile-specific permission overrides
- ✅ Platform/system/custom role separation

### UI-Ready Metadata

- ✅ Permission labels for display
- ✅ Permission descriptions for tooltips
- ✅ Structured permission metadata (key, label, description)

## 📋 Schema Statistics

**Total Models:** 10

- User Management: 4 models
- Roles & Permissions: 3 models
- Profiles: 3 models
- Tenants: 1 model (basic structure)

**Total Relationships:** 15+

- User → UserTenant (many-to-many)
- UserTenant → Role (many-to-many via UserTenantRole)
- Role → Permission (many-to-many via RolePermission)
- UserTenant → Permission (many-to-many via UserTenantPermission)
- Tenant → Role (one-to-many for custom roles)
- Tenant → UserTenant (one-to-many)

**Total Indexes:** 30+

- Foreign key indexes
- Unique constraint indexes
- Query optimization indexes

## 🔄 Next Steps

### Schema Migration

When ready to apply these schemas:

1. Run `prisma migrate dev` to create migration
2. Review generated migration SQL
3. Test migration on development database
4. Apply to production database

### Seed Data

Consider creating seed data for:

- System roles (Architect, SuperAdmin, Owner, Management, etc.)
- Permission definitions (300+ permissions with labels and descriptions)
- Permission pools per clearance level (for custom role validation)
  - See `_actions/role-permissions-management.md` for permission pool inheritance approach
- Permission pool assignments (assign permissions to pools by clearance level)

### Future Context-Based Files

As the application grows, you can add more context-based files:

- `academic.prisma` - Students, courses, grades, assessments
- `financial.prisma` - Fees, payments, billing, invoices
- `communication.prisma` - Messages, announcements, notifications
- `attendance.prisma` - Attendance tracking
- `library.prisma` - Library management
- `transportation.prisma` - Bus routes, vehicles, drivers
- `cafeteria.prisma` - Meal planning, orders, inventory
- `health.prisma` - Health records, medications, immunizations
- `facilities.prisma` - Room management, maintenance, reservations
- `events.prisma` - School events, activities, registrations
- `sports.prisma` - Athletics, teams, schedules
- `clubs.prisma` - Clubs and extracurricular activities
- `reports.prisma` - Reporting and analytics
- `audit.prisma` - Audit logs and compliance
- `mfa.prisma` - Multi-factor authentication models
- `security-policy.prisma` - Security policy models
- `jwt-secrets.prisma` - JWT secret management models

## Tenant isolation (Row-Level Security) — REQUIRED for new tables

Tenant data isolation is enforced at the database via Postgres RLS (see
`ARCHITECTURE_DECISIONS.md` ADR-004 and `docs/tenant-isolation-plan.md`).

**Any new table with a `tenant_id`/`school_id` column MUST have RLS + a
`tenant_isolation` policy.** This is enforced in CI:

```bash
pnpm --filter @workspace/database db:rls:check    # fails if a tenant table lacks RLS
pnpm --filter @workspace/database db:rls:enforce  # apply strict policy to any missing
```

When adding a tenant-scoped model, follow the checklist in
`docs/tenant-isolation-plan.md` (add `tenantId` + indexes, call
`enforce_tenant_rls()` in the migration, backfill, add the model to
`STRICT_TENANT_MODELS`). `ALTER DEFAULT PRIVILEGES` already auto-grants new
tables to the runtime `app_runtime` role.
