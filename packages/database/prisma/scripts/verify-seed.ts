/**
 * Seed Data Verification Script
 *
 * Verifies that seed data was created correctly after running the seed script.
 * Run this after: npm run db:seed
 */
import { prisma } from '../../src/client.js';

interface VerificationResult {
  name: string;
  status: 'pass' | 'fail';
  expected: number | string;
  actual: number | string;
  message?: string;
}

async function verifySeedData() {
  console.log('🔍 Verifying seed data...\n');

  const results: VerificationResult[] = [];

  try {
    // 1. Verify System Roles
    console.log('📋 Checking system roles...');
    const systemRoles = await prisma.role.findMany({
      where: { isSystemRole: true },
      orderBy: { clearanceLevel: 'desc' },
    });

    const expectedRoles = 11; // Architect, SuperAdmin, Owner, Management, ITSupport, Finance, Operations, Teacher, Parent, Student, Guest
    const actualRoles = systemRoles.length;

    results.push({
      name: 'System Roles',
      status: actualRoles === expectedRoles ? 'pass' : 'fail',
      expected: expectedRoles,
      actual: actualRoles,
      message:
        actualRoles === expectedRoles
          ? `✅ Found ${actualRoles} system roles`
          : `❌ Expected ${expectedRoles} roles, found ${actualRoles}`,
    });

    if (systemRoles.length > 0) {
      console.log(`  ✅ Found ${systemRoles.length} system roles:`);
      systemRoles.forEach((role) => {
        console.log(
          `     - ${role.name} (Level ${role.clearanceLevel}, ${role.roleType})`,
        );
      });
    }

    // 2. Verify Permission Pools
    console.log('\n📋 Checking permission pools...');
    const permissionPools = await prisma.permissionPool.findMany({
      where: { isSystemPool: true },
      orderBy: { clearanceLevel: 'desc' },
    });

    const expectedPools = 11; // One pool per clearance level (0-10)
    const actualPools = permissionPools.length;

    results.push({
      name: 'Permission Pools',
      status: actualPools === expectedPools ? 'pass' : 'fail',
      expected: expectedPools,
      actual: actualPools,
      message:
        actualPools === expectedPools
          ? `✅ Found ${actualPools} permission pools`
          : `❌ Expected ${expectedPools} pools, found ${actualPools}`,
    });

    if (permissionPools.length > 0) {
      console.log(`  ✅ Found ${permissionPools.length} permission pools:`);
      permissionPools.forEach((pool) => {
        console.log(`     - ${pool.name} (Level ${pool.clearanceLevel})`);
      });
    }

    // 3. Verify Permissions
    console.log('\n📋 Checking permissions...');
    const permissions = await prisma.permission.findMany();
    const expectedPermissions = 274; // From SEED_DATA_IMPLEMENTATION.md
    const actualPermissions = permissions.length;

    results.push({
      name: 'Permissions',
      status: actualPermissions >= expectedPermissions ? 'pass' : 'fail',
      expected: `>= ${expectedPermissions}`,
      actual: actualPermissions,
      message:
        actualPermissions >= expectedPermissions
          ? `✅ Found ${actualPermissions} permissions`
          : `❌ Expected at least ${expectedPermissions} permissions, found ${actualPermissions}`,
    });

    // Group by category
    const permissionsByCategory = permissions.reduce(
      (acc, perm) => {
        acc[perm.category] = (acc[perm.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    console.log(
      `  ✅ Found ${actualPermissions} permissions across ${Object.keys(permissionsByCategory).length} categories:`,
    );
    Object.entries(permissionsByCategory)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .forEach(([category, count]) => {
        console.log(`     - ${category}: ${count} permissions`);
      });

    // 4. Verify Permission Pool Assignments
    console.log('\n📋 Checking permission pool assignments...');
    const poolAssignments = await prisma.permissionPoolPermission.findMany();
    const expectedMinAssignments = 200; // Minimum expected assignments
    const actualAssignments = poolAssignments.length;

    results.push({
      name: 'Permission Pool Assignments',
      status: actualAssignments >= expectedMinAssignments ? 'pass' : 'fail',
      expected: `>= ${expectedMinAssignments}`,
      actual: actualAssignments,
      message:
        actualAssignments >= expectedMinAssignments
          ? `✅ Found ${actualAssignments} permission-pool assignments`
          : `❌ Expected at least ${expectedMinAssignments} assignments, found ${actualAssignments}`,
    });

    // Check assignments per pool
    const assignmentsPerPool = await prisma.permissionPool.findMany({
      include: {
        poolPermissions: {
          select: { id: true },
        },
      },
    });

    console.log(`  ✅ Permission assignments per pool:`);
    assignmentsPerPool
      .sort((a, b) => b.clearanceLevel - a.clearanceLevel)
      .forEach((pool) => {
        const count = pool.poolPermissions.length;
        console.log(`     - ${pool.name}: ${count} permissions`);
      });

    // 5. Verify Role-Pool Assignments
    console.log('\n📋 Checking role-pool assignments...');
    const rolePoolAssignments = await prisma.rolePermissionPool.findMany();
    const expectedMinRolePools = 11; // Each system role should have at least one pool
    const actualRolePools = rolePoolAssignments.length;

    results.push({
      name: 'Role-Pool Assignments',
      status: actualRolePools >= expectedMinRolePools ? 'pass' : 'fail',
      expected: `>= ${expectedMinRolePools}`,
      actual: actualRolePools,
      message:
        actualRolePools >= expectedMinRolePools
          ? `✅ Found ${actualRolePools} role-pool assignments`
          : `❌ Expected at least ${expectedMinRolePools} assignments, found ${actualRolePools}`,
    });

    // Check assignments per role
    const assignmentsPerRole = await prisma.role.findMany({
      where: { isSystemRole: true },
      include: {
        rolePools: {
          include: {
            pool: {
              select: { id: true },
            },
          },
        },
      },
    });

    console.log(`  ✅ Pool assignments per role:`);
    assignmentsPerRole
      .sort((a, b) => b.clearanceLevel - a.clearanceLevel)
      .forEach((role) => {
        const count = role.rolePools.length;
        console.log(`     - ${role.name}: ${count} pools`);
      });

    // 6. Verify Clearance Levels
    console.log('\n📋 Checking clearance level coverage...');
    const clearanceLevels = systemRoles
      .map((r) => r.clearanceLevel)
      .sort((a, b) => b - a);
    const expectedLevels = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    const missingLevels = expectedLevels.filter(
      (level) => !clearanceLevels.includes(level),
    );

    results.push({
      name: 'Clearance Level Coverage',
      status: missingLevels.length === 0 ? 'pass' : 'fail',
      expected: 'All levels 0-10',
      actual:
        missingLevels.length === 0
          ? 'Complete'
          : `Missing: ${missingLevels.join(', ')}`,
      message:
        missingLevels.length === 0
          ? '✅ All clearance levels (0-10) are covered'
          : `❌ Missing clearance levels: ${missingLevels.join(', ')}`,
    });

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = results.filter((r) => r.status === 'fail').length;

    results.forEach((result) => {
      const icon = result.status === 'pass' ? '✅' : '❌';
      console.log(
        `${icon} ${result.name}: ${result.message || `${result.actual} (expected: ${result.expected})`}`,
      );
    });

    console.log('\n' + '='.repeat(60));
    console.log(
      `Total: ${results.length} checks | ✅ Passed: ${passed} | ❌ Failed: ${failed}`,
    );
    console.log('='.repeat(60));

    if (failed === 0) {
      console.log('\n🎉 All verifications passed! Seed data is correct.\n');
      process.exit(0);
    } else {
      console.log(
        '\n⚠️  Some verifications failed. Please review the seed script.\n',
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifySeedData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
