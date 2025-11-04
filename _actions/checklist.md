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
- [ ] 2.2 Design user-tenant relationship (many-to-many with roles)
- [ ] 2.3 Implement tenant resolution middleware
- [ ] 2.4 Set up tenant context management (school selection)
- [ ] 2.5 Implement tenant data isolation (row-level security)
- [ ] 2.6 Create tenant validation utilities
- [ ] 2.7 Set up tenant-specific database queries
- [ ] 2.8 Implement role switching within school context

### 3. Authentication System

- [ ] 3.1 Design authentication flow (JWT-based, multi-school support)
- [ ] 3.2 Implement user login (returns list of schools user belongs to)
- [ ] 3.3 Implement school selection/context switching
- [ ] 3.4 Implement password hashing (bcrypt)
- [ ] 3.5 Implement password policy enforcement (mandatory)
- [ ] 3.6 Implement JWT token generation and validation (with tenant context)
- [ ] 3.7 Implement refresh token mechanism
- [ ] 3.8 Set up authentication guards/middleware
- [ ] 3.9 Implement password reset flow
- [ ] 3.10 Implement login attempt limiting and account lockout

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
- [ ] 4.3 Implement clearance level system (10 levels)
- [ ] 4.4 Create permission decorators/guards
- [ ] 4.5 Implement context-aware permissions
- [ ] 4.6 Set up maker-checker approval system structure
- [ ] 4.7 Implement platform oversight capabilities

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
- [ ] 6.2 Implement optional email domain validation (DNS TXT record)
- [ ] 6.3 Implement admin-controlled user addition (direct creation, invitation, bulk import)
- [ ] 6.4 Implement user invitation system (token-based, email links)
- [ ] 6.5 Implement tenant configuration system
- [ ] 6.6 Set up tenant onboarding flow
- [ ] 6.7 Implement tenant status management
- [ ] 6.8 Create tenant settings/configuration API
- [ ] 6.9 Implement multi-school user management
- [ ] 6.10 Implement audit logging for user additions

### 7. Database Setup & Configuration

- [ ] 7.1 Set up Prisma schema
- [ ] 7.2 Configure database connection
- [ ] 7.3 Set up database migrations
- [ ] 7.4 Configure environment variables
- [ ] 7.5 Set up database seeding
- [ ] 7.6 Configure connection pooling

---

## DONE

<!-- Completed items will be moved here -->
