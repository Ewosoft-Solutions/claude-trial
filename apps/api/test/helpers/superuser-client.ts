/**
 * Privileged (RLS-bypassing) Postgres connection for e2e FIXTURE setup only.
 *
 * Under the topology-parity harness (docs/rls-privileged-client-plan.md) the
 * app-under-test boots with `DATABASE_URL` pointed at the non-superuser
 * `app_runtime` role, so `app.get(DatabaseService).client` is RLS-subject and
 * cannot seed cross-tenant fixtures (a bare INSERT of another tenant's row is
 * rejected by `WITH CHECK`). This helper connects as the superuser via
 * `E2E_SUPERUSER_DATABASE_URL` purely to create and tear down test data — the
 * same way migrations and seeds run as the owner, not as `app_runtime`.
 *
 * Falls back to `DATABASE_URL` when `E2E_SUPERUSER_DATABASE_URL` is unset — i.e.
 * local `pnpm test:e2e` without the split, where `DATABASE_URL` is already a
 * superuser — so the suite still runs out of the box (just without parity).
 *
 * Built with the same pg driver adapter the app uses (Prisma 7), so behaviour
 * matches the real client. Call `$disconnect()` in `afterAll`.
 */
import { PrismaClient } from '@workspace/database';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

export function makeSuperuserClient(): PrismaClient {
  const connectionString =
    process.env.E2E_SUPERUSER_DATABASE_URL ?? process.env.DATABASE_URL;
  // A small pool: this handle only seeds/tears down fixtures, and each e2e file
  // opens one on top of the app's two pools (privileged + tenant). Left at the
  // pg default of 10 they add up across files and can exhaust connections.
  const pool = new pg.Pool({ connectionString, max: 3 });
  const adapter = new PrismaPg(pool, { disposeExternalPool: true });
  return new PrismaClient({ adapter });
}

/** True when the app-under-test is running on the non-superuser parity topology. */
export function isParityTopology(): boolean {
  return (
    !!process.env.E2E_SUPERUSER_DATABASE_URL &&
    process.env.E2E_SUPERUSER_DATABASE_URL !== process.env.DATABASE_URL
  );
}
