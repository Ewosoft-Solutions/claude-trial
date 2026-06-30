import { prisma } from '../../src/client.js';
import bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';

/**
 * Seed script for database initialization
 *
 * Phase 1: System Roles (Priority)
 * Phase 2: Permission Pools
 * Phase 3: Sample Permissions (Subsets)
 * Phase 4: Assign Permissions to Pools
 * Phase 5: Assign Pools to Roles
 * Phase 6: Platform Bootstrap (Architect account + platform tenant)
 */

const PLATFORM_BOOTSTRAP = {
  tenant: {
    name: 'Platform Administration',
    slug: 'platform',
    status: 'active' as const,
  },
  architect: {
    email: 'architect@schoolwithease.com',
    firstName: 'Platform',
    lastName: 'Architect',
    defaultPassword: 'Architect@2025!',
  },
};

// System Roles with clearance levels
const SYSTEM_ROLES = [
  // Platform roles
  {
    name: 'Architect',
    description:
      'Platform architect and owner with unrestricted access to all schools, data, and configurations',
    roleType: 'platform',
    clearanceLevel: 10,
    isSystemRole: true,
  },
  {
    name: 'SuperAdmin',
    description:
      'Platform support staff with controlled access through maker-checker system for resolving issues securely',
    roleType: 'platform',
    clearanceLevel: 9,
    isSystemRole: true,
  },
  // System roles
  {
    name: 'Owner',
    description:
      "School owner, CEO, or founder with complete access to their school's operations and data",
    roleType: 'system',
    clearanceLevel: 8,
    isSystemRole: true,
  },
  {
    name: 'Management',
    description:
      'School management with comprehensive administrative and operational oversight',
    roleType: 'system',
    clearanceLevel: 7,
    isSystemRole: true,
  },
  {
    name: 'ITSupport',
    description:
      'School IT support responsible for technical and system-related maintenance tasks',
    roleType: 'system',
    clearanceLevel: 6,
    isSystemRole: true,
  },
  {
    name: 'Finance',
    description:
      'Handles finance, billing, compliance, and legal documentation',
    roleType: 'system',
    clearanceLevel: 5,
    isSystemRole: true,
  },
  {
    name: 'Operations',
    description:
      'Manages school logistics, resources, and day-to-day operations',
    roleType: 'system',
    clearanceLevel: 4,
    isSystemRole: true,
  },
  {
    name: 'Teacher',
    description:
      'Academic staff with access to classes, student records, and assessments',
    roleType: 'system',
    clearanceLevel: 3,
    isSystemRole: true,
  },
  {
    name: 'Parent',
    description:
      "Guardians with access to their children's academic progress and records",
    roleType: 'system',
    clearanceLevel: 2,
    isSystemRole: true,
  },
  {
    name: 'Student',
    description:
      'Students with access to their own academic and performance data',
    roleType: 'system',
    clearanceLevel: 1,
    isSystemRole: true,
  },
  {
    name: 'Guest',
    description:
      'Visitors with access limited to publicly available school or platform information',
    roleType: 'system',
    clearanceLevel: 0,
    isSystemRole: true,
  },
];

// Permission Pools for each clearance level
const PERMISSION_POOLS = [
  {
    name: 'Level10_PlatformArchitect',
    clearanceLevel: 10,
    description: 'Platform architect access pool - Complete system access',
  },
  {
    name: 'Level9_PlatformSuperAdmin',
    clearanceLevel: 9,
    description:
      'Platform super admin access pool - Complete system access with approval workflow',
  },
  {
    name: 'Level8_SchoolOwner',
    clearanceLevel: 8,
    description: 'School owner access pool - Full school access',
  },
  {
    name: 'Level7_SchoolManagement',
    clearanceLevel: 7,
    description: 'School management access pool - Broad school access',
  },
  {
    name: 'Level6_ITSupport',
    clearanceLevel: 6,
    description: 'IT support access pool - Technical maintenance access',
  },
  {
    name: 'Level5_Finance',
    clearanceLevel: 5,
    description: 'Finance access pool - Financial and legal access',
  },
  {
    name: 'Level4_Operations',
    clearanceLevel: 4,
    description: 'Operations access pool - Logistics and operations access',
  },
  {
    name: 'Level3_Teacher',
    clearanceLevel: 3,
    description: 'Teacher access pool - Classroom and student access',
  },
  {
    name: 'Level2_Parent',
    clearanceLevel: 2,
    description: "Parent access pool - Children's information access",
  },
  {
    name: 'Level1_Student',
    clearanceLevel: 1,
    description: 'Student access pool - Own academic information access',
  },
  {
    name: 'Level0_Guest',
    clearanceLevel: 0,
    description: 'Guest access pool - Limited public information access',
  },
];

const EXPECTED_PERMISSION_COUNTS = {
  total: 274,
  arrays: {
    STUDENT_PERMISSIONS: 15,
    ACADEMIC_MANAGEMENT_PERMISSIONS: 19,
    GRADE_ASSESSMENT_PERMISSIONS: 21,
    ATTENDANCE_PERMISSIONS: 9,
    FINANCIAL_PERMISSIONS: 16,
    COMMUNICATION_PERMISSIONS: 13,
    STAFF_PERMISSIONS: 13,
    REPORTS_PERMISSIONS: 10,
    SYSTEM_ADMIN_PERMISSIONS: 18,
    PLATFORM_PERMISSIONS: 12,
    LIBRARY_PERMISSIONS: 7,
    TRANSPORTATION_PERMISSIONS: 8,
    CAFETERIA_PERMISSIONS: 8,
    HEALTH_PERMISSIONS: 8,
    FACILITIES_PERMISSIONS: 8,
    EVENTS_PERMISSIONS: 8,
    SPORTS_PERMISSIONS: 8,
    CLUBS_PERMISSIONS: 7,
    PARENT_PORTAL_PERMISSIONS: 7,
    INVENTORY_PERMISSIONS: 7,
    SAFETY_PERMISSIONS: 7,
    COMPLIANCE_PERMISSIONS: 6,
    TIMETABLE_PERMISSIONS: 12,
    EXAMS_PERMISSIONS: 12,
    ADMISSIONS_PERMISSIONS: 15,
  },
  clearanceLevels: { min: 0, max: 10 },
};

