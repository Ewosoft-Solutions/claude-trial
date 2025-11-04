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

**Decision: To be finalized** (See `multi-tenancy-strategy.md` for detailed discussion)

- Concerns: Email domain limitations, multi-school users, role switching
- Proposed: Hybrid approach (School Code + Optional Email Domain)

### 5. Polymorphic Features

**Decision: Build Core First, Add Adaptations Later**

- Build core features with standard structure
- Add polymorphic adaptations as separate layer later

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

## Multi-Tenancy Strategy: Organizational Email vs Subdomain

### Current Plan: Organizational Email as Tenant Identifier

**How it would work:**

- Users register with email: `john@schoolname.edu`
- System extracts domain: `schoolname.edu`
- Domain becomes tenant identifier
- All queries filtered by email domain

### Analysis

#### Pros of Email Domain Approach:

- ✅ **Simpler setup**: No DNS/subdomain configuration needed
- ✅ **Natural identifier**: Organizations already have email domains
- ✅ **User-friendly**: Users already know their email
- ✅ **Less infrastructure**: No need for wildcard SSL certificates
- ✅ **Easier onboarding**: Schools don't need to configure subdomains

#### Cons of Email Domain Approach:

- ⚠️ **Email domain validation**: Need to verify domain ownership
- ⚠️ **Security consideration**: Email domains can be spoofed
- ⚠️ **Multi-domain support**: What if one school has multiple email domains?
- ⚠️ **User email changes**: What happens if user changes email domain?
- ⚠️ **Tenant identification**: Need to extract and validate domain on every request

### Proposed Hybrid Approach

**Option 1: Email Domain + Tenant ID (Recommended)**

```
User registration flow:
1. User registers with email: john@schoolname.edu
2. System extracts domain: schoolname.edu
3. System looks up or creates tenant for that domain
4. Tenant record has: id (UUID), domain (schoolname.edu), slug (schoolname)
5. User record has: tenant_id (UUID), email (john@schoolname.edu)
6. All queries use tenant_id for filtering
```

**Benefits:**

- ✅ Email domain is used for discovery/validation
- ✅ Tenant ID (UUID) is used for actual data isolation (faster, more secure)
- ✅ Can support multiple domains per tenant
- ✅ Can validate domain ownership
- ✅ More secure than filtering by email domain directly

**Option 2: Pure Email Domain**

```
User registration flow:
1. User registers with email: john@schoolname.edu
2. System extracts domain: schoolname.edu
3. All queries filter by email domain directly
4. No separate tenant table needed initially
```

**Benefits:**

- ✅ Simplest approach
- ✅ No tenant table needed
- ✅ Direct email-to-tenant mapping

**Drawbacks:**

- ❌ Less flexible (hard to support multiple domains)
- ❌ Performance: String matching on every query
- ❌ Security: Domain validation harder

### Detailed Questions for Email Domain Approach:

1. **Domain Validation:**
   - Should we verify email domain ownership (DNS TXT record, email verification)?
   - How do we prevent someone registering with `gmail.com` and claiming all Gmail users?

2. **Multi-Domain Support:**
   - Can one school have multiple email domains? (e.g., `school.edu` and `school.org`)
   - Should they be separate tenants or linked?

3. **User Email Changes:**
   - What if a user changes from `john@schoolA.edu` to `john@schoolB.edu`?
   - Should they be moved to new tenant or lose access?

4. **Tenant Discovery:**
   - How do new users join existing tenants? (Invite system?)
   - What if two schools have similar domains? (e.g., `school.edu` vs `school.com`)

5. **Security:**
   - Should we validate email domain ownership before allowing tenant creation?
   - How do we prevent domain squatting?

### Recommendation

**⚠️ Decision Pending - See `multi-tenancy-strategy.md` for detailed discussion**

**Proposed: Hybrid Approach (Option 1):**

- Use email domain for **tenant discovery and validation**
- Use tenant ID (UUID) for **actual data isolation**
- Store tenant record with domain, slug, and other metadata
- Validate domain ownership during tenant creation
- Support multiple domains per tenant (for complex organizations)

**Implementation:**

```typescript
// Tenant model
{
  id: UUID (primary key)
  domain: string (e.g., "schoolname.edu") - unique
  slug: string (e.g., "schoolname") - for URLs
  name: string (e.g., "School Name")
  status: 'active' | 'pending' | 'suspended'
  domain_verified: boolean
  created_at: timestamp
}

// User model
{
  id: UUID
  email: string (e.g., "john@schoolname.edu")
  tenant_id: UUID (foreign key to tenants)
  // ... other fields
}

// Resolution flow
1. User registers with email → extract domain
2. Look up tenant by domain
3. If not found, create tenant (with domain verification)
4. Create user with tenant_id
5. All queries filter by tenant_id (indexed, fast)
```

**What do you think? Should we discuss this further before implementing?**

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

1. **Clarify MVP scope** - What's included in foundation MVP?
2. **Finalize multi-tenancy approach** - Discuss email domain strategy in detail
3. **Confirm development approach** - Layered for foundation, incremental for features?
4. **Confirm Prisma approach** - Code-first with Prisma migrations?
5. **Start implementation** - Begin with database schema design

**Please review and let me know your thoughts on each point!**
