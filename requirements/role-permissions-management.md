# Role & Permissions Management - Design & Implementation

## Overview

This document defines the comprehensive role and permissions management strategy, including clearance levels, permission pools, custom role constraints, and AI mediator integration considerations.

**📋 Reference**: See [Access Control Framework](../_requirements/access-control.md) for complete role hierarchy and clearance levels.

---

## Table of Contents

1. [Clearance Level Hierarchy](#clearance-level-hierarchy)
2. [Permission Pool Inheritance by Clearance Level](#permission-pool-inheritance-by-clearance-level)
3. [Role Types & Constraints](#role-types--constraints)
4. [Custom Role Creation Rules](#custom-role-creation-rules)
5. [Permission Assignment & Validation](#permission-assignment--validation)
6. [AI Mediator Integration](#ai-mediator-integration)
7. [Implementation Guidelines](#implementation-guidelines)

---

## Clearance Level Hierarchy

### Hierarchy Definition (0-10)

The clearance level system provides a hierarchical access control structure where higher levels have broader access:

| Level  | Role           | Clearance Scope                        | Access Boundary                       |
| ------ | -------------- | -------------------------------------- | ------------------------------------- |
| **10** | **Architect**  | Complete System Access                 | All schools, all data, all functions  |
| **9**  | **SuperAdmin** | Complete System Access (with approval) | All schools, all data (maker-checker) |
| **8**  | **Owner**      | Full School Access                     | Complete school operations and data   |
| **7**  | **Management** | Broad School Access                    | Most administrative functions         |
| **6**  | **ITSupport**  | Technical Maintenance Access           | System maintenance and support        |
| **5**  | **Finance**    | Financial & Legal Access               | Financial operations and compliance   |
| **4**  | **Operations** | Logistics & Operations Access          | Day-to-day operations                 |
| **3**  | **Teacher**    | Classroom & Student Access             | Academic functions and own classes    |
| **2**  | **Parent**     | Children's Information Access          | Own children's academic data          |
| **1**  | **Student**    | Own Academic Information Access        | Own academic and performance data     |
| **0**  | **Guest**      | Limited Public Information Access      | Public information only               |

### Key Principles

1. **Hierarchical Access**: Higher clearance levels inherit access from lower levels
2. **Clear Boundaries**: Each level has defined access boundaries
3. **No Escalation**: Lower levels cannot access higher-level resources
4. **Consistent Enforcement**: Clearance levels enforced on every operation
5. **AI Integration**: Clearance levels drive AI mediator access scopes

---

## Permission Pool Inheritance by Clearance Level

### Problem Statement

**Challenge**: Custom roles created by schools could potentially:

- Gain platform-wide access or higher clearance levels
- Disrupt clearance level consistency for AI mediator integration
- Create security vulnerabilities through privilege escalation
- Break the hierarchical access model

**Solution**: Permission Pool Inheritance by Clearance Level

### Concept Overview

**Permission Pools** are predefined sets of permissions grouped by clearance level. Custom roles can only inherit permissions from pools that match or are below their assigned clearance level.

### Permission Pool Structure

```typescript
interface PermissionPool {
  clearanceLevel: number; // 0-10
  poolName: string; // e.g., "Level7_SchoolManagement"
  permissions: string[]; // Array of permission keys
  description: string;
  isSystemPool: boolean; // True for predefined pools
}

// Example: Permission pools per clearance level
const PERMISSION_POOLS: Record<number, PermissionPool[]> = {
  10: [
    {
      clearanceLevel: 10,
      poolName: 'Level10_PlatformArchitect',
      permissions: [
        'platform.override',
        'platform.audit',
        'platform.maintenance',
        'platform.security',
        'platform.tenants',
        // ... all platform permissions
      ],
      description: 'Platform architect access pool',
      isSystemPool: true,
    },
  ],
  9: [
    {
      clearanceLevel: 9,
      poolName: 'Level9_PlatformSuperAdmin',
      permissions: [
        'platform.support.access',
        'platform.monitoring',
        'platform.audit.limited',
        'platform.maintenance.limited',
        // ... platform support permissions
      ],
      description: 'Platform super admin access pool',
      isSystemPool: true,
    },
  ],
  8: [
    {
      clearanceLevel: 8,
      poolName: 'Level8_SchoolOwner',
      permissions: [
        'school.*', // All school operations
        'users.*',
        'roles.*',
        'settings.*',
        // ... full school access
      ],
      description: 'School owner access pool',
      isSystemPool: true,
    },
  ],
  7: [
    {
      clearanceLevel: 7,
      poolName: 'Level7_SchoolManagement',
      permissions: [
        'students.*',
        'staff.*',
        'reports.*',
        'settings.school',
        // ... management permissions
      ],
      description: 'School management access pool',
      isSystemPool: true,
    },
  ],
  // ... pools for levels 6-0
};
```

### Custom Role Constraints

When creating a custom role, schools must:

1. **Assign Clearance Level**: Custom roles can only have clearance levels 0-7 (school-level only)
2. **Select from Permission Pools**: Can only select permissions from pools matching their clearance level or below
3. **No Platform Access**: Cannot access platform-level permissions (clearance levels 8-10)
4. **No Escalation**: Cannot combine permissions from higher clearance levels

### Implementation

```typescript
interface CustomRoleCreation {
  name: string;
  description?: string;
  clearanceLevel: number; // Must be 0-7 for custom roles
  tenantId: string; // Required for custom roles
  permissionPoolIds: string[]; // IDs of permission pools to inherit from
  customPermissions?: string[]; // Additional permissions from selected pools
  createdBy: string;
  requiresApproval: boolean; // For clearance level 7 custom roles
}

// Validation function
function validateCustomRoleCreation(
  role: CustomRoleCreation,
): ValidationResult {
  // 1. Check clearance level constraint
  if (role.clearanceLevel > 7) {
    return {
      valid: false,
      error: 'Custom roles cannot exceed clearance level 7',
    };
  }

  // 2. Validate permission pools
  const selectedPools = getPermissionPools(role.permissionPoolIds);
  const maxPoolLevel = Math.max(...selectedPools.map((p) => p.clearanceLevel));

  if (maxPoolLevel > role.clearanceLevel) {
    return {
      valid: false,
      error: `Selected permission pools exceed role clearance level ${role.clearanceLevel}`,
    };
  }

  // 3. Validate individual permissions
  const allPermissions = getAllPermissionsFromPools(selectedPools);
  const invalidPermissions =
    role.customPermissions?.filter((p) => !allPermissions.includes(p)) || [];

  if (invalidPermissions.length > 0) {
    return {
      valid: false,
      error: `Invalid permissions: ${invalidPermissions.join(', ')}`,
    };
  }

  // 4. Check for platform-level permissions
  const platformPermissions = allPermissions.filter((p) =>
    p.startsWith('platform.'),
  );
  if (platformPermissions.length > 0) {
    return {
      valid: false,
      error: 'Custom roles cannot include platform-level permissions',
    };
  }

  return { valid: true };
}
```

### Benefits

1. **Security**: Prevents privilege escalation through custom roles
2. **Consistency**: Maintains clearance level integrity across system
3. **AI Integration**: Ensures AI mediator receives consistent clearance context
4. **Flexibility**: Schools can still create custom roles within their clearance scope
5. **Auditability**: Clear permission boundaries for compliance

---

## Role Types & Constraints

### Role Type Definitions

The system supports three role types:

#### 1. Platform Roles (`platform`)

- **Clearance Levels**: 9-10 only
- **Tenant ID**: `null` (global)
- **Examples**: Architect (10), SuperAdmin (9)
- **Constraints**:
  - Cannot be created by schools
  - Globally unique names
  - Full platform access
  - Cannot be modified by schools

#### 2. System Roles (`system`)

- **Clearance Levels**: 0-8
- **Tenant ID**: `null` (global)
- **Examples**: Owner (8), Management (7), Teacher (3), Parent (2), Student (1), Guest (0)
- **Constraints**:
  - Predefined by platform
  - Globally unique names
  - Cannot be created by schools
  - Can be used by any school
  - Permissions defined by platform

#### 3. Custom Roles (`custom`)

- **Clearance Levels**: 0-7 only (school-level)
- **Tenant ID**: Required (UUID of school)
- **Examples**: Department Head, Counselor, Librarian, Custom Staff Role
- **Constraints**:
  - Created by school admins (Management or Owner)
  - Name unique per tenant
  - Can only inherit from permission pools ≤ clearance level
  - Cannot access platform-level permissions
  - Cannot exceed clearance level 7

### Role Type Validation

```typescript
interface RoleTypeConstraints {
  platform: {
    minClearanceLevel: 9;
    maxClearanceLevel: 10;
    canBeCreatedBySchools: false;
    tenantIdRequired: false;
    nameUniqueness: 'global';
  };
  system: {
    minClearanceLevel: 0;
    maxClearanceLevel: 8;
    canBeCreatedBySchools: false;
    tenantIdRequired: false;
    nameUniqueness: 'global';
  };
  custom: {
    minClearanceLevel: 0;
    maxClearanceLevel: 7; // School-level only
    canBeCreatedBySchools: true;
    tenantIdRequired: true;
    nameUniqueness: 'per-tenant';
    permissionSource: 'permission-pools'; // Must inherit from pools
  };
}
```

---

## Custom Role Creation Rules

### Creation Authority

1. **Management (Clearance 7)**: Can create custom roles with clearance levels 0-6
2. **Owner (Clearance 8)**: Can create custom roles with clearance levels 0-7
3. **Platform Roles**: Cannot create custom roles (they manage platform/system roles)

### Creation Process

1. **Define Role**: Name, description, clearance level (0-7)
2. **Select Permission Pools**: Choose from pools matching clearance level or below
3. **Customize Permissions**: Select specific permissions from chosen pools
4. **Validation**: System validates against permission pool constraints
5. **Approval**: For clearance level 7 custom roles, requires Owner approval
6. **Creation**: Role created with assigned permissions

### Approval Workflow

```typescript
interface CustomRoleApproval {
  roleId: string;
  requestedBy: string; // User ID
  requestedByClearance: number;
  requestedClearance: number; // 0-7
  approverRequired: string; // Owner (clearance 8)
  status: 'pending' | 'approved' | 'rejected';
  approvalReason?: string;
  approvedAt?: Date;
}
```

---

## Permission Assignment & Validation

### Permission Structure

Each permission has structured metadata for UI rendering:

```typescript
interface Permission {
  id: string;
  name: string; // Key/identifier (e.g., 'students.view')
  label: string; // Human-readable display name (e.g., 'View Students')
  description?: string; // Detailed description for UI rendering
  resource: string; // e.g., 'students', 'grades', 'platform'
  action: string; // e.g., 'view', 'edit', 'create', 'delete'
  context?: string; // e.g., 'own_classes', 'children', 'department'
  category: string; // e.g., 'academic', 'administrative', 'platform'
  requiredClearanceLevel: number; // Minimum clearance level required
  permissionPoolIds: string[]; // Which pools this permission belongs to
}
```

### Permission Validation Flow

Every permission check follows this flow:

1. **JWT Validation**: Verify token signature and expiration
2. **Context Validation**: Verify user belongs to school and profile is active
3. **Clearance Level Check**: Verify user's clearance level ≥ required clearance level
4. **Permission Check**: Verify user has specific permission (via role or profile override)
5. **Policy Check**: Verify operation complies with security policy

### Permission Sources

Permissions can come from multiple sources (checked in order):

1. **Profile-Specific Permissions** (highest priority)
   - Explicit grants/denials per profile
   - Override role permissions
2. **Role Permissions**
   - Inherited from role's permission pools
   - System role permissions
   - Custom role permissions (from pools)

3. **Clearance Level Inheritance**
   - Lower clearance levels inherit from higher levels in same pool
   - Not automatic - must be explicitly assigned

---

## AI Mediator Integration

### Clearance Level Context

The AI mediator requires consistent clearance level context to:

- Determine access scope for queries
- Filter data appropriately
- Prevent unauthorized data exposure
- Maintain audit trail

### Integration Rules

1. **Clearance Level Consistency**:
   - Custom roles must respect clearance level boundaries
   - Permission pools ensure consistent access patterns
   - AI mediator receives user's clearance level in context

2. **Access Scope Validation**:
   - AI queries validated against user's clearance level
   - Data filtering based on clearance level requirements
   - Platform-level queries require clearance 9-10

3. **Permission Pool Alignment**:
   - AI mediator uses permission pools to understand access boundaries
   - Ensures consistent behavior across custom and system roles
   - Prevents privilege escalation through custom roles

### AI Mediator Context

```typescript
interface AIMediatorContext {
  userId: string;
  tenantId: string;
  profileId: string;
  clearanceLevel: number; // 0-10
  roleIds: string[]; // All roles for this profile
  permissions: string[]; // Effective permissions (from roles + profile overrides)
  permissionPools: string[]; // Permission pools this user has access to
  accessScope: 'platform' | 'school' | 'department' | 'own'; // Derived from clearance level
}
```

---

## Implementation Guidelines

### Database Schema

The schema already supports these concepts:

- **Role Model**: `roleType`, `clearanceLevel`, `tenantId`
- **Permission Model**: `name` (key), `label` (display), `description` (details)
- **RolePermission**: Many-to-many relationship
- **UserTenantPermission**: Profile-specific overrides

### Application-Level Validation

**Critical**: Application-level validation is required because:

1. **Prisma Constraints**: Prisma's `@@unique([name, tenantId])` allows multiple NULL values
   - Platform/system roles (tenantId = null) need application-level uniqueness checks
2. **Clearance Level Constraints**: Database cannot enforce clearance level rules
   - Custom roles limited to 0-7
   - Permission pool inheritance rules
3. **Permission Pool Rules**: Permission assignments must validate against pools
   - Cannot assign permissions from higher clearance levels
   - Cannot assign platform permissions to custom roles

### Validation Functions

Implement these validation functions:

```typescript
// 1. Role name uniqueness validation
async function validateRoleNameUniqueness(
  name: string,
  roleType: 'platform' | 'system' | 'custom',
  tenantId?: string,
): Promise<boolean> {
  if (roleType === 'platform' || roleType === 'system') {
    // Must be globally unique
    const existing = await prisma.role.findFirst({
      where: {
        name,
        roleType: { in: ['platform', 'system'] },
        tenantId: null,
      },
    });
    return !existing;
  } else {
    // Custom role: unique per tenant
    const existing = await prisma.role.findFirst({
      where: {
        name,
        roleType: 'custom',
        tenantId: tenantId!,
      },
    });
    return !existing;
  }
}

// 2. Clearance level validation for custom roles
function validateCustomRoleClearanceLevel(
  clearanceLevel: number,
): ValidationResult {
  if (clearanceLevel > 7) {
    return {
      valid: false,
      error: 'Custom roles cannot exceed clearance level 7',
    };
  }
  return { valid: true };
}

// 3. Permission pool validation
async function validatePermissionAssignment(
  roleId: string,
  permissionIds: string[],
): Promise<ValidationResult> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { rolePermissions: true },
  });

  if (!role) {
    return { valid: false, error: 'Role not found' };
  }

  // For custom roles, validate against permission pools
  if (role.roleType === 'custom') {
    const permissions = await prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    // Check if any permission requires higher clearance level
    const invalidPermissions = permissions.filter(
      (p) => p.requiredClearanceLevel > role.clearanceLevel,
    );

    if (invalidPermissions.length > 0) {
      return {
        valid: false,
        error: `Permissions require higher clearance level: ${invalidPermissions.map((p) => p.name).join(', ')}`,
      };
    }

    // Check for platform permissions
    const platformPermissions = permissions.filter(
      (p) => p.resource === 'platform',
    );
    if (platformPermissions.length > 0) {
      return {
        valid: false,
        error: 'Custom roles cannot include platform-level permissions',
      };
    }
  }

  return { valid: true };
}
```

### Seed Data Requirements

When seeding the database:

1. **System Roles**: Create all system roles (Architect, SuperAdmin, Owner, Management, etc.)
2. **Permission Pools**: Create permission pools for each clearance level (0-10)
3. **Permissions**: Create all 300+ permissions with labels and descriptions
4. **Pool Assignments**: Assign permissions to appropriate permission pools
5. **Role-Pool Mapping**: Assign permission pools to system roles

### Migration Strategy

1. **Phase 1**: Create permission pools and assign permissions
2. **Phase 2**: Update existing roles to use permission pools
3. **Phase 3**: Implement custom role creation with pool validation
4. **Phase 4**: Enforce clearance level constraints for custom roles

---

## Summary

### Key Concepts

1. **Clearance Level Hierarchy**: 0-10 hierarchy with defined access boundaries
2. **Permission Pool Inheritance**: Custom roles inherit from pools matching their clearance level
3. **Role Type Constraints**: Platform (9-10), System (0-8), Custom (0-7 only)
4. **Application-Level Validation**: Required for uniqueness and clearance level rules
5. **AI Mediator Integration**: Consistent clearance level context for AI queries

### Benefits

- ✅ **Security**: Prevents privilege escalation through custom roles
- ✅ **Consistency**: Maintains clearance level integrity
- ✅ **Flexibility**: Schools can create custom roles within their scope
- ✅ **AI Integration**: Consistent access patterns for AI mediator
- ✅ **Auditability**: Clear permission boundaries

### Next Steps

1. Implement permission pool models in database schema
2. Create seed data for permission pools
3. Implement validation functions for custom role creation
4. Update role creation API to use permission pools
5. Integrate clearance level validation in AI mediator

---

**See Also:**

- [`multi-tenancy-security-strategy.md`](./multi-tenancy-security-strategy.md) - Security implementation details
- [`../_requirements/access-control.md`](../_requirements/access-control.md) - Complete role hierarchy
- [`../_requirements/permissions.md`](../_requirements/permissions.md) - Permission definitions
