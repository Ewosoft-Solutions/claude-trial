# Creating Additional Test Users

The seed script already creates a loginable **Platform Architect** account (`architect@schoolwithease.com` / `Architect@2025!`). This document covers creating additional users for testing different roles and scenarios.

## The Recommended Way: Use the API

Once you can log in as the Architect, the easiest way to create additional users is through the API itself:

```bash
# 1. Log in as the Architect (see Authentication guide)
# 2. Select the target tenant
# 3. Create a user with a specific role:

curl -X POST http://localhost:3000/tenant/<tenantId>/users \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@example.com",
    "password": "SecurePassword123",
    "firstName": "Jane",
    "lastName": "Smith",
    "roleIds": ["<teacher-role-uuid>"]
  }'
```

Get the role UUIDs by listing roles first:

```bash
curl http://localhost:3000/roles \
  -H "Authorization: Bearer <accessToken>"
```

## Alternative: Direct Database Insert

If you need users before the API is running, or want to create users for specific test scenarios.

### Option A: Quick Script

Create a temporary script at `packages/database/prisma/scripts/create-test-user.ts`:

```typescript
import { prisma } from '../../src/client.js';
import bcrypt from 'bcrypt';

async function createTestUser() {
  const passwordHash = await bcrypt.hash('TestPassword123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'owner@test.com' },
    update: { passwordHash },
    create: {
      email: 'owner@test.com',
      passwordHash,
      firstName: 'Test',
      lastName: 'Owner',
      isActive: true,
      isVerified: true,
    },
  });

  console.log('Created user:', user.id, user.email);

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

  const existingProfile = await prisma.userTenant.findFirst({
    where: { userId: user.id, tenantId: tenant.id },
  });

  const profile =
    existingProfile ??
    (await prisma.userTenant.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        status: 'active',
        suspended: false,
      },
    }));

  await prisma.userTenantRole.upsert({
    where: { userTenantId: profile.id },
    update: {},
    create: {
      userTenantId: profile.id,
      roleId: ownerRole.id,
      isPrimary: true,
    },
  });

  console.log('Assigned to tenant:', tenant.slug, '(profile:', profile.id, ')');
  console.log('Role: Owner (clearance level 8)');
  console.log('\nCredentials:');
  console.log('  Email: owner@test.com');
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

### Option B: Prisma Studio

1. `pnpm db:studio` — opens at `http://localhost:5555`
2. Create a `User` record with a bcrypt-hashed password
3. Create a `UserTenant` record linking the user to a tenant
4. Create a `UserTenantRole` record assigning a role

Generate a password hash:

```bash
cd apps/api
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('TestPassword123', 12).then(h => console.log(h));"
```

## Typical Test User Matrix

For thorough testing, create users at different clearance levels in the same tenant:

| Email                       | Role       | Clearance | Purpose                          |
| --------------------------- | ---------- | --------- | -------------------------------- |
| `architect@schoolwithease.com` | Architect | 10        | Platform bootstrap (from seed)   |
| `owner@test.com`            | Owner      | 8         | School-level admin testing       |
| `manager@test.com`          | Management | 7         | User/staff management testing    |
| `teacher@test.com`          | Teacher    | 3         | Academic workflow testing         |
| `parent@test.com`           | Parent     | 2         | Parent portal testing             |
| `student@test.com`          | Student    | 1         | Student view testing              |

Use the Architect account to create all of these via `POST /tenant/<id>/users`.
