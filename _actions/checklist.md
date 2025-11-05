# Foundation Layer - Implementation Actions

## TODO

### 1. Database Schema Design

- [ ] 1.1 Design core user management tables (users, roles, permissions)
- [ ] 1.2 Design tenant/school tables (tenants, schools)
- [ ] 1.3 Design academic structure tables (academic_years, terms, courses, classes)
- [ ] 1.4 Design student management tables (students, enrollments)
- [ ] 1.5 Design assessment/grading tables (assessments, grades, grading_systems)
- [ ] 1.6 Design communication tables (messages, announcements)
- [ ] 1.7 Design audit logging tables (audit_logs)
- [ ] 1.8 Set up database indexes and constraints
- [ ] 1.9 Set up database migrations system

### 2. Multi-Tenant Architecture

- [ ] 2.1 Design tenant identification strategy (UUID-based, optional email domain for validation)
- [ ] 2.2 Design user-tenant relationship (many-to-many with roles, profile-based)
- [ ] 2.3 Implement tenant resolution middleware
- [ ] 2.4 Set up tenant context management (school selection, profile switching)
- [ ] 2.5 Implement tenant data isolation (row-level security)
- [ ] 2.6 Create tenant validation utilities
- [ ] 2.7 Set up tenant-specific database queries
- [ ] 2.8 Implement role switching within school context
- [ ] 2.9 Implement school-specific JWT secrets (auto-generated, platform admin only)
- [ ] 2.10 Implement secret rotation system (scheduled + emergency)
- [ ] 2.11 Implement profile-level suspension capability

### 3. Authentication System

- [ ] 3.1 Design authentication flow (JWT-based, multi-school support, profile-based)
- [ ] 3.2 Implement user login (returns list of schools/profiles user belongs to)
- [ ] 3.3 Implement school selection/context switching (profile switching)
- [ ] 3.4 Implement password hashing (bcrypt)
- [ ] 3.5 Implement password policy enforcement (mandatory, school-specific)
- [ ] 3.6 Implement JWT token generation with school-specific secrets (platform admin only)
- [ ] 3.7 Implement JWT token validation with school-specific secrets
- [ ] 3.8 Implement refresh token mechanism
- [ ] 3.9 Set up authentication guards/middleware (multi-layer validation)
- [ ] 3.10 Implement enhanced password reset flow (MFA required, rate limiting, audit logging)
- [ ] 3.11 Implement login attempt limiting and account lockout (school-specific)
- [ ] 3.12 Implement session invalidation on password reset

### 3a. MFA System (Mandatory)

- [ ] 3a.1 Implement SMS MFA option
- [ ] 3a.2 Implement Email MFA option
- [ ] 3a.3 Implement TOTP MFA (Google Authenticator, Microsoft Authenticator)
- [ ] 3a.4 Implement Hardware Key MFA (WebAuthn/FIDO2)
- [ ] 3a.5 Implement MFA setup flow (user selects preferred method)
- [ ] 3a.6 Implement MFA verification flow
- [ ] 3a.7 Implement backup MFA methods
- [ ] 3a.8 Implement MFA recovery process
- [ ] 3a.9 Implement MFA requirements per operation (sensitive operations)
- [ ] 3a.10 Implement MFA enforcement middleware
- [ ] 3a.11 Implement MFA audit logging

### 4. Authorization/Permission System

- [ ] 4.1 Design permission structure (300+ permissions)
- [ ] 4.2 Implement role-based access control (RBAC)
- [ ] 4.3 Implement clearance level system (10 levels: Architect=10, SuperAdmin=9, Owner=8, etc.)
- [ ] 4.4 Implement clearance level validation on every request
- [ ] 4.5 Implement permission validation on every request (profile-specific)
- [ ] 4.6 Create permission decorators/guards
- [ ] 4.7 Implement context-aware permissions
- [ ] 4.8 Set up maker-checker approval system structure
- [ ] 4.9 Implement platform oversight capabilities
- [ ] 4.10 Implement strict context validation (user belongs to school, profile active)
- [ ] 4.11 Implement multi-layer security validation middleware
- [ ] 4.12 Implement permission pool inheritance system (per clearance level)
- [ ] 4.13 Implement custom role creation constraints (clearance level 0-7 only, permission pool validation)
- [ ] 4.14 Implement permission pool models and seed data
- [ ] 4.15 Implement application-level role name uniqueness validation (platform/system roles)
- [ ] 4.16 Integrate clearance level context with AI mediator

### 4a. Security Policy Framework

- [ ] 4a.1 Design default security policy (Tier 1: Basic - mandatory)
- [ ] 4a.2 Design enhanced security policy (Tier 2: Enhanced - optional)
- [ ] 4a.3 Design maximum security policy (Tier 3: Maximum - optional)
- [ ] 4a.4 Implement security policy assignment system
- [ ] 4a.5 Implement security policy enforcement middleware
- [ ] 4a.6 Implement school admin policy management
- [ ] 4a.7 Implement platform admin policy management (emergency override)
- [ ] 4a.8 Implement policy upgrade/downgrade controls
- [ ] 4a.9 Implement policy audit logging

### 5. API Structure & Core Services

- [ ] 5.1 Set up NestJS module structure
- [ ] 5.2 Create shared/common modules
- [ ] 5.3 Implement base repository pattern
- [ ] 5.4 Set up DTOs and validation
- [ ] 5.5 Implement error handling middleware
- [ ] 5.6 Set up API documentation (Swagger/OpenAPI)
- [ ] 5.7 Implement request/response logging

### 6. Tenant Management

- [ ] 6.1 Implement school registration (platform admin or school owner)
- [ ] 6.2 Implement school-specific JWT secret auto-generation (platform admin only)
- [ ] 6.3 Implement optional email domain validation (DNS TXT record)
- [ ] 6.4 Implement admin-controlled user addition (direct creation, invitation, bulk import)
- [ ] 6.5 Implement user invitation system (token-based, email links, expiration)
- [ ] 6.6 Implement tenant configuration system
- [ ] 6.7 Set up tenant onboarding flow
- [ ] 6.8 Implement tenant status management
- [ ] 6.9 Create tenant settings/configuration API
- [ ] 6.10 Implement multi-school user management (profile-based)
- [ ] 6.11 Implement audit logging for user additions
- [ ] 6.12 Implement secret rotation (scheduled 90-180 days + emergency)
- [ ] 6.13 Implement secret access controls (platform admin only, schools cannot access)

### 7. Database Setup & Configuration

- [ ] 7.1 Set up Prisma schema
- [ ] 7.2 Configure database connection
- [ ] 7.3 Set up database migrations
- [ ] 7.4 Configure environment variables
- [ ] 7.5 Set up database seeding
- [ ] 7.6 Configure connection pooling
- [ ] 7.7 Set up database encryption for sensitive fields (JWT secrets, MFA secrets)

### 8. Security & Breach Response

- [ ] 8.1 Implement breach response system (graduated: MFA re-auth primary, password reset for severe)
- [ ] 8.2 Implement force MFA re-authentication mechanism
- [ ] 8.3 Implement force password reset mechanism (for severe breaches)
- [ ] 8.4 Implement platform-wide breach response
- [ ] 8.5 Implement school-specific breach response
- [ ] 8.6 Implement profile-level breach response
- [ ] 8.7 Implement breach severity detection and classification
- [ ] 8.8 Implement breach notification system
- [ ] 8.9 Implement security investigation mode
- [ ] 8.10 Implement enhanced monitoring for breach response

---

## DONE

<!-- Completed items will be moved here -->
