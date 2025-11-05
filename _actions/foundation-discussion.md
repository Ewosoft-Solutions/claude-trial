# Foundation Layer - Discussion & Decisions

## ✅ DECISIONS MADE

### 1. MVP Scope

**Decision: Extended MVP**

- Complete foundation layer (Standard MVP)
- Plus one complete feature (e.g., student management or course management)

### 2. Development Approach

**Decision: Layered First, Then Incremental**

- Build complete foundation layer first (solid base)
- Then build features incrementally (one at a time)

### 3. Prisma Approach

**Decision: Code-First**

- Write Prisma schema first
- Generate migrations automatically
- Type safety and better developer experience

### 4. Multi-Tenancy Strategy

**Decision: Admin-Controlled Registration with Profile-Based Context** ✅

- **School Registration**: Schools registered by platform admins or school owners
- **User Addition**: Admin-controlled (IT Support, SuperAdmin, Management)
- **No Self-Registration**: All accounts created by authorized personnel
- **Multi-School Users**: Users can belong to multiple schools (many-to-many)
- **Profile-Based Context**: Each school-role combination is a profile
- **School-Specific JWT Secrets**: Auto-generated secrets per school (platform admin only)
- **Optional Email Domain**: Can be used for validation, not for tenant identification
- See `multi-tenancy-security-strategy.md` for complete details

### 5. Polymorphic Features

**Decision: Build Core First, Add Adaptations Later**

- Build core features with standard structure
- Add polymorphic adaptations as separate layer later

### 6. Security Policy Framework

**Decision: Mandatory Security Policies with Tiered Options**

- **Mandatory**: All schools must have security policies configured
- **Default Tier**: Basic (Tier 1) - mandatory for all schools
- **Enhanced Tiers**: Schools can opt-in to Enhanced (Tier 2) or Maximum (Tier 3)
- **Policy Management**: Both school admins and platform admins can manage
- **Platform Override**: Platform admins can set emergency policies
- See `multi-tenancy-security-strategy.md` Part 4 for details

### 7. MFA Requirements

**Decision: Mandatory MFA with Multiple Options**

- **Mandatory**: MFA required for all users (cannot be disabled)
- **Multiple Options**: SMS, Email, TOTP (Google Authenticator), Hardware Keys (WebAuthn)
- **User Choice**: Users can select their preferred MFA method
- **Backup Methods**: Users can set up multiple MFA methods
- See `multi-tenancy-security-strategy.md` Part 4 for details

### 8. Secret Management

**Decision: Automated Secret Generation with Rotation**

- **Auto-Generated**: Secrets automatically generated for dynamic school creation
- **Platform Admin Only**: Only platform admins (Architect, SuperAdmin) can manage secrets
- **Schools Cannot Access**: Schools have no visibility or access to JWT secrets
- **Scheduled Rotation**: Every 90-180 days (graceful transition)
- **Emergency Rotation**: Immediate rotation for breach response
- See `multi-tenancy-security-strategy.md` Part 5 for details

### 9. Breach Response Strategy

**Decision: Graduated Response (MFA Re-auth Primary, Password Reset for Severe)**

- **Primary Response**: Force MFA re-authentication (less disruptive, still secure)
- **Escalation**: Password reset for severe breaches (when password compromise suspected)
- **Industry Standard**: Aligns with GitHub, Microsoft, Google, AWS practices
- **Breach Levels**: LOW (MFA re-auth), MEDIUM (+ monitoring), HIGH (+ password reset), CRITICAL (full response)
- See `multi-tenancy-security-strategy.md` Part 5 for details

---

## MVP Clarification

**Question: What should be included in the MVP for the foundation layer?**

Please clarify what you consider the minimum viable product for the foundation layer:

1. **Minimal MVP** (just enough to support features):
   - Basic tenant isolation (one tenant works)
   - Simple authentication (login/register)
   - Basic permission system (3-4 roles)
   - Core user management

2. **Standard MVP** (production-ready foundation):
   - Full multi-tenant architecture
   - Complete authentication system (with refresh tokens, email verification)
   - Comprehensive permission system (all 10 clearance levels)
   - Audit logging
   - Tenant management

3. **Extended MVP** (foundation + one working feature):
   - Everything in Standard MVP
   - Plus one complete feature (e.g., student management or course management)

**✅ Decision: Extended MVP** - Complete foundation + one working feature

### 10. Role & Permissions Management

**Decision: Permission Pool Inheritance by Clearance Level**

- **Clearance Level Hierarchy**: 0-10 hierarchy with defined access boundaries
- **Permission Pool Inheritance**: Custom roles inherit from permission pools matching their clearance level
- **Custom Role Constraints**: Custom roles limited to clearance levels 0-7 (school-level only)
- **Role Type Separation**: Platform (9-10), System (0-8), Custom (0-7) roles with distinct constraints
- **Application-Level Validation**: Required for role name uniqueness and clearance level rules
- **AI Mediator Integration**: Consistent clearance level context for AI queries
- See `role-permissions-management.md` for complete details

---

## Development Approach Implications

### Option A: Incremental (Feature-by-Feature)

**Process:**

1. Build one complete feature end-to-end (e.g., student management)
2. Make it fully functional with UI, API, database
3. Move to next feature
4. Refactor as needed when adding new features

**Pros:**

- ✅ See working features quickly
- ✅ Early validation of approach
- ✅ Can demo progress sooner
- ✅ Features are complete and tested before moving on

**Cons:**

- ❌ May need refactoring when adding new features
- ❌ Might duplicate code patterns initially
- ❌ Foundation might evolve as we learn from features
- ❌ Risk of inconsistent patterns across features

**Best for:** When you want to see tangible progress quickly, or when you're uncertain about requirements

