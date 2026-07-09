/**
 * AI schema RLS proof (ai-integration-plan Step 6).
 *
 * Requires APP_RUNTIME_DATABASE_URL (real Postgres with the AI governance
 * migration applied); skips otherwise.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { DatabaseService, TenantDbService } from '../src/common';

const HAS_DB = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

d('AI schema RLS', () => {
  let app: INestApplication;
  let owner: DatabaseService['client'];
  let tenantDb: TenantDbService;
  const slugA = `ai-rls-a-${Date.now()}`;
  const slugB = `ai-rls-b-${Date.now()}`;
  let tenantAId = '';
  let tenantBId = '';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = app.get(DatabaseService).client;
    tenantDb = app.get(TenantDbService);

    const [tenantA, tenantB] = await Promise.all([
      owner.tenant.create({
        data: { name: 'AI RLS A', slug: slugA, status: 'active' },
      }),
      owner.tenant.create({
        data: { name: 'AI RLS B', slug: slugB, status: 'active' },
      }),
    ]);
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    await Promise.all([seedAiRows(tenantAId, 'A'), seedAiRows(tenantBId, 'B')]);
  }, 60000);

  afterAll(async () => {
    if (owner) {
      await owner.tenant.deleteMany({ where: { slug: { in: [slugA, slugB] } } });
    }
    if (app) await app.close();
  });

  async function seedAiRows(tenantId: string, suffix: string) {
    const session = await owner.chatSession.create({
      data: {
        tenantId,
        userTenantId: `profile-${suffix}`,
        type: 'analytics',
        title: `Session ${suffix}`,
      },
    });
    await owner.chatMessage.create({
      data: {
        tenantId,
        sessionId: session.id,
        sender: 'assistant',
        content: `Message ${suffix}`,
      },
    });
    await owner.aiSettings.create({
      data: {
        tenantId,
        monthlyTokenBudget: suffix === 'A' ? 111 : 222,
        concurrencyLimit: 2,
      },
    });
    await owner.aiUsageMonthly.create({
      data: {
        tenantId,
        month: '2026-07',
        feature: 'analytics',
        requestCount: 1,
        totalTokens: suffix === 'A' ? 11 : 22,
      },
    });
    await owner.aiConcurrencyLease.create({
      data: {
        tenantId,
        feature: 'analytics',
        profileId: `profile-${suffix}`,
        expiresAt: new Date('2026-07-09T10:05:00Z'),
      },
    });
  }

  it('shows only the scoped tenant rows across AI tables', async () => {
    const scoped = await tenantDb.runScoped(tenantAId, undefined, async () => {
      const [settings, usage, leases, sessions, messages] = await Promise.all([
        tenantDb.client.aiSettings.findMany({ orderBy: { tenantId: 'asc' } }),
        tenantDb.client.aiUsageMonthly.findMany({ orderBy: { tenantId: 'asc' } }),
        tenantDb.client.aiConcurrencyLease.findMany({
          orderBy: { tenantId: 'asc' },
        }),
        tenantDb.client.chatSession.findMany({ orderBy: { tenantId: 'asc' } }),
        tenantDb.client.chatMessage.findMany({ orderBy: { tenantId: 'asc' } }),
      ]);
      return { settings, usage, leases, sessions, messages };
    });

    expect(scoped.settings.map((row) => row.tenantId)).toEqual([tenantAId]);
    expect(scoped.usage.map((row) => row.tenantId)).toEqual([tenantAId]);
    expect(scoped.leases.map((row) => row.tenantId)).toEqual([tenantAId]);
    expect(scoped.sessions.map((row) => row.tenantId)).toEqual([tenantAId]);
    expect(scoped.messages.map((row) => row.tenantId)).toEqual([tenantAId]);
    expect(scoped.usage[0].totalTokens).toBe(11);
  });
});
