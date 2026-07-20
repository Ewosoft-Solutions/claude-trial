/**
 * AiUsageService unit tests — DB-backed tenant governance.
 */
import { AiUsageService } from './ai-usage.service';
import type { AiConfig } from '../config/ai.config';

const config: AiConfig = {
  ANTHROPIC_API_KEY: 'test-key',
  AI_MODEL: 'claude-opus-4-8',
  AI_MAX_TOKENS: 4096,
  AI_ENABLED: true,
  AI_TOOL_LOOP_MAX_ITERATIONS: 5,
  AI_HISTORY_MAX_MESSAGES: 20,
  AI_RATE_LIMIT_PER_MINUTE: 10,
  AI_DAILY_MESSAGE_CAP: 200,
  AI_MONTHLY_TOKEN_BUDGET: 1_000,
  AI_TENANT_CONCURRENCY_LIMIT: 2,
  AI_SPEND_ALERT_THRESHOLD_PERCENT: 80,
  AI_EMBEDDINGS_MODEL: 'voyage-3.5-lite',
  AI_EMBEDDINGS_DIMENSIONS: 1024,
};

interface SettingsRow {
  tenantId: string;
  modelTier: string;
  analyticsEnabled: boolean;
  tutorEnabled: boolean;
  monthlyTokenBudget: number;
  concurrencyLimit: number;
  alertThresholdPercent: number;
  byokProvider: string | null;
  keyLast4: string | null;
}

interface UsageRow {
  tenantId: string;
  month: string;
  feature: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  totalTokens: number;
  lastProvider: string | null;
  lastModel: string | null;
  lastUsedAt: Date | null;
  alertSentAt: Date | null;
}

interface LeaseRow {
  id: string;
  tenantId: string;
  feature: string;
  profileId: string;
  expiresAt: Date;
}

