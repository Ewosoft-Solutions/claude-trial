import { prisma } from './client';

/**
 * Seed script for database initialization
 *
 * Phase 1: System Roles (Priority)
 * Phase 2: Permission Pools
 * Phase 3: Sample Permissions (Subsets)
 * Phase 4: Assign Permissions to Pools
 * Phase 5: Assign Pools to Roles
 */

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

// Sample Permissions - Academic subset
const ACADEMIC_PERMISSIONS = [
  {
    name: 'students.view',
    label: 'View Students',
    description: 'View student list and basic information',
    resource: 'students',
    action: 'view',
    category: 'academic',
    clearanceLevel: 3,
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
    clearanceLevel: 7,
  },
  {
    name: 'students.edit',
    label: 'Edit Students',
    description: 'Edit basic student information',
    resource: 'students',
    action: 'edit',
    category: 'academic',
    clearanceLevel: 7,
  },
  {
    name: 'students.create',
    label: 'Create Students',
    description: 'Add new students to the system',
    resource: 'students',
    action: 'create',
    category: 'academic',
    clearanceLevel: 7,
  },
  {
    name: 'courses.view',
    label: 'View Courses',
    description: 'View course catalog and schedules',
    resource: 'courses',
    action: 'view',
    category: 'academic',
    clearanceLevel: 3,
  },
  {
    name: 'courses.edit',
    label: 'Edit Courses',
    description: 'Modify course information',
    resource: 'courses',
    action: 'edit',
    category: 'academic',
    clearanceLevel: 7,
  },
  {
    name: 'courses.create',
    label: 'Create Courses',
    description: 'Create new courses',
    resource: 'courses',
    action: 'create',
    category: 'academic',
    clearanceLevel: 7,
  },
  {
    name: 'grades.view',
    label: 'View Grades',
    description: 'View grades and assessments',
    resource: 'grades',
    action: 'view',
    category: 'academic',
    clearanceLevel: 3,
  },
  {
    name: 'grades.view.own',
    label: 'View Own Grades',
    description: 'View only own grades (for students)',
    resource: 'grades',
    action: 'view',
    context: 'own',
    category: 'academic',
    clearanceLevel: 1,
  },
  {
    name: 'grades.edit',
    label: 'Edit Grades',
    description: 'Edit grades and assessments',
    resource: 'grades',
    action: 'edit',
    category: 'academic',
    clearanceLevel: 3,
  },
  {
    name: 'grades.edit.own_classes',
    label: 'Edit Grades for Own Classes',
    description: 'Edit grades for own classes only (for teachers)',
    resource: 'grades',
    action: 'edit',
    context: 'own_classes',
    category: 'academic',
    clearanceLevel: 3,
  },
];

// Sample Permissions - Platform subset
const PLATFORM_PERMISSIONS = [
  {
    name: 'platform.override',
    label: 'Platform Override',
    description: 'Emergency override access to any school',
    resource: 'platform',
    action: 'override',
    category: 'platform',
    clearanceLevel: 10,
  },
  {
    name: 'platform.audit',
    label: 'View All Audit Logs',
    description: 'View all audit logs across platform',
    resource: 'platform',
    action: 'audit',
    category: 'platform',
    clearanceLevel: 10,
  },
  {
    name: 'platform.maintenance',
    label: 'Platform Maintenance',
    description: 'Perform system maintenance',
    resource: 'platform',
    action: 'maintenance',
    category: 'platform',
    clearanceLevel: 10,
  },
  {
    name: 'platform.support.access',
    label: 'Platform Support Access',
    description: 'Access school systems for support',
    resource: 'platform',
    action: 'support',
    context: 'access',
    category: 'platform',
    clearanceLevel: 9,
  },
  {
    name: 'platform.monitoring',
    label: 'Platform Monitoring',
    description: 'View system health and performance',
    resource: 'platform',
    action: 'monitoring',
    category: 'platform',
    clearanceLevel: 9,
  },
  {
    name: 'platform.audit.limited',
    label: 'Limited Audit Access',
    description: 'View limited audit information',
    resource: 'platform',
    action: 'audit',
    context: 'limited',
    category: 'platform',
    clearanceLevel: 9,
  },
];

