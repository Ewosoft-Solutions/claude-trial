# Authorization/Permission System Implementation

## Overview

This document describes the implementation of the Authorization/Permission System (Section 4) for the school management application.

## Implementation Status

### ✅ Completed Items

- **4.2** - Role-based access control (RBAC) ✅
- **4.4** - Clearance level validation on every request ✅
- **4.5** - Permission validation on every request (profile-specific) ✅
- **4.6** - Permission decorators/guards ✅
- **4.7** - Context-aware permissions ✅
- **4.10** - Strict context validation (user belongs to school, profile active) ✅
- **4.11** - Multi-layer security validation middleware ✅
- **4.12** - Permission pool inheritance system (per clearance level) ✅
- **4.13** - Custom role creation constraints (clearance level 0-7 only, permission pool validation) ✅
- **4.15** - Application-level role name uniqueness validation (platform/system roles) ✅
- **4.8** - Maker-checker approval system structure ✅
- **4.9** - Platform oversight capabilities ✅

### ⏳ Pending Items

- **4.14** - Permission pool models and seed data (database seeding required)
- **4.16** - Integrate clearance level context with AI mediator (AI mediator integration required)

## Components

### Services

#### 1. PermissionService (`services/permission.service.ts`)

Core service for permission checking and clearance level validation.

**Key Features:**

- User permission context loading (4.5, 4.10)
- Clearance level validation (4.4)
- Permission checking (single, multiple, any) (4.5)
- Context-aware permission checking (4.7)
- Strict context validation (4.10)

**Key Methods:**

- `getUserPermissionContext()` - Loads user's roles, permissions, and clearance level
- `checkClearanceLevel()` - Validates clearance level requirements
- `checkPermission()` - Checks single permission
- `checkPermissions()` - Checks multiple permissions (AND logic)
- `checkAnyPermission()` - Checks multiple permissions (OR logic)
- `checkContextAwarePermission()` - Context-aware permission checking
- `validateStrictContext()` - Validates user belongs to school and profile is active

#### 2. RoleService (`services/role.service.ts`)

Service for role management with custom role creation constraints.

**Key Features:**

- Role name uniqueness validation (4.15)
- Custom role creation validation (4.13)
- Custom role creation with permission pool inheritance (4.13)

**Key Methods:**

- `validateRoleNameUniqueness()` - Validates role name uniqueness per type
- `validateCustomRoleCreation()` - Validates custom role constraints
- `createCustomRole()` - Creates custom role with validation
- `canCreateCustomRole()` - Checks if user can create custom role

#### 3. PermissionPoolService (`services/permission-pool.service.ts`)

Service for permission pool inheritance system.

**Key Features:**

- Permission pool retrieval by clearance level (4.12)
- Permission extraction from pools (4.12)
- Permission pool assignment validation (4.12)

**Key Methods:**

- `getPermissionPoolsByClearanceLevel()` - Gets pools matching clearance level
- `getPermissionsFromPools()` - Extracts permissions from pools
- `validatePermissionPoolAssignment()` - Validates pool assignment
- `getSystemPermissionPools()` - Gets all system pools

#### 4. MakerCheckerService (`services/maker-checker.service.ts`)

Service for maker-checker approval system.

**Key Features:**

- Sensitive operation detection (4.8)
- Approval request creation (4.8)
- Approval/rejection handling (4.8)

**Key Methods:**

- `getSensitiveOperation()` - Gets sensitive operation config
- `createApprovalRequest()` - Creates approval request
- `approveRequest()` - Approves request
- `rejectRequest()` - Rejects request
- `requiresApproval()` - Checks if operation requires approval

#### 5. PlatformOversightService (`services/platform-oversight.service.ts`)

Service for platform oversight and emergency access.

**Key Features:**

- Platform override access checking (4.9)
- Emergency access validation (4.9)
- Platform operation validation (4.9)

**Key Methods:**

- `hasPlatformOverrideAccess()` - Checks platform override access
- `hasEmergencyAccess()` - Checks emergency access
- `createPlatformOverrideContext()` - Creates platform override context
- `hasPlatformAuditAccess()` - Checks platform audit access
- `hasPlatformMaintenanceAccess()` - Checks platform maintenance access
- `canPerformPlatformOperation()` - Validates platform operation

### Guards

#### 1. ClearanceLevelGuard (`guards/clearance-level.guard.ts`)

Guard for clearance level validation.

**Usage:**

```typescript
@RequireClearanceLevel(7) // Requires Management level
@UseGuards(ClearanceLevelGuard)
@Get('admin-only')
async adminOnly() {
  // ...
}
```

**Decorator:**

- `@RequireClearanceLevel(level)` - Requires minimum clearance level

#### 2. PermissionGuard (`guards/permission.guard.ts`)

Guard for permission-based access control.

**Usage:**

```typescript
@RequirePermissions(['students.view', 'students.edit'], PermissionMode.ALL)
@UseGuards(PermissionGuard)
@Get('students')
async getStudents() {
  // ...
}
```

**Decorator:**

- `@RequirePermissions(permissions, mode, clearanceLevel?)` - Requires permissions

**Modes:**

- `PermissionMode.ALL` - All permissions required (AND)
- `PermissionMode.ANY` - Any permission required (OR)

#### 3. ContextValidationGuard (`guards/context-validation.guard.ts`)

Guard for strict context validation.

**Usage:**

```typescript
@UseGuards(ContextValidationGuard)
@Get('profile')
async getProfile() {
  // ...
}
```

Validates:

- User belongs to school
- Profile is active
- Profile is not suspended

### Middleware

#### 1. MultiLayerSecurityMiddleware (`middleware/multi-layer-security.middleware.ts`)

Multi-layer security validation middleware.

