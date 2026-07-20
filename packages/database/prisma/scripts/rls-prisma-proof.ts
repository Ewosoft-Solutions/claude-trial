/**
 * RLS proof through the REAL runtime stack (Prisma 7 + @prisma/adapter-pg),
 * connected as the non-superuser `app_runtime` role.
 *
 * This is stronger than the psql proof: it confirms that a Prisma interactive
 * `$transaction` keeps the transaction-local `set_config('app.current_tenant_id')`
 * GUC on the SAME pooled connection for every query in the callback — i.e. the
 * way the NestJS app will actually enforce tenant isolation at runtime.
 *
 * Run (skips cleanly if env not provided):
 *   APP_RUNTIME_DATABASE_URL=postgres://app_runtime:...@host/db \
 *   OWNER_DATABASE_URL=postgres://owner:...@host/db \
 *   TA=<tenantA-uuid> TB=<tenantB-uuid> \
 *   pnpm --filter @workspace/database exec tsx prisma/scripts/rls-prisma-proof.ts
 */
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const appUrl = process.env.APP_RUNTIME_DATABASE_URL;
const ownerUrl = process.env.OWNER_DATABASE_URL ?? process.env.DATABASE_URL;
const TA = process.env.TA;
const TB = process.env.TB;

if (!appUrl || !ownerUrl || !TA || !TB) {
  console.log(
    'SKIP rls-prisma-proof: set APP_RUNTIME_DATABASE_URL, OWNER_DATABASE_URL (or DATABASE_URL), TA, TB.',
  );
  process.exit(0);
}

function client(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  return { prisma: new PrismaClient({ adapter: new PrismaPg(pool) }), pool };
}

const TAG = 'PRISMA-PROOF';
let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`);
  if (!ok) failures++;
}

async function setTenant(tx: PrismaClient, tenantId: string) {
  // transaction-local GUC, parameterized (mirrors @workspace/database/rls setContext)
  await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
}

async function main() {
  const owner = client(ownerUrl!);
  const app = client(appUrl!);
  try {
    // Seed one announcement per tenant as the owner (bypasses RLS).
    await owner.prisma.announcement.deleteMany({ where: { title: { startsWith: TAG } } });
    await owner.prisma.announcement.createMany({
      data: [
        { tenantId: TA!, targetType: 'all', title: `${TAG}-A`, content: 'x' },
        { tenantId: TB!, targetType: 'all', title: `${TAG}-B`, content: 'y' },
      ],
    });

    // [1] As tenant A (in a tx with the GUC), only A's row is visible.
    const aRows = await app.prisma.$transaction(async (tx) => {
      await setTenant(tx as unknown as PrismaClient, TA!);
      return tx.announcement.findMany({ where: { title: { startsWith: TAG } } });
    });
    check('tenant A sees only its own announcement', aRows.length === 1 && aRows[0]!.title === `${TAG}-A`);

    // [2] As tenant B, only B's row.
    const bRows = await app.prisma.$transaction(async (tx) => {
      await setTenant(tx as unknown as PrismaClient, TB!);
      return tx.announcement.findMany({ where: { title: { startsWith: TAG } } });
    });
    check('tenant B sees only its own announcement', bRows.length === 1 && bRows[0]!.title === `${TAG}-B`);

    // [3] No GUC (no tx context) → nothing visible (RLS denies).
    const noneRows = await app.prisma.announcement.findMany({ where: { title: { startsWith: TAG } } });
    check('no tenant context sees nothing', noneRows.length === 0);

    // [4] WITH CHECK: as A, creating a B-owned row is rejected.
    let writeBlocked = false;
    try {
      await app.prisma.$transaction(async (tx) => {
        await setTenant(tx as unknown as PrismaClient, TA!);
        await tx.announcement.create({
          data: { tenantId: TB!, targetType: 'all', title: `${TAG}-EVIL`, content: 'z' },
        });
      });
    } catch {
      writeBlocked = true;
    }
    check('cross-tenant write rejected by WITH CHECK', writeBlocked);

    // [5] cross-tenant updateMany as A on B's row affects 0 rows.
    const upd = await app.prisma.$transaction(async (tx) => {
      await setTenant(tx as unknown as PrismaClient, TA!);
      return tx.announcement.updateMany({ where: { title: `${TAG}-B` }, data: { content: 'hacked' } });
    });
    check('cross-tenant updateMany affects 0 rows', upd.count === 0);
  } finally {
    await owner.prisma.announcement.deleteMany({ where: { title: { startsWith: TAG } } });
    await owner.prisma.$disconnect();
    await app.prisma.$disconnect();
    await owner.pool.end();
    await app.pool.end();
  }

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
