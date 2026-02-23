# Creating a Test User You Can Log In With

The seed script creates sample users without passwords, so they can't be used for login. You need to create a user with a hashed password to test the authentication flow.

## Option A: Insert via Prisma Studio

1. Start Prisma Studio:

```bash
pnpm db:studio
```

2. Open the `User` table
3. Add a new record with these values:

| Field          | Value                                         |
| -------------- | --------------------------------------------- |
| email          | `admin@test.com`                               |
| firstName      | `Test`                                         |
| lastName       | `Admin`                                        |
| isActive       | `true`                                         |
| isVerified     | `true`                                         |
| passwordHash   | (see below — you need a bcrypt hash)           |

### Generate a Password Hash

The API uses bcrypt with 12 salt rounds. Generate a hash for your desired password using Node.js:

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('TestPassword123', 12).then(h => console.log(h));"
```

If `bcrypt` isn't available globally, run it from the API project:

```bash
cd apps/api
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('TestPassword123', 12).then(h => console.log(h));"
```

Copy the output (starts with `$2b$12$...`) and paste it into the `passwordHash` field.

## Option B: Insert via SQL

Connect to your PostgreSQL database and run:

```sql
-- First, generate a bcrypt hash (you can use the Node.js command above)
-- Example hash for "TestPassword123":

INSERT INTO "User" (id, email, "passwordHash", "firstName", "lastName", "isActive", "isVerified", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@test.com',
  '<paste-your-bcrypt-hash-here>',
  'Test',
  'Admin',
  true,
  true,
  NOW(),
  NOW()
);
```

## Option C: Write a Quick Script

Create a temporary script file (don't commit it) at `packages/database/prisma/scripts/create-test-user.ts`:

```typescript
import { prisma } from '../../src/client.js';
import bcrypt from 'bcrypt';

async function createTestUser() {
  const passwordHash = await bcrypt.hash('TestPassword123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: { passwordHash },
    create: {
      email: 'admin@test.com',
      passwordHash,
      firstName: 'Test',
      lastName: 'Admin',
      isActive: true,
      isVerified: true,
    },
  });

  console.log('Created user:', user.id, user.email);

  // Now assign the user to the sample-school tenant with an Owner role
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'sample-school' },
  });

  if (!tenant) {
    console.error('sample-school tenant not found. Run db:seed first.');
    process.exit(1);
  }

  const ownerRole = await prisma.role.findFirst({
    where: { name: 'Owner', isSystemRole: true },
  });

  if (!ownerRole) {
    console.error('Owner role not found. Run db:seed first.');
    process.exit(1);
  }

  const profile = await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenant.id,
      },
    },
    update: { status: 'active' },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      status: 'active',
      suspended: false,
    },
  });

  await prisma.userTenantRole.upsert({
    where: {
      userTenantId_roleId: {
        userTenantId: profile.id,
        roleId: ownerRole.id,
      },
    },
    update: {},
    create: {
      userTenantId: profile.id,
      roleId: ownerRole.id,
      isPrimary: true,
    },
  });

  console.log('Assigned to tenant:', tenant.slug, '(profile:', profile.id, ')');
  console.log('Role: Owner (clearance level 8)');
  console.log('\nYou can now log in with:');
  console.log('  Email: admin@test.com');
  console.log('  Password: TestPassword123');

  await prisma.$disconnect();
}

createTestUser().catch(console.error);
```

Run it:

```bash
cd packages/database
npx tsx prisma/scripts/create-test-user.ts
```

## What You'll Have After This

| Property      | Value                           |
| ------------- | ------------------------------- |
| Email         | `admin@test.com`                |
| Password      | `TestPassword123`               |
| Tenant        | `sample-school`                 |
| Role          | Owner (clearance level 8)       |

This user can:
- Log in via `POST /auth/login`
- Select the `sample-school` tenant via `POST /auth/select-school`
- Register new tenants (clearance 8+)
- Manage users within the tenant (clearance 7+)
- Access most school-level endpoints

For platform-level operations (clearance 9-10), you'll need to create a user with the `SuperAdmin` or `Architect` role. Follow the same script but replace `Owner` with `SuperAdmin` or `Architect`.
