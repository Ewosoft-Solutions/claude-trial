/**
 * Permissions-only sync — run in CD after `prisma migrate deploy`.
 *
 * Upserts the platform-level permission catalog + role grants (Phases 1–5 of the
 * seed: system roles → pools → permissions → pool-permission links → role-pool
 * grants). It does NOT touch tenant/demo data or the platform Architect account,
 * so it is safe to run on every deploy — new permissions and their role grants
 * reach the environment automatically, without the manual reseed that hid the
 * People directory on demo (see project-seed-permission-gotchas).
 *
 * Must run with a DB role that can write the platform tables (the CD "owner"
 * role — DATABASE_URL_OWNER — same as `prisma migrate deploy`).
 */
import { prisma } from '../../src/singleton.js';
import { syncPermissions } from './seed.js';

async function main() {
  console.log('🔐 Syncing permission catalog + role grants...\n');
  try {
    const { allPermissions, poolPermissionCount, rolePoolCount } =
      await syncPermissions();
    console.log('\n✨ Permissions sync complete.');
    console.log(`  - Permissions: ${allPermissions.length}`);
    console.log(`  - Permission-Pool links: ${poolPermissionCount}`);
    console.log(`  - Role-Pool grants: ${rolePoolCount}`);
  } catch (error) {
    console.error('❌ Error syncing permissions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
