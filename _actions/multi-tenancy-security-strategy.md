# Multi-Tenancy & Security Strategy - Comprehensive Guide

## ✅ DECISIONS MADE

### Registration Approach: **Admin-Controlled**

- Schools register on platform first (by platform admins or school owners)
- Users are added by authorized personnel (IT Support, SuperAdmin, Management)
- No self-registration - all accounts created by admins
- Users can belong to multiple schools - added to each school separately

### Security Policies: **MANDATORY**

- **Rationale**: Platform bears responsibility for data breaches
- **Approach**: Mandatory security policies from the start
- **Default Policies**: Provided by platform, schools can opt-in to enhanced tiers

### Policy Management: **Both School and Platform Admins**

- **School Admins**: Can configure policies for their school
- **Platform Admins**: Can override/set policies for any school (emergency response)

### MFA Requirements: **MANDATORY with Multiple Options**

- **Mandatory**: MFA required for all users
- **Options**: SMS, Email, TOTP (Google Authenticator), Hardware Keys (WebAuthn)
- **User Choice**: Users can choose their preferred MFA method

---

## Part 1: Multi-Tenancy Architecture

### Problem Statement

#### Current Concerns:

1. **Email domain limitations:**
   - Many schools don't have email domains for parents/students
   - Setting up email domains for schools may be complex
   - Personal emails don't indicate school affiliation

2. **Multi-school user scenarios:**
   - Parents may have children in multiple schools
   - Teachers may also be parents at different schools
   - Users need to switch between school contexts

3. **User profile switching:**
   - Teacher who is also a parent needs to switch views
   - Same user, different roles in different schools
   - Need intuitive profile switching within organization

### Solution: Admin-Controlled User Addition with Profile-Based Context

#### Core Concept

**Tenant (School) Registration:**

- Schools are registered on the platform first
- Can be registered by platform admins (SuperAdmin/Architect) or school owners
- School gets unique identifier (UUID) and optional slug/name
- Optional email domain can be set for validation

**User Addition (Admin-Controlled):**

- Users are added to schools by authorized personnel:
  - **IT Support** (school-level) - can add users to their school
  - **SuperAdmin/Architect** (platform-level) - can add users to any school
  - **School Management** (with appropriate permissions) - can add users to their school
- Users can be added via:
  - **Direct creation** - admin creates account with email, password, role
  - **Invitation** - admin invites user by email, user sets password on first login
  - **Bulk import** - CSV/Excel upload
- No self-registration or public joining

**Authentication Flow:**

1. User logs in with email and password (set by admin or during invitation)
2. System shows all schools user belongs to
3. User selects school context (profile)
4. All operations filtered by selected school
5. User can switch school context at any time

**User-Tenant Relationship:**

- Many-to-many: One user can belong to multiple schools
- Role per tenant: User can be "Teacher" at School A, "Parent" at School B
- Added by admins: All user-school relationships are admin-controlled
- Profile switching: User switches between school contexts and roles

### Database Schema

```typescript
// Tenant (School)
{
  id: UUID (primary key)
  name: string (e.g., "Lincoln High School")
  slug: string (e.g., "lincoln-high") - for URLs, optional
  email_domain: string? (optional, e.g., "lincoln.edu") - for validation
  status: 'active' | 'pending' | 'suspended'
  created_by: UUID (user who created the school)
  created_at: timestamp
  settings: JSONB (school-specific settings)
}

// User
{
  id: UUID (primary key)
  email: string (unique, personal or school email)
  password_hash: string
  first_name: string
  last_name: string
  phone: string?
  is_active: boolean
  is_verified: boolean
  created_at: timestamp
}

// User-Tenant Relationship (Many-to-Many) - Each relationship is a "Profile"
{
  id: UUID
  user_id: UUID (foreign key to users)
  tenant_id: UUID (foreign key to tenants)
  role: string (e.g., "teacher", "parent", "student")
  status: 'active' | 'inactive' | 'pending' | 'suspended'
  added_at: timestamp
  added_by: UUID (user who added them - admin/IT support)
  invitation_token: string? (for invitation-based addition)
  invitation_expires_at: timestamp? (for invitation-based addition)
  suspended_at?: timestamp
  suspended_by?: UUID
  suspension_reason?: string
}

// User-Tenant Permissions
{
  id: UUID
  user_tenant_id: UUID (foreign key to user_tenants)
  permission_id: UUID (foreign key to permissions)
  granted_at: timestamp
  granted_by: UUID
}
```

### User Addition Methods

#### Method 1: Direct Account Creation

```
1. Admin (IT Support/SuperAdmin/Management) creates user account
2. Admin provides: email, password (or generate), name, role
3. System creates user account
4. System creates user_tenant relationship (profile)
5. User can immediately log in
```

#### Method 2: Invitation-Based Addition

```
1. Admin (IT Support/SuperAdmin/Management) invites user by email
2. System generates invitation token
3. System sends invitation email with link
4. User clicks link, sets password, selects role (or role pre-assigned)
5. System creates user account and user_tenant relationship
6. User can now log in
```

#### Method 3: Bulk Import

```
1. Admin uploads CSV/Excel file with user data
2. System validates and creates accounts
3. System creates user_tenant relationships
4. Users receive welcome emails with credentials or invitation links
```

### Multi-School User Experience

**Login Flow:**

```
1. User enters email and password
2. System authenticates user
3. System loads all schools user belongs to (profiles)
4. System shows school selection screen:
   - "Lincoln High School" (Teacher profile)
   - "Lincoln High School" (Parent profile)
   - "Riverside Elementary" (Parent profile)
5. User selects school context
6. User lands in dashboard for selected school
```

**School Context Switching:**

```
1. User clicks "Switch School" button
2. System shows list of user's schools (profiles)
3. User selects different school
4. System updates context (tenant_id in session/token)
5. User sees different dashboard/features
```

**Profile/Role Switching (Within Same School):**

```
1. User has multiple roles in same school (e.g., Teacher + Parent)
2. User sees role selector in header
3. User switches from "Teacher View" to "Parent View"
4. System filters data based on selected role
   - Teacher View: See all students in classes
   - Parent View: See only own children
```

---

## Part 2: Profile-Based Context Security Analysis

### Proposed Approach: Single Account with Multiple Profiles/Contexts

**Single Authentication:**

- User has **one email + password + MFA** for authentication
- Single account login grants access to all schools/roles

**Profile/Context System:**

- Each school-role combination is a **profile** or **context**
- User can switch between profiles within the same interface
- Each profile has its own permissions and data access

**Example:**

```
User: johndoe@gmail.com

School A:
  - Profile 1: Teacher (can see Class 10A students)
  - Profile 2: Parent (can see child John's data)

School B:
  - Profile 3: Parent (can see child Jane's data)

User logs in once → can access all 3 profiles
```

### Security Risks

**Quick Reference:**

- ❗️❗️❗️ **HIGH** - Critical security risks requiring immediate attention
- ❗️❗️ **MEDIUM** - Important risks that need mitigation
- ❕ **LOW** - Minor risks with acceptable mitigation

#### 1. **Cascading Security Risk (Primary Concern)** ❗️❗️❗️

**Status: ✅ ADDRESSED**

**Risk:**

- If account is compromised (password leak, MFA bypass, session hijack), attacker gains access to **ALL schools and roles**
- Single point of failure for multiple schools

**Impact:**

- Teacher at School A compromised → can access School B as parent
- Parent at School A compromised → can access School B as teacher
- Cross-school data breach from single account compromise

**Severity: ❗️❗️❗️ HIGH**

**✅ Solution: Multi-Layer Security with School-Specific Isolation**

**Approach:**

1. **School-Specific JWT Secrets** 🔑 (CRITICAL)
   - Each school has its own unique JWT signing secret
   - Tokens signed with School A's secret cannot be used for School B
   - Prevents cross-school token reuse even if token is compromised
   - Each school can rotate secrets independently
   - See Part 5 for implementation details

2. **Strict Context Validation** ✅ (CRITICAL)
   - Every request validates user belongs to school and profile is active
   - Only schools user was invited/added to are accessible
   - Suspended profiles are immediately blocked
   - Pending invitations cannot be used
   - See Part 5 for implementation details

3. **Clearance Level Validation** (0-10 Hierarchy) ✅
   - Leverages access control clearance levels (Architect=10, SuperAdmin=9, Owner=8, etc.)
   - Every operation validates clearance level requirement
   - Prevents privilege escalation across schools
   - Role hierarchy enforced per school independently
   - See Part 5 for implementation details

4. **Permission Validation on Every Request** ✅
   - Granular permission checks (300+ permissions)
   - Profile-specific permissions (no cross-profile inheritance)
   - Unauthorized access attempts logged
   - Permission-based access control per operation
   - See Part 5 and \_requirements/permissions.md for details

5. **Organization-Level Security Policies** (Mandatory for all schools)
   - Each school can enforce its own security requirements
   - More sensitive schools can require stricter policies (Enhanced/Maximum tiers)
   - Policies include: MFA requirements, password complexity, session timeout, IP restrictions, device management
   - See Part 4 for policy tiers

