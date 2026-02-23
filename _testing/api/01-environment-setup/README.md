# 1. Environment Setup

Before you can test the API, you need three things configured: dependencies installed, environment variables set, and a PostgreSQL database ready.

## 1.1 Install Dependencies

From the **repository root**:

```bash
pnpm install
```

This installs all workspace dependencies across `apps/` and `packages/`.

## 1.2 Configure the Database Package

The database package needs its own `.env` file for Prisma to connect to PostgreSQL.

**File:** `packages/database/.env`

```env
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/schoolsys"
```

Replace `<user>` and `<password>` with your PostgreSQL credentials. The database name (`schoolsys`) can be whatever you choose — just be consistent across files.

### Create the Database

If the database doesn't exist yet, create it in PostgreSQL:

```bash
psql -U <user> -c "CREATE DATABASE schoolsys;"
```

## 1.3 Configure the API

Copy the environment template and customize it.

```bash
cp apps/api/env.template apps/api/.env
```

**File:** `apps/api/.env` — key values to set:

```env
# Must match the packages/database/.env connection string
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/schoolsys

NODE_ENV=development
PORT=3000

# Generate real values with: openssl rand -base64 32
# Quote values if they contain "=" (base64 padding)
JWT_SECRET="your-fallback-jwt-secret-change-in-production"
ENCRYPTION_KEY="your-encryption-key-change-in-production"

# For local dev, use console providers (no external services needed)
SMS_PROVIDER=console
EMAIL_PROVIDER=console
AUDIT_LOG_DESTINATION=database
MONITORING_PROVIDER=none
```

The `console` providers print MFA codes and emails to the API server stdout, so you can see them during testing without configuring Twilio, SendGrid, etc.

## 1.4 Run Database Migrations

Generate the Prisma client and apply all migrations:

```bash
# From the repository root
pnpm db:generate
pnpm db:migrate
```

Or from the database package directly:

```bash
cd packages/database
pnpm run db:generate
pnpm run db:migrate
```

This creates all the tables in your PostgreSQL database.

## 1.5 Start the API Server

```bash
# From the repository root (starts both API and web with Turborepo)
pnpm dev

# Or start only the API
cd apps/api && pnpm run dev
```

The API will be available at:

- **Base URL:** `http://localhost:3000`
- **Health check:** `GET http://localhost:3000/` (returns "Hello World!")
- **Swagger UI:** `http://localhost:3000/api/docs`

### Verify It's Running

```bash
curl http://localhost:3000/
```

Expected response: `Hello World!`

## 1.6 Explore the Database (Optional)

Prisma Studio provides a GUI for browsing your database:

```bash
pnpm db:studio
```

This opens a browser at `http://localhost:5555` where you can inspect all tables and records.

## What's Next

Your database is empty (no roles, permissions, or users). Proceed to [Seeding the Platform](../02-seeding/README.md) to populate the foundational data.
