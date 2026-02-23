# 4. Tenant Management

Tenants represent schools in the platform. This section covers registering new schools, managing users within a school, and configuring tenant settings.

**Prerequisite:** You must be authenticated with a JWT access token. See [Authentication](../03-authentication/README.md).

**Clearance requirements:**
- Registering tenants: Clearance 8+ (Owner)
- Managing users: Clearance 7+ (Management)
- Listing all tenants: Clearance 9+ (SuperAdmin)
- Changing tenant status: Clearance 9+ (SuperAdmin)

## 4.1 Register a New School

Create a new tenant (school) on the platform.

```bash
curl -X POST http://localhost:3000/tenant/register \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Greenfield Academy",
    "slug": "greenfield-academy",
    "emailDomain": "greenfield.edu",
    "settings": {}
  }'
```

**Response:**

```json
{
  "id": "<new-tenant-uuid>",
  "name": "Greenfield Academy",
  "slug": "greenfield-academy",
  "status": "active",
  "emailDomain": "greenfield.edu",
  "settings": {},
  "createdAt": "..."
}
```

The `slug` must be unique, lowercase, and contain only letters, numbers, and hyphens. If omitted, one is generated from the name.

**Save the tenant `id`** — you'll need it for all subsequent tenant operations.

## 4.2 List All Tenants

Requires clearance 9+ (SuperAdmin/Architect).

```bash
curl "http://localhost:3000/tenant?page=1&limit=20" \
  -H "Authorization: Bearer <accessToken>"
```

Supports query parameters:
- `status` — filter by tenant status
- `search` — search by name
- `page` / `limit` — pagination

## 4.3 Get Tenant Details

```bash
curl http://localhost:3000/tenant/<tenantId> \
  -H "Authorization: Bearer <accessToken>"
```

## 4.4 Update a Tenant

Requires clearance 8+ (Owner).

```bash
curl -X PUT http://localhost:3000/tenant/<tenantId> \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Greenfield Academy International",
    "emailDomain": "greenfield-intl.edu"
  }'
```

## 4.5 Change Tenant Status

Requires clearance 9+ (SuperAdmin). Used for activating, suspending, or deactivating schools.

```bash
curl -X PATCH http://localhost:3000/tenant/<tenantId>/status \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "suspended",
    "reason": "Non-payment of platform fees"
  }'
```

## 4.6 Tenant Configuration

### Get Configuration

```bash
curl http://localhost:3000/tenant/<tenantId>/configuration \
  -H "Authorization: Bearer <accessToken>"
```

### Update Configuration

```bash
curl -X PUT http://localhost:3000/tenant/<tenantId>/configuration \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "schoolType": "high_school",
      "timezone": "America/New_York",
      "gradingSystem": "letter"
    }
  }'
```

## 4.7 Create Users in a Tenant

There are three ways to add users to a school: direct creation, invitation, and adding existing users.

### Direct User Creation

Requires clearance 7+ (Management). Creates a user account and assigns them to the tenant with specified roles.

First, get the role IDs you want to assign. Use the roles endpoint to find them:

```bash
# List available roles
curl http://localhost:3000/roles \
  -H "Authorization: Bearer <accessToken>"
```

Then create the user:

```bash
curl -X POST http://localhost:3000/tenant/<tenantId>/users \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@greenfield.edu",
    "password": "SecurePassword123",
    "firstName": "Jane",
    "lastName": "Smith",
    "roleIds": ["<teacher-role-uuid>"]
  }'
```

### Bulk User Creation

Create multiple users at once:

```bash
curl -X POST http://localhost:3000/tenant/<tenantId>/users/bulk \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "users": [
      {
        "email": "teacher1@greenfield.edu",
        "password": "SecurePassword123",
        "firstName": "Alice",
        "lastName": "Johnson",
        "roleIds": ["<teacher-role-uuid>"]
      },
      {
        "email": "teacher2@greenfield.edu",
        "password": "SecurePassword123",
        "firstName": "Bob",
        "lastName": "Williams",
        "roleIds": ["<teacher-role-uuid>"]
      }
    ]
  }'
```

### Invite a User

Send an invitation that the user accepts to create their account:

```bash
curl -X POST http://localhost:3000/tenant/<tenantId>/invitations \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newteacher@greenfield.edu",
    "firstName": "Carol",
    "lastName": "Davis",
    "roleId": "<teacher-role-uuid>",
    "expirationHours": 168
  }'
```

The response includes an invitation token. With `EMAIL_PROVIDER=console`, the invitation email (and token) is printed to the API server stdout.

### Accept an Invitation

This is a public endpoint (no auth required):

```bash
curl -X POST http://localhost:3000/tenant/invitations/accept \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<invitation-token>",
    "password": "NewUserPassword123",
    "firstName": "Carol",
    "lastName": "Davis"
  }'
```

### Add an Existing User to a Tenant

If a user already exists (e.g., from another school), add them to this tenant:

```bash
curl -X POST http://localhost:3000/tenant/<tenantId>/users/add \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<existing-user-uuid>",
    "roleIds": ["<teacher-role-uuid>"]
  }'
```

## 4.8 Manage Users in a Tenant

### List User Profiles

```bash
curl "http://localhost:3000/tenant/<tenantId>/users?page=1&limit=20" \
  -H "Authorization: Bearer <accessToken>"
```

Supports `status`, `search`, `page`, `limit` query parameters.

### Get a User Profile

```bash
curl http://localhost:3000/tenant/<tenantId>/users/<profileId> \
  -H "Authorization: Bearer <accessToken>"
```

### Update a User

```bash
curl -X PUT http://localhost:3000/tenant/users/<userId> \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith-Johnson"
  }'
```

### Update a User's Tenant Profile (Roles/Status)

```bash
curl -X PUT http://localhost:3000/tenant/<tenantId>/users/<profileId> \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active",
    "roleIds": ["<teacher-role-uuid>", "<management-role-uuid>"]
  }'
```

### Remove a User from a Tenant

```bash
curl -X DELETE http://localhost:3000/tenant/<tenantId>/users/<profileId> \
  -H "Authorization: Bearer <accessToken>"
```

## 4.9 Typical Testing Workflow

Here's a complete scenario you can follow to test tenant management end to end:

1. **Log in** as your Owner-level test user (see [Authentication](../03-authentication/README.md))
2. **Register a new tenant:** `POST /tenant/register`
3. **Get the new tenant's details:** `GET /tenant/<id>`
4. **Configure the tenant:** `PUT /tenant/<id>/configuration`
5. **List roles** to get role UUIDs: `GET /roles`
6. **Create a teacher user** in the tenant: `POST /tenant/<id>/users`
7. **Create a student user** in the tenant: `POST /tenant/<id>/users`
8. **List users** in the tenant: `GET /tenant/<id>/users`
9. **Log out**, then **log in** as the newly created teacher to verify their access
10. **Select the new school** to get a tenant-scoped token

## What's Next

With a school and users set up, you can start testing academic features. Proceed to [Academic Management](../05-academic-management/README.md) to work with students, classes, courses, and grades.