6. **Organization-Level MFA Requirements**
   - Mandatory MFA for all schools (cannot be disabled)
   - Schools can require MFA for sensitive operations
   - MFA can be enforced per school independently
   - Multiple MFA options available (SMS, Email, TOTP, Hardware Key)

7. **Profile-Level Isolation**
   - Profile-specific session tokens (token tied to current profile)
   - Profile-level suspension capability (can suspend individual profiles)
   - Enhanced audit logging per profile
   - Anomaly detection for suspicious profile switching
   - See Part 5 for implementation details

8. **Organization-Level Access Revocation**
   - Can remove user from one school without affecting others
   - Can suspend access to specific school/profile
   - Can revoke tokens for specific school
   - See Part 3 for details

**Multi-Layer Validation:**
Every request goes through multiple validation layers:

1. **JWT Signature Verification** - School-specific secret validation
2. **Context Validation** - User belongs to school, profile is active
3. **Clearance Level Check** - Required clearance level for operation (0-10)
4. **Permission Validation** - Specific permissions required for operation
5. **Security Policy Check** - MFA, IP restrictions, time restrictions

**Rationale:**

- **School-specific JWT secrets** prevent cross-school token reuse (critical protection)
- **Strict context validation** ensures only invited schools are accessible
- **Clearance level validation** enforces role hierarchy and prevents privilege escalation
- **Permission validation** provides granular access control per operation
- Organization-level policies reduce cascading risk by requiring MFA and stricter security per school
- Profile-level isolation allows granular control and incident isolation
- Mandatory MFA across all schools provides baseline protection
- Similar approach used by GitHub, Microsoft, Google, enhanced with school-specific secrets

**Implementation Status:**

- ✅ Policy framework defined (Part 4)
- ✅ MFA system designed (Part 4)
- ✅ Profile isolation mechanisms defined (Part 5)
- ✅ School-specific JWT secret strategy defined
- ✅ Clearance level validation framework defined
- ✅ Permission validation framework defined
- ⏳ Pending implementation

**Remaining Risk Level:** ⚠️ **REDUCED** (from HIGH to LOW with comprehensive mitigations in place)

---

#### 2. **Role Escalation Risk** ❗️❗️❗️

**Status: ✅ ADDRESSED**

**Risk:**

- User with low-privilege role in one school might gain access to high-privilege role in another school
- If one profile is compromised, all profiles are accessible

**Impact:**

- Compromised parent account → can access teacher profiles
- Cross-role privilege escalation

**Severity: ❗️❗️❗️ HIGH**

**✅ Solution: Profile-Specific Permissions + Strict Validation**

**Approach:**

1. **Profile-Specific Permissions**
   - Each profile (school-role combination) has independent permissions
   - Permissions are validated per profile on every request
   - No cross-profile permission inheritance

2. **Strict Permission Validation**
   - Every operation validates permissions for the current profile
   - Unauthorized access attempts are logged
   - Profile switching requires validation of profile ownership

3. **Organization-Level Security Policies**
   - Schools can require MFA for sensitive operations (e.g., viewing student data, modifying grades)
   - Higher MFA levels required for higher-privilege operations
   - See Part 4 for MFA requirements per operation

4. **Role-Based Data Filtering**
   - Data access is filtered by both tenant (school) and role
   - Teacher role sees different data than parent role, even in same school
   - See Part 7 for implementation details

**Rationale:**

- Profile-specific permissions ensure role isolation
- MFA requirements for sensitive operations add additional protection layer
- Strict validation prevents privilege escalation attempts

**Implementation Status:**

- ✅ Permission validation framework defined
- ✅ Role-based data filtering approach defined (Part 7)
- ⏳ Pending implementation

**Remaining Risk Level:** ⚠️ **REDUCED** (from HIGH to LOW with mitigations in place)

---

#### 3. **Session Management Complexity** ❗️❗️

**Status: ✅ ADDRESSED**

**Risk:**

- Complex session management across multiple profiles
- Session tokens might grant access to all profiles
- Difficult to revoke access to specific profiles

**Impact:**

- Compromised session token → access to all profiles
- Can't selectively revoke access

**Severity: ❗️❗️ MEDIUM**

**✅ Solution: Profile-Specific Session Tokens + Organization-Level Session Management**

**Approach:**

1. **Profile-Specific Session Tokens**
   - JWT token includes `currentProfileId` (user-tenant relationship ID)
   - Token is tied to specific profile, not all profiles
   - Profile switch generates new token with new profile context
   - See Part 5 for implementation

2. **Organization-Level Session Management**
   - Separate session tokens per school
   - Can revoke sessions for specific school
   - Can set different session timeouts per school (via security policy)
   - See Part 3 for details

3. **Profile-Level Session Revocation**
   - Can revoke sessions for specific profile
   - Profile suspension automatically revokes all sessions for that profile
   - See Part 5 for implementation

**Rationale:**

- Profile-specific tokens prevent cross-profile access from single token
- Organization-level session management allows granular control
- Profile suspension provides immediate access revocation

**Implementation Status:**

- ✅ Token structure defined (Part 5)
- ✅ Session revocation mechanisms defined
- ⏳ Pending implementation

**Remaining Risk Level:** ✅ **RESOLVED** (risk mitigated with profile-specific tokens)

---

#### 4. **Password Reset Implications** ❗️❗️

**Status: ✅ ADDRESSED**

**Risk:**

- Password reset affects all profiles
- Can't reset password for specific school/role
- If password reset is compromised, all profiles accessible

**Impact:**

- Single password reset → all schools/roles accessible
- Difficult to isolate security incidents

**Severity: ❗️❗️ MEDIUM**

**✅ Solution: Enhanced Account-Level Password Reset with Comprehensive Security**

**Approach:**

1. **Account-Level Password Reset** (Standard Practice)
   - Password reset affects entire account (all profiles)
   - Standard practice for single-account authentication
   - Simpler UX and implementation
   - Consistent with industry practices (GitHub, Microsoft, Google)

2. **MFA Verification Required**
   - Password reset requires MFA verification before allowing password change
   - Prevents unauthorized password resets
   - Uses user's configured MFA method (TOTP, SMS, Email, Hardware Key)

3. **Enhanced Security Measures**
   - **Rate limiting**: Maximum 3 password reset attempts per hour per user
   - **Token expiration**: Reset tokens expire in 15 minutes
   - **Single-use tokens**: Tokens can only be used once
   - **Email verification**: Secure reset link sent to verified email
   - **IP address validation**: Optional (can be required by school policy)
   - **Device fingerprinting**: Optional, for suspicious resets

4. **Comprehensive Audit Logging**
   - All password reset requests logged (IP, user agent, timestamp)
   - All password reset completions logged
   - Unsuccessful attempts logged and monitored
   - Anomaly detection for suspicious patterns

5. **Session Invalidation on Password Reset**
   - All active sessions invalidated when password is reset
   - Forces re-authentication with new password
   - Prevents continued access with old password

6. **Profile-Level Suspension as Mitigation**
   - If password reset is compromised, can immediately suspend affected profiles
   - Profile suspension provides instant isolation
   - Can selectively suspend specific schools/profiles
   - See Part 5 for profile suspension implementation

7. **Notification System**
   - User notified on all active profiles when password is reset
   - Email sent to registered email address
   - Alert if password reset from unrecognized device/location

**Implementation:**

```typescript
// Enhanced password reset flow
async requestPasswordReset(email: string, schoolId?: UUID): Promise<void> {
  // Rate limiting
  await this.checkRateLimit(email, 'password_reset', 3, 3600); // 3 per hour

  const user = await this.getUserByEmail(email);

  // Generate secure reset token
  const resetToken = this.generateSecureToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Store reset request
  await this.prisma.passwordResetRequest.create({
    data: {
      userId: user.id,
      token: this.hashToken(resetToken),
      expiresAt,
      ipAddress: this.request.ip,
      userAgent: this.request.headers['user-agent'],
      schoolId // Optional: school-specific reset
    }
  });

  // Send email with reset link
  await this.emailService.sendPasswordResetEmail(user.email, resetToken);

  // Log attempt
  await this.auditLog.create({
    userId: user.id,
    action: 'password_reset_requested',
    ipAddress: this.request.ip
  });
}

async resetPassword(token: string, newPassword: string): Promise<void> {
  // Verify token
  const resetRequest = await this.verifyResetToken(token);

  // MFA verification required
  await this.verifyMFA(resetRequest.userId);

  // Validate new password against all school policies
  const schools = await this.getUserSchools(resetRequest.userId);
  for (const school of schools) {
    const policy = await this.getSchoolSecurityPolicy(school.id);
    await this.validatePassword(newPassword, policy.passwordComplexity);
  }

  // Update password
  await this.updateUserPassword(resetRequest.userId, newPassword);

  // Invalidate all active sessions (security measure)
  await this.revokeAllUserSessions(resetRequest.userId);

  // Notify user on all active profiles
  await this.notifyPasswordReset(resetRequest.userId);

  // Log password reset
  await this.auditLog.create({
    userId: resetRequest.userId,
    action: 'password_reset_completed',
    ipAddress: this.request.ip
  });

  // Delete used token
  await this.deleteResetToken(token);
}
```

**Rationale:**