**Layers:**

1. JWT validation (handled by JwtAuthGuard)
2. Tenant context validation (handled by TenantContextGuard)
3. Context validation (user belongs to school, profile active)
4. User permission context loading

**Usage:**

```typescript
// In app.module.ts or controller
@Module({
  // ...
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MultiLayerSecurityMiddleware).forRoutes('*');
  }
}
```

## Usage Examples

### Example 1: Clearance Level Protection

```typescript
import { RequireClearanceLevel } from '@workspace/api/auth/guards';
import { ClearanceLevelGuard } from '@workspace/api/auth/guards';

@Controller('admin')
@UseGuards(ClearanceLevelGuard)
export class AdminController {
  @RequireClearanceLevel(7) // Management level
  @Get('dashboard')
  async getDashboard() {
    // Only users with clearance level 7+ can access
  }
}
```

### Example 2: Permission-Based Access

```typescript
import { RequirePermissions, PermissionMode } from '@workspace/api/auth/guards';
import { PermissionGuard } from '@workspace/api/auth/guards';

@Controller('students')
@UseGuards(PermissionGuard)
export class StudentsController {
  @RequirePermissions(['students.view'], PermissionMode.ALL)
  @Get()
  async getStudents() {
    // Only users with 'students.view' permission can access
  }

  @RequirePermissions(['students.edit'], PermissionMode.ALL, 7)
  @Put(':id')
  async updateStudent(@Param('id') id: string) {
    // Requires 'students.edit' permission AND clearance level 7+
  }
}
```

### Example 3: Context-Aware Permissions

```typescript
import { PermissionService } from '@workspace/api/auth/services';

@Controller('grades')
export class GradesController {
  constructor(private permissionService: PermissionService) {}

  @Put(':id')
  async updateGrade(@Param('id') id: string, @Request() req) {
    const userContext = req.userContext;

    // Check context-aware permission
    const check = await this.permissionService.checkContextAwarePermission(
      req.prisma,
      userContext,
      'grades.edit.own_classes',
      {
        resourceId: id,
        resourceType: 'grade',
        ownerId: 'teacher-id', // Would be extracted from grade
      },
    );

    if (!check.granted) {
      throw new ForbiddenException('Cannot edit grade from other classes');
    }

    // Update grade
  }
}
```

### Example 4: Custom Role Creation

```typescript
import { RoleService } from '@workspace/api/auth/services';

@Controller('roles')
export class RolesController {
  constructor(private roleService: RoleService) {}

  @Post()
  async createCustomRole(@Body() input: CreateCustomRoleDto, @Request() req) {
    const userContext = req.userContext;

    // Check if user can create custom role
    if (
      !this.roleService.canCreateCustomRole(
        userContext.clearanceLevel,
        input.clearanceLevel,
      )
    ) {
      throw new ForbiddenException(
        'Cannot create role with this clearance level',
      );
    }

    // Create custom role
    const role = await this.roleService.createCustomRole(req.prisma, {
      ...input,
      tenantId: userContext.tenantId,
      createdBy: userContext.userId,
    });

    return role;
  }
}
```

## Integration with Existing System

### Module Integration

All authorization services and guards are integrated into the `AuthModule`:

```typescript
@Module({
  providers: [
    // ... authentication services
    PermissionService,
    RoleService,
    PermissionPoolService,
    MakerCheckerService,
    PlatformOversightService,
    ClearanceLevelGuard,
    PermissionGuard,
    ContextValidationGuard,
  ],
  exports: [
    // ... exported for use in other modules
  ],
})
export class AuthModule {}
```

### Guard Chain

Recommended guard chain order:

1. `JwtAuthGuard` - Validates JWT token
2. `TenantContextGuard` - Validates tenant context
3. `ContextValidationGuard` - Validates strict context
4. `ClearanceLevelGuard` - Validates clearance level (if required)
5. `PermissionGuard` - Validates permissions (if required)
6. `MfaRequiredGuard` - Validates MFA (if required)

### Middleware Integration

The `MultiLayerSecurityMiddleware` should be applied globally or to specific routes:

```typescript
@Module({
  // ...
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MultiLayerSecurityMiddleware).forRoutes('*'); // Apply to all routes
  }
}
```

## Database Schema

The implementation uses the existing Prisma schema models:

- `Role` - Roles with clearance levels
- `Permission` - Permissions with metadata
- `RolePermission` - Role-permission assignments
- `PermissionPool` - Permission pools by clearance level
- `PermissionPoolPermission` - Pool-permission assignments
- `RolePermissionPool` - Role-pool assignments
- `UserTenantRole` - User-role assignments per profile
- `UserTenantPermission` - Profile-specific permission overrides

## Next Steps

1. **Database Seeding (4.14)**: Create seed data for:
   - System roles (Architect, SuperAdmin, Owner, Management, etc.)
   - Permission pools for each clearance level (0-10)
   - All 300+ permissions
   - Pool-permission assignments
   - Role-pool assignments

2. **AI Mediator Integration (4.16)**: Integrate clearance level context with AI mediator for:
   - Access scope determination
   - Data filtering
   - Query validation

3. **Maker-Checker Database**: Create database tables for approval requests (currently placeholder)

4. **Audit Logging**: Integrate audit logging for:
   - Permission checks
   - Clearance level validations
   - Platform overrides
   - Approval workflows

## Notes

- All services are injectable and can be used in controllers or other services
- Guards use NestJS decorators for easy application
- Context-aware permissions support is implemented but context-specific checks need to be completed (e.g., `checkOwnClassesContext`, `checkChildrenContext`)
- Maker-checker approval system structure is in place but needs database tables for persistence
- Platform oversight capabilities are implemented but need audit logging integration
