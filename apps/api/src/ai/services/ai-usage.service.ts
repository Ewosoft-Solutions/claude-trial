/**
 * DB-backed AI governance (Step 6).
 *
 * Owns tenant-level feature toggles, monthly token budgets, concurrency
 * leases, usage roll-ups, and the admin usage summary. Every method opens a
 * short RLS scope; no scope spans an LLM/embedding round-trip.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@workspace/database';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { aiConfig } from '../config/ai.config';
import type { AiConfig } from '../config/ai.config';
import type { LlmUsage } from '../llm/llm.types';

const LEASE_TTL_MS = 5 * 60 * 1000;

export type AiGovernedFeature = 'analytics' | 'tutor';

export type AiUsageDenialCode =
  | 'AI_FEATURE_DISABLED'
  | 'AI_QUOTA_EXHAUSTED'
  | 'AI_CONCURRENCY_LIMIT';

export interface AiUsageDenial {
  allowed: false;
  code: AiUsageDenialCode;
  message: string;
  retryAfterSeconds?: number;
  details?: {
    month?: string;
    monthlyTokenBudget?: number;
    usedTokens?: number;
    remainingTokens?: number;
    concurrencyLimit?: number;
    activeRequests?: number;
  };
}

export interface AiUsageLease {
  id: string;
  tenantId: string;
}

export type AiUsageAdmission =
  | { allowed: true; lease: AiUsageLease }
  | AiUsageDenial;

export interface RecordAiUsageParams {
  tenantId: string;
  userId: string;
  feature: AiGovernedFeature;
  provider: string;
  model: string;
  usage: LlmUsage;
}

export interface AiUsageSummary {
  month: string;
  settings: {
    modelTier: string;
    analyticsEnabled: boolean;
    tutorEnabled: boolean;
    monthlyTokenBudget: number;
    concurrencyLimit: number;
    alertThresholdPercent: number;
    byokProvider: string | null;
    keyLast4: string | null;
  };
  usage: {
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    totalTokens: number;
    remainingTokens: number;
    percentUsed: number;
    alertSentAt: Date | null;
  };
  concurrency: {
    activeRequests: number;
    limit: number;
  };
  features: Array<{
    feature: AiGovernedFeature;
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    totalTokens: number;
    percentOfTotal: number;
    lastProvider: string | null;
    lastModel: string | null;
    lastUsedAt: Date | null;
    alertSentAt: Date | null;
  }>;
}

interface SettingsRow {
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

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    @Inject(aiConfig.KEY) private readonly config: AiConfig,
    private readonly tenantDb: TenantDbService,
  ) {}

  async startRequest(params: {
    tenantId: string;
    userId: string;
    profileId: string;
    feature: AiGovernedFeature;
  }): Promise<AiUsageAdmission> {
    const month = monthKey();
    const now = new Date();

    return this.tenantDb.runScoped(params.tenantId, params.userId, async () => {
      const settings = await this.ensureSettings(params.tenantId);
      if (!this.featureEnabled(settings, params.feature)) {
        return {
          allowed: false,
          code: 'AI_FEATURE_DISABLED',
          message: 'This AI feature is disabled for your school.',
        };
      }

      const rows = await this.usageRows(params.tenantId, month);
      const usedTokens = rows.reduce((sum, row) => sum + row.totalTokens, 0);
      if (usedTokens >= settings.monthlyTokenBudget) {
        return {
          allowed: false,
          code: 'AI_QUOTA_EXHAUSTED',
          message:
            'This school has exhausted its monthly AI token quota. Ask an administrator to review AI usage settings.',
          retryAfterSeconds: secondsUntilNextUtcMonth(now),
          details: {
            month,
            monthlyTokenBudget: settings.monthlyTokenBudget,
            usedTokens,
            remainingTokens: 0,
          },
        };
      }

      await this.cleanupExpiredLeases(now);
      const activeRequests = await this.tenantDb.client.aiConcurrencyLease.count({
        where: {
          tenantId: params.tenantId,
          expiresAt: { gt: now },
        },
      });
      if (activeRequests >= settings.concurrencyLimit) {
        return {
          allowed: false,
          code: 'AI_CONCURRENCY_LIMIT',
          message:
            'Your school has too many AI requests running right now. Please retry shortly.',
          retryAfterSeconds: 30,
          details: {
            concurrencyLimit: settings.concurrencyLimit,
            activeRequests,
          },
        };
      }

      const lease = await this.tenantDb.client.aiConcurrencyLease.create({
        data: {
          tenantId: params.tenantId,
          feature: params.feature,
          profileId: params.profileId,
          expiresAt: new Date(now.getTime() + LEASE_TTL_MS),
        },
        select: { id: true, tenantId: true },
      });
      return { allowed: true, lease };
    });
  }

  async finishRequest(lease: AiUsageLease | null): Promise<void> {
    if (!lease) return;
    try {
      await this.tenantDb.runScoped(lease.tenantId, undefined, () =>
        this.tenantDb.client.aiConcurrencyLease.deleteMany({
          where: { id: lease.id, tenantId: lease.tenantId },
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Could not release AI concurrency lease ${lease.id}: ${(error as Error).message}`,
      );
    }
  }

  async recordUsage(params: RecordAiUsageParams): Promise<void> {
    const totalTokens = totalUsageTokens(params.usage);
    if (totalTokens <= 0) return;

    const month = monthKey();
    const now = new Date();

    await this.tenantDb.runScoped(params.tenantId, params.userId, async () => {
      await this.tenantDb.client.aiUsageMonthly.upsert({
        where: {
          tenantId_month_feature: {
            tenantId: params.tenantId,
            month,
            feature: params.feature,
          },
        },
        create: {
          tenantId: params.tenantId,
          month,
          feature: params.feature,
          requestCount: 1,
          inputTokens: params.usage.inputTokens,
          outputTokens: params.usage.outputTokens,
          cacheReadInputTokens: params.usage.cacheReadInputTokens,
          cacheCreationInputTokens: params.usage.cacheCreationInputTokens,
          totalTokens,
          lastProvider: params.provider,
          lastModel: params.model,
          lastUsedAt: now,
        },
        update: {
          requestCount: { increment: 1 },
          inputTokens: { increment: params.usage.inputTokens },
          outputTokens: { increment: params.usage.outputTokens },
          cacheReadInputTokens: {
            increment: params.usage.cacheReadInputTokens,
          },
          cacheCreationInputTokens: {
            increment: params.usage.cacheCreationInputTokens,
          },
          totalTokens: { increment: totalTokens },
          lastProvider: params.provider,
          lastModel: params.model,
          lastUsedAt: now,
          updatedAt: now,
        },
        select: {
          feature: true,
          totalTokens: true,
          alertSentAt: true,
        },
      });

      const settings = await this.ensureSettings(params.tenantId);
      const rows = await this.usageRows(params.tenantId, month);
      const tenantTotalTokens = rows.reduce(
        (sum, usageRow) => sum + usageRow.totalTokens,
        0,
      );
      const alreadyAlerted = rows.some((usageRow) => usageRow.alertSentAt);
      const thresholdTokens = Math.ceil(
        settings.monthlyTokenBudget *
          (settings.alertThresholdPercent / 100),
      );
      if (!alreadyAlerted && tenantTotalTokens >= thresholdTokens) {
        await this.tenantDb.client.aiUsageMonthly.update({
          where: {
            tenantId_month_feature: {
              tenantId: params.tenantId,
              month,
              feature: params.feature,
            },
          },
          data: { alertSentAt: now },
        });
        this.logger.warn(
          `AI usage alert: tenant ${params.tenantId} reached ${tenantTotalTokens}/${settings.monthlyTokenBudget} tokens for ${month}.`,
        );
      }
    });
  }

  async getTenantUsageSummary(
    tenantId: string,
    userId: string,
    requestedMonth?: string,
  ): Promise<AiUsageSummary> {
    const month = requestedMonth ?? monthKey();
    const now = new Date();

    return this.tenantDb.runScoped(tenantId, userId, async () => {
      await this.cleanupExpiredLeases(now);
      const settings = await this.ensureSettings(tenantId);
      const rows = await this.usageRows(tenantId, month);
      const activeRequests = await this.tenantDb.client.aiConcurrencyLease.count({
          where: { tenantId, expiresAt: { gt: now } },
      });

      return buildSummary(month, settings, rows, activeRequests);
    });
  }

  private async ensureSettings(tenantId: string): Promise<SettingsRow> {
    const existing = await this.tenantDb.client.aiSettings.findUnique({
      where: { tenantId },
      select: {
        modelTier: true,
        analyticsEnabled: true,
        tutorEnabled: true,
        monthlyTokenBudget: true,
        concurrencyLimit: true,
        alertThresholdPercent: true,
        byokProvider: true,
        keyLast4: true,
      },
    });
    if (existing) return existing;

    try {
      return await this.tenantDb.client.aiSettings.create({
        data: {
          tenantId,
          monthlyTokenBudget: this.config.AI_MONTHLY_TOKEN_BUDGET,
          concurrencyLimit: this.config.AI_TENANT_CONCURRENCY_LIMIT,
          alertThresholdPercent: this.config.AI_SPEND_ALERT_THRESHOLD_PERCENT,
        },
        select: {
          modelTier: true,
          analyticsEnabled: true,
          tutorEnabled: true,
          monthlyTokenBudget: true,
          concurrencyLimit: true,
          alertThresholdPercent: true,
          byokProvider: true,
          keyLast4: true,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const raced = await this.tenantDb.client.aiSettings.findUnique({
          where: { tenantId },
          select: {
            modelTier: true,
            analyticsEnabled: true,
            tutorEnabled: true,
            monthlyTokenBudget: true,
            concurrencyLimit: true,
            alertThresholdPercent: true,
            byokProvider: true,
            keyLast4: true,
          },
        });
        if (raced) return raced;
      }
      throw error;
    }
  }

  private usageRows(tenantId: string, month: string): Promise<UsageRow[]> {
    return this.tenantDb.client.aiUsageMonthly.findMany({
      where: { tenantId, month },
      select: {
        feature: true,
        requestCount: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadInputTokens: true,
        cacheCreationInputTokens: true,
        totalTokens: true,
        lastProvider: true,
        lastModel: true,
        lastUsedAt: true,
        alertSentAt: true,
      },
      orderBy: { feature: 'asc' },
    });
  }

  private cleanupExpiredLeases(now: Date): Promise<{ count: number }> {
    return this.tenantDb.client.aiConcurrencyLease.deleteMany({
      where: { expiresAt: { lte: now } },
    });
  }

  private featureEnabled(
    settings: SettingsRow,
    feature: AiGovernedFeature,
  ): boolean {
    return feature === 'analytics'
      ? settings.analyticsEnabled
      : settings.tutorEnabled;
  }
}

function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

function secondsUntilNextUtcMonth(now: Date): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

function totalUsageTokens(usage: LlmUsage): number {
  return (
    usage.inputTokens +
    usage.outputTokens +
    usage.cacheReadInputTokens +
    usage.cacheCreationInputTokens
  );
}

function buildSummary(
  month: string,
  settings: SettingsRow,
  rows: UsageRow[],
  activeRequests: number,
): AiUsageSummary {
  const totals = rows.reduce(
    (acc, row) => {
      acc.requestCount += row.requestCount;
      acc.inputTokens += row.inputTokens;
      acc.outputTokens += row.outputTokens;
      acc.cacheReadInputTokens += row.cacheReadInputTokens;
      acc.cacheCreationInputTokens += row.cacheCreationInputTokens;
      acc.totalTokens += row.totalTokens;
      if (row.alertSentAt && (!acc.alertSentAt || row.alertSentAt < acc.alertSentAt)) {
        acc.alertSentAt = row.alertSentAt;
      }
      return acc;
    },
    {
      requestCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      totalTokens: 0,
      alertSentAt: null as Date | null,
    },
  );

  const budget = Math.max(1, settings.monthlyTokenBudget);
  const percentUsed = Math.min(100, Math.round((totals.totalTokens / budget) * 100));

  return {
    month,
    settings,
    usage: {
      ...totals,
      remainingTokens: Math.max(0, settings.monthlyTokenBudget - totals.totalTokens),
      percentUsed,
    },
    concurrency: {
      activeRequests,
      limit: settings.concurrencyLimit,
    },
    features: rows.map((row) => ({
      feature: row.feature === 'tutor' ? 'tutor' : 'analytics',
      requestCount: row.requestCount,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cacheReadInputTokens: row.cacheReadInputTokens,
      cacheCreationInputTokens: row.cacheCreationInputTokens,
      totalTokens: row.totalTokens,
      percentOfTotal:
        totals.totalTokens > 0
          ? Math.round((row.totalTokens / totals.totalTokens) * 100)
          : 0,
      lastProvider: row.lastProvider,
      lastModel: row.lastModel,
      lastUsedAt: row.lastUsedAt,
      alertSentAt: row.alertSentAt,
    })),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