- **Account-level password reset** is standard practice for single-account authentication (used by GitHub, Microsoft, Google)
- **MFA verification** adds critical security layer preventing unauthorized resets
- **Rate limiting** prevents brute force attacks
- **Session invalidation** ensures old sessions cannot continue after password reset
- **Profile-level suspension** provides isolation capability if reset is compromised
- **Comprehensive audit logging** enables detection and response to suspicious activity
- **Profile-specific password reset** would be complex, non-standard, and poor UX (multiple passwords to manage)

**Implementation Status:**

- ✅ Enhanced password reset security measures defined
- ✅ MFA verification requirement defined
- ✅ Rate limiting strategy defined
- ✅ Session invalidation mechanism defined
- ✅ Profile suspension mechanism defined (Part 5)
- ✅ Audit logging framework defined
- ⏳ Pending implementation

**Remaining Risk Level:** ✅ **RESOLVED** (risk mitigated with enhanced security measures and profile-level suspension capability)

---

#### 5. **MFA Bypass Risk** ❗️❗️

**Status: ✅ ADDRESSED**

**Risk:**

- If MFA is bypassed, all profiles accessible
- Single MFA device failure affects all access
- Can't have profile-specific MFA

**Impact:**

- MFA compromise → all schools/roles accessible
- No granular MFA protection

**Severity: ❗️❗️ MEDIUM**

**✅ Solution: Organization-Level MFA Requirements + Multiple Backup Methods**

**Approach:**

1. **Mandatory MFA for All Schools**
   - MFA cannot be disabled (mandatory policy requirement)
   - All schools must enforce MFA
   - See Part 4 for policy tiers

2. **Organization-Level MFA Requirements**
   - Schools can require MFA for sensitive operations
   - Higher MFA levels required for higher-privilege operations
   - MFA enforced per school independently
   - See Part 4 for MFA requirements per operation

3. **Multiple MFA Methods Available**
   - Users can set up multiple MFA methods (primary + backup)
   - Methods: SMS, Email, TOTP (Google Authenticator), Hardware Key
   - Backup methods prevent single point of failure
   - See Part 4 for MFA implementation

4. **Profile-Level Suspension**
   - If MFA is compromised, can suspend affected profiles
   - Profile suspension provides immediate isolation
   - See Part 5 for profile suspension

**Rationale:**

- Mandatory MFA provides baseline protection
- Multiple backup methods prevent single device failure
- Organization-level requirements allow stricter enforcement per school
- Profile-level suspension provides isolation capability

**Implementation Status:**

- ✅ MFA system designed (Part 4)
- ✅ Multiple MFA methods defined
- ✅ Backup method support defined
- ⏳ Pending implementation

**Remaining Risk Level:** ✅ **RESOLVED** (risk mitigated with mandatory MFA + backup methods)

---

### Summary: Risk Status

| Risk                             | Status       | Remaining Risk Level    |
| -------------------------------- | ------------ | ----------------------- |
| 1. Cascading Security Risk       | ✅ ADDRESSED | ⚠️ REDUCED (HIGH → LOW) |
| 2. Role Escalation Risk          | ✅ ADDRESSED | ⚠️ REDUCED (HIGH → LOW) |
| 3. Session Management Complexity | ✅ ADDRESSED | ✅ RESOLVED             |
| 4. Password Reset Implications   | ✅ ADDRESSED | ✅ RESOLVED             |
| 5. MFA Bypass Risk               | ✅ ADDRESSED | ✅ RESOLVED             |

---

## Part 3: Platform Security Comparison & Low-Risk Solution

### How GitHub and Similar Platforms Manage Multi-Organization Access

**GitHub's Model:**

- Users can belong to **multiple organizations**
- **Single account authentication** - one email + password + MFA
- **Organization-level security policies** - each org can set its own security rules
- **Organization-level MFA requirement** - can enforce MFA per organization
- **Organization-level access revocation** - can remove user from one org without affecting others

**Key Differences:**

- **GitHub's Risk**: 🔵 Lower (code repositories, less sensitive data)
- **Our Risk**: 🔴 Higher (student personal data, academic records, health information, regulatory compliance)

### How Big Companies Handle Security Breaches

**Common Breach Response Patterns:**

1. **GitHub (Multi-Organization Model)**
   - Immediate token revocation for affected organizations
   - Force re-authentication with MFA for affected users
   - Organization-level secret rotation
   - Email notifications to affected users
   - Public security advisory (if needed)
   - **Response**: MFA re-authentication first, password reset for severe cases

2. **Microsoft/Azure AD**
   - Conditional Access policies trigger immediately
   - Force MFA re-authentication
   - Revoke all tokens for affected tenants
   - Risk-based access controls activate
   - Security alerts to admins
   - **Response**: MFA re-auth primary, password reset for confirmed breaches

3. **Google Workspace**
   - Force re-authentication for affected users
   - Organization-level security policy changes
   - Revoke all sessions
   - Security investigation and audit
   - User notifications
   - **Response**: MFA re-auth standard, password reset for critical incidents

4. **AWS (Multi-Account Model)**
   - Immediate IAM role/token revocation
   - Force MFA re-authentication
   - Account-level access controls
   - Security CloudTrail logging
   - Automated response systems
   - **Response**: MFA re-auth primary, credential rotation for breaches

**Industry Standard:**

- **Primary Response**: Force MFA re-authentication (less disruptive, still secure)
- **Escalation**: Password reset for severe breaches (when password compromise suspected)
- **Rationale**: Balances security with user experience

### Security Patterns That Reduce Risk

#### 1. **Organization-Level Security Policies** ✅

**How It Works:**

- Each school can set its own security requirements
- Policies include: MFA requirements, password complexity, session timeout, IP restrictions, device management

**Benefits:**

- ✅ Schools can enforce their own security standards
- ✅ More sensitive schools can require stricter policies
- ✅ Reduces cascading risk through policy enforcement

#### 2. **Organization-Level MFA Requirements** ✅

**How It Works:**

- Schools can require MFA for all members
- Schools can require MFA for sensitive operations
- MFA can be enforced per school independently

**Benefits:**

- ✅ Can enforce MFA per school
- ✅ More sensitive schools can require stricter MFA
- ✅ Reduces cascading risk if one school is compromised

#### 3. **Organization-Level Session Management** ✅

**How It Works:**

- Separate session tokens per school
- Can revoke sessions for specific school
- Can set different session timeouts per school

**Benefits:**

- ✅ Can revoke sessions per school
- ✅ Can set different timeouts per school
- ✅ Better security isolation

#### 4. **Organization-Level Access Revocation** ✅

**How It Works:**

- Can remove user from one school without affecting others
- Can suspend access to specific school
- Can revoke tokens for specific school

**Benefits:**

- ✅ Can isolate security incidents
- ✅ Can remove access without affecting other schools
- ✅ Granular access control

#### 5. **Comprehensive Audit Logging** ✅

**How It Works:**

- Log all actions per school
- Track school switches (profile switching)
- Monitor access patterns
- Detect anomalies

**Benefits:**

- ✅ Track all access per school
- ✅ Detect suspicious activity
- ✅ Compliance requirements

#### 6. **Organization-Level Conditional Access** ✅

**How It Works:**

- Policies that apply based on school context
- Can require additional authentication for sensitive schools
- Can restrict access based on location, device, time

**Benefits:**

- ✅ Can enforce stricter policies for sensitive schools
- ✅ Location-based access control
- ✅ Time-based access restrictions

---

## Part 4: Security Policy Framework & MFA System

### Security Policy Tiers

#### Tier 1: Basic (Default for All Schools - MANDATORY)

```typescript
interface DefaultSecurityPolicy {
  // MFA Requirements
  requireMFA: true; // Mandatory
  requireMFAForSensitiveOperations: true;
  sensitiveOperations: [
    'view_student_data',
    'modify_grades',
    'view_medical_records',
    'modify_financial_data',
    'export_data',
    'delete_records',
  ];

  // Password Policy
  passwordComplexity: {
    minLength: 8;
    requireUppercase: true;
    requireLowercase: true;
    requireNumbers: true;
    requireSpecialChars: false; // Default is less strict
    maxAge: 90; // days
    preventReuse: 5; // last 5 passwords
  };

  // Session Management
  sessionTimeout: 30; // minutes
  requireMFAForSessionExtension: true;
  maxConcurrentSessions: 3;

  // Access Control
  deviceManagement: 'basic'; // Track devices, no restrictions
  loginAttemptLimit: 5; // max failed attempts
  lockoutDuration: 15; // minutes

  // Audit Requirements
  auditLevel: 'standard';
  auditRetention: 365; // days (1 year)

  // Conditional Access
  timeRestrictions: null; // No restrictions by default
  ipWhitelist: null; // No IP restrictions by default
}
```

#### Tier 2: Enhanced (Optional - Schools Can Opt-In)

