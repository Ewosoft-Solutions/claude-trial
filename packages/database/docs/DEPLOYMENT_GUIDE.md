# Database Deployment Guide

This guide covers the complete process of deploying and seeding the database for the School Management System.

## Prerequisites

1. **PostgreSQL Database** (version 12 or higher)
   - Local installation, or
   - Cloud provider (AWS RDS, Google Cloud SQL, Azure Database, etc.)

2. **Node.js and pnpm** installed

3. **Environment Variables** configured

## Step 1: Environment Configuration

### Required Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database Configuration (REQUIRED)
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]

# Example for local PostgreSQL:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/school_db

# Application Configuration
NODE_ENV=development
PORT=3000

# Security Configuration
JWT_SECRET=your-fallback-jwt-secret-change-in-production
ENCRYPTION_KEY=your-encryption-key-change-in-production

# WebAuthn Configuration
WEBAUTHN_RP_NAME=School Management System
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:3000

# Database Connection Pool (Optional)
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT=5000
DB_QUERY_TIMEOUT=30000

# Database Logging (Optional)
DB_LOG_QUERIES=false
DB_LOG_ERRORS=true
DB_LOG_WARNINGS=true
```

### Generating Encryption Key

Generate a secure 32-byte encryption key:

```bash
openssl rand -base64 32
```

### Database Connection String Format

```
postgresql://[username]:[password]@[host]:[port]/[database]?[parameters]
```

**Parameters:**

- `schema=public` - Database schema (default: public)
- `sslmode=require` - SSL mode for production
- `connection_limit=10` - Connection pool size
- `pool_timeout=20` - Pool timeout in seconds

**Example for production:**

```
DATABASE_URL=postgresql://user:pass@dbService.example.com:5432/school_db?sslmode=require&connection_limit=20
```

## Step 2: Verify Database Connection

Test the database connection:

```bash
cd packages/database
npx prisma db pull
```

If successful, you should see the database schema being introspected.

## Step 3: Check Migration Status

Check current migration status:

```bash
cd packages/database
npx prisma migrate status
```

This will show:

- ✅ Applied migrations
- ⏳ Pending migrations
- ⚠️ Migration drift (if database schema differs from migrations)

## Step 4: Apply Migrations

### Development Environment

Apply migrations to development database:

```bash
cd packages/database
npm run db:migrate
```

This will:

1. Detect any schema changes
2. Create new migration files if needed
3. Apply migrations to the database
4. Update the `_prisma_migrations` table

### Production Environment

For production, use `db:deploy` (does not modify schema, only applies pending migrations):

```bash
cd packages/database
npm run db:deploy
```

**Important:** Always backup your database before running migrations in production!

## Step 5: Review Migration SQL

Before applying migrations, review the generated SQL:

```bash
# View the latest migration
cat packages/database/prisma/migrations/[latest_migration]/migration.sql
```

**Check for:**

- ✅ Correct table/column changes
- ✅ Index creation statements
- ✅ Foreign key constraints
- ✅ No unintended data loss
- ✅ Proper data types and constraints

## Step 6: Generate Prisma Client

After migrations are applied, generate the Prisma client:

```bash
cd packages/database
npm run db:generate
```

This is automatically run via `prebuild`/`predev` hooks, but can be run manually if needed.

## Step 7: Seed Database

Run the seed script to populate initial data:

```bash
cd packages/database
npm run db:seed
```

**What gets seeded:**

- ✅ System roles (Architect, SuperAdmin, Owner, Management, etc.)
- ✅ Permission pools for each clearance level (0-10)
- ✅ 274 permissions across 26 categories
- ✅ Permission-to-pool assignments
- ✅ Role-to-pool assignments

**Seed script is idempotent:** Running it multiple times will update existing data rather than creating duplicates.

## Step 8: Verify Seed Data

Verify that seed data was created correctly:

### Using Prisma Studio

```bash
cd packages/database
npm run db:studio
```

Navigate to:

- `Role` table - Should have 11 system roles
- `Permission` table - Should have 274 permissions
- `PermissionPool` table - Should have 11 pools (one per clearance level)
- `PermissionPoolPermission` table - Should have permission-pool assignments
- `RolePermissionPool` table - Should have role-pool assignments

### Using SQL Query

```sql
-- Check system roles
SELECT name, "roleType", "clearanceLevel", "isSystemRole"
FROM roles
WHERE "isSystemRole" = true
ORDER BY "clearanceLevel" DESC;

