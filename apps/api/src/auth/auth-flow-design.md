# Authentication Flow Design

## Overview

This document describes the JWT-based authentication flow with multi-school support and profile-based context switching.

## Authentication Flow

### 1. Initial Login (3.2)

**Endpoint:** `POST /auth/login`

**Flow:**

1. User provides email and password
2. System validates credentials
3. System checks account lockout status
4. System records login attempt
5. On success:
   - Returns list of schools/profiles user belongs to
   - Does NOT return JWT token yet
6. On failure:
   - Increments login attempts
   - Locks account if threshold reached (3.11)

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "schools": [
    {
      "tenantId": "school-1-uuid",
      "tenantName": "School A",
      "tenantSlug": "school-a",
      "profileId": "profile-1-uuid",
      "roles": ["Teacher", "Parent"],
      "primaryRole": "Teacher",
      "status": "active",
      "tenantStatus": "active"
    },
    {
      "tenantId": "school-2-uuid",
      "tenantName": "School B",
      "tenantSlug": "school-b",
      "profileId": "profile-2-uuid",
      "roles": ["Parent"],
      "primaryRole": "Parent",
      "status": "active",
      "tenantStatus": "active"
    }
  ]
}
```

### 2. School Selection / Context Switching (3.3)

**Endpoint:** `POST /auth/select-school`

**Flow:**

1. User selects a school from available schools
2. System validates user has access to selected school
3. System validates profile is active
4. System generates JWT token with school-specific secret (3.6)
5. System creates session record (3.8)
6. Returns JWT token and refresh token

**Request:**

```json
{
  "tenantId": "school-1-uuid",
  "profileId": "profile-1-uuid"
}
```

**Response:**

```json
{
  "success": true,
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "expiresIn": 3600,
  "tenantContext": {
    "tenantId": "school-1-uuid",
    "tenantSlug": "school-a",
    "userId": "user-uuid",
    "profileId": "profile-1-uuid",
    "roles": ["Teacher", "Parent"],
    "tenantStatus": "active",
    "profileStatus": "active"
  }
}
```

### 3. Token Refresh (3.8)

**Endpoint:** `POST /auth/refresh`

**Flow:**

1. User provides refresh token
2. System validates refresh token
3. System checks session is still valid
4. System generates new access token
5. Returns new access token

**Request:**

```json
{
  "refreshToken": "refresh-token"
}
```

**Response:**

```json
{
  "success": true,
  "accessToken": "new-jwt-token",
  "expiresIn": 3600
}
```

### 4. Password Reset Flow (3.10)

**Endpoint:** `POST /auth/request-password-reset`

**Flow:**

1. User requests password reset with email
2. System validates rate limiting
3. System generates reset token (expires in 1 hour)
4. System sends reset email
5. System logs audit event

**Endpoint:** `POST /auth/reset-password`

**Flow:**

1. User provides reset token and new password
2. System validates reset token
3. System requires MFA verification (if enabled)
4. System validates password against all school policies (3.5)
5. System checks password history (prevent reuse)
6. System updates password
7. System invalidates all sessions (3.12)
8. System logs audit event

### 5. JWT Token Structure

**Payload:**

```json
{
  "sub": "user-uuid",
  "tenantId": "school-uuid",
  "profileId": "profile-uuid",
  "roles": ["Teacher", "Parent"],
  "iat": 1234567890,
  "exp": 1234571490,
  "type": "access"
}
```

**Refresh Token:**

- Stored in database (Session table)
- Linked to user and profile
- Can be revoked independently
- Longer expiration (7 days)

### 6. Security Features

- **School-specific JWT secrets** (3.6, 3.7): Each school has unique secret
- **Multi-layer validation** (3.9): Token validation + tenant context validation
- **Login attempt limiting** (3.11): Account lockout after failed attempts
- **Session management** (3.8): Active sessions tracked in database
- **Password policy enforcement** (3.5): School-specific password requirements
- **Session invalidation** (3.12): All sessions invalidated on password reset

## Implementation Status

- ✅ 3.1: Authentication flow designed
- ⏳ 3.2-3.12: Implementation in progress