```typescript
interface EnhancedSecurityPolicy extends DefaultSecurityPolicy {
  // Stricter Password Policy
  passwordComplexity: {
    minLength: 12; // Increased
    requireUppercase: true;
    requireLowercase: true;
    requireNumbers: true;
    requireSpecialChars: true; // Required
    maxAge: 60; // days (shorter)
    preventReuse: 10; // last 10 passwords
  };

  // Stricter Session Management
  sessionTimeout: 15; // minutes (shorter)
  requireMFAForSessionExtension: true;
  maxConcurrentSessions: 1; // Only one session

  // Enhanced Access Control
  deviceManagement: 'strict'; // Require device registration
  loginAttemptLimit: 3; // Lower limit
  lockoutDuration: 30; // minutes (longer)

  // Enhanced Audit
  auditLevel: 'comprehensive';
  auditRetention: 730; // days (2 years)

  // Conditional Access
  timeRestrictions: {
    allowedHours: [{ start: 6; end: 22 }]; // 6 AM to 10 PM
    allowedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  };
  ipWhitelist: string[]; // Can set IP restrictions
}
```

#### Tier 3: Maximum (Optional - Highest Security)

```typescript
interface MaximumSecurityPolicy extends EnhancedSecurityPolicy {
  // Maximum Password Policy
  passwordComplexity: {
    minLength: 16; // Maximum
    requireUppercase: true;
    requireLowercase: true;
    requireNumbers: true;
    requireSpecialChars: true;
    maxAge: 30; // days (very short)
    preventReuse: 20; // last 20 passwords
  };

  // Maximum Session Management
  sessionTimeout: 5; // minutes (very short)
  requireMFAForSessionExtension: true;
  maxConcurrentSessions: 1;
  requireMFAForEveryAction: true; // MFA for every action

  // Maximum Access Control
  deviceManagement: 'strict'; // Device registration + approval
  loginAttemptLimit: 2; // Very low
  lockoutDuration: 60; // minutes (1 hour)

  // Maximum Audit
  auditLevel: 'comprehensive';
  auditRetention: 1095; // days (3 years)

  // Maximum Conditional Access
  timeRestrictions: {
    allowedHours: [{ start: 8; end: 18 }]; // 8 AM to 6 PM only
    allowedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  };
  ipWhitelist: string[]; // Required IP whitelist
  requireVPN: true; // Require VPN connection
}
```

### MFA Implementation Framework

#### MFA Options Available

**1. SMS-Based MFA** ❕ (Simple)

- Pros: Simple to use, no additional app needed, works on any phone
- Cons: ⚠️ SMS can be intercepted (SIM swapping), less secure than TOTP

**2. Email-Based MFA** ❕ (Simple)

- Pros: Simple to use, no additional app needed, works on any device
- Cons: ⚠️ Email can be compromised, less secure than TOTP

**3. TOTP-Based MFA** ❗️❗️ (Recommended)

- Supported Apps: Google Authenticator, Microsoft Authenticator, Authy, 1Password
- Pros: ✅ More secure than SMS/Email, works offline, industry standard
- Cons: ⚠️ Requires authenticator app, can lose access if device is lost

**4. Hardware Key MFA** ❗️❗️❗️ (Maximum Security)

- Supported Devices: YubiKey, Titan Security Key, any WebAuthn/FIDO2 device
- Pros: ✅ Maximum security, physical device required, resistant to phishing
- Cons: ⚠️ Requires hardware purchase, can lose device, more complex setup

#### MFA Requirements per Operation

```typescript
const mfaRequirements: MFARequirement[] = [
  {
    operation: 'login',
    requireMFA: true,
    mfaLevel: 'basic', // SMS, Email, TOTP, Hardware Key
    allowedMethods: ['sms', 'email', 'totp', 'hardware_key'],
  },
  {
    operation: 'view_student_data',
    requireMFA: true,
    mfaLevel: 'high', // TOTP or Hardware Key only
    allowedMethods: ['totp', 'hardware_key'],
  },
  {
    operation: 'modify_grades',
    requireMFA: true,
    mfaLevel: 'high',
    allowedMethods: ['totp', 'hardware_key'],
  },
  {
    operation: 'export_data',
    requireMFA: true,
    mfaLevel: 'maximum', // Hardware Key only
    allowedMethods: ['hardware_key'],
  },
  {
    operation: 'delete_records',
    requireMFA: true,
    mfaLevel: 'maximum',
    allowedMethods: ['hardware_key'],
  },
];
```

---

## Part 5: Security Mitigation Strategies

### 1. School-Specific JWT Secrets 🔑 (Platform Admin Only)

**Implementation:**

Each school has its own unique JWT signing secret, preventing cross-school token reuse. Secrets are **automatically generated** for dynamic school creation and **managed exclusively by platform admins**. Schools cannot access these secrets.

**Secret Management:**

- **Auto-Generated**: Secrets automatically generated when schools are created on the fly
- **Platform Admin Only**: Only platform admins (Architect, SuperAdmin) can manage secrets
- **Schools Cannot Access**: Schools have no visibility or access to JWT secrets
- **Encrypted Storage**: All secrets encrypted at rest in database

```typescript
// School JWT configuration
interface SchoolJWTConfig {
  schoolId: UUID;
  jwtSecret: string; // Encrypted, unique per school
  secretSource: 'auto_generated'; // Automatically generated
  secretRotationDate: Date;
  previousSecrets: string[]; // For graceful rotation (keep last 2)
  rotationReason?: string; // 'scheduled' | 'emergency' | 'breach_response'
  emergencyRotation?: boolean;
  managedBy: 'platform_admin'; // Only platform admins can manage
  accessibleBySchools: false; // Schools cannot access secrets
}

// Initialize secret (automated for dynamic school creation)
async initializeSchoolJWTSecret(schoolId: UUID): Promise<void> {
  // Auto-generate 256-bit random secret
  const secret = this.generateSecureSecret();

  await this.prisma.schoolJWTConfig.create({
    data: {
      schoolId,
      jwtSecret: await this.encryptSecret(secret), // Encrypted at rest
      secretSource: 'auto_generated',
      secretRotationDate: new Date(),
      previousSecrets: [],
      managedBy: 'platform_admin',
      accessibleBySchools: false
    }
  });
}

// Get secret (platform admin only - schools cannot access)
async getSchoolJWTSecret(schoolId: UUID, requesterRole: string): Promise<string> {
  // Only platform admins can access secrets
  if (requesterRole !== 'platform_admin' && requesterRole !== 'architect') {
    throw new Error('Unauthorized: Only platform admins can access JWT secrets');
  }

  const config = await this.getSchoolJWTConfig(schoolId);
  return await this.decryptSecret(config.jwtSecret);
}

// Create token with school-specific secret
async createSchoolToken(
  userId: UUID,
  profileId: UUID,
  schoolId: UUID,
  role: string,
  permissions: string[],
  clearanceLevel: number
): Promise<string> {
  // Internal use - no role check needed (system operation)
  const schoolSecret = await this.getSchoolJWTSecretInternal(schoolId);

  return this.jwtService.sign({
    userId,
    currentProfileId: profileId,
    tenantId: schoolId,
    role,
    permissions,
    clearanceLevel,
    iat: Math.floor(Date.now() / 1000)
  }, {
    secret: schoolSecret, // School-specific secret
    expiresIn: this.getSchoolSessionTimeout(schoolId)
  });
}

// Verify token with school-specific secret
async verifySchoolToken(token: string, schoolId: UUID): Promise<JWTToken> {
  const config = await this.getSchoolJWTConfig(schoolId);
  const currentSecret = await this.decryptSecret(config.jwtSecret);

  try {
    const decoded = this.jwtService.verify(token, {
      secret: currentSecret // Must match school
    });

    // Verify token belongs to this school
    if (decoded.tenantId !== schoolId) {
      throw new Error('Token does not belong to this school');
    }

    return decoded;
  } catch (error) {
    // Try previous secrets (for graceful rotation)
    for (const previousSecret of config.previousSecrets) {
      try {
        const decryptedPrevious = await this.decryptSecret(previousSecret);
        return this.jwtService.verify(token, { secret: decryptedPrevious });
      } catch {
        continue;
      }
    }
    throw new Error('Invalid token or secret mismatch');
  }
}
```

**Secret Rotation:**

**What is Secret Rotation?**

- Regularly changing JWT signing secrets to limit exposure window
- Reduces risk if a secret is compromised
- Industry best practice (NIST, OWASP recommend regular rotation)

**Rotation Types:**

1. **Scheduled Rotation** (Regular - Every 90-180 days)

```typescript
// Scheduled rotation (graceful transition)
async scheduledSecretRotation(schoolId: UUID): Promise<void> {
  const config = await this.getSchoolJWTConfig(schoolId);
  const newSecret = this.generateSecureSecret();

  // Keep old secret for 24 hours (graceful transition)
  await this.prisma.schoolJWTConfig.update({
    where: { schoolId },
    data: {
      jwtSecret: await this.encryptSecret(newSecret),
      previousSecrets: [
        config.jwtSecret,
        ...config.previousSecrets.slice(0, 1) // Keep last 2
      ].map(s => this.encryptSecret(s)),
      secretRotationDate: new Date(),
      rotationReason: 'scheduled',
      emergencyRotation: false
    }
  });

  // After 24 hours, invalidate old tokens (graceful transition)
  setTimeout(async () => {
    await this.revokeOldTokens(schoolId, config.jwtSecret);
  }, 24 * 60 * 60 * 1000);
}
```

2. **Emergency Rotation** (Breach Response - Immediate)

