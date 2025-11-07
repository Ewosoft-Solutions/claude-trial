# Seed Data Implementation Guide (4.14)

## Overview

This document outlines what's needed to complete item 4.14: "Implement permission pool models and seed data".

## Current Status

### ✅ Completed

1. **Database Models** - All models exist in Prisma schema:
   - `PermissionPool` - Permission pools by clearance level
   - `PermissionPoolPermission` - Pool-permission assignments
   - `RolePermissionPool` - Role-pool assignments
   - `Role` - System roles with clearance levels
   - `Permission` - Permission definitions

2. **Seed Script Implementation** - `packages/database/src/seed.ts` includes:
   - System roles (Architect, SuperAdmin, Owner, Management, etc.)
   - Permission pools for each clearance level (0-10)
   - **All 274 permissions** organized across 26 categories
   - Permission-to-pool assignment logic (with platform permission isolation)
   - Role-to-pool assignment logic

### Permission Summary

The seed script includes **274 permissions** organized across **26 categories**:

- **Student Management** (14 permissions)
- **Academic Management** (11 permissions)
- **Grade & Assessment** (15 permissions)
- **Attendance** (7 permissions)
- **Financial** (12 permissions)
- **Communication** (12 permissions)
- **Staff Management** (10 permissions)
- **Reports & Analytics** (9 permissions)
- **System Administration** (18 permissions)
- **Platform** (13 permissions)
- **Library** (7 permissions)
- **Transportation** (8 permissions)
- **Cafeteria** (8 permissions)
- **Health** (8 permissions)
- **Facilities** (8 permissions)
- **Events** (7 permissions)
- **Sports** (8 permissions)
- **Clubs** (7 permissions)
- **Parent Portal** (7 permissions)
- **Inventory** (7 permissions)
- **Safety** (7 permissions)
- **Compliance** (6 permissions)
- **Timetable** (12 permissions)
- **Exams** (12 permissions)
- **Admissions** (15 permissions)

2. **Permission Pool Assignments** - Need to ensure:
   - All permissions are assigned to appropriate pools based on clearance level
   - Permissions are assigned to pools at their clearance level and below
   - Platform permissions only in platform pools (levels 9-10)

3. **Role-Permission Assignments** - Need to ensure:
   - System roles have permissions assigned via pools
   - Direct role-permission assignments for backward compatibility

## Implementation Plan

### Step 1: Extract All Permissions

Extract all 300+ permissions from `_requirements/permissions.md` and structure them as:

```typescript
interface PermissionDefinition {
  name: string; // e.g., 'students.view'
  label: string; // e.g., 'View Students'
  description: string; // Detailed description
  resource: string; // e.g., 'students'
  action: string; // e.g., 'view'
  context?: string; // e.g., 'own_classes', 'children'
  category: string; // e.g., 'academic', 'administrative', 'platform'
  clearanceLevel: number; // Minimum clearance level required (0-10)
}
```

### Step 2: Categorize Permissions

Organize permissions by category:

- Academic (students, courses, grades, assessments, attendance)
- Administrative (users, roles, settings, reports)
- Financial (fees, payments, billing)
- Communication (messages, announcements)
- Platform (platform.override, platform.audit, etc.)
- Support Services (library, transportation, cafeteria, health, facilities)
- Events & Activities
- Sports & Athletics
- Clubs & Extracurricular
- Compliance & Reporting
- And more...

### Step 3: Assign Permissions to Pools

For each permission:

1. Determine minimum clearance level required
2. Assign to permission pool at that level
3. Also assign to pools at lower levels (inheritance)
4. Platform permissions only go to platform pools (levels 9-10)

Example:

```typescript
// Permission: students.view (clearance level 3)
// Should be assigned to pools: Level3_Teacher, Level4_Operations, Level5_Finance, etc.
// But NOT to Level2_Parent, Level1_Student, Level0_Guest

// Permission: platform.override (clearance level 10)
// Should ONLY be assigned to Level10_PlatformArchitect
```

### Step 4: Update Seed Script

Update `packages/database/src/seed.ts`:

