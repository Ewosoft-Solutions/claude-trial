# 3. Authentication

The API uses a multi-step authentication flow designed for multi-tenancy. A user can belong to multiple schools, so login is separated from school selection.

**Prerequisite:** You must have a user with a password in the database. If you haven't created one yet, see [Creating a Test User](../02-seeding/creating-a-test-user.md).

## 3.1 The Authentication Flow

```
┌─────────────────────────────────────────────────────┐
│ 1. POST /auth/login                                 │
│    Body: { email, password }                        │
│    Returns: { user, schools[], token }              │
│    (If MFA is required, returns mfaRequired: true)  │
└──────────────────┬──────────────────────────────────┘
                   │
          ┌────────┴─────────┐
          │ MFA Required?    │
          └────┬────────┬────┘
               │ No     │ Yes
               │        ▼
               │  ┌─────────────────────────────────┐
               │  │ 2. POST /auth/verify-mfa-login  │
               │  │    Body: { challengeId, code }   │
               │  │    Returns: { schools[] }        │
               │  └─────────────┬───────────────────┘
               │                │
               ▼                ▼
┌─────────────────────────────────────────────────────┐
│ 3. POST /auth/select-school                         │
│    Header: Authorization: Bearer <login-token>      │
│    Body: { tenantId, profileId }                    │
│    Returns: { accessToken, refreshToken }           │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ 4. Use accessToken on all subsequent requests       │
│    Header: Authorization: Bearer <accessToken>      │
└─────────────────────────────────────────────────────┘
```

## 3.2 Step-by-Step with curl

### Step 1: Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "TestPassword123"
  }'
```

**Expected response (no MFA):**

```json
{
  "success": true,
  "user": {
    "id": "<user-uuid>",
    "email": "admin@test.com",
    "firstName": "Test",
    "lastName": "Admin"
  },
  "schools": [
    {
      "tenantId": "<tenant-uuid>",
      "tenantName": "Sample School",
      "profileId": "<profile-uuid>",
      "roles": ["Owner"]
    }
  ],
  "token": "<pre-auth-token>"
}
```

**Save these values** — you'll need `tenantId`, `profileId`, and `token` for the next step.

### Step 2: Select School

Use the `token` from the login response and pick a school from the `schools` array:

```bash
curl -X POST http://localhost:3000/auth/select-school \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <pre-auth-token>" \
  -d '{
    "tenantId": "<tenant-uuid>",
    "profileId": "<profile-uuid>"
  }'
```

**Expected response:**

```json
{
  "success": true,
  "accessToken": "<jwt-access-token>",
  "refreshToken": "<jwt-refresh-token>",
  "expiresIn": 3600,
  "tenantContext": {
    "tenantId": "<tenant-uuid>",
    "tenantName": "Sample School"
  }
}
```

The `accessToken` is your working token. Use it in the `Authorization` header for all subsequent requests.

### Step 3: Make Authenticated Requests

```bash
# Example: List roles in the current tenant
curl http://localhost:3000/roles \
  -H "Authorization: Bearer <accessToken>"

# Example: List permissions
curl http://localhost:3000/permissions \
  -H "Authorization: Bearer <accessToken>"
```

## 3.3 Refreshing Tokens

When the access token expires, use the refresh token to get a new one:

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<jwt-refresh-token>"
  }'
```

**Response:**

```json
{
  "success": true,
  "accessToken": "<new-access-token>",
  "refreshToken": "<new-refresh-token>",
  "expiresIn": 3600
}
```

## 3.4 Password Reset Flow

If you need to reset a password:

```bash
# Request a reset (sends code via configured EMAIL_PROVIDER)
curl -X POST http://localhost:3000/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{ "email": "admin@test.com" }'

# With EMAIL_PROVIDER=console, check the API server stdout for the reset token

# Apply the reset
curl -X POST http://localhost:3000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<reset-token-from-console>",
    "newPassword": "NewPassword456"
  }'
```

## 3.5 Logout

```bash
# Logout current session
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <accessToken>"

# Logout all sessions for this user
curl -X POST http://localhost:3000/auth/logout-all \
  -H "Authorization: Bearer <accessToken>"
```

## 3.6 Using Swagger UI

Instead of curl, you can use the Swagger UI at `http://localhost:3000/api/docs`:

1. Find and execute `POST /auth/login` with your credentials
2. Copy the `token` from the response
3. Click the "Authorize" button (lock icon) at the top
4. Enter: `Bearer <your-token>`
5. Execute `POST /auth/select-school` with tenantId and profileId
6. Copy the `accessToken` from the response
7. Click "Authorize" again and update to: `Bearer <accessToken>`
8. You can now test any endpoint directly

The Swagger UI has `persistAuthorization: true`, so your token persists across page refreshes.

## 3.7 JWT Token Structure

The access token JWT payload contains:

```json
{
  "sub": "<user-id>",
  "tenantId": "<tenant-id>",
  "profileId": "<profile-id>",
  "roleId": "<role-id>",
  "type": "access"
}
```

Each token is signed with a **per-tenant secret** (not the global `JWT_SECRET` from `.env`). The fallback secret is only used when a tenant-specific secret hasn't been generated yet.

## 3.8 MFA Testing

If MFA is enabled for a user, the login response will include `mfaRequired: true`. See [MFA Testing](./mfa-testing.md) for details on testing multi-factor authentication flows.

## What's Next

Now that you can authenticate, proceed to [Tenant Management](../04-tenant-management/README.md) to learn how to create and manage schools.