```typescript
// Emergency rotation (breach response - no grace period)
async emergencySecretRotation(
  schoolId: UUID,
  reason: string,
  forceReauth: boolean = true
): Promise<void> {
  const newSecret = this.generateSecureSecret();
  const config = await this.getSchoolJWTConfig(schoolId);

  // Immediate rotation - don't keep old secret
  await this.prisma.schoolJWTConfig.update({
    where: { schoolId },
    data: {
      jwtSecret: await this.encryptSecret(newSecret),
      previousSecrets: [], // Don't keep old secret (breach response)
      secretRotationDate: new Date(),
      rotationReason: reason,
      emergencyRotation: true
    }
  });

  // Immediately invalidate all sessions
  await this.revokeAllSchoolSessions(schoolId);

  // Force re-authentication if requested
  if (forceReauth) {
    await this.forceSchoolReauthentication(schoolId);
  }

  // Log emergency action
  await this.auditLog.create({
    schoolId,
    action: 'emergency_secret_rotation',
    reason,
    timestamp: new Date(),
    severity: 'critical'
  });
}
```

**Benefits:**

- ✅ **Critical Protection**: Tokens signed with School A's secret cannot be used for School B
- ✅ **Cross-School Isolation**: Compromised token for one school does not grant access to other schools
- ✅ **Automated Generation**: Secrets auto-generated for dynamic school creation (no manual intervention)
- ✅ **Platform Admin Control**: Only platform admins can manage secrets (schools cannot access)
- ✅ **Independent Rotation**: Each school can rotate secrets independently
- ✅ **Graceful Rotation**: Scheduled rotation keeps old secrets temporarily for smooth transition
- ✅ **Emergency Response**: Immediate rotation for breach response without grace period

---

### 2. Strict Context Validation ✅

**Implementation:**

Validates on every request that user belongs to school and profile is active.

```typescript
// Validate school context on every request
async validateSchoolContext(
  userId: UUID,
  schoolId: UUID,
  profileId: UUID
): Promise<boolean> {
  // 1. Verify user-tenant relationship exists and is active
  const userTenant = await this.prisma.userTenant.findFirst({
    where: {
      userId,
      tenantId: schoolId,
      id: profileId,
      status: 'active' // Must be active
    }
  });

  if (!userTenant) {
    await this.logUnauthorizedAccess(userId, schoolId, profileId, 'profile_not_found');
    throw new Error('User does not belong to this school or profile is inactive');
  }

  // 2. Verify profile is not suspended
  if (userTenant.suspended) {
    await this.logUnauthorizedAccess(userId, schoolId, profileId, 'profile_suspended');
    throw new Error('Profile access is suspended');
  }

  // 3. Verify invitation was accepted (if applicable)
  if (userTenant.status === 'pending') {
    throw new Error('Profile invitation not yet accepted');
  }

  // 4. Verify user was added by authorized admin (audit check)
  const addedBy = await this.prisma.user.findUnique({
    where: { id: userTenant.addedBy }
  });

  if (!addedBy || !addedBy.isActive) {
    // Log suspicious activity
    await this.logSecurityAnomaly({
      userId,
      schoolId,
      profileId,
      anomalyType: 'unauthorized_profile_access',
      details: 'User added by inactive admin'
    });
  }

  return true;
}

// Middleware for context validation
class StrictContextValidationMiddleware {
  async validateRequest(context: Request): Promise<SecurityContext> {
    const { userId, profileId, schoolId } = this.extractFromToken(context);

    // Validate school context
    await this.validateSchoolContext(userId, schoolId, profileId);

    // Load profile details
    const profile = await this.getProfile(userId, profileId);

    return {
      userId,
      profileId,
      schoolId,
      role: profile.role,
      clearanceLevel: profile.clearanceLevel,
      permissions: profile.permissions
    };
  }
}
```

**Benefits:**

- ✅ **Only Invited Schools**: Ensures only schools user was invited/added to are accessible
- ✅ **Immediate Blocking**: Suspended profiles are immediately blocked
- ✅ **Pending Invitations**: Pending invitations cannot be used until accepted
- ✅ **Audit Trail**: All unauthorized access attempts are logged

---

### 3. Clearance Level Validation (0-10 Hierarchy) ✅

**Implementation:**

Leverages access control clearance levels to enforce role hierarchy.

```typescript
// Clearance level requirements per operation
interface ClearanceRequirement {
  operation: string;
  requiredClearanceLevel: number; // 0-10 (Architect=10, SuperAdmin=9, Owner=8, etc.)
  requiredPermissions: string[];
  description: string;
}

// Clearance level definitions (from _requirements/access-control.md)
const CLEARANCE_LEVELS = {
  ARCHITECT: 10,    // Complete System Access
  SUPERADMIN: 9,    // Complete System Access (with approval)
  OWNER: 8,         // Full School Access
  MANAGEMENT: 7,   // Broad School Access
  ITSUPPORT: 6,     // Technical Maintenance Access
  FINANCE: 5,       // Financial & Legal Access
  OPERATIONS: 4,    // Logistics & Operations Access
  TEACHER: 3,       // Classroom & Student Access
  PARENT: 2,        // Children's Information Access
  STUDENT: 1,       // Own Academic Information Access
  GUEST: 0          // Limited Public Information Access
};

// Validate clearance level for operation
async validateClearanceLevel(
  userId: UUID,
  profileId: UUID,
  operation: string
): Promise<boolean> {
  const profile = await this.getProfile(userId, profileId);
  const requirement = this.getClearanceRequirement(operation);

  // Check clearance level
  if (profile.clearanceLevel < requirement.requiredClearanceLevel) {
    await this.logUnauthorizedAccess(
      userId,
      profileId,
      operation,
      'insufficient_clearance',
      {
        userLevel: profile.clearanceLevel,
        requiredLevel: requirement.requiredClearanceLevel
      }
    );
    throw new Error(
      `Operation requires clearance level ${requirement.requiredClearanceLevel}, ` +
      `user has level ${profile.clearanceLevel}`
    );
  }

  // Check specific permissions
  const hasPermission = requirement.requiredPermissions.every(
    perm => profile.permissions.includes(perm)
  );

  if (!hasPermission) {
    await this.logUnauthorizedAccess(
      userId,
      profileId,
      operation,
      'insufficient_permissions',
      {
        requiredPermissions: requirement.requiredPermissions,
        userPermissions: profile.permissions
      }
    );
    throw new Error('Insufficient permissions for this operation');
  }

  return true;
}

// Example clearance requirements
const clearanceRequirements: ClearanceRequirement[] = [
  {
    operation: 'students.delete',
    requiredClearanceLevel: CLEARANCE_LEVELS.MANAGEMENT, // 7
    requiredPermissions: ['students.delete'],
    description: 'Delete student records'
  },
  {
    operation: 'grades.modify',
    requiredClearanceLevel: CLEARANCE_LEVELS.TEACHER, // 3
    requiredPermissions: ['grades.edit'],
    description: 'Modify grades'
  },
  {
    operation: 'platform.override',
    requiredClearanceLevel: CLEARANCE_LEVELS.SUPERADMIN, // 9
    requiredPermissions: ['platform.override'],
    description: 'Platform-level override access'
  },
  {
    operation: 'financial.transactions',
    requiredClearanceLevel: CLEARANCE_LEVELS.FINANCE, // 5
    requiredPermissions: ['payments.edit', 'financial_reports.view'],
    description: 'Process financial transactions'
  }
];

// Get clearance requirement for operation
function getClearanceRequirement(operation: string): ClearanceRequirement {
  const requirement = clearanceRequirements.find(r => r.operation === operation);
  if (!requirement) {
    // Default to highest clearance if not specified
    return {
      operation,
      requiredClearanceLevel: CLEARANCE_LEVELS.ARCHITECT,
      requiredPermissions: [],
      description: 'Unknown operation'
    };
  }
  return requirement;
}
```

**Benefits:**

- ✅ **Role Hierarchy Enforcement**: Clearance levels (0-10) enforce role hierarchy
- ✅ **Cross-School Protection**: Prevents privilege escalation across schools
- ✅ **Granular Control**: Each operation has specific clearance level requirement
- ✅ **Audit Trail**: All clearance violations are logged with details

---

### 4. Permission Validation on Every Request ✅

**Implementation:**

Granular permission checks using the 300+ permission system.

```typescript
// Validate permissions for operation
async validatePermissions(
  userId: UUID,
  profileId: UUID,
  operation: string,
  resource?: string
): Promise<boolean> {
  const profile = await this.getProfile(userId, profileId);

  // Get required permissions for operation
  const requiredPermissions = this.getRequiredPermissions(operation, resource);

  // Check if user has all required permissions
  const hasAllPermissions = requiredPermissions.every(
    requiredPerm => {
      // Check exact permission match
      if (profile.permissions.includes(requiredPerm)) {
        return true;
      }

      // Check context-aware permissions (e.g., 'students.edit.own_classes')
      if (resource) {
        const contextPerm = this.getContextPermission(requiredPerm, resource, profile);
        if (profile.permissions.includes(contextPerm)) {
          return true;
        }
      }

      return false;
    }
  );

  if (!hasAllPermissions) {
    await this.logUnauthorizedAccess(
      userId,
      profileId,
      operation,
      'insufficient_permissions',
      {
        requiredPermissions,
        userPermissions: profile.permissions,
        resource
      }
    );
    throw new Error('Insufficient permissions for this operation');
  }

  return true;
}

// Get context-aware permission (e.g., 'students.edit.own_classes')
function getContextPermission(
  basePermission: string,
  resource: string,
  profile: Profile
): string {
  // Example: 'students.edit' + 'own_classes' = 'students.edit.own_classes'
  if (profile.role === 'teacher') {
    return `${basePermission}.own_classes`;
  }
  if (profile.role === 'parent') {
    return `${basePermission}.children`;
  }
  return basePermission;
}
```