function buildTenantDb(seed?: {
  settings?: Partial<SettingsRow>;
  usage?: Partial<UsageRow>[];
  leases?: Partial<LeaseRow>[];
}) {
  let leaseSeq = 0;
  const settingsRows = new Map<string, SettingsRow>();
  if (seed?.settings) {
    settingsRows.set(seed.settings.tenantId ?? 'tenant-1', {
      tenantId: seed.settings.tenantId ?? 'tenant-1',
      modelTier: seed.settings.modelTier ?? 'standard',
      analyticsEnabled: seed.settings.analyticsEnabled ?? true,
      tutorEnabled: seed.settings.tutorEnabled ?? true,
      monthlyTokenBudget: seed.settings.monthlyTokenBudget ?? 1_000,
      concurrencyLimit: seed.settings.concurrencyLimit ?? 2,
      alertThresholdPercent: seed.settings.alertThresholdPercent ?? 80,
      byokProvider: seed.settings.byokProvider ?? null,
      keyLast4: seed.settings.keyLast4 ?? null,
    });
  }

  const usageRows: UsageRow[] =
    seed?.usage?.map((row) => ({
      tenantId: row.tenantId ?? 'tenant-1',
      month: row.month ?? '2026-07',
      feature: row.feature ?? 'analytics',
      requestCount: row.requestCount ?? 1,
      inputTokens: row.inputTokens ?? 0,
      outputTokens: row.outputTokens ?? 0,
      cacheReadInputTokens: row.cacheReadInputTokens ?? 0,
      cacheCreationInputTokens: row.cacheCreationInputTokens ?? 0,
      totalTokens: row.totalTokens ?? 0,
      lastProvider: row.lastProvider ?? 'test',
      lastModel: row.lastModel ?? 'test-model',
      lastUsedAt: row.lastUsedAt ?? new Date('2026-07-09T10:00:00Z'),
      alertSentAt: row.alertSentAt ?? null,
    })) ?? [];

  const leases: LeaseRow[] =
    seed?.leases?.map((lease, i) => ({
      id: lease.id ?? `lease-${i}`,
      tenantId: lease.tenantId ?? 'tenant-1',
      feature: lease.feature ?? 'analytics',
      profileId: lease.profileId ?? `profile-${i}`,
      expiresAt: lease.expiresAt ?? new Date('2026-07-09T10:05:00Z'),
    })) ?? [];

  const tenantDb = {
    rows: { settingsRows, usageRows, leases },
    runScoped: jest.fn(
      async (_tenantId: string, _userId: string | undefined, fn: () => unknown) =>
        fn(),
    ),
    client: {
      aiSettings: {
        findUnique: jest.fn(async ({ where }: { where: { tenantId: string } }) =>
          settingsRows.get(where.tenantId) ?? null,
        ),
        create: jest.fn(async ({ data }: { data: Partial<SettingsRow> }) => {
          const row: SettingsRow = {
            tenantId: data.tenantId!,
            modelTier: data.modelTier ?? 'standard',
            analyticsEnabled: data.analyticsEnabled ?? true,
            tutorEnabled: data.tutorEnabled ?? true,
            monthlyTokenBudget:
              data.monthlyTokenBudget ?? config.AI_MONTHLY_TOKEN_BUDGET,
            concurrencyLimit:
              data.concurrencyLimit ?? config.AI_TENANT_CONCURRENCY_LIMIT,
            alertThresholdPercent:
              data.alertThresholdPercent ??
              config.AI_SPEND_ALERT_THRESHOLD_PERCENT,
            byokProvider: data.byokProvider ?? null,
            keyLast4: data.keyLast4 ?? null,
          };
          settingsRows.set(row.tenantId, row);
          return row;
        }),
      },
      aiUsageMonthly: {
        findMany: jest.fn(
          async ({ where }: { where: { tenantId: string; month: string } }) =>
            usageRows.filter(
              (row) => row.tenantId === where.tenantId && row.month === where.month,
            ),
        ),
        upsert: jest.fn(async ({ where, create, update }: {
          where: { tenantId_month_feature: { tenantId: string; month: string; feature: string } };
          create: Partial<UsageRow> & Pick<UsageRow, 'tenantId' | 'month' | 'feature'>;
          update: Record<string, unknown>;
        }) => {
          const key = where.tenantId_month_feature;
          let row = usageRows.find(
            (candidate) =>
              candidate.tenantId === key.tenantId &&
              candidate.month === key.month &&
              candidate.feature === key.feature,
          );
          if (!row) {
            row = {
              requestCount: 0,
              inputTokens: 0,
              outputTokens: 0,
              cacheReadInputTokens: 0,
              cacheCreationInputTokens: 0,
              totalTokens: 0,
              lastProvider: null,
              lastModel: null,
              lastUsedAt: null,
              alertSentAt: null,
              ...create,
            };
            usageRows.push(row);
            return row;
          }
          increment(row, 'requestCount', update.requestCount);
          increment(row, 'inputTokens', update.inputTokens);
          increment(row, 'outputTokens', update.outputTokens);
          increment(row, 'cacheReadInputTokens', update.cacheReadInputTokens);
          increment(
            row,
            'cacheCreationInputTokens',
            update.cacheCreationInputTokens,
          );
          increment(row, 'totalTokens', update.totalTokens);
          row.lastProvider = update.lastProvider as string;
          row.lastModel = update.lastModel as string;
          row.lastUsedAt = update.lastUsedAt as Date;
          return row;
        }),
        update: jest.fn(async ({ where, data }: {
          where: { tenantId_month_feature: { tenantId: string; month: string; feature: string } };
          data: Partial<UsageRow>;
        }) => {
          const key = where.tenantId_month_feature;
          const row = usageRows.find(
            (candidate) =>
              candidate.tenantId === key.tenantId &&
              candidate.month === key.month &&
              candidate.feature === key.feature,
          );
          if (!row) throw new Error('usage row not found');
          Object.assign(row, data);
          return row;
        }),
      },
      aiConcurrencyLease: {
        deleteMany: jest.fn(async ({ where }: { where: { expiresAt?: { lte: Date }; id?: string; tenantId?: string } }) => {
          const before = leases.length;
          for (let i = leases.length - 1; i >= 0; i--) {
            const lease = leases[i];
            const expired = where.expiresAt ? lease.expiresAt <= where.expiresAt.lte : true;
            const idMatches = where.id ? lease.id === where.id : true;
            const tenantMatches = where.tenantId ? lease.tenantId === where.tenantId : true;
            if (expired && idMatches && tenantMatches) leases.splice(i, 1);
          }
          return { count: before - leases.length };
        }),
        count: jest.fn(async ({ where }: { where: { tenantId: string; expiresAt: { gt: Date } } }) =>
          leases.filter(
            (lease) =>
              lease.tenantId === where.tenantId &&
              lease.expiresAt > where.expiresAt.gt,
          ).length,
        ),
        create: jest.fn(async ({ data }: { data: Omit<LeaseRow, 'id'> }) => {
          const row = { id: `lease-new-${++leaseSeq}`, ...data };
          leases.push(row);
          return { id: row.id, tenantId: row.tenantId };
        }),
      },
    },
  };

  return tenantDb;
}

function increment(row: UsageRow, key: keyof UsageRow, value: unknown) {
  const amount =
    value &&
    typeof value === 'object' &&
    'increment' in value &&
    typeof value.increment === 'number'
      ? value.increment
      : 0;
  (row as unknown as Record<string, number>)[key as string] += amount;
}