1. Add all 300+ permissions to the seed data
2. Ensure proper categorization
3. Ensure proper clearance level assignment
4. Ensure proper pool assignments
5. Test seed script execution

### Step 5: Verify Seed Data

After seeding:

1. Verify all system roles exist
2. Verify all permission pools exist
3. Verify all permissions exist
4. Verify permission-pool assignments
5. Verify role-pool assignments
6. Verify permissions are accessible via pools

## Permission Categories Reference

From `_requirements/permissions.md`, the main categories are:

1. **Student Management** - students.\*
2. **Academic Management** - courses._, schedules._, subjects.\*
3. **Grade & Assessment** - grades._, assessments._, transcripts.\*
4. **Attendance Management** - attendance.\*
5. **Financial Management** - fees._, payments._, billing._, financial_reports._
6. **Communication** - messages._, announcements._, notifications.\*
7. **Staff Management** - staff._, departments._
8. **Reports & Analytics** - reports._, analytics._, dashboard.\*
9. **System Administration** - settings.\*
10. **Library Management** - library.\*
11. **Transportation** - transportation.\*
12. **Food Service & Cafeteria** - cafeteria.\*
13. **Health & Medical Services** - health.\*
14. **Facilities & Maintenance** - facilities.\*
15. **Events & Activities** - events.\*
16. **Sports & Athletics** - sports.\*
17. **Clubs & Extracurricular** - clubs.\*
18. **Parent & Community Engagement** - parent_portal._, community._
19. **Inventory & Asset Management** - inventory.\*
20. **Safety & Security** - safety.\*
21. **Compliance & Reporting** - compliance.\*
22. **Lesson & Timetable Management** - timetable.\*
23. **Exam & Assessment Scheduling** - exams.\*
24. **Admissions Management** - admissions.\*
25. **Platform** - platform.\*

## Clearance Level Guidelines

Based on `_requirements/access-control.md`:

- **Level 10 (Architect)**: All platform permissions
- **Level 9 (SuperAdmin)**: Platform support permissions
- **Level 8 (Owner)**: All school permissions
- **Level 7 (Management)**: Most administrative permissions
- **Level 6 (ITSupport)**: Technical maintenance permissions
- **Level 5 (Finance)**: Financial permissions
- **Level 4 (Operations)**: Operational permissions
- **Level 3 (Teacher)**: Academic and classroom permissions
- **Level 2 (Parent)**: Children's information permissions
- **Level 1 (Student)**: Own information permissions
- **Level 0 (Guest)**: Public information permissions

## Example Permission Structure

```typescript
const ALL_PERMISSIONS: PermissionDefinition[] = [
  // Student Management
  {
    name: 'students.view',
    label: 'View Students',
    description: 'View student list and basic information',
    resource: 'students',
    action: 'view',
    category: 'academic',
    clearanceLevel: 3, // Teacher level
  },
  {
    name: 'students.view.detailed',
    label: 'View Detailed Student Profiles',
    description:
      'View detailed student profiles with comprehensive information',
    resource: 'students',
    action: 'view',
    context: 'detailed',
    category: 'academic',
    clearanceLevel: 7, // Management level
  },
  {
    name: 'students.edit',
    label: 'Edit Students',
    description: 'Edit basic student information',
    resource: 'students',
    action: 'edit',
    category: 'academic',
    clearanceLevel: 7, // Management level
  },
  // ... continue for all 300+ permissions
];
```

## Testing

After implementing:

1. Run seed script: `npm run db:seed`
2. Verify database has all expected data
3. Test permission checking with different roles
4. Test permission pool inheritance
5. Test custom role creation with pools

## Notes

- The seed script structure is already in place
- Only need to populate with all 300+ permissions
- Permission pool assignment logic already exists
- Role-pool assignment logic already exists
- Just need to extract and structure all permissions from `_requirements/permissions.md`

## Estimated Effort

- **Extract permissions**: 2-3 hours (manual extraction from permissions.md)
- **Structure and categorize**: 1-2 hours
- **Assign to pools**: 1-2 hours (automated via existing logic)
- **Testing**: 1 hour
- **Total**: ~5-8 hours