**Benefits:**

- ✅ **Granular Control**: 300+ permissions provide fine-grained access control
- ✅ **Profile-Specific**: Permissions are profile-specific (no cross-profile inheritance)
- ✅ **Context-Aware**: Supports context-aware permissions (e.g., 'own_classes', 'children')
- ✅ **Audit Trail**: All permission violations are logged

---

### 5. Multi-Layer Validation Middleware

**Implementation:**

Combines all validations into a single middleware that runs on every request.

```typescript
// Comprehensive security validation middleware
class MultiLayerSecurityValidationMiddleware {
  async validateRequest(context: Request): Promise<SecurityContext> {
    const { userId, profileId, schoolId } = this.extractFromToken(context);
    const operation = this.getOperation(context);

    // Layer 1: Verify JWT signature with school-specific secret
    await this.verifySchoolToken(context.headers.authorization, schoolId);

    // Layer 2: Validate user belongs to school and profile is active
    await this.validateSchoolContext(userId, schoolId, profileId);

    // Layer 3: Validate clearance level for operation
    await this.validateClearanceLevel(userId, profileId, operation);

    // Layer 4: Validate specific permissions
    const resource = this.getResource(context);
    await this.validatePermissions(userId, profileId, operation, resource);

    // Layer 5: Check school security policy (MFA, IP restrictions, time restrictions)
    await this.checkSecurityPolicy(userId, schoolId, operation);

    // Load final context
    const profile = await this.getProfile(userId, profileId);

    return {
      userId,
      profileId,
      schoolId,
      role: profile.role,
      clearanceLevel: profile.clearanceLevel,
      permissions: profile.permissions,
    };
  }
}
```

**Benefits:**

- ✅ **Defense in Depth**: Multiple validation layers prevent bypass
- ✅ **Comprehensive Security**: All security checks applied on every request
- ✅ **Early Failure**: Fails fast if any validation fails
- ✅ **Complete Audit**: All validation failures are logged

---

### 6. Profile-Specific Session Tokens

**Implementation:**

```typescript
// JWT token includes current profile with clearance level
interface JWTToken {
  userId: UUID;
  currentProfileId: UUID; // User-tenant relationship ID
  tenantId: UUID;
  role: string;
  clearanceLevel: number; // 0-10 clearance level
  permissions: string[];
  iat: number;
  exp: number;
}

// Profile switch generates new token with school-specific secret
async switchProfile(userId: UUID, profileId: UUID): Promise<string> {
  const profile = await this.validateProfileOwnership(userId, profileId);

  // Generate new token with school-specific secret
  const token = await this.createSchoolToken(
    userId,
    profileId,
    profile.tenantId,
    profile.role,
    profile.permissions,
    profile.clearanceLevel
  );

  return token;
}
```

**Benefits:**

- ✅ Token tied to specific profile
- ✅ Can revoke token for specific profile
- ✅ More granular access control

### 2. Profile-Level Suspension

**Implementation:**

```typescript
// Suspend profile without affecting others
async suspendProfile(profileId: UUID, reason: string, suspendedBy: UUID) {
  await this.updateProfile(profileId, {
    status: 'suspended',
    suspendedAt: new Date(),
    suspendedBy,
    suspensionReason: reason
  });

  // Invalidate any active sessions for this profile
  await this.revokeProfileSessions(profileId);
}
```

**Benefits:**

- ✅ Can isolate security incidents
- ✅ Suspend one profile without affecting others
- ✅ Granular access control

### 3. Enhanced Audit Logging

**Implementation:**

```typescript
// Log all profile-related actions
async logProfileAction(
  userId: UUID,
  profileId: UUID,
  action: string,
  resource: string
) {
  await this.auditLog.create({
    userId,
    profileId,
    tenantId: await this.getTenantId(profileId),
    action,
    resource,
    ipAddress: this.request.ip,
    userAgent: this.request.headers['user-agent'],
    timestamp: new Date()
  });
}
```

**Benefits:**

- ✅ Track all profile access
- ✅ Detect suspicious profile switching
- ✅ Compliance and security monitoring

### 4. Anomaly Detection

**Implementation:**

```typescript
// Detect suspicious profile switching patterns
async detectAnomalies(userId: UUID): Promise<Anomaly[]> {
  const recentActions = await this.getRecentActions(userId, 24 * 60 * 60);
  const anomalies: Anomaly[] = [];

  // Detect rapid profile switching
  const profileSwitches = recentActions.filter(a => a.action === 'profile_switch');
  if (profileSwitches.length > 10) {
    anomalies.push({
      userId,
      anomalyType: 'rapid_switching',
      detectedAt: new Date(),
      severity: 'medium',
      details: { switchCount: profileSwitches.length }
    });
  }

  return anomalies;
}
```

**Benefits:**

- ✅ Detect suspicious activity
- ✅ Alert on potential security breaches
- ✅ Proactive security monitoring

### 5. Organization-Level Security Policies

**Implementation:**

```typescript
// School security policy enforcement
async createSchoolSession(userId: UUID, schoolId: UUID): Promise<string> {
  const policy = await this.getSchoolSecurityPolicy(schoolId);

  // Check if MFA is required
  if (policy.requireMFA) {
    const mfaVerified = await this.verifyMFA(userId);
    if (!mfaVerified) {
      throw new Error('MFA required for this school');
    }
  }

  // Create session with school-specific timeout
  const session = await this.sessionService.create({
    userId,
    schoolId,
    expiresAt: new Date(Date.now() + policy.sessionTimeout * 60 * 1000),
    mfaVerified: policy.requireMFA
  });

  return this.jwtService.sign({
    userId,
    schoolId,
    sessionId: session.id,
    expiresAt: session.expiresAt
  });
}
```

**Benefits:**

- ✅ Schools can enforce their own security standards
- ✅ More sensitive schools can require stricter policies
- ✅ Reduces cascading risk through policy enforcement

---

### 6. Breach Response & Force Re-authentication 🔒

**Implementation:**

Graduated breach response strategy: **MFA re-authentication as primary response**, with password reset reserved for severe breaches. This aligns with industry practices (GitHub, Microsoft, Google, AWS).

**Breach Response Levels:**

```typescript
// Breach severity levels
enum BreachSeverity {
  LOW = 'low',           // Suspicious activity - MFA re-auth only
  MEDIUM = 'medium',     // Potential compromise - MFA re-auth + enhanced monitoring
  HIGH = 'high',         // Likely compromise - MFA re-auth + password reset
  CRITICAL = 'critical'  // Confirmed breach - Password reset + MFA + account review
}

// Primary breach response: Force MFA re-authentication
async forceMFAReauthentication(
  schoolId: UUID,
  reason: string,
  escalateToPasswordReset: boolean = false
): Promise<void> {
  // 1. Rotate secret (if needed for breach)
  await this.emergencySecretRotation(schoolId, reason, true);

  // 2. Revoke all sessions
  await this.revokeAllSchoolSessions(schoolId);

  // 3. Force MFA re-authentication for all users
  await this.markAllUsersForMFAReauth(schoolId);

  // 4. Optionally force password reset (for severe breaches)
  if (escalateToPasswordReset) {
    await this.forcePasswordReset(schoolId);
  }

  // 5. Notify users
  await this.notifySchoolUsers(schoolId, {
    message: escalateToPasswordReset
      ? 'Security incident detected. Please log in and reset your password.'
      : 'Security verification required. Please log in with MFA.',
    requiresReauth: true,
    requiresPasswordReset: escalateToPasswordReset
  });

  // 6. Log breach response
  await this.auditLog.create({
    schoolId,
    action: 'breach_response_force_reauth',
    reason,
    escalatedToPasswordReset: escalateToPasswordReset,
    timestamp: new Date(),
    severity: escalateToPasswordReset ? 'critical' : 'high'
  });
}

// Graduated breach response
async respondToBreach(schoolId: UUID, severity: BreachSeverity): Promise<void> {
  switch (severity) {
    case BreachSeverity.LOW:
      // Force MFA re-authentication only
      await this.forceMFAReauthentication(schoolId, 'Suspicious activity detected');
      break;

    case BreachSeverity.MEDIUM:
      // Force MFA re-auth + enhanced monitoring
      await this.forceMFAReauthentication(schoolId, 'Potential security compromise');
      await this.enableEnhancedMonitoring(schoolId);
      break;

    case BreachSeverity.HIGH:
      // Force MFA re-auth + password reset
      await this.forceMFAReauthentication(schoolId, 'Security breach detected', true);
      break;

    case BreachSeverity.CRITICAL:
      // Full security response
      await this.forceMFAReauthentication(schoolId, 'Confirmed security breach', true);
      await this.forceAccountReview(schoolId);
      await this.enhanceMFARequirements(schoolId);
      await this.enableSecurityInvestigationMode(schoolId);
      break;
  }
}

// Platform-wide breach response
async respondToPlatformBreach(severity: 'critical'): Promise<void> {
  // 1. Rotate secrets for ALL schools
  await this.rotateAllSchoolSecrets();

  // 2. Force all users to re-authenticate with MFA
  await this.forcePlatformWideMFAReauthentication();

  // 3. Force password reset for all users
  await this.forceGlobalPasswordReset();

  // 4. Enhance MFA requirements
  await this.enforceStricterMFA();

  // 5. Notify all users
  await this.notifyAllUsers('Platform-wide security incident detected. Please log in and reset your password.');

  // 6. Enable security investigation mode
  await this.enableSecurityInvestigationMode();

  // 7. Log platform-wide action
  await this.auditLog.create({
    action: 'platform_wide_breach_response',
    severity: 'critical',
    timestamp: new Date()
  });
}

// Profile-level breach response
async respondToProfileBreach(profileId: UUID): Promise<void> {
  // 1. Suspend profile immediately
  await this.suspendProfile(profileId, 'Security breach', SYSTEM_ADMIN_ID);

  // 2. Revoke all sessions for this profile
  await this.revokeProfileSessions(profileId);

  // 3. Force password reset for user account
  await this.forceUserPasswordReset(profileId);

  // 4. Enhance MFA requirements
  await this.requireStricterMFA(profileId);

  // 5. Notify user
  await this.notifyUser(profileId, 'Your account security has been compromised. Please reset your password.');
}
```

