# Database Migration Workflow

## Overview

This document outlines the migration workflow for the database schema using Prisma Migrate. The migration system is fully configured and ready for use.

## Migration System Setup

### Configuration

- ✅ **Migration Lock File**: `migrations/migration_lock.toml` - Ensures single provider (PostgreSQL)
- ✅ **Migration Scripts**: Configured in `package.json`
- ✅ **Prisma Config**: `prisma.config.ts` - Centralized configuration

### Migration Scripts

Available scripts in `package.json`:

```json
{
  "db:migrate": "prisma migrate dev --skip-generate",
  "db:deploy": "prisma migrate deploy",
  "db:generate": "prisma generate",
  "db:push": "prisma db push"
}
```

## Migration Workflow

### 1. Development Workflow

#### Creating a New Migration

When you modify the schema (add/remove models, fields, indexes, etc.):

```bash
# Navigate to database package
cd packages/database

# Create a new migration
npm run db:migrate -- --name your_migration_name

# Or with pnpm (if using pnpm workspace)
pnpm --filter @workspace/database db:migrate --name your_migration_name
```

**What happens:**

1. Prisma detects schema changes
2. Creates a new migration file in `prisma/migrations/YYYYMMDDHHMMSS_migration_name/`
3. Generates SQL migration file (`migration.sql`)
4. Applies migration to development database
5. Updates `_prisma_migrations` table

**Note**: `--skip-generate` flag is used because we have a separate `prebuild`/`predev` step that runs `db:generate`

#### Reviewing Migration SQL

Always review the generated migration SQL before applying:

```bash
# View the latest migration SQL
cat prisma/migrations/[latest_migration]/migration.sql
```

**Check for:**

- ✅ Correct table/column changes
- ✅ Index creation statements
- ✅ Foreign key constraints
- ✅ Data migration logic (if needed)
- ❌ No unintended data loss

#### Regenerating Prisma Client

After creating a migration, regenerate the Prisma client:

```bash
npm run db:generate
```

Or it will run automatically via `prebuild`/`predev` hooks.

### 2. Production Workflow

#### Deploying Migrations

For production deployments:

```bash
# Deploy migrations (does not regenerate client)
npm run db:deploy
```

**What happens:**

1. Prisma reads migration history
2. Applies only pending migrations
3. Does NOT regenerate Prisma client (run separately if needed)
4. Safe for production (no prompts, no schema changes)

**Best Practice**: Run migrations as part of your deployment pipeline before starting the application.

#### Migration Status

Check migration status:

```bash
# Check migration status
npx prisma migrate status
```

Shows:

- ✅ Applied migrations
- ⏳ Pending migrations
- ⚠️ Migration drift (if database schema differs from migrations)

### 3. Schema Push (Development Only)

For rapid prototyping during development:

```bash
# Push schema changes directly (no migration file)
npm run db:push
```

**⚠️ Warning**:

- Use only in development
- Does not create migration files
- Cannot be used in production
- Use `db:migrate` for tracked migrations

## Migration Best Practices

### 1. Naming Conventions

Use descriptive migration names:

```bash
# Good examples
db:migrate --name add_student_management
db:migrate --name add_audit_logging
db:migrate --name update_indexes_constraints

# Bad examples
db:migrate --name migration1
db:migrate --name update
db:migrate --name fix
```

### 2. Schema Changes

#### Adding Models

```prisma
// Add new model
model NewModel {
  id String @id @default(uuid())
  // ... fields
}
```

Run: `npm run db:migrate -- --name add_new_model`

#### Adding Fields

```prisma
// Add field to existing model
model ExistingModel {
  // ... existing fields
  newField String? // New field
}
```

Run: `npm run db:migrate -- --name add_new_field_to_existing_model`

#### Modifying Fields

```prisma
// Modify field type or constraints
model ExistingModel {
  // Change from nullable to required
  existingField String // Was: String?
}
```

**⚠️ Warning**: Changing field types can cause data loss. Review migration SQL carefully.

#### Removing Fields/Models

**⚠️ Warning**: Removing fields or models will cause data loss. Always:

