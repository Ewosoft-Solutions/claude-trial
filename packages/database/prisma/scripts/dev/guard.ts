const DEV_SEED_FLAG = 'ENABLE_DEV_SEEDS';
const TRUE_VALUES = new Set(['1', 'true', 'yes']);
const PRODUCTION_VALUES = new Set(['prod', 'production']);

function isTrue(value: string | undefined): boolean {
  return TRUE_VALUES.has((value ?? '').trim().toLowerCase());
}

function isProductionLike(value: string | undefined): boolean {
  return PRODUCTION_VALUES.has((value ?? '').trim().toLowerCase());
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
}

export const DEV_SEED_TAG = 'DEV-SEED';