**Why MFA Re-authentication First (Industry Standard):**

1. **Less Disruptive**: Users keep their password, faster recovery
2. **Still Secure**: MFA verification required, sessions invalidated
3. **Standard Practice**: GitHub, Google, Microsoft use this approach
4. **Better UX**: Users can recover quickly without password reset

**When to Escalate to Password Reset:**

- **High Severity**: Password compromise suspected
- **Critical Severity**: Account takeover confirmed
- **School-Wide Breach**: Multiple accounts affected
- **Confirmed Breach**: Security investigation confirms password compromise

**Benefits:**

- ✅ **Graduated Response**: Appropriate response based on severity
- ✅ **Industry Standard**: Aligns with GitHub, Microsoft, Google practices
- ✅ **User-Friendly**: MFA re-auth less disruptive than password reset
- ✅ **Secure**: Full session revocation and MFA verification
- ✅ **Flexible**: Can escalate to password reset when needed

---

## Part 6: Policy Management

### School Admin Policy Management

```typescript
// School admin can view and update their school's security policy
async updateSchoolPolicy(
  schoolId: UUID,
  updates: Partial<SchoolSecurityPolicy>,
  updatedBy: UUID // School admin ID
): Promise<SchoolSecurityPolicy> {
  const currentPolicy = await this.getSchoolPolicy(schoolId);

  // Cannot downgrade security
  if (updates.passwordComplexity?.minLength < currentPolicy.passwordComplexity.minLength) {
    throw new Error('Cannot reduce password complexity');
  }

  if (updates.sessionTimeout && updates.sessionTimeout > currentPolicy.sessionTimeout) {
    throw new Error('Cannot increase session timeout (reduces security)');
  }

  // Apply updates
  const updatedPolicy = { ...currentPolicy, ...updates };

  // Log policy change
  await this.auditLog.create({
    schoolId,
    action: 'policy_updated',
    updatedBy,
    changes: updates,
    timestamp: new Date()
  });

  return updatedPolicy;
}
```

### Platform Admin Policy Management

```typescript
// Platform admin can override any school's policy (emergency response)
async setEmergencyPolicy(
  schoolId: UUID,
  emergencyPolicy: EmergencySecurityPolicy,
  setBy: UUID // Platform admin ID
): Promise<void> {
  const emergencyPolicyConfig = {
    ...emergencyPolicy,
    enforcedBy: 'platform_admin',
    enforcedAt: new Date(),
    enforcedByUserId: setBy,
    reason: emergencyPolicy.reason
  };

  await this.policyService.setEmergencyPolicy(schoolId, emergencyPolicyConfig);

  // Log emergency action
  await this.auditLog.create({
    schoolId,
    action: 'emergency_policy_set',
    setBy,
    policy: emergencyPolicy,
    timestamp: new Date(),
    severity: 'high'
  });

  // Notify school admins
  await this.notificationService.sendToSchoolAdmins(schoolId, {
    type: 'emergency_policy',
    message: `Emergency security policy has been set by platform admin: ${emergencyPolicy.reason}`
  });
}
```

---

## Part 7: Implementation Details

### Secret Management (Platform Admin Only)

**Secret Lifecycle:**

1. **Initialization** (School Creation)
   - Secret auto-generated when school is created
   - Stored encrypted in database
   - Only platform admins can access secrets
   - Schools have no visibility to secrets

2. **Scheduled Rotation** (Every 90-180 days)
   - Automated rotation process
   - Old secret kept for 24 hours (graceful transition)
   - After grace period, old tokens invalidated
   - Users re-authenticate with new tokens

3. **Emergency Rotation** (Breach Response)
   - Immediate rotation when security incident detected
   - Old secret not kept (immediate invalidation)
   - All sessions revoked immediately
   - Force re-authentication required

4. **Access Control**
   - Only platform admins (Architect, SuperAdmin) can view/manage secrets
   - Schools cannot access secrets
   - All secret access logged and audited

### Tenant Context Management

```typescript
// Request Context
interface TenantContext {
  tenantId: UUID;
  userId: UUID;
  profileId: UUID; // User-tenant relationship ID
  role: string;
  permissions: Permission[];
}

// Middleware
class TenantContextMiddleware {
  async resolve(context: Request): Promise<TenantContext> {
    // 1. Get user from JWT token
    const user = await this.getUserFromToken(context);

    // 2. Get tenant from token (includes profileId)
    const { tenantId, profileId } = this.extractTenantFromToken(context);

    // 3. Validate user belongs to tenant and profile is active
    const profile = await this.validateProfile(user.id, tenantId, profileId);

    // 4. Load user's role and permissions for this profile
    const permissions = await this.getPermissions(user.id, profileId);

    return {
      tenantId,
      userId: user.id,
      profileId,
      role: profile.role,
      permissions,
    };
  }
}
```

### Database Query Filtering

```typescript
// All queries automatically filter by tenant
class BaseRepository {
  async findAll(tenantId: UUID, filters: any) {
    return this.prisma.model.findMany({
      where: {
        tenant_id: tenantId, // Always include tenant filter
        ...filters,
      },
    });
  }
}
```

### Role-Based Data Filtering

```typescript
// Teacher role: See students in assigned classes
async getStudents(tenantId: UUID, userId: UUID, role: string) {
  if (role === 'teacher') {
    return this.prisma.student.findMany({
      where: {
        tenant_id: tenantId,
        classes: {
          some: {
            teacher_id: userId
          }
        }
      }
    });
  }

  // Parent role: See only own children
  if (role === 'parent') {
    return this.prisma.student.findMany({
      where: {
        tenant_id: tenantId,
        guardian_info: {
          some: {
            user_id: userId
          }
        }
      }
    });
  }
}
```

---

## Part 8: Database Schema

### Security Policies Table

```sql
CREATE TABLE school_security_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  policy_tier VARCHAR(20) NOT NULL CHECK (policy_tier IN ('basic', 'enhanced', 'maximum')),

  -- MFA Configuration
  require_mfa BOOLEAN DEFAULT true NOT NULL,
  require_mfa_for_sensitive_operations BOOLEAN DEFAULT true NOT NULL,
  sensitive_operations JSONB DEFAULT '[]',

  -- Password Policy
  password_min_length INTEGER DEFAULT 8 NOT NULL,
  password_require_uppercase BOOLEAN DEFAULT true NOT NULL,
  password_require_lowercase BOOLEAN DEFAULT true NOT NULL,
  password_require_numbers BOOLEAN DEFAULT true NOT NULL,
  password_require_special_chars BOOLEAN DEFAULT false NOT NULL,
  password_max_age INTEGER DEFAULT 90 NOT NULL, -- days
  password_prevent_reuse INTEGER DEFAULT 5 NOT NULL, -- last N passwords

  -- Session Management
  session_timeout INTEGER DEFAULT 30 NOT NULL, -- minutes
  require_mfa_for_session_extension BOOLEAN DEFAULT true NOT NULL,
  max_concurrent_sessions INTEGER DEFAULT 3 NOT NULL,

  -- Access Control
  device_management VARCHAR(20) DEFAULT 'basic' CHECK (device_management IN ('none', 'basic', 'strict')),
  login_attempt_limit INTEGER DEFAULT 5 NOT NULL,
  lockout_duration INTEGER DEFAULT 15 NOT NULL, -- minutes

  -- Conditional Access
  time_restrictions JSONB,
  ip_whitelist JSONB,
  require_vpn BOOLEAN DEFAULT false,

  -- Audit
  audit_level VARCHAR(20) DEFAULT 'standard' CHECK (audit_level IN ('basic', 'standard', 'comprehensive')),
  audit_retention INTEGER DEFAULT 365 NOT NULL, -- days

  -- Policy Management
  is_default BOOLEAN DEFAULT true,
  is_emergency BOOLEAN DEFAULT false,
  enforced_by VARCHAR(20) CHECK (enforced_by IN ('school_admin', 'platform_admin')),
  enforced_by_user_id UUID REFERENCES users(id),
  enforced_at TIMESTAMP,
  reason TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_school_security_policies_school_id ON school_security_policies(school_id);
CREATE INDEX idx_school_security_policies_tier ON school_security_policies(policy_tier);
```