1. Backup data first
2. Review migration SQL carefully
3. Consider data migration if needed

### 3. Data Migrations

For complex data transformations:

1. Create migration with schema changes
2. Edit migration SQL to add data migration logic
3. Test thoroughly in development

Example:

```sql
-- Migration: prisma/migrations/YYYYMMDDHHMMSS_migration_name/migration.sql

-- Schema changes
ALTER TABLE "users" ADD COLUMN "new_field" TEXT;

-- Data migration
UPDATE "users" SET "new_field" = "old_field" WHERE "old_field" IS NOT NULL;

-- Cleanup (optional)
-- ALTER TABLE "users" DROP COLUMN "old_field";
```

### 4. Index Management

Indexes are defined in Prisma schema:

```prisma
model Example {
  // ... fields

  @@index([field1, field2]) // Composite index
  @@index([field3])         // Single field index
}
```

Indexes are automatically created during migration. No manual SQL needed.

### 5. Rollback Strategy

Prisma Migrate does not support automatic rollbacks. To rollback:

1. **Development**: Create a new migration that reverses changes
2. **Production**:
   - Create a new migration with reverse changes
   - Test thoroughly
   - Deploy with `db:deploy`

**Best Practice**: Always test migrations in development/staging before production.

## Migration File Structure

```
prisma/
├── migrations/
│   ├── 20251105113331_init_schema/
│   │   └── migration.sql
│   ├── 20251105115956_init_schema_with_models/
│   │   └── migration.sql
│   └── migration_lock.toml
├── models/
│   ├── user-management.prisma
│   ├── roles-permissions.prisma
│   ├── profile.prisma
│   ├── tenant.prisma
│   ├── academic-structure.prisma
│   ├── student-management.prisma
│   ├── assessment-grading.prisma
│   ├── communication.prisma
│   └── audit-logging.prisma
└── schema.prisma
```

## Common Workflows

### Initial Schema Setup

```bash
# 1. Create initial migration
npm run db:migrate -- --name init_complete_schema

# 2. Generate Prisma client
npm run db:generate

# 3. Seed database (optional)
npm run db:seed
```

### Adding New Features

```bash
# 1. Modify schema files in prisma/models/
# 2. Create migration
npm run db:migrate -- --name add_feature_name

# 3. Review migration SQL
cat prisma/migrations/[latest]/migration.sql

# 4. Generate Prisma client
npm run db:generate

# 5. Test changes
npm run dev
```

### Production Deployment

```bash
# 1. Build and deploy code
# 2. Run migrations (before starting app)
npm run db:deploy

# 3. Generate Prisma client (if needed)
npm run db:generate

# 4. Start application
```

## Troubleshooting

### Migration Conflicts

If migrations conflict:

```bash
# Check migration status
npx prisma migrate status

# Resolve conflicts manually
# Edit migration files or create new migration
```

### Schema Drift

If database schema differs from migrations:

```bash
# Check drift
npx prisma migrate status

# Reset development database (⚠️ data loss)
npx prisma migrate reset

# Or create migration to sync
npx prisma migrate dev --name sync_schema
```

### Failed Migrations

If migration fails:

1. Check error message
2. Review migration SQL
3. Fix issues manually if needed
4. Mark migration as applied (if safe): `npx prisma migrate resolve --applied [migration_name]`
5. Or create new migration to fix issues

## Environment-Specific Considerations

### Development

- Use `db:migrate` for tracked migrations
- Use `db:push` for rapid prototyping
- Can reset database with `npx prisma migrate reset`

### Staging

- Use `db:deploy` for safe migrations
- Test migrations before production
- Monitor migration execution

### Production

- **Always** use `db:deploy`
- **Never** use `db:push` or `db:migrate`
- Test migrations in staging first
- Backup database before migrations
- Run migrations during maintenance window for large changes

## Summary

✅ **Migration system configured** and ready
✅ **Development workflow** documented
✅ **Production workflow** documented
✅ **Best practices** established
✅ **Troubleshooting guide** provided

The migration system is production-ready and follows Prisma best practices.