function validatePermissionPools() {
  const poolCount = PERMISSION_POOLS.length;
  const uniqueLevels = new Set(PERMISSION_POOLS.map((p) => p.clearanceLevel));
  const requiredLevels = Array.from({ length: 11 }, (_, i) => i);

  if (poolCount !== 11) {
    throw new Error(
      `Invalid permission pool count. Expected 11 (levels 0-10), found ${poolCount}`,
    );
  }

  for (const level of requiredLevels) {
    if (!uniqueLevels.has(level)) {
      throw new Error(
        `Missing permission pool for clearance level ${level}. Pools must cover levels 0-10.`,
      );
    }
  }

  const nameCollisions = PERMISSION_POOLS.reduce<Record<string, number>>(
    (acc, pool) => {
      acc[pool.name] = (acc[pool.name] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const duplicates = Object.entries(nameCollisions)
    .filter(([, count]) => count > 1)
    .map(([name]) => name);

  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate permission pool names found: ${duplicates.join(', ')}`,
    );
  }
}

function validateRolePoolMapping(
  roles: typeof SYSTEM_ROLES,
  mapping: Record<string, string>,
) {
  const poolNames = new Set(PERMISSION_POOLS.map((p) => p.name));
  const missingPools: string[] = [];
  const missingRoles: string[] = [];

  for (const role of roles) {
    if (!mapping[role.name]) {
      missingRoles.push(role.name);
    }
  }

  for (const [roleName, poolName] of Object.entries(mapping)) {
    if (!poolNames.has(poolName)) {
      missingPools.push(`${roleName} -> ${poolName}`);
    }
  }

  if (missingRoles.length > 0) {
    throw new Error(
      `ROLE_TO_POOL_MAPPING missing entries for roles: ${missingRoles.join(', ')}`,
    );
  }

  if (missingPools.length > 0) {
    throw new Error(
      `ROLE_TO_POOL_MAPPING references pools that do not exist: ${missingPools.join(
        '; ',
      )}`,
    );
  }
}

function collectArrayCountErrors(
  permissionArrays: Record<
    string,
    Array<{ requiredClearanceLevel: number; name: string; category?: string }>
  >,
  expectations: Record<string, number>,
): string[] {
  return Object.entries(expectations).reduce<string[]>(
    (acc, [key, expected]) => {
      const actual = permissionArrays[key]?.length ?? 0;
      if (actual !== expected) {
        acc.push(
          `${key} count mismatch. Expected ${expected}, found ${actual}`,
        );
      }
      return acc;
    },
    [],
  );
}

function collectTotalCountErrors(
  allPermissions: Array<{ name: string }>,
): string[] {
  if (allPermissions.length !== EXPECTED_PERMISSION_COUNTS.total) {
    return [
      `Total permissions mismatch. Expected ${EXPECTED_PERMISSION_COUNTS.total}, found ${allPermissions.length}`,
    ];
  }
  return [];
}

function collectClearanceErrors(
  allPermissions: Array<{ requiredClearanceLevel: number; name: string }>,
): string[] {
  return allPermissions.reduce<string[]>((acc, perm) => {
    if (
      perm.requiredClearanceLevel === undefined ||
      perm.requiredClearanceLevel === null
    ) {
      acc.push(`Permission ${perm.name} missing requiredClearanceLevel`);
      return acc;
    }

    if (
      perm.requiredClearanceLevel <
        EXPECTED_PERMISSION_COUNTS.clearanceLevels.min ||
      perm.requiredClearanceLevel >
        EXPECTED_PERMISSION_COUNTS.clearanceLevels.max
    ) {
      acc.push(
        `Permission ${perm.name} has out-of-range clearance level ${perm.requiredClearanceLevel}. Expected ${EXPECTED_PERMISSION_COUNTS.clearanceLevels.min}-${EXPECTED_PERMISSION_COUNTS.clearanceLevels.max}.`,
      );
    }
    return acc;
  }, []);
}

function validatePermissionsCatalog(
  permissionArrays: Record<
    string,
    Array<{ requiredClearanceLevel: number; name: string; category?: string }>
  >,
) {
  const allPermissions = Object.values(permissionArrays).flat();
  const errors: string[] = [
    ...collectArrayCountErrors(
      permissionArrays,
      EXPECTED_PERMISSION_COUNTS.arrays,
    ),
    ...collectTotalCountErrors(allPermissions),
    ...collectClearanceErrors(allPermissions),
  ];

  if (errors.length > 0) {
    throw new Error(
      `Permission catalog validation failed:\n - ${errors.join('\n - ')}`,
    );
  }
}

// All Permissions - Comprehensive List (274 permissions total)
//
// Permission Summary by Category:
// - Student Management (15 permissions)
// - Academic Management (19 permissions)
// - Grade & Assessment (21 permissions)
// - Attendance (9 permissions)
// - Financial (16 permissions)
// - Communication (13 permissions)
// - Staff Management (13 permissions)
// - Reports & Analytics (10 permissions)
// - System Administration (18 permissions)
// - Platform (12 permissions)
// - Library (7 permissions)
// - Transportation (8 permissions)
// - Cafeteria (8 permissions)
// - Health (8 permissions)
// - Facilities (8 permissions)
// - Events (8 permissions)
// - Sports (8 permissions)
// - Clubs (7 permissions)
// - Parent Portal (7 permissions)
// - Inventory (7 permissions)
// - Safety (7 permissions)
// - Compliance (6 permissions)
// - Timetable (12 permissions)
// - Exams (12 permissions)
// - Admissions (15 permissions)

// Student Management Permissions (15 permissions)
const STUDENT_PERMISSIONS = [
  {
    name: 'students.view',
    label: 'View Students',
    description: 'View student list and basic information',
    resource: 'students',
    action: 'view',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'students.view.own',
    label: 'View Own Profile',
    description: 'View own student profile (students)',
    resource: 'students',
    action: 'view',
    context: 'own',
    category: 'academic',
    requiredClearanceLevel: 1,
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
    requiredClearanceLevel: 7,
  },
  {
    name: 'students.view.personal_info',
    label: 'View Personal Information',
    description: 'Access personal/contact information',
    resource: 'students',
    action: 'view',
    context: 'personal_info',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'students.view.academic_records',
    label: 'View Academic Records',
    description: 'View academic history and transcripts',
    resource: 'students',
    action: 'view',
    context: 'academic_records',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'students.view.medical_info',
    label: 'View Medical Information',
    description: 'Access medical/health information',
    resource: 'students',
    action: 'view',
    context: 'medical_info',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'students.edit',
    label: 'Edit Students',
    description: 'Edit basic student information',
    resource: 'students',
    action: 'edit',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'students.edit.personal_info',
    label: 'Edit Personal Information',
    description: 'Modify personal/contact details',
    resource: 'students',
    action: 'edit',
    context: 'personal_info',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'students.edit.academic_info',
    label: 'Edit Academic Information',
    description: 'Update academic records',
    resource: 'students',
    action: 'edit',
    context: 'academic_info',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'students.edit.medical_info',
    label: 'Edit Medical Information',
    description: 'Modify medical information',
    resource: 'students',
    action: 'edit',
    context: 'medical_info',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'students.create',
    label: 'Create Students',
    description: 'Add new students to the system',
    resource: 'students',
    action: 'create',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'students.delete',
    label: 'Delete Students',
    description: 'Remove students from the system',
    resource: 'students',
    action: 'delete',
    category: 'academic',
    requiredClearanceLevel: 8,
  },
  {
    name: 'students.export',
    label: 'Export Student Data',
    description: 'Export student data',
    resource: 'students',
    action: 'export',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'students.import',
    label: 'Import Student Data',
    description: 'Import student data from external sources',
    resource: 'students',
    action: 'import',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'students.edit.own_classes',
    label: 'Edit Students in Own Classes',
    description: 'Edit students only in own classes',
    resource: 'students',
    action: 'edit',
    context: 'own_classes',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
];

// Academic Management Permissions (19 permissions)
const ACADEMIC_MANAGEMENT_PERMISSIONS = [
  {
    name: 'courses.view',
    label: 'View Courses',
    description: 'View course catalog and schedules',
    resource: 'courses',
    action: 'view',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'courses.view.detailed',
    label: 'View Detailed Course Information',
    description: 'View detailed course information',
    resource: 'courses',
    action: 'view',
    context: 'detailed',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'courses.edit',
    label: 'Edit Courses',
    description: 'Modify course information',
    resource: 'courses',
    action: 'edit',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'courses.create',
    label: 'Create Courses',
    description: 'Create new courses',
    resource: 'courses',
    action: 'create',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'courses.delete',
    label: 'Delete Courses',
    description: 'Remove courses',
    resource: 'courses',
    action: 'delete',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'courses.export',
    label: 'Export Course Data',
    description: 'Export course catalog data',
    resource: 'courses',
    action: 'export',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'courses.import',
    label: 'Import Course Data',
    description: 'Import course data from external sources',
    resource: 'courses',
    action: 'import',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'schedules.view',
    label: 'View Schedules',
    description: 'View class schedules',
    resource: 'schedules',
    action: 'view',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'schedules.edit',
    label: 'Edit Schedules',
    description: 'Modify schedules',
    resource: 'schedules',
    action: 'edit',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'schedules.create',
    label: 'Create Schedules',
    description: 'Create new schedules',
    resource: 'schedules',
    action: 'create',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'subjects.view',
    label: 'View Subjects',
    description: 'View subject listings',
    resource: 'subjects',
    action: 'view',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'subjects.edit',
    label: 'Edit Subjects',
    description: 'Modify subject information',
    resource: 'subjects',
    action: 'edit',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'subjects.create',
    label: 'Create Subjects',
    description: 'Add new subjects',
    resource: 'subjects',
    action: 'create',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'subjects.delete',
    label: 'Delete Subjects',
    description: 'Remove subjects',
    resource: 'subjects',
    action: 'delete',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'schedules.delete',
    label: 'Delete Schedules',
    description: 'Remove schedules',
    resource: 'schedules',
    action: 'delete',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'schedules.export',
    label: 'Export Schedule Data',
    description: 'Export schedule data',
    resource: 'schedules',
    action: 'export',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'schedules.import',
    label: 'Import Schedule Data',
    description: 'Import schedule data from external sources',
    resource: 'schedules',
    action: 'import',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'subjects.export',
    label: 'Export Subject Data',
    description: 'Export subject listings',
    resource: 'subjects',
    action: 'export',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'subjects.import',
    label: 'Import Subject Data',
    description: 'Import subject data from external sources',
    resource: 'subjects',
    action: 'import',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
];

// Grade & Assessment Permissions (21 permissions)
const GRADE_ASSESSMENT_PERMISSIONS = [
  {
    name: 'grades.view',
    label: 'View Grades',
    description: 'View grades and assessments',
    resource: 'grades',
    action: 'view',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'grades.view.own',
    label: 'View Own Grades',
    description: 'View only own grades (students)',
    resource: 'grades',
    action: 'view',
    context: 'own',
    category: 'academic',
    requiredClearanceLevel: 1,
  },
  {
    name: 'grades.view.children',
    label: 'View Children Grades',
    description: "View children's grades (parents)",
    resource: 'grades',
    action: 'view',
    context: 'children',
    category: 'academic',
    requiredClearanceLevel: 2,
  },
  {
    name: 'grades.edit',
    label: 'Edit Grades',
    description: 'Edit grades and assessments',
    resource: 'grades',
    action: 'edit',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'grades.edit.own_classes',
    label: 'Edit Grades for Own Classes',
    description: 'Edit grades for own classes only',
    resource: 'grades',
    action: 'edit',
    context: 'own_classes',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'grades.create',
    label: 'Create Grades',
    description: 'Create new grade entries',
    resource: 'grades',
    action: 'create',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'grades.delete',
    label: 'Delete Grades',
    description: 'Delete grade entries',
    resource: 'grades',
    action: 'delete',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'grades.export',
    label: 'Export Grade Reports',
    description: 'Export grade reports',
    resource: 'grades',
    action: 'export',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'grades.import',
    label: 'Import Grade Data',
    description: 'Import grade data from external sources',
    resource: 'grades',
    action: 'import',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'assessments.view',
    label: 'View Assessments',
    description: 'View assessment details',
    resource: 'assessments',
    action: 'view',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'assessments.edit',
    label: 'Edit Assessments',
    description: 'Modify assessments',
    resource: 'assessments',
    action: 'edit',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'assessments.create',
    label: 'Create Assessments',
    description: 'Create new assessments',
    resource: 'assessments',
    action: 'create',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'assessments.delete',
    label: 'Delete Assessments',
    description: 'Remove assessments',
    resource: 'assessments',
    action: 'delete',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'assessments.export',
    label: 'Export Assessment Data',
    description: 'Export assessment data',
    resource: 'assessments',
    action: 'export',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'assessments.import',
    label: 'Import Assessment Data',
    description: 'Import assessment data from external sources',
    resource: 'assessments',
    action: 'import',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'grades.edit.own_students',
    label: 'Edit Grades for Own Students',
    description: 'Edit grades only for own students',
    resource: 'grades',
    action: 'edit',
    context: 'own_students',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'transcripts.view',
    label: 'View Transcripts',
    description: 'View academic transcripts',
    resource: 'transcripts',
    action: 'view',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'transcripts.edit',
    label: 'Edit Transcripts',
    description: 'Modify transcripts',
    resource: 'transcripts',
    action: 'edit',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'transcripts.generate',
    label: 'Generate Transcripts',
    description: 'Generate official transcripts',
    resource: 'transcripts',
    action: 'generate',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'transcripts.delete',
    label: 'Delete Transcripts',
    description: 'Remove transcripts',
    resource: 'transcripts',
    action: 'delete',
    category: 'academic',
    requiredClearanceLevel: 8,
  },
  {
    name: 'transcripts.export',
    label: 'Export Transcripts',
    description: 'Export transcript data',
    resource: 'transcripts',
    action: 'export',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
];

// Attendance Management Permissions (9 permissions)
const ATTENDANCE_PERMISSIONS = [
  {
    name: 'attendance.view',
    label: 'View Attendance',
    description: 'View attendance records',
    resource: 'attendance',
    action: 'view',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'attendance.view.own',
    label: 'View Own Attendance',
    description: 'View own attendance (students)',
    resource: 'attendance',
    action: 'view',
    context: 'own',
    category: 'academic',
    requiredClearanceLevel: 1,
  },
  {
    name: 'attendance.view.children',
    label: 'View Children Attendance',
    description: "View children's attendance (parents)",
    resource: 'attendance',
    action: 'view',
    context: 'children',
    category: 'academic',
    requiredClearanceLevel: 2,
  },
  {
    name: 'attendance.edit',
    label: 'Edit Attendance',
    description: 'Edit attendance records',
    resource: 'attendance',
    action: 'edit',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'attendance.edit.own_classes',
    label: 'Edit Attendance for Own Classes',
    description: 'Edit attendance for own classes',
    resource: 'attendance',
    action: 'edit',
    context: 'own_classes',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'attendance.create',
    label: 'Mark Attendance',
    description: 'Mark attendance',
    resource: 'attendance',
    action: 'create',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'attendance.export',
    label: 'Export Attendance Reports',
    description: 'Export attendance reports',
    resource: 'attendance',
    action: 'export',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'attendance.delete',
    label: 'Delete Attendance Records',
    description: 'Remove attendance records',
    resource: 'attendance',
    action: 'delete',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'attendance.import',
    label: 'Import Attendance Data',
    description: 'Import attendance data from external sources',
    resource: 'attendance',
    action: 'import',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
];

// Financial Management Permissions (16 permissions)
const FINANCIAL_PERMISSIONS = [
  {
    name: 'fees.view',
    label: 'View Fees',
    description: 'View fee structures and payments',
    resource: 'fees',
    action: 'view',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'fees.view.own',
    label: 'View Own Fees',
    description: 'View own fee information (students/parents)',
    resource: 'fees',
    action: 'view',
    context: 'own',
    category: 'financial',
    requiredClearanceLevel: 2,
  },
  {
    name: 'fees.edit',
    label: 'Edit Fees',
    description: 'Modify fee structures',
    resource: 'fees',
    action: 'edit',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'fees.create',
    label: 'Create Fees',
    description: 'Create new fee categories',
    resource: 'fees',
    action: 'create',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'fees.delete',
    label: 'Delete Fees',
    description: 'Remove fee categories',
    resource: 'fees',
    action: 'delete',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'payments.view',
    label: 'View Payments',
    description: 'View payment records',
    resource: 'payments',
    action: 'view',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'payments.edit',
    label: 'Process Payments',
    description: 'Process payments',
    resource: 'payments',
    action: 'edit',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'payments.refund',
    label: 'Process Refunds',
    description: 'Process refunds',
    resource: 'payments',
    action: 'refund',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'billing.view',
    label: 'View Billing',
    description: 'View billing information',
    resource: 'billing',
    action: 'view',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'billing.edit',
    label: 'Edit Billing',
    description: 'Modify billing details',
    resource: 'billing',
    action: 'edit',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'financial_reports.view',
    label: 'View Financial Reports',
    description: 'Access financial reports',
    resource: 'financial_reports',
    action: 'view',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'financial_reports.export',
    label: 'Export Financial Data',
    description: 'Export financial data',
    resource: 'financial_reports',
    action: 'export',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'fees.export',
    label: 'Export Fee Data',
    description: 'Export fee structure data',
    resource: 'fees',
    action: 'export',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'fees.import',
    label: 'Import Fee Data',
    description: 'Import fee data from external sources',
    resource: 'fees',
    action: 'import',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'payments.export',
    label: 'Export Payment Data',
    description: 'Export payment records',
    resource: 'payments',
    action: 'export',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
  {
    name: 'billing.export',
    label: 'Export Billing Data',
    description: 'Export billing information',
    resource: 'billing',
    action: 'export',
    category: 'financial',
    requiredClearanceLevel: 5,
  },
];

// Communication Permissions (13 permissions)
const COMMUNICATION_PERMISSIONS = [
  {
    name: 'messages.view',
    label: 'View Messages',
    description: 'View messages and announcements',
    resource: 'messages',
    action: 'view',
    category: 'communication',
    requiredClearanceLevel: 3,
  },
  {
    name: 'messages.send',
    label: 'Send Messages',
    description: 'Send messages',
    resource: 'messages',
    action: 'send',
    category: 'communication',
    requiredClearanceLevel: 3,
  },
  {
    name: 'messages.send.broadcast',
    label: 'Send Broadcast Messages',
    description: 'Send broadcast messages',
    resource: 'messages',
    action: 'send',
    context: 'broadcast',
    category: 'communication',
    requiredClearanceLevel: 7,
  },
  {
    name: 'messages.send.parents',
    label: 'Send Messages to Parents',
    description: 'Send messages to parents',
    resource: 'messages',
    action: 'send',
    context: 'parents',
    category: 'communication',
    requiredClearanceLevel: 3,
  },
  {
    name: 'messages.send.students',
    label: 'Send Messages to Students',
    description: 'Send messages to students',
    resource: 'messages',
    action: 'send',
    context: 'students',
    category: 'communication',
    requiredClearanceLevel: 3,
  },
  {
    name: 'messages.send.staff',
    label: 'Send Messages to Staff',
    description: 'Send messages to staff',
    resource: 'messages',
    action: 'send',
    context: 'staff',
    category: 'communication',
    requiredClearanceLevel: 7,
  },
  {
    name: 'messages.send.own_classes',
    label: 'Send Messages to Own Classes',
    description: 'Send messages only to own class students',
    resource: 'messages',
    action: 'send',
    context: 'own_classes',
    category: 'communication',
    requiredClearanceLevel: 3,
  },
  {
    name: 'announcements.view',
    label: 'View Announcements',
    description: 'View announcements',
    resource: 'announcements',
    action: 'view',
    category: 'communication',
    requiredClearanceLevel: 0,
  },
  {
    name: 'announcements.create',
    label: 'Create Announcements',
    description: 'Create announcements',
    resource: 'announcements',
    action: 'create',
    category: 'communication',
    requiredClearanceLevel: 7,
  },
  {
    name: 'announcements.edit',
    label: 'Edit Announcements',
    description: 'Edit announcements',
    resource: 'announcements',
    action: 'edit',
    category: 'communication',
    requiredClearanceLevel: 7,
  },
  {
    name: 'announcements.delete',
    label: 'Delete Announcements',
    description: 'Delete announcements',
    resource: 'announcements',
    action: 'delete',
    category: 'communication',
    requiredClearanceLevel: 7,
  },
  {
    name: 'notifications.view',
    label: 'View Notifications',
    description: 'View notification settings',
    resource: 'notifications',
    action: 'view',
    category: 'communication',
    requiredClearanceLevel: 1,
  },
  {
    name: 'notifications.edit',
    label: 'Edit Notifications',
    description: 'Modify notification preferences',
    resource: 'notifications',
    action: 'edit',
    category: 'communication',
    requiredClearanceLevel: 1,
  },
];

// Staff Management Permissions (13 permissions)
const STAFF_PERMISSIONS = [
  {
    name: 'staff.view',
    label: 'View Staff',
    description: 'View staff directory',
    resource: 'staff',
    action: 'view',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'staff.view.detailed',
    label: 'View Detailed Staff Information',
    description: 'View detailed staff information',
    resource: 'staff',
    action: 'view',
    context: 'detailed',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'staff.edit',
    label: 'Edit Staff',
    description: 'Edit staff information',
    resource: 'staff',
    action: 'edit',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'staff.create',
    label: 'Create Staff',
    description: 'Add new staff members',
    resource: 'staff',
    action: 'create',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'staff.delete',
    label: 'Delete Staff',
    description: 'Remove staff members',
    resource: 'staff',
    action: 'delete',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
  {
    name: 'staff.schedules',
    label: 'Manage Staff Schedules',
    description: 'Manage staff schedules',
    resource: 'staff',
    action: 'schedules',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'staff.performance',
    label: 'View Staff Performance',
    description: 'View performance records',
    resource: 'staff',
    action: 'performance',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'departments.view',
    label: 'View Departments',
    description: 'View department information',
    resource: 'departments',
    action: 'view',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'departments.edit',
    label: 'Edit Departments',
    description: 'Modify departments',
    resource: 'departments',
    action: 'edit',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'departments.create',
    label: 'Create Departments',
    description: 'Create new departments',
    resource: 'departments',
    action: 'create',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'departments.delete',
    label: 'Delete Departments',
    description: 'Remove departments',
    resource: 'departments',
    action: 'delete',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
  {
    name: 'staff.export',
    label: 'Export Staff Data',
    description: 'Export staff data',
    resource: 'staff',
    action: 'export',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'staff.import',
    label: 'Import Staff Data',
    description: 'Import staff data from external sources',
    resource: 'staff',
    action: 'import',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
];

// Reports & Analytics Permissions (10 permissions)
const REPORTS_PERMISSIONS = [
  {
    name: 'reports.view',
    label: 'View Reports',
    description: 'Access general reports',
    resource: 'reports',
    action: 'view',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'reports.academic',
    label: 'View Academic Reports',
    description: 'View academic reports',
    resource: 'reports',
    action: 'academic',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'reports.financial',
    label: 'View Financial Reports',
    description: 'View financial reports',
    resource: 'reports',
    action: 'financial',
    category: 'administrative',
    requiredClearanceLevel: 5,
  },
  {
    name: 'reports.attendance',
    label: 'View Attendance Reports',
    description: 'View attendance reports',
    resource: 'reports',
    action: 'attendance',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'reports.export',
    label: 'Export Reports',
    description: 'Export report data',
    resource: 'reports',
    action: 'export',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'reports.view.department',
    label: 'View Department Reports',
    description: 'View reports only for own department',
    resource: 'reports',
    action: 'view',
    context: 'department',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'analytics.view',
    label: 'View Analytics',
    description: 'Access analytics dashboard',
    resource: 'analytics',
    action: 'view',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'analytics.advanced',
    label: 'View Advanced Analytics',
    description: 'Access advanced analytics',
    resource: 'analytics',
    action: 'advanced',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'dashboard.view',
    label: 'View Dashboard',
    description: 'View main dashboard',
    resource: 'dashboard',
    action: 'view',
    category: 'administrative',
    requiredClearanceLevel: 1,
  },
  {
    name: 'dashboard.customize',
    label: 'Customize Dashboard',
    description: 'Customize dashboard layout',
    resource: 'dashboard',
    action: 'customize',
    category: 'administrative',
    requiredClearanceLevel: 1,
  },
];

// System Administration Permissions (18 permissions)
const SYSTEM_ADMIN_PERMISSIONS = [
  {
    name: 'settings.view',
    label: 'View Settings',
    description: 'View system settings',
    resource: 'settings',
    action: 'view',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'settings.edit',
    label: 'Edit Settings',
    description: 'Modify system settings',
    resource: 'settings',
    action: 'edit',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
  {
    name: 'settings.school',
    label: 'Edit School Settings',
    description: 'Edit school-specific settings',
    resource: 'settings',
    action: 'edit',
    context: 'school',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'settings.users',
    label: 'Manage Users',
    description: 'Manage user accounts',
    resource: 'settings',
    action: 'users',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'settings.roles',
    label: 'Manage Roles',
    description: 'Manage roles and permissions',
    resource: 'settings',
    action: 'roles',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
  {
    name: 'settings.backup',
    label: 'Backup/Restore',
    description: 'Access backup/restore functions',
    resource: 'settings',
    action: 'backup',
    category: 'administrative',
    requiredClearanceLevel: 6,
  },
  {
    name: 'settings.audit',
    label: 'View Audit Logs',
    description: 'View audit logs',
    resource: 'settings',
    action: 'audit',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'settings.integrations',
    label: 'Manage Integrations',
    description: 'Manage third-party integrations',
    resource: 'settings',
    action: 'integrations',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'settings.theme',
    label: 'Customize Theme',
    description: 'Customize school theme/branding',
    resource: 'settings',
    action: 'theme',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'settings.features',
    label: 'Manage Features',
    description: 'Enable/disable features',
    resource: 'settings',
    action: 'features',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
  {
    name: 'users.view',
    label: 'View Users',
    description: 'View user list and basic information',
    resource: 'users',
    action: 'view',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'users.create',
    label: 'Create Users',
    description: 'Add new users to the system',
    resource: 'users',
    action: 'create',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'users.edit',
    label: 'Edit Users',
    description: 'Modify user information',
    resource: 'users',
    action: 'edit',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'users.delete',
    label: 'Delete Users',
    description: 'Remove users from the system',
    resource: 'users',
    action: 'delete',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
  {
    name: 'roles.view',
    label: 'View Roles',
    description: 'View roles and permissions',
    resource: 'roles',
    action: 'view',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'roles.create',
    label: 'Create Roles',
    description: 'Create new roles',
    resource: 'roles',
    action: 'create',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
  {
    name: 'roles.edit',
    label: 'Edit Roles',
    description: 'Modify roles and permissions',
    resource: 'roles',
    action: 'edit',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
  {
    name: 'roles.delete',
    label: 'Delete Roles',
    description: 'Remove roles from the system',
    resource: 'roles',
    action: 'delete',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
];

// Platform Permissions (12 permissions)
const PLATFORM_PERMISSIONS = [
  {
    name: 'platform.override',
    label: 'Platform Override',
    description: 'Emergency override access to any school',
    resource: 'platform',
    action: 'override',
    category: 'platform',
    requiredClearanceLevel: 10,
  },
  {
    name: 'platform.audit',
    label: 'View All Audit Logs',
    description: 'View all audit logs across platform',
    resource: 'platform',
    action: 'audit',
    category: 'platform',
    requiredClearanceLevel: 10,
  },
  {
    name: 'platform.maintenance',
    label: 'Platform Maintenance',
    description: 'Perform system maintenance',
    resource: 'platform',
    action: 'maintenance',
    category: 'platform',
    requiredClearanceLevel: 10,
  },
  {
    name: 'platform.backup',
    label: 'Platform Backup',
    description: 'Access backup and recovery systems',
    resource: 'platform',
    action: 'backup',
    category: 'platform',
    requiredClearanceLevel: 10,
  },
  {
    name: 'platform.security',
    label: 'Platform Security',
    description: 'Manage platform-wide security settings',
    resource: 'platform',
    action: 'security',
    category: 'platform',
    requiredClearanceLevel: 10,
  },
  {
    name: 'platform.tenants',
    label: 'Manage Tenants',
    description: 'Manage school tenant accounts',
    resource: 'platform',
    action: 'tenants',
    category: 'platform',
    requiredClearanceLevel: 10,
  },
  {
    name: 'platform.billing',
    label: 'Platform Billing',
    description: 'Access platform billing and subscriptions',
    resource: 'platform',
    action: 'billing',
    category: 'platform',
    requiredClearanceLevel: 10,
  },
  {
    name: 'platform.support',
    label: 'Platform Support',
    description: 'Provide technical support to schools',
    resource: 'platform',
    action: 'support',
    category: 'platform',
    requiredClearanceLevel: 9,
  },
  {
    name: 'platform.support.access',
    label: 'Platform Support Access',
    description: 'Access school systems for support',
    resource: 'platform',
    action: 'support',
    context: 'access',
    category: 'platform',
    requiredClearanceLevel: 9,
  },
  {
    name: 'platform.monitoring',
    label: 'Platform Monitoring',
    description: 'View system health and performance',
    resource: 'platform',
    action: 'monitoring',
    category: 'platform',
    requiredClearanceLevel: 9,
  },
  {
    name: 'platform.audit.limited',
    label: 'Limited Audit Access',
    description: 'View limited audit information',
    resource: 'platform',
    action: 'audit',
    context: 'limited',
    category: 'platform',
    requiredClearanceLevel: 9,
  },
  {
    name: 'platform.maintenance.limited',
    label: 'Limited Maintenance',
    description: 'Perform limited maintenance tasks',
    resource: 'platform',
    action: 'maintenance',
    context: 'limited',
    category: 'platform',
    requiredClearanceLevel: 9,
  },
];

// Library Management Permissions (7 permissions)
const LIBRARY_PERMISSIONS = [
  {
    name: 'library.view',
    label: 'View Library',
    description: 'View library catalog',
    resource: 'library',
    action: 'view',
    category: 'support_services',
    requiredClearanceLevel: 3,
  },
  {
    name: 'library.books.view',
    label: 'View Books',
    description: 'View book information',
    resource: 'library',
    action: 'books',
    context: 'view',
    category: 'support_services',
    requiredClearanceLevel: 3,
  },
  {
    name: 'library.books.edit',
    label: 'Edit Books',
    description: 'Edit book records',
    resource: 'library',
    action: 'books',
    context: 'edit',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'library.books.create',
    label: 'Create Books',
    description: 'Add new books',
    resource: 'library',
    action: 'books',
    context: 'create',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'library.books.delete',
    label: 'Delete Books',
    description: 'Remove books',
    resource: 'library',
    action: 'books',
    context: 'delete',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'library.circulation',
    label: 'Manage Circulation',
    description: 'Manage book circulation',
    resource: 'library',
    action: 'circulation',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'library.reservations',
    label: 'Handle Reservations',
    description: 'Handle book reservations',
    resource: 'library',
    action: 'reservations',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
];

// Transportation Permissions (8 permissions)
const TRANSPORTATION_PERMISSIONS = [
  {
    name: 'transportation.view',
    label: 'View Transportation',
    description: 'View transportation routes',
    resource: 'transportation',
    action: 'view',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'transportation.edit',
    label: 'Edit Transportation',
    description: 'Modify routes and schedules',
    resource: 'transportation',
    action: 'edit',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'transportation.students',
    label: 'Manage Student Transportation',
    description: 'Manage student transportation assignments',
    resource: 'transportation',
    action: 'students',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'transportation.drivers',
    label: 'Manage Drivers',
    description: 'Manage driver information',
    resource: 'transportation',
    action: 'drivers',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'transportation.vehicles',
    label: 'Manage Vehicles',
    description: 'Manage school bus/vehicle information',
    resource: 'transportation',
    action: 'vehicles',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'transportation.routes',
    label: 'Manage Routes',
    description: 'Create and modify bus routes',
    resource: 'transportation',
    action: 'routes',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'transportation.tracking',
    label: 'Track Transportation',
    description: 'Real-time bus location tracking',
    resource: 'transportation',
    action: 'tracking',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'transportation.emergency',
    label: 'Handle Transportation Emergency',
    description: 'Handle transportation emergencies',
    resource: 'transportation',
    action: 'emergency',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
];

// Food Service & Cafeteria Permissions (8 permissions)
const CAFETERIA_PERMISSIONS = [
  {
    name: 'cafeteria.view',
    label: 'View Cafeteria',
    description: 'View cafeteria operations',
    resource: 'cafeteria',
    action: 'view',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'cafeteria.menu',
    label: 'Manage Menu',
    description: 'Manage meal menus and planning',
    resource: 'cafeteria',
    action: 'menu',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'cafeteria.orders',
    label: 'Process Orders',
    description: 'Process meal orders and pre-orders',
    resource: 'cafeteria',
    action: 'orders',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'cafeteria.payments',
    label: 'Handle Payments',
    description: 'Handle meal payment processing',
    resource: 'cafeteria',
    action: 'payments',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'cafeteria.inventory',
    label: 'Manage Inventory',
    description: 'Manage food inventory and supplies',
    resource: 'cafeteria',
    action: 'inventory',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'cafeteria.nutrition',
    label: 'Track Nutrition',
    description: 'Track nutritional information',
    resource: 'cafeteria',
    action: 'nutrition',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'cafeteria.allergies',
    label: 'Manage Allergies',
    description: 'Manage dietary restrictions and allergies',
    resource: 'cafeteria',
    action: 'allergies',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'cafeteria.reports',
    label: 'Generate Reports',
    description: 'Generate food service reports',
    resource: 'cafeteria',
    action: 'reports',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
];

// Health & Medical Services Permissions (8 permissions)
const HEALTH_PERMISSIONS = [
  {
    name: 'health.view',
    label: 'View Health Records',
    description: 'View health records and medical information',
    resource: 'health',
    action: 'view',
    category: 'support_services',
    requiredClearanceLevel: 7,
  },
  {
    name: 'health.records',
    label: 'Manage Health Records',
    description: 'Manage student health records',
    resource: 'health',
    action: 'records',
    category: 'support_services',
    requiredClearanceLevel: 7,
  },
  {
    name: 'health.medications',
    label: 'Track Medications',
    description: 'Track medication administration',
    resource: 'health',
    action: 'medications',
    category: 'support_services',
    requiredClearanceLevel: 7,
  },
  {
    name: 'health.emergency',
    label: 'Handle Medical Emergency',
    description: 'Handle medical emergencies',
    resource: 'health',
    action: 'emergency',
    category: 'support_services',
    requiredClearanceLevel: 7,
  },
  {
    name: 'health.immunizations',
    label: 'Track Immunizations',
    description: 'Track vaccination records',
    resource: 'health',
    action: 'immunizations',
    category: 'support_services',
    requiredClearanceLevel: 7,
  },
  {
    name: 'health.visits',
    label: 'Log Nurse Visits',
    description: 'Log nurse visits and medical incidents',
    resource: 'health',
    action: 'visits',
    category: 'support_services',
    requiredClearanceLevel: 7,
  },
  {
    name: 'health.reports',
    label: 'Generate Health Reports',
    description: 'Generate health-related reports',
    resource: 'health',
    action: 'reports',
    category: 'support_services',
    requiredClearanceLevel: 7,
  },
  {
    name: 'health.parents',
    label: 'Communicate with Parents',
    description: 'Communicate health issues to parents',
    resource: 'health',
    action: 'parents',
    category: 'support_services',
    requiredClearanceLevel: 7,
  },
];

// Facilities & Maintenance Permissions (8 permissions)
const FACILITIES_PERMISSIONS = [
  {
    name: 'facilities.view',
    label: 'View Facilities',
    description: 'View facility information',
    resource: 'facilities',
    action: 'view',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'facilities.rooms',
    label: 'Manage Rooms',
    description: 'Manage classroom and room assignments',
    resource: 'facilities',
    action: 'rooms',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'facilities.maintenance',
    label: 'Schedule Maintenance',
    description: 'Schedule and track maintenance',
    resource: 'facilities',
    action: 'maintenance',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'facilities.equipment',
    label: 'Manage Equipment',
    description: 'Manage school equipment inventory',
    resource: 'facilities',
    action: 'equipment',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'facilities.reservations',
    label: 'Handle Reservations',
    description: 'Handle room/equipment reservations',
    resource: 'facilities',
    action: 'reservations',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'facilities.cleaning',
    label: 'Track Cleaning',
    description: 'Track cleaning schedules and tasks',
    resource: 'facilities',
    action: 'cleaning',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'facilities.security',
    label: 'Manage Security',
    description: 'Manage security systems and access',
    resource: 'facilities',
    action: 'security',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
  {
    name: 'facilities.utilities',
    label: 'Monitor Utilities',
    description: 'Monitor utility usage and costs',
    resource: 'facilities',
    action: 'utilities',
    category: 'support_services',
    requiredClearanceLevel: 4,
  },
];

// Events & Activities Management Permissions (7 permissions)
const EVENTS_PERMISSIONS = [
  {
    name: 'events.view',
    label: 'View Events',
    description: 'View school events and activities',
    resource: 'events',
    action: 'view',
    category: 'events',
    requiredClearanceLevel: 0,
  },
  {
    name: 'events.create',
    label: 'Create Events',
    description: 'Create new events and activities',
    resource: 'events',
    action: 'create',
    category: 'events',
    requiredClearanceLevel: 4,
  },
  {
    name: 'events.edit',
    label: 'Edit Events',
    description: 'Modify event details',
    resource: 'events',
    action: 'edit',
    category: 'events',
    requiredClearanceLevel: 4,
  },
  {
    name: 'events.delete',
    label: 'Delete Events',
    description: 'Remove events',
    resource: 'events',
    action: 'delete',
    category: 'events',
    requiredClearanceLevel: 4,
  },
  {
    name: 'events.registration',
    label: 'Handle Event Registration',
    description: 'Handle event registrations',
    resource: 'events',
    action: 'registration',
    category: 'events',
    requiredClearanceLevel: 4,
  },
  {
    name: 'events.attendance',
    label: 'Track Event Attendance',
    description: 'Track event attendance',
    resource: 'events',
    action: 'attendance',
    category: 'events',
    requiredClearanceLevel: 4,
  },
  {
    name: 'events.volunteers',
    label: 'Manage Volunteers',
    description: 'Manage volunteer coordination',
    resource: 'events',
    action: 'volunteers',
    category: 'events',
    requiredClearanceLevel: 4,
  },
  {
    name: 'events.facilities',
    label: 'Reserve Facilities',
    description: 'Reserve facilities for events',
    resource: 'events',
    action: 'facilities',
    category: 'events',
    requiredClearanceLevel: 4,
  },
];

// Sports & Athletics Permissions (8 permissions)
const SPORTS_PERMISSIONS = [
  {
    name: 'sports.view',
    label: 'View Sports',
    description: 'View sports programs and teams',
    resource: 'sports',
    action: 'view',
    category: 'sports',
    requiredClearanceLevel: 0,
  },
  {
    name: 'sports.teams',
    label: 'Manage Teams',
    description: 'Manage team rosters and information',
    resource: 'sports',
    action: 'teams',
    category: 'sports',
    requiredClearanceLevel: 4,
  },
  {
    name: 'sports.schedules',
    label: 'Handle Schedules',
    description: 'Handle game and practice schedules',
    resource: 'sports',
    action: 'schedules',
    category: 'sports',
    requiredClearanceLevel: 4,
  },
  {
    name: 'sports.equipment',
    label: 'Manage Equipment',
    description: 'Manage sports equipment inventory',
    resource: 'sports',
    action: 'equipment',
    category: 'sports',
    requiredClearanceLevel: 4,
  },
  {
    name: 'sports.facilities',
    label: 'Reserve Facilities',
    description: 'Reserve sports facilities',
    resource: 'sports',
    action: 'facilities',
    category: 'sports',
    requiredClearanceLevel: 4,
  },
  {
    name: 'sports.medical',
    label: 'Track Medical Clearances',
    description: 'Track athlete medical clearances',
    resource: 'sports',
    action: 'medical',
    category: 'sports',
    requiredClearanceLevel: 4,
  },
  {
    name: 'sports.performance',
    label: 'Record Performance',
    description: 'Record athletic performance data',
    resource: 'sports',
    action: 'performance',
    category: 'sports',
    requiredClearanceLevel: 4,
  },
  {
    name: 'sports.parents',
    label: 'Communicate with Parents',
    description: 'Communicate with parents about sports',
    resource: 'sports',
    action: 'parents',
    category: 'sports',
    requiredClearanceLevel: 4,
  },
];

// Clubs & Extracurricular Permissions (7 permissions)
const CLUBS_PERMISSIONS = [
  {
    name: 'clubs.view',
    label: 'View Clubs',
    description: 'View clubs and organizations',
    resource: 'clubs',
    action: 'view',
    category: 'clubs',
    requiredClearanceLevel: 0,
  },
  {
    name: 'clubs.manage',
    label: 'Manage Clubs',
    description: 'Manage club information and rosters',
    resource: 'clubs',
    action: 'manage',
    category: 'clubs',
    requiredClearanceLevel: 4,
  },
  {
    name: 'clubs.meetings',
    label: 'Schedule Meetings',
    description: 'Schedule and track club meetings',
    resource: 'clubs',
    action: 'meetings',
    category: 'clubs',
    requiredClearanceLevel: 4,
  },
  {
    name: 'clubs.activities',
    label: 'Plan Activities',
    description: 'Plan and organize club activities',
    resource: 'clubs',
    action: 'activities',
    category: 'clubs',
    requiredClearanceLevel: 4,
  },
  {
    name: 'clubs.funding',
    label: 'Manage Funding',
    description: 'Manage club budgets and fundraising',
    resource: 'clubs',
    action: 'funding',
    category: 'clubs',
    requiredClearanceLevel: 4,
  },
  {
    name: 'clubs.leadership',
    label: 'Track Leadership',
    description: 'Track club leadership positions',
    resource: 'clubs',
    action: 'leadership',
    category: 'clubs',
    requiredClearanceLevel: 4,
  },
  {
    name: 'clubs.achievements',
    label: 'Record Achievements',
    description: 'Record club achievements and awards',
    resource: 'clubs',
    action: 'achievements',
    category: 'clubs',
    requiredClearanceLevel: 4,
  },
];

// Parent & Community Engagement Permissions (7 permissions)
const PARENT_PORTAL_PERMISSIONS = [
  {
    name: 'parent_portal.view',
    label: 'View Parent Portal',
    description: 'Access parent portal features',
    resource: 'parent_portal',
    action: 'view',
    category: 'communication',
    requiredClearanceLevel: 2,
  },
  {
    name: 'parent_portal.communicate',
    label: 'Communicate with Parents',
    description: 'Send messages to parents',
    resource: 'parent_portal',
    action: 'communicate',
    category: 'communication',
    requiredClearanceLevel: 3,
  },
  {
    name: 'parent_portal.volunteer',
    label: 'Manage Volunteers',
    description: 'Manage parent volunteer programs',
    resource: 'parent_portal',
    action: 'volunteer',
    category: 'communication',
    requiredClearanceLevel: 4,
  },
  {
    name: 'parent_portal.meetings',
    label: 'Schedule Meetings',
    description: 'Schedule parent-teacher conferences',
    resource: 'parent_portal',
    action: 'meetings',
    category: 'communication',
    requiredClearanceLevel: 3,
  },
  {
    name: 'parent_portal.feedback',
    label: 'Collect Feedback',
    description: 'Collect and manage parent feedback',
    resource: 'parent_portal',
    action: 'feedback',
    category: 'communication',
    requiredClearanceLevel: 4,
  },
  {
    name: 'community.view',
    label: 'View Community',
    description: 'View community engagement activities',
    resource: 'community',
    action: 'view',
    category: 'communication',
    requiredClearanceLevel: 0,
  },
  {
    name: 'community.partnerships',
    label: 'Manage Partnerships',
    description: 'Manage community partnerships',
    resource: 'community',
    action: 'partnerships',
    category: 'communication',
    requiredClearanceLevel: 7,
  },
];

// Inventory & Asset Management Permissions (7 permissions)
const INVENTORY_PERMISSIONS = [
  {
    name: 'inventory.view',
    label: 'View Inventory',
    description: 'View school inventory and assets',
    resource: 'inventory',
    action: 'view',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
  {
    name: 'inventory.equipment',
    label: 'Manage Equipment',
    description: 'Manage equipment assignments',
    resource: 'inventory',
    action: 'equipment',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
  {
    name: 'inventory.textbooks',
    label: 'Track Textbooks',
    description: 'Track textbook distribution',
    resource: 'inventory',
    action: 'textbooks',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
  {
    name: 'inventory.supplies',
    label: 'Manage Supplies',
    description: 'Manage classroom supplies',
    resource: 'inventory',
    action: 'supplies',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
  {
    name: 'inventory.technology',
    label: 'Track Technology',
    description: 'Track technology devices',
    resource: 'inventory',
    action: 'technology',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
  {
    name: 'inventory.maintenance',
    label: 'Schedule Maintenance',
    description: 'Schedule asset maintenance',
    resource: 'inventory',
    action: 'maintenance',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
  {
    name: 'inventory.disposal',
    label: 'Handle Disposal',
    description: 'Handle asset disposal and recycling',
    resource: 'inventory',
    action: 'disposal',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
];

// Safety & Security Permissions (7 permissions)
const SAFETY_PERMISSIONS = [
  {
    name: 'safety.view',
    label: 'View Safety',
    description: 'View safety procedures and protocols',
    resource: 'safety',
    action: 'view',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
  {
    name: 'safety.incidents',
    label: 'Report Incidents',
    description: 'Report and track safety incidents',
    resource: 'safety',
    action: 'incidents',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
  {
    name: 'safety.drills',
    label: 'Schedule Drills',
    description: 'Schedule and track safety drills',
    resource: 'safety',
    action: 'drills',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
  {
    name: 'safety.visitors',
    label: 'Manage Visitors',
    description: 'Manage visitor check-in/out',
    resource: 'safety',
    action: 'visitors',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
  {
    name: 'safety.emergency',
    label: 'Handle Emergency',
    description: 'Handle emergency procedures',
    resource: 'safety',
    action: 'emergency',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
  {
    name: 'safety.cameras',
    label: 'Access Cameras',
    description: 'Access security camera systems',
    resource: 'safety',
    action: 'cameras',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
  {
    name: 'safety.alerts',
    label: 'Send Alerts',
    description: 'Send emergency alerts and notifications',
    resource: 'safety',
    action: 'alerts',
    category: 'administrative',
    requiredClearanceLevel: 4,
  },
];

// Compliance & Reporting Permissions (6 permissions)
const COMPLIANCE_PERMISSIONS = [
  {
    name: 'compliance.view',
    label: 'View Compliance',
    description: 'View compliance requirements',
    resource: 'compliance',
    action: 'view',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'compliance.reports',
    label: 'Generate Reports',
    description: 'Generate compliance reports',
    resource: 'compliance',
    action: 'reports',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'compliance.audits',
    label: 'Conduct Audits',
    description: 'Conduct internal audits',
    resource: 'compliance',
    action: 'audits',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'compliance.training',
    label: 'Track Training',
    description: 'Track staff training requirements',
    resource: 'compliance',
    action: 'training',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'compliance.policies',
    label: 'Manage Policies',
    description: 'Manage policy documentation',
    resource: 'compliance',
    action: 'policies',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'compliance.legal',
    label: 'Handle Legal Matters',
    description: 'Handle legal and regulatory matters',
    resource: 'compliance',
    action: 'legal',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
];

// Lesson & Timetable Management Permissions (12 permissions)
const TIMETABLE_PERMISSIONS = [
  {
    name: 'timetable.view',
    label: 'View Timetable',
    description: 'View class timetables and schedules',
    resource: 'timetable',
    action: 'view',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'timetable.edit',
    label: 'Edit Timetable',
    description: 'Modify timetables and schedules',
    resource: 'timetable',
    action: 'edit',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'timetable.create',
    label: 'Create Timetable',
    description: 'Create new timetables',
    resource: 'timetable',
    action: 'create',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'timetable.delete',
    label: 'Delete Timetable',
    description: 'Remove timetables',
    resource: 'timetable',
    action: 'delete',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'timetable.teachers',
    label: 'Assign Teachers',
    description: 'Assign teachers to classes',
    resource: 'timetable',
    action: 'teachers',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'timetable.rooms',
    label: 'Assign Rooms',
    description: 'Assign rooms to classes',
    resource: 'timetable',
    action: 'rooms',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'timetable.subjects',
    label: 'Manage Subject Scheduling',
    description: 'Manage subject scheduling',
    resource: 'timetable',
    action: 'subjects',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'timetable.conflicts',
    label: 'Resolve Conflicts',
    description: 'Resolve scheduling conflicts',
    resource: 'timetable',
    action: 'conflicts',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'timetable.export',
    label: 'Export Timetable',
    description: 'Export timetable data',
    resource: 'timetable',
    action: 'export',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'timetable.import',
    label: 'Import Timetable',
    description: 'Import timetable from external sources',
    resource: 'timetable',
    action: 'import',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'timetable.substitution',
    label: 'Handle Substitution',
    description: 'Handle teacher substitutions',
    resource: 'timetable',
    action: 'substitution',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'timetable.breaks',
    label: 'Manage Breaks',
    description: 'Manage break and lunch periods',
    resource: 'timetable',
    action: 'breaks',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
];

// Exam & Assessment Scheduling Permissions (12 permissions)
const EXAMS_PERMISSIONS = [
  {
    name: 'exams.view',
    label: 'View Exams',
    description: 'View exam schedules and timetables',
    resource: 'exams',
    action: 'view',
    category: 'academic',
    requiredClearanceLevel: 3,
  },
  {
    name: 'exams.create',
    label: 'Create Exam Schedule',
    description: 'Create exam schedules',
    resource: 'exams',
    action: 'create',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'exams.edit',
    label: 'Edit Exam Schedule',
    description: 'Modify exam timetables',
    resource: 'exams',
    action: 'edit',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'exams.delete',
    label: 'Delete Exam Schedule',
    description: 'Remove exam schedules',
    resource: 'exams',
    action: 'delete',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'exams.rooms',
    label: 'Assign Exam Rooms',
    description: 'Assign exam rooms and venues',
    resource: 'exams',
    action: 'rooms',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'exams.invigilators',
    label: 'Assign Invigilators',
    description: 'Assign exam supervisors',
    resource: 'exams',
    action: 'invigilators',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'exams.students',
    label: 'Manage Student Registrations',
    description: 'Manage student exam registrations',
    resource: 'exams',
    action: 'students',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'exams.conflicts',
    label: 'Resolve Conflicts',
    description: 'Resolve exam scheduling conflicts',
    resource: 'exams',
    action: 'conflicts',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'exams.results',
    label: 'Manage Results',
    description: 'Manage exam results and grading',
    resource: 'exams',
    action: 'results',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'exams.reports',
    label: 'Generate Reports',
    description: 'Generate exam reports',
    resource: 'exams',
    action: 'reports',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'exams.emergency',
    label: 'Handle Emergency',
    description: 'Handle exam emergencies and rescheduling',
    resource: 'exams',
    action: 'emergency',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
  {
    name: 'exams.accommodations',
    label: 'Manage Accommodations',
    description: 'Manage special exam accommodations',
    resource: 'exams',
    action: 'accommodations',
    category: 'academic',
    requiredClearanceLevel: 7,
  },
];

// Admissions Management Permissions (15 permissions)
const ADMISSIONS_PERMISSIONS = [
  {
    name: 'admissions.view',
    label: 'View Admissions',
    description: 'View admission applications and status',
    resource: 'admissions',
    action: 'view',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'admissions.create',
    label: 'Create Application',
    description: 'Create new admission applications',
    resource: 'admissions',
    action: 'create',
    category: 'administrative',
    requiredClearanceLevel: 0,
  },
  {
    name: 'admissions.edit',
    label: 'Edit Application',
    description: 'Modify application details',
    resource: 'admissions',
    action: 'edit',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'admissions.delete',
    label: 'Delete Application',
    description: 'Remove applications',
    resource: 'admissions',
    action: 'delete',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'admissions.review',
    label: 'Review Application',
    description: 'Review and evaluate applications',
    resource: 'admissions',
    action: 'review',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'admissions.approve',
    label: 'Approve Application',
    description: 'Approve admission applications',
    resource: 'admissions',
    action: 'approve',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
  {
    name: 'admissions.reject',
    label: 'Reject Application',
    description: 'Reject admission applications',
    resource: 'admissions',
    action: 'reject',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
  {
    name: 'admissions.waitlist',
    label: 'Manage Waitlist',
    description: 'Manage waitlist and priority',
    resource: 'admissions',
    action: 'waitlist',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'admissions.interviews',
    label: 'Schedule Interviews',
    description: 'Schedule and conduct interviews',
    resource: 'admissions',
    action: 'interviews',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'admissions.documents',
    label: 'Manage Documents',
    description: 'Manage required documents',
    resource: 'admissions',
    action: 'documents',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'admissions.fees',
    label: 'Handle Fees',
    description: 'Handle admission fees and payments',
    resource: 'admissions',
    action: 'fees',
    category: 'administrative',
    requiredClearanceLevel: 5,
  },
  {
    name: 'admissions.communication',
    label: 'Communicate with Applicants',
    description: 'Communicate with applicants',
    resource: 'admissions',
    action: 'communication',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'admissions.reports',
    label: 'Generate Reports',
    description: 'Generate admission reports',
    resource: 'admissions',
    action: 'reports',
    category: 'administrative',
    requiredClearanceLevel: 7,
  },
  {
    name: 'admissions.quotas',
    label: 'Manage Quotas',
    description: 'Manage admission quotas and limits',
    resource: 'admissions',
    action: 'quotas',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
  {
    name: 'admissions.criteria',
    label: 'Set Criteria',
    description: 'Set admission criteria and requirements',
    resource: 'admissions',
    action: 'criteria',
    category: 'administrative',
    requiredClearanceLevel: 8,
  },
];

// Role to Pool mapping
const ROLE_TO_POOL_MAPPING: Record<string, string> = {
  Architect: 'Level10_PlatformArchitect',
  SuperAdmin: 'Level9_PlatformSuperAdmin',
  Owner: 'Level8_SchoolOwner',
  Management: 'Level7_SchoolManagement',
  ITSupport: 'Level6_ITSupport',
  Finance: 'Level5_Finance',
  Operations: 'Level4_Operations',
  Teacher: 'Level3_Teacher',
  Parent: 'Level2_Parent',
  Student: 'Level1_Student',
  Guest: 'Level0_Guest',
};

/**
 * Phase 6: Platform Bootstrap
 *
 * Creates the originator Architect account that can bootstrap the entire system.
 * This is the first user who can log in and register tenants, create SuperAdmins, etc.
 *
 * Creates:
 * 1. A "Platform Administration" tenant for platform-level operations
 * 2. An Architect user with a hashed password
 * 3. A UserTenant profile linking the Architect to the platform tenant
 * 4. A UserTenantRole assigning the Architect role to that profile
 */
async function seedPlatformBootstrap(
  prismaInstance: typeof prisma,
  createdRoles: Record<string, string>,
) {
  console.log('\n📋 Phase 6: Bootstrapping platform Architect account...');

  const architectRoleId = createdRoles['Architect'];

  if (!architectRoleId) {
    console.warn(
      '⚠️  Skipping platform bootstrap: Architect role not found.',
    );
    return;
  }

  const platformTenant = await prismaInstance.tenant.upsert({
    where: { slug: PLATFORM_BOOTSTRAP.tenant.slug },
    update: {
      name: PLATFORM_BOOTSTRAP.tenant.name,
      status: PLATFORM_BOOTSTRAP.tenant.status,
    },
    create: {
      name: PLATFORM_BOOTSTRAP.tenant.name,
      slug: PLATFORM_BOOTSTRAP.tenant.slug,
      status: PLATFORM_BOOTSTRAP.tenant.status,
      settings: {
        isPlatformTenant: true,
        description: 'System tenant for platform administration. Do not delete.',
      },
    },
  });

  console.log(`  ✅ Platform tenant: ${platformTenant.name} (${platformTenant.slug})`);

  const jwtSecret = crypto.randomBytes(32).toString('base64');
  const encryptedSecret = Buffer.from(jwtSecret).toString('base64');

  await prismaInstance.tenantJWTConfig.upsert({
    where: { tenantId: platformTenant.id },
    update: {},
    create: {
      tenantId: platformTenant.id,
      jwtSecret: encryptedSecret,
      secretSource: 'auto_generated',
      secretRotationDate: new Date(),
      previousSecrets: [],
      managedBy: 'platform_admin',
      accessibleBySchools: false,
    },
  });

  console.log(`  ✅ JWT secret initialized for platform tenant`);

  const passwordHash = await bcrypt.hash(
    PLATFORM_BOOTSTRAP.architect.defaultPassword,
    12,
  );

  const architectUser = await prismaInstance.user.upsert({
    where: { email: PLATFORM_BOOTSTRAP.architect.email },
    update: {
      firstName: PLATFORM_BOOTSTRAP.architect.firstName,
      lastName: PLATFORM_BOOTSTRAP.architect.lastName,
      isActive: true,
      isVerified: true,
    },
    create: {
      email: PLATFORM_BOOTSTRAP.architect.email,
      passwordHash,
      firstName: PLATFORM_BOOTSTRAP.architect.firstName,
      lastName: PLATFORM_BOOTSTRAP.architect.lastName,
      isActive: true,
      isVerified: true,
    },
  });

  console.log(`  ✅ Architect user: ${architectUser.email}`);

  const existingProfile = await prismaInstance.userTenant.findFirst({
    where: {
      userId: architectUser.id,
      tenantId: platformTenant.id,
    },
  });

  const architectProfile =
    existingProfile ??
    (await prismaInstance.userTenant.create({
      data: {
        userId: architectUser.id,
        tenantId: platformTenant.id,
        status: 'active',
        suspended: false,
      },
    }));

  await prismaInstance.userTenantRole.upsert({
    where: {
      userTenantId: architectProfile.id,
    },
    update: {},
    create: {
      userTenantId: architectProfile.id,
      roleId: architectRoleId,
      isPrimary: true,
    },
  });

  console.log(`  ✅ Architect profile linked to platform tenant with Architect role`);
  console.log(`\n  🔑 Platform bootstrap credentials:`);
  console.log(`     Email:    ${PLATFORM_BOOTSTRAP.architect.email}`);
  console.log(`     Password: ${PLATFORM_BOOTSTRAP.architect.defaultPassword}`);
  console.log(`     ⚠️  Change this password immediately after first login in production!`);
}

// Permission to Pool mapping based on clearance level
// Platform permissions (category: 'platform') only go to platform pools (levels 9-10)
function getPermissionPoolsForPermission(
  requiredClearanceLevel: number,
  category?: string,
): string[] {
  const poolNames: string[] = [];

  // Clearance is a floor, not a ceiling: a permission requiring level R
  // must be available to every pool at R *and above* (more-privileged
  // tiers always retain everything less-privileged tiers can do, plus
  // more) — never to pools below R. Iterating the other direction (0..R)
  // would leak high-clearance permissions (e.g. requiredClearanceLevel: 8
  // "users.delete") down into low-clearance pools like Level3_Teacher.

  // Platform permissions only go to platform pools (levels 9-10)
  if (category === 'platform') {
    for (let level = Math.max(9, requiredClearanceLevel); level <= 10; level++) {
      const pool = PERMISSION_POOLS.find((p) => p.clearanceLevel === level);
      if (pool) {
        poolNames.push(pool.name);
      }
    }
  } else {
    // School permissions go to their clearance level and every level above it
    for (let level = requiredClearanceLevel; level <= 10; level++) {
      const pool = PERMISSION_POOLS.find((p) => p.clearanceLevel === level);
      if (pool) {
        poolNames.push(pool.name);
      }
    }
  }

  return poolNames;
}

async function seedSystemRoles() {
  console.log('📋 Phase 1: Creating system roles...');
  const createdRoles: Record<string, string> = {};

  for (const roleData of SYSTEM_ROLES) {
    const existing = await prisma.role.findFirst({
      where: {
        name: roleData.name,
        roleType: roleData.roleType,
        tenantId: null,
      },
    });

    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: {
            description: roleData.description,
            clearanceLevel: roleData.clearanceLevel,
            isSystemRole: roleData.isSystemRole,
          },
        })
      : await prisma.role.create({
          data: {
            name: roleData.name,
            description: roleData.description,
            roleType: roleData.roleType,
            clearanceLevel: roleData.clearanceLevel,
            isSystemRole: roleData.isSystemRole,
            tenantId: null,
          },
        });

    createdRoles[roleData.name] = role.id;
    console.log(
      `  ✅ ${existing ? 'Updated' : 'Created'} role: ${roleData.name} (Level ${roleData.clearanceLevel})`,
    );
  }

  return createdRoles;
}

async function seedPermissionPools() {
  console.log('\n📋 Phase 2: Creating permission pools...');
  const createdPools: Record<string, string> = {};

  for (const poolData of PERMISSION_POOLS) {
    const existing = await prisma.permissionPool.findFirst({
      where: {
        name: poolData.name,
        tenantId: null,
      },
    });

    const pool = existing
      ? await prisma.permissionPool.update({
          where: { id: existing.id },
          data: {
            description: poolData.description,
            clearanceLevel: poolData.clearanceLevel,
          },
        })
      : await prisma.permissionPool.create({
          data: {
            name: poolData.name,
            description: poolData.description,
            clearanceLevel: poolData.clearanceLevel,
            isSystemPool: true,
            tenantId: null,
          },
        });

    createdPools[poolData.name] = pool.id;
    console.log(
      `  ✅ ${existing ? 'Updated' : 'Created'} pool: ${poolData.name} (Level ${poolData.clearanceLevel})`,
    );
  }

  return createdPools;
}

async function upsertPermissions(
  allPermissions: Array<{
    name: string;
    label: string;
    description: string;
    resource: string;
    action: string;
    context?: string;
    category?: string;
    requiredClearanceLevel: number;
  }>,
) {
  console.log('\n📋 Phase 3: Creating all permissions...');

  console.log(`\n📋 Permission Arrays Summary:`);
  console.log(`  - STUDENT_PERMISSIONS: ${STUDENT_PERMISSIONS.length}`);
  console.log(
    `  - ACADEMIC_MANAGEMENT_PERMISSIONS: ${ACADEMIC_MANAGEMENT_PERMISSIONS.length}`,
  );
  console.log(`  - Total in allPermissions array: ${allPermissions.length}`);

  const permissionNames = allPermissions.map((p) => p.name);
  const uniqueNames = new Set(permissionNames);
  if (permissionNames.length !== uniqueNames.size) {
    const duplicates = permissionNames.filter(
      (name, index) => permissionNames.indexOf(name) !== index,
    );
    console.warn(
      `  ⚠️  Found ${duplicates.length} duplicate permission names:`,
    );
    [...new Set(duplicates)].forEach((name) => console.warn(`     - ${name}`));
  }

  const createdPermissions: Record<string, string> = {};

  for (const permData of allPermissions) {
    const permission = await prisma.permission.upsert({
      where: {
        name: permData.name,
      },
      update: {
        label: permData.label,
        description: permData.description,
        resource: permData.resource,
        action: permData.action,
        context: (permData as any).context || null,
        category: permData.category,
        requiredClearanceLevel: permData.requiredClearanceLevel,
      } as any,
      create: {
        name: permData.name,
        label: permData.label,
        description: permData.description,
        resource: permData.resource,
        action: permData.action,
        context: (permData as any).context || null,
        category: permData.category,
        requiredClearanceLevel: permData.requiredClearanceLevel,
      } as any,
    });
    createdPermissions[permData.name] = permission.id;
    console.log(`  ✅ Created permission: ${permData.name}`);
  }

  return createdPermissions;
}

async function assignPermissionsToPools(
  allPermissions: Array<{
    name: string;
    requiredClearanceLevel: number;
    category?: string;
  }>,
  createdPermissions: Record<string, string>,
  createdPools: Record<string, string>,
) {
  console.log('\n📋 Phase 4: Assigning permissions to pools...');
  let poolPermissionCount = 0;

  for (const permData of allPermissions) {
    const poolNames = getPermissionPoolsForPermission(
      permData.requiredClearanceLevel,
      permData.category,
    );
    const permissionId = createdPermissions[permData.name];

    if (!permissionId) {
      console.warn(`  ⚠️  Permission not found: ${permData.name}`);
      continue;
    }

    for (const poolName of poolNames) {
      const poolId = createdPools[poolName];

      if (!poolId) {
        console.warn(`  ⚠️  Pool not found: ${poolName}`);
        continue;
      }

      await prisma.permissionPoolPermission.upsert({
        where: {
          poolId_permissionId: {
            poolId,
            permissionId,
          },
        },
        update: {},
        create: {
          poolId,
          permissionId,
        },
      });
      poolPermissionCount++;
    }
  }

  console.log(
    `  ✅ Assigned ${poolPermissionCount} permission-pool relationships`,
  );
  return poolPermissionCount;
}

async function assignPoolsToRoles(
  createdRoles: Record<string, string>,
  createdPools: Record<string, string>,
) {
  console.log('\n📋 Phase 5: Assigning pools to roles...');
  let rolePoolCount = 0;

  for (const [roleName, poolName] of Object.entries(ROLE_TO_POOL_MAPPING)) {
    const roleId = createdRoles[roleName];
    const poolId = createdPools[poolName];

    if (roleId && poolId) {
      await prisma.rolePermissionPool.upsert({
        where: {
          roleId_poolId: {
            roleId,
            poolId,
          },
        },
        update: {},
        create: {
          roleId,
          poolId,
        },
      });
      rolePoolCount++;
      console.log(`  ✅ Assigned ${poolName} to ${roleName}`);
    }
  }

  return rolePoolCount;
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    validatePermissionPools();
    validateRolePoolMapping(SYSTEM_ROLES, ROLE_TO_POOL_MAPPING);

    const createdRoles = await seedSystemRoles();
    const createdPools = await seedPermissionPools();

    const permissionArrays = {
      STUDENT_PERMISSIONS,
      ACADEMIC_MANAGEMENT_PERMISSIONS,
      GRADE_ASSESSMENT_PERMISSIONS,
      ATTENDANCE_PERMISSIONS,
      FINANCIAL_PERMISSIONS,
      COMMUNICATION_PERMISSIONS,
      STAFF_PERMISSIONS,
      REPORTS_PERMISSIONS,
      SYSTEM_ADMIN_PERMISSIONS,
      PLATFORM_PERMISSIONS,
      LIBRARY_PERMISSIONS,
      TRANSPORTATION_PERMISSIONS,
      CAFETERIA_PERMISSIONS,
      HEALTH_PERMISSIONS,
      FACILITIES_PERMISSIONS,
      EVENTS_PERMISSIONS,
      SPORTS_PERMISSIONS,
      CLUBS_PERMISSIONS,
      PARENT_PORTAL_PERMISSIONS,
      INVENTORY_PERMISSIONS,
      SAFETY_PERMISSIONS,
      COMPLIANCE_PERMISSIONS,
      TIMETABLE_PERMISSIONS,
      EXAMS_PERMISSIONS,
      ADMISSIONS_PERMISSIONS,
    };

    const allPermissions = Object.values(permissionArrays).flat();

    validatePermissionsCatalog(permissionArrays);

    const createdPermissions = await upsertPermissions(allPermissions);
    const poolPermissionCount = await assignPermissionsToPools(
      allPermissions,
      createdPermissions,
      createdPools,
    );
    const rolePoolCount = await assignPoolsToRoles(createdRoles, createdPools);

    await seedPlatformBootstrap(prisma, createdRoles);

    console.log('\n✨ Seed completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`  - System Roles: ${SYSTEM_ROLES.length}`);
    console.log(`  - Permission Pools: ${PERMISSION_POOLS.length}`);
    console.log(`  - All Permissions: ${allPermissions.length}`);
    console.log(`  - Permission-Pool Assignments: ${poolPermissionCount}`);
    console.log(`  - Role-Pool Assignments: ${rolePoolCount}`);
    console.log(`  - Platform Architect: ${PLATFORM_BOOTSTRAP.architect.email}`);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