// Sample Permissions - Administrative subset
const ADMINISTRATIVE_PERMISSIONS = [
  {
    name: 'settings.view',
    label: 'View Settings',
    description: 'View system settings',
    resource: 'settings',
    action: 'view',
    category: 'administrative',
    clearanceLevel: 7,
  },
  {
    name: 'settings.edit',
    label: 'Edit Settings',
    description: 'Modify system settings',
    resource: 'settings',
    action: 'edit',
    category: 'administrative',
    clearanceLevel: 8,
  },
  {
    name: 'settings.school',
    label: 'Edit School Settings',
    description: 'Edit school-specific settings',
    resource: 'settings',
    action: 'edit',
    context: 'school',
    category: 'administrative',
    clearanceLevel: 7,
  },
  {
    name: 'users.view',
    label: 'View Users',
    description: 'View user list and basic information',
    resource: 'users',
    action: 'view',
    category: 'administrative',
    clearanceLevel: 7,
  },
  {
    name: 'users.create',
    label: 'Create Users',
    description: 'Add new users to the system',
    resource: 'users',
    action: 'create',
    category: 'administrative',
    clearanceLevel: 7,
  },
  {
    name: 'users.edit',
    label: 'Edit Users',
    description: 'Modify user information',
    resource: 'users',
    action: 'edit',
    category: 'administrative',
    clearanceLevel: 7,
  },
  {
    name: 'roles.view',
    label: 'View Roles',
    description: 'View roles and permissions',
    resource: 'roles',
    action: 'view',
    category: 'administrative',
    clearanceLevel: 7,
  },
  {
    name: 'roles.create',
    label: 'Create Roles',
    description: 'Create new roles',
    resource: 'roles',
    action: 'create',
    category: 'administrative',
    clearanceLevel: 8,
  },
  {
    name: 'roles.edit',
    label: 'Edit Roles',
    description: 'Modify roles and permissions',
    resource: 'roles',
    action: 'edit',
    category: 'administrative',
    clearanceLevel: 8,
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

// Permission to Pool mapping based on clearance level
function getPermissionPoolsForPermission(clearanceLevel: number): string[] {
  const poolNames: string[] = [];
  for (let level = 0; level <= clearanceLevel; level++) {
    const pool = PERMISSION_POOLS.find((p) => p.clearanceLevel === level);
    if (pool) {
      poolNames.push(pool.name);
    }
  }
  return poolNames;
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Phase 1: Create System Roles
    console.log('📋 Phase 1: Creating system roles...');
    const createdRoles: Record<string, string> = {};

    for (const roleData of SYSTEM_ROLES) {
      const role = await prisma.role.upsert({
        where: {
          name_tenantId: {
            name: roleData.name,
            tenantId: null,
          },
        },
        update: {
          description: roleData.description,
          roleType: roleData.roleType,
          clearanceLevel: roleData.clearanceLevel,
          isSystemRole: roleData.isSystemRole,
        },
        create: {
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
        `  ✅ Created role: ${roleData.name} (Level ${roleData.clearanceLevel})`,
      );
    }

    // Phase 2: Create Permission Pools
    console.log('\n📋 Phase 2: Creating permission pools...');
    const createdPools: Record<string, string> = {};

    for (const poolData of PERMISSION_POOLS) {
      const pool = await prisma.permissionPool.upsert({
        where: {
          name_tenantId: {
            name: poolData.name,
            tenantId: null,
          },
        },
        update: {
          description: poolData.description,
          clearanceLevel: poolData.clearanceLevel,
        },
        create: {
          name: poolData.name,
          description: poolData.description,
          clearanceLevel: poolData.clearanceLevel,
          isSystemPool: true,
          tenantId: null,
        },
      });
      createdPools[poolData.name] = pool.id;
      console.log(
        `  ✅ Created pool: ${poolData.name} (Level ${poolData.clearanceLevel})`,
      );
    }

    // Phase 3: Create Sample Permissions
    console.log('\n📋 Phase 3: Creating sample permissions...');
    const allPermissions = [
      ...ACADEMIC_PERMISSIONS,
      ...PLATFORM_PERMISSIONS,
      ...ADMINISTRATIVE_PERMISSIONS,
    ];
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
          context: permData.context || null,
          category: permData.category,
        },
        create: {
          name: permData.name,
          label: permData.label,
          description: permData.description,
          resource: permData.resource,
          action: permData.action,
          context: permData.context || null,
          category: permData.category,
        },
      });
      createdPermissions[permData.name] = permission.id;
      console.log(`  ✅ Created permission: ${permData.name}`);
    }

    // Phase 4: Assign Permissions to Pools
    console.log('\n📋 Phase 4: Assigning permissions to pools...');
    let poolPermissionCount = 0;

    for (const permData of allPermissions) {
      const poolNames = getPermissionPoolsForPermission(
        permData.clearanceLevel,
      );
      const permissionId = createdPermissions[permData.name];

      for (const poolName of poolNames) {
        const poolId = createdPools[poolName];

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

    // Phase 5: Assign Pools to Roles
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

    console.log('\n✨ Seed completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`  - System Roles: ${SYSTEM_ROLES.length}`);
    console.log(`  - Permission Pools: ${PERMISSION_POOLS.length}`);
    console.log(`  - Sample Permissions: ${allPermissions.length}`);
    console.log(`  - Permission-Pool Assignments: ${poolPermissionCount}`);
    console.log(`  - Role-Pool Assignments: ${rolePoolCount}`);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