describe('AiUsageService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-09T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates default settings and claims a concurrency lease', async () => {
    const tenantDb = buildTenantDb();
    const service = new AiUsageService(config, tenantDb as never);

    const admission = await service.startRequest({
      tenantId: 'tenant-1',
      userId: 'user-1',
      profileId: 'profile-1',
      feature: 'analytics',
    });

    expect(admission.allowed).toBe(true);
    expect(tenantDb.client.aiSettings.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          monthlyTokenBudget: 1_000,
          concurrencyLimit: 2,
        }),
      }),
    );
    expect(tenantDb.rows.leases).toHaveLength(1);
  });

  it('denies a request when the tenant monthly quota is exhausted', async () => {
    const tenantDb = buildTenantDb({
      settings: { monthlyTokenBudget: 100 },
      usage: [{ totalTokens: 100 }],
    });
    const service = new AiUsageService(config, tenantDb as never);

    const admission = await service.startRequest({
      tenantId: 'tenant-1',
      userId: 'user-1',
      profileId: 'profile-1',
      feature: 'analytics',
    });

    expect(admission).toMatchObject({
      allowed: false,
      code: 'AI_QUOTA_EXHAUSTED',
      details: {
        month: '2026-07',
        monthlyTokenBudget: 100,
        usedTokens: 100,
      },
    });
    expect(tenantDb.client.aiConcurrencyLease.create).not.toHaveBeenCalled();
  });

  it('cleans expired leases and denies when active tenant concurrency is still full', async () => {
    const tenantDb = buildTenantDb({
      settings: { concurrencyLimit: 1 },
      leases: [
        { id: 'expired', expiresAt: new Date('2026-07-09T09:59:00Z') },
        { id: 'active', expiresAt: new Date('2026-07-09T10:05:00Z') },
      ],
    });
    const service = new AiUsageService(config, tenantDb as never);

    const admission = await service.startRequest({
      tenantId: 'tenant-1',
      userId: 'user-1',
      profileId: 'profile-1',
      feature: 'tutor',
    });

    expect(tenantDb.rows.leases.map((lease) => lease.id)).toEqual(['active']);
    expect(admission).toMatchObject({
      allowed: false,
      code: 'AI_CONCURRENCY_LIMIT',
      details: { concurrencyLimit: 1, activeRequests: 1 },
    });
  });

  it('records usage into the monthly aggregate and marks the threshold alert once', async () => {
    const tenantDb = buildTenantDb({
      settings: { monthlyTokenBudget: 200, alertThresholdPercent: 50 },
    });
    const service = new AiUsageService(config, tenantDb as never);

    await service.recordUsage({
      tenantId: 'tenant-1',
      userId: 'user-1',
      feature: 'analytics',
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      usage: {
        inputTokens: 70,
        outputTokens: 20,
        cacheReadInputTokens: 10,
        cacheCreationInputTokens: 0,
      },
    });

    expect(tenantDb.rows.usageRows[0]).toMatchObject({
      month: '2026-07',
      feature: 'analytics',
      requestCount: 1,
      totalTokens: 100,
      lastProvider: 'anthropic',
      lastModel: 'claude-opus-4-8',
    });
    expect(tenantDb.rows.usageRows[0].alertSentAt).toEqual(
      new Date('2026-07-09T10:00:00Z'),
    );
  });

  it('builds the admin monthly usage summary', async () => {
    const tenantDb = buildTenantDb({
      settings: { monthlyTokenBudget: 1_000, concurrencyLimit: 4 },
      usage: [
        { feature: 'analytics', requestCount: 2, totalTokens: 300, inputTokens: 200 },
        { feature: 'tutor', requestCount: 1, totalTokens: 100, outputTokens: 80 },
      ],
      leases: [{ expiresAt: new Date('2026-07-09T10:05:00Z') }],
    });
    const service = new AiUsageService(config, tenantDb as never);

    const summary = await service.getTenantUsageSummary(
      'tenant-1',
      'user-1',
      '2026-07',
    );

    expect(summary).toMatchObject({
      month: '2026-07',
      settings: { monthlyTokenBudget: 1_000, concurrencyLimit: 4 },
      usage: {
        requestCount: 3,
        totalTokens: 400,
        remainingTokens: 600,
        percentUsed: 40,
      },
      concurrency: { activeRequests: 1, limit: 4 },
    });
    expect(summary.features.map((row) => row.feature)).toEqual([
      'analytics',
      'tutor',
    ]);
  });
});