### MFA Configuration Table

```sql
CREATE TABLE user_mfa_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  mfa_type VARCHAR(20) NOT NULL CHECK (mfa_type IN ('sms', 'email', 'totp', 'hardware_key')),
  is_primary BOOLEAN DEFAULT false,
  is_backup BOOLEAN DEFAULT false,

  -- SMS/Email Configuration
  phone_number VARCHAR(20),
  email VARCHAR(255),

  -- TOTP Configuration
  totp_secret VARCHAR(255), -- Encrypted
  totp_algorithm VARCHAR(10) DEFAULT 'SHA1',
  totp_period INTEGER DEFAULT 30,
  totp_digits INTEGER DEFAULT 6,

  -- Hardware Key Configuration
  credential_id VARCHAR(255),
  public_key TEXT, -- Encrypted

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_mfa_configs_user_id ON user_mfa_configs(user_id);
CREATE INDEX idx_user_mfa_configs_school_id ON user_mfa_configs(school_id);
CREATE INDEX idx_user_mfa_configs_type ON user_mfa_configs(mfa_type);
```

### School JWT Secrets Table

```sql
CREATE TABLE school_jwt_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE UNIQUE,

  jwt_secret TEXT NOT NULL, -- Encrypted at rest
  secret_source VARCHAR(20) DEFAULT 'auto_generated' CHECK (secret_source IN ('auto_generated', 'environment_variable', 'manual_input')),
  secret_rotation_date TIMESTAMP DEFAULT NOW(),
  previous_secrets JSONB DEFAULT '[]', -- Encrypted previous secrets (for graceful rotation)

  rotation_reason VARCHAR(50) CHECK (rotation_reason IN ('scheduled', 'emergency', 'breach_response', 'manual')),
  emergency_rotation BOOLEAN DEFAULT false,

  -- Access Control
  managed_by VARCHAR(20) DEFAULT 'platform_admin' CHECK (managed_by IN ('platform_admin', 'architect')),
  accessible_by_schools BOOLEAN DEFAULT false, -- Schools cannot access secrets

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_school_jwt_configs_school_id ON school_jwt_configs(school_id);
CREATE INDEX idx_school_jwt_configs_rotation_date ON school_jwt_configs(secret_rotation_date);
```

---

## Part 9: Risk Reduction Summary

### ✅ How This Approach Reduces Risk

1. **Organization-Level Security Policies**
   - ✅ Schools can enforce their own security standards
   - ✅ More sensitive schools can require stricter policies
   - ✅ Reduces cascading risk through policy enforcement

2. **Organization-Level MFA Requirements**
   - ✅ Can require MFA per school
   - ✅ Can require MFA for sensitive operations
   - ✅ Reduces cascading risk if one school is compromised

3. **Organization-Level Session Management**
   - ✅ Separate sessions per school
   - ✅ Can revoke sessions for specific school
   - ✅ Better security isolation

4. **Organization-Level Access Revocation**
   - ✅ Can remove access without affecting other schools
   - ✅ Can isolate security incidents
   - ✅ Granular access control

5. **Comprehensive Audit Logging**
   - ✅ Track all access per school
   - ✅ Detect suspicious activity
   - ✅ Compliance requirements

6. **Profile-Level Isolation**
   - ✅ Profile-specific session tokens
   - ✅ Profile-level suspension
   - ✅ Enhanced audit logging per profile
   - ✅ Anomaly detection

7. **Automated Secret Management**
   - ✅ Auto-generated secrets for dynamic school creation
   - ✅ Platform admin only access (schools cannot access secrets)
   - ✅ Scheduled secret rotation (every 90-180 days)
   - ✅ Emergency secret rotation for breach response

8. **Graduated Breach Response**
   - ✅ MFA re-authentication as primary response (less disruptive)
   - ✅ Password reset for severe breaches (when needed)
   - ✅ Force re-authentication capabilities
   - ✅ Platform-wide and school-specific breach response

### Risk Comparison

**GitHub Model (No Organization Policies):**

- ❌ Cascading risk if account compromised
- ❌ No organization-level security policies
- ❌ No organization-level MFA requirements
- ⚠️ Risk Level: **MEDIUM** (lower stakes data)

**Our Model (With Organization Policies + Profile Isolation + Automated Secrets):**

- ✅ Reduced cascading risk through policies
- ✅ Organization-level security policies (mandatory)
- ✅ Organization-level MFA requirements (mandatory)
- ✅ Organization-level access revocation
- ✅ Profile-level isolation
- ✅ School-specific JWT secrets (automated generation)
- ✅ Secret rotation (scheduled + emergency)
- ✅ Graduated breach response (MFA re-auth + password reset)
- ✅ Risk Level: **LOW** (with proper implementation)

---

## Part 10: Final Recommendation

### ✅ Recommended Approach: Profile-Based with Organization-Level Security Policies

**Key Features:**

1. **Admin-Controlled Registration**: Schools register first, users added by admins
2. **Single Account Authentication**: User logs in once with email + password + MFA
3. **Profile-Based Context**: Each school-role combination is a profile
4. **Organization-Level Security Policies**: Mandatory policies, schools can opt-in to enhanced tiers
5. **Mandatory MFA**: Multiple options (SMS, Email, TOTP, Hardware Key)
6. **Profile-Level Isolation**: Profile-specific tokens, suspension, audit logging
7. **Organization-Level Controls**: Separate sessions, access revocation, conditional access
8. **Automated Secret Management**: Auto-generated secrets for dynamic school creation, platform admin only
9. **Secret Rotation**: Scheduled rotation (90-180 days) + emergency rotation for breaches
10. **Graduated Breach Response**: MFA re-authentication primary, password reset for severe breaches

**Benefits:**

- ✅ **Low Risk** - organization-level security policies reduce cascading risk
- ✅ **Flexible** - schools can set their own security standards
- ✅ **Compliant** - meets regulatory requirements (FERPA, COPPA, GDPR)
- ✅ **User-Friendly** - single login, switch between schools
- ✅ **Secure** - organization-level isolation and access control
- ✅ **Auditable** - comprehensive logging and monitoring

**Implementation Flow:**

```
1. School Registration
   → Platform admin or school owner registers school
   → Default security policy assigned (mandatory)
   → JWT secret auto-generated (platform admin only access)
   → Optional email domain validation
   → Initial admin account created

2. User Addition
   → Authorized admin (IT Support/SuperAdmin/Management) adds user
   → Methods: Direct creation, invitation, or bulk import
   → User added to school with role (creates profile)
   → MFA setup required

3. User Login
   → User logs in with email/password + MFA
   → System shows all schools user belongs to (profiles)
   → User selects school context
   → Token signed with school-specific secret
   → Organization-level security policy enforced
   → User can switch between schools/profiles

4. Secret Rotation (Scheduled)
   → Every 90-180 days, secrets rotated automatically
   → Old secrets kept for 24 hours (graceful transition)
   → Users re-authenticate with new tokens

5. Breach Response (Emergency)
   → Security incident detected
   → Emergency secret rotation (immediate, no grace period)
   → Force MFA re-authentication (primary response)
   → Escalate to password reset if severe breach
   → Users notified and must re-authenticate
```

---

## Questions for Discussion

1. **School Registration:**
   - Who can register schools? (Platform admins only, or school owners can self-register?)
   - Should there be approval workflow for school registration?

2. **User Addition:**
   - Should there be approval workflows for user addition?
   - Can admins add users to any school, or only their own?

3. **Profile Switching:**
   - Should MFA be required for profile switching?
   - Or only for sensitive operations within profiles?

4. **Anomaly Detection:**
   - What thresholds for anomaly detection?
   - What actions should be taken on anomalies?

5. **Secret Rotation:**
   - What rotation frequency for scheduled rotation? (90 days, 180 days?)
   - Should rotation be automated or manual?
   - What triggers emergency rotation?

6. **Breach Response:**
   - Who can trigger breach response? (Platform admins only?)
   - What severity levels should trigger password reset vs MFA re-auth only?
   - Should there be automated breach detection triggers?

---

## Conclusion

By implementing **profile-based context switching** with **organization-level security policies** (similar to GitHub/Microsoft/Google models), we achieve:

1. **Low Risk** - organization-level security policies reduce cascading risk
2. **Flexible** - schools can set their own security standards
3. **Compliant** - meets regulatory requirements
4. **User-Friendly** - single login, switch between schools
5. **Secure** - organization-level isolation and access control

**Recommendation: Proceed with profile-based approach with organization-level security policies and all security mitigations implemented.**