### Option B: Layered (Foundation First)

**Process:**

1. Build complete foundation layer (multi-tenancy, auth, permissions)
2. Ensure it's solid and tested
3. Build features on top of foundation
4. Features inherit consistent patterns

**Pros:**

- ✅ Solid, consistent foundation
- ✅ Features built on stable base
- ✅ Less refactoring needed later
- ✅ Consistent patterns across all features
- ✅ Easier to maintain and scale

**Cons:**

- ❌ Slower to see working features
- ❌ More upfront investment
- ❌ Might over-engineer foundation
- ❌ Less early feedback on approach

**Best for:** When you have clear requirements and want a scalable, maintainable system

**✅ Decision: Layered First, Then Incremental** - Build solid foundation first, then add features incrementally

---

## Prisma Approach Implications

### Option A: Code-First (Prisma Schema → Migrations)

**Process:**

1. Write Prisma schema (`schema.prisma`)
2. Generate migrations: `prisma migrate dev`
3. Prisma generates SQL migrations automatically
4. Database schema evolves from Prisma schema

**Pros:**

- ✅ Type-safe: TypeScript types generated from schema
- ✅ Version controlled: Schema file is source of truth
- ✅ Automatic migrations: Prisma generates SQL
- ✅ Easy rollbacks: Prisma handles migration history
- ✅ Developer-friendly: Less SQL knowledge needed
- ✅ Introspection: Can sync existing DB to schema

**Cons:**

- ❌ Less control: Prisma generates SQL (might not be optimal)
- ❌ Prisma-specific: Migrations tied to Prisma
- ❌ Learning curve: Prisma schema syntax
- ❌ Complex migrations: Might need manual SQL for edge cases

**Best for:** Most projects, especially when starting fresh. Recommended for our case.

### Option B: Schema-First (SQL → Prisma as Query Builder)

**Process:**

1. Write SQL migrations manually
2. Use Prisma only as ORM/query builder
3. Manually sync Prisma schema with actual DB
4. More control over SQL generation

**Pros:**

- ✅ Full control: Write optimized SQL yourself
- ✅ Database-specific: Can use PostgreSQL-specific features easily
- ✅ Flexible: Not limited by Prisma's migration system

**Cons:**

- ❌ More manual work: Write SQL, maintain schema separately
- ❌ Type safety issues: Prisma schema might drift from actual DB
- ❌ More complex: Need to manage two sources of truth
- ❌ Less automated: More manual steps

**Best for:** When you need very specific database optimizations or have complex migration requirements

**✅ Decision: Code-First** - Prisma schema → automatic migrations → type safety

---

## Multi-Tenancy Strategy: Finalized Approach ✅

### ✅ Final Decision: Admin-Controlled Registration with Profile-Based Context

**Approach:**

- **School Registration**: Schools registered by platform admins or school owners (not email domain based)
- **User Addition**: Admin-controlled (IT Support, SuperAdmin, Management)
- **No Self-Registration**: All user accounts created by authorized personnel
- **Multi-School Users**: Users can belong to multiple schools (many-to-many relationship)
- **Profile-Based Context**: Each school-role combination is a profile
- **School-Specific JWT Secrets**: Auto-generated secrets per school (platform admin only access)
- **Optional Email Domain**: Can be used for validation (DNS TXT record), not for tenant identification

**Key Features:**

1. **Tenant Identification**: UUID-based (not email domain)
2. **User Addition Methods**: Direct creation, invitation, bulk import
3. **Profile Switching**: Users can switch between school contexts and roles
4. **Security**: School-specific JWT secrets prevent cross-school token reuse

**Implementation:**

```typescript
// Tenant (School)
{
  id: UUID (primary key)
  name: string
  slug: string (optional, for URLs)
  email_domain: string? (optional, for validation only)
  status: 'active' | 'pending' | 'suspended'
  created_by: UUID
  created_at: timestamp
}

// User-Tenant Relationship (Profile)
{
  id: UUID
  user_id: UUID
  tenant_id: UUID
  role: string
  status: 'active' | 'inactive' | 'pending' | 'suspended'
  added_by: UUID (admin who added user)
  added_at: timestamp
}
```

**Why This Approach:**

- ✅ Works for schools without email domains (parents, students)
- ✅ Supports multi-school users (parents with children in multiple schools)
- ✅ Supports role switching (teacher who is also parent)
- ✅ More secure (admin-controlled, no public joining)
- ✅ Better control (admins manage who has access)

**See `multi-tenancy-security-strategy.md` for complete details and security analysis.**

---

## Polymorphic Features Strategy

**Decision: Build core features first, add adaptations later**

This is a solid approach. We'll:

1. Build core features with standard structure
2. Make them work for one school type (e.g., high school)
3. Add polymorphic adaptations later (theming, feature toggles, etc.)

**Benefits:**

- ✅ Focus on getting core functionality right first
- ✅ Less complexity during initial development
- ✅ Can add polymorphism layer later without breaking existing features
- ✅ Easier to test and validate core features

**Implementation:**

- Core features will have standard data models
- We'll design with polymorphism in mind (using JSONB fields for flexibility)
- Add polymorphic layer as a separate concern later

---

## Next Steps

1. ✅ **Clarify MVP scope** - Extended MVP (complete foundation + one feature)
2. ✅ **Finalize multi-tenancy approach** - Admin-controlled registration with profile-based context
3. ✅ **Confirm development approach** - Layered first, then incremental
4. ✅ **Confirm Prisma approach** - Code-first with Prisma migrations
5. ✅ **Security strategy finalized** - Multi-layer security with school-specific secrets
6. ⏳ **Start implementation** - Begin with database schema design

**All major decisions have been made. Ready to proceed with implementation.**
