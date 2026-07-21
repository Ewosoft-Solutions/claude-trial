const DEV_SEED_FLAG = 'ENABLE_DEV_SEEDS';
const REMOTE_TARGET_FLAG = 'ALLOW_REMOTE_DEV_SEED_TARGET';
const TRUE_VALUES = new Set(['1', 'true', 'yes']);
const PRODUCTION_VALUES = new Set(['prod', 'production']);

// Hosts that can only ever be a developer's own machine or container network.
const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
  'host.docker.internal',
  'postgres',
  'db',
]);

function isTrue(value: string | undefined): boolean {
  return TRUE_VALUES.has((value ?? '').trim().toLowerCase());
}

function isProductionLike(value: string | undefined): boolean {
  return PRODUCTION_VALUES.has((value ?? '').trim().toLowerCase());
}

/**
 * Extracts the host from a Postgres connection string.
 *
 * Returns undefined when the URL cannot be parsed — callers treat that as
 * "unknown target", which is refused rather than assumed safe.
 */
function connectionHost(connectionString: string): string | undefined {
  try {
    const host = new URL(connectionString).hostname;
    return host === '' ? undefined : host.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Refuses to run a dev seed against anything but a local database.
 *
 * The environment checks below (NODE_ENV/APP_ENV/VERCEL_ENV) describe the
 * *process*, not the *target*. A developer running `pnpm seed:dev` on their
 * laptop with a production DATABASE_URL exported passes every one of them, so
 * the connection target is checked separately.
 *
 * Set ALLOW_REMOTE_DEV_SEED_TARGET=true to seed a shared/remote development
 * database on purpose. That flag is an explicit, per-invocation decision — do
 * not put it in a committed .env file.
 */
function assertLocalSeedTarget(seedName: string): void {
  if (isTrue(process.env[REMOTE_TARGET_FLAG])) {
    console.warn(
      `[dev-seed:${seedName}] ${REMOTE_TARGET_FLAG} is set — skipping the local-database check. Confirm DATABASE_URL points at a development database.`,
    );
    return;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      `[dev-seed:${seedName}] Refusing to run: DATABASE_URL is not set, so the target database cannot be verified as local.`,
    );
  }

  const host = connectionHost(connectionString);

  if (!host) {
    throw new Error(
      `[dev-seed:${seedName}] Refusing to run: DATABASE_URL could not be parsed, so the target database cannot be verified as local. Set ${REMOTE_TARGET_FLAG}=true to override.`,
    );
  }

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `[dev-seed:${seedName}] Refusing to run against non-local database host "${host}". Dev seeds write fake data and are destructive to real records. Point DATABASE_URL at a local database, or set ${REMOTE_TARGET_FLAG}=true if this really is a remote development database.`,
    );
  }
}

export function assertDevSeedAllowed(seedName: string): void {
  const productionEnv = [
    ['NODE_ENV', process.env.NODE_ENV],
    ['APP_ENV', process.env.APP_ENV],
    ['VERCEL_ENV', process.env.VERCEL_ENV],
  ].find(([, value]) => isProductionLike(value));

  if (productionEnv) {
    throw new Error(
      `[dev-seed:${seedName}] Refusing to run because ${productionEnv[0]}=${productionEnv[1]}. Dev seeds are blocked in production.`,
    );
  }

  if (!isTrue(process.env[DEV_SEED_FLAG])) {
    throw new Error(
      `[dev-seed:${seedName}] Refusing to run. Set ${DEV_SEED_FLAG}=true only for local or remote development databases.`,
    );
  }

  assertLocalSeedTarget(seedName);
}

export const DEV_SEED_TAG = 'DEV-SEED';