-- Check permission count
SELECT COUNT(*) as total_permissions FROM permissions;

-- Check permission pools
SELECT name, "clearanceLevel"
FROM permission_pools
ORDER BY "clearanceLevel" DESC;

-- Check permission pool assignments
SELECT
  pp.name as pool_name,
  COUNT(ppp.permission_id) as permission_count
FROM permission_pools pp
LEFT JOIN permission_pool_permissions ppp ON pp.id = ppp.pool_id
GROUP BY pp.id, pp.name
ORDER BY pp."clearanceLevel" DESC;
```

## Step 9: Test Database Connection

Test the database connection and query performance:

```bash
# Test connection via Prisma
cd packages/database
node -e "const { prisma } = require('./src/client.ts'); prisma.\$connect().then(() => console.log('✅ Connected')).catch(e => console.error('❌ Error:', e));"
```

## Step 10: Set Up Database Backups

### Manual Backup

```bash
# PostgreSQL dump
pg_dump -h localhost -U postgres -d school_db -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Restore from backup
pg_restore -h localhost -U postgres -d school_db backup_file.dump
```

### Automated Backups

Set up automated backups using:

- **pg_dump** with cron jobs
- **AWS RDS automated backups**
- **Google Cloud SQL automated backups**
- **Azure Database automated backups**
- Third-party backup tools (pgBackRest, Barman, etc.)

### Backup Schedule Recommendations

- **Development:** Daily backups, retain 7 days
- **Staging:** Daily backups, retain 30 days
- **Production:**
  - Full backup: Daily
  - Incremental backup: Every 6 hours
  - Retain: 90 days minimum

## Troubleshooting

### Migration Errors

**Error: "Migration failed"**

- Check database connection
- Review migration SQL for errors
- Check database user permissions
- Verify database version compatibility

**Error: "Schema drift detected"**

- Run `npx prisma migrate status` to see differences
- Create a new migration to sync: `npm run db:migrate -- --name sync_schema`
- Or reset development database: `npx prisma migrate reset` (⚠️ data loss)

### Seed Errors

**Error: "Seed script fails"**

- Ensure migrations are applied first
- Check database connection
- Review seed script logs for specific errors
- Verify Prisma client is generated

**Error: "Duplicate key violation"**

- Seed script is idempotent, but if errors occur:
  - Check for partial seed data
  - Review unique constraints in schema
  - Re-run seed script (it handles updates)

### Connection Issues

**Error: "Connection refused"**

- Verify PostgreSQL is running
- Check host, port, and credentials
- Verify firewall rules
- Check SSL requirements for production

**Error: "Authentication failed"**

- Verify username and password
- Check PostgreSQL user permissions
- Verify database exists

## Production Deployment Checklist

Before deploying to production:

- [ ] Database backups configured
- [ ] Environment variables set securely (use secrets management)
- [ ] SSL/TLS enabled for database connections
- [ ] Connection pooling configured appropriately
- [ ] Migration rollback plan documented
- [ ] Seed data verified in staging environment
- [ ] Database monitoring and alerting set up
- [ ] Performance testing completed
- [ ] Disaster recovery plan documented

## Next Steps

After successful deployment:

1. **Verify API connectivity** - Test API endpoints with database
2. **Set up monitoring** - Configure database monitoring and alerts
3. **Performance tuning** - Optimize queries and indexes based on usage
4. **Documentation** - Update API documentation with database schema
5. **Security audit** - Review database security settings and access controls

## Additional Resources

- [Prisma Migration Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Migration Workflow](./prisma/MIGRATION_WORKFLOW.md)
- [Seed Data Implementation](../_actions/SEED_DATA_IMPLEMENTATION.md)
