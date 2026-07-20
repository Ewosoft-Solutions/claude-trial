/**
 * Analytics AI — LIVE acceptance (ai-integration-plan Step 2).
 *
 * ⚠ PAID: drives real Anthropic API calls through the full stack (auth →
 * PermissionGuard → SSE chat → tool loop → mediator → persistence). Never
 * runs in CI — gated on AI_LIVE=1, and needs a real DATABASE_URL plus
 * ANTHROPIC_API_KEY in apps/api/.env (loaded by ConfigModule).
 *
 * Run:  AI_LIVE=1 pnpm --filter api test:e2e -- --testPathPattern ai-analytics-live
 *
 * Personas (plan acceptance): owner gets school-wide numbers; parent gets
 * only their own child's data; student asking for financial reports is
 * refused with the insufficient-clearance shape; every exchange rows up in
 * ChatMessage and the audit log.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request, { Response as SupertestResponse } from 'supertest';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  jest,
} from '@jest/globals';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/services/password.service';
import { DatabaseService } from '../src/common';
import { JWTSecretService } from '@workspace/api';

const LIVE = process.env.AI_LIVE === '1';
const d = LIVE ? describe : describe.skip;

jest.setTimeout(300_000);

interface SseEvent {
  event: string;
  data: Record<string, unknown> | string;
}

function parseSse(raw: string): SseEvent[] {
  return raw
    .split('\n\n')
    .filter((frame) => frame.trim().length > 0)
    .map((frame) => {
      const lines = frame.split('\n');
      const event =
        lines.find((l) => l.startsWith('event: '))?.slice(7) ?? 'message';
      const dataLine = lines.find((l) => l.startsWith('data: '))?.slice(6) ?? '';
      let data: SseEvent['data'] = dataLine;
      try {
        data = JSON.parse(dataLine) as Record<string, unknown>;
      } catch {
        // [DONE] marker etc. — keep as string
      }
      return { event, data };
    });
}

interface Envelope {
  sessionId: string;
  messageId: string;
  data: Array<{
    tool: string;
    allowed: boolean;
    result?: unknown;
    error?: string;
  }>;
  visualization: unknown;
  insights: string;
  usage: { inputTokens: number; outputTokens: number; iterations: number };
}

function completeEnvelope(events: SseEvent[]): Envelope {
  const complete = events.find((e) => e.event === 'complete');
  expect(complete).toBeDefined();
  const data = complete!.data as Record<string, unknown>;
  return data.envelope as Envelope;
}

d('Analytics AI live acceptance (e2e, PAID)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: DatabaseService['client'];

  const ts = Date.now();
  const password = 'TestPassword123';
  const emails = {
    owner: `ai-live-owner-${ts}@example.com`,
    parent: `ai-live-parent-${ts}@example.com`,
    student: `ai-live-student-${ts}@example.com`,
    child: `ai-live-child-${ts}@example.com`,
    otherChild: `ai-live-other-${ts}@example.com`,
  };

  let tenantId = '';
  const userIds: string[] = [];
  const roleIds: string[] = [];
  const profileIds: Record<string, string> = {};

  async function makePersona(
    key: 'owner' | 'parent' | 'student',
    firstName: string,
    clearanceLevel: number,
    poolName: string,
  ) {
    const pool = await prisma.permissionPool.findFirst({
      where: { name: poolName },
      select: { id: true },
    });
    if (!pool) {
      throw new Error(`Seeded pool ${poolName} not found — run the DB seed first`);
    }

    const passwordHash = await PasswordService.hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: emails[key],
        passwordHash,
        firstName,
        lastName: 'AiLive',
        isVerified: true,
        isActive: true,
      },
    });
    userIds.push(user.id);

    const role = await prisma.role.create({
      data: {
        name: `ai-live-${key}-${ts}`,
        roleType: 'custom',
        clearanceLevel,
        tenantId,
        isActive: true,
      },
    });
    roleIds.push(role.id);
    await prisma.rolePermissionPool.create({
      data: { roleId: role.id, poolId: pool.id },
    });

    const profile = await prisma.userTenant.create({
      data: {
        userId: user.id,
        tenantId,
        status: 'active',
        suspended: false,
        userTenantRole: {
          create: { roleId: role.id, tenantId, isPrimary: true },
        },
      },
    });
    profileIds[key] = profile.id;
    return profile.id;
  }

  /** Profile + student row for a child (no login needed). */
  async function makeChild(email: string, firstName: string, studentNumber: string) {
    const passwordHash = await PasswordService.hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName: 'AiLive',
        isVerified: true,
        isActive: true,
      },
    });
    userIds.push(user.id);
    const profile = await prisma.userTenant.create({
      data: { userId: user.id, tenantId, status: 'active', suspended: false },
    });
    return prisma.student.create({
      data: {
        tenantId,
        userTenantId: profile.id,
        studentNumber,
        gradeLevel: '4',
        enrollmentStatus: 'active',
      },
    });
  }

  async function login(key: 'owner' | 'parent' | 'student'): Promise<string> {
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: emails[key], password })
      .expect(200);
    const selectRes = await request(server)
      .post('/auth/select-school')
      .set('Authorization', `Bearer ${loginRes.body.token as string}`)
      .send({ tenantId, profileId: profileIds[key] })
      .expect(200);
    return selectRes.body.accessToken as string;
  }

  async function chat(token: string, message: string): Promise<SseEvent[]> {
    const res: SupertestResponse = await request(server)
      .post('/ai/analytics/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message })
      .buffer(true)
      .parse((response, callback) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (text += chunk));
        response.on('end', () => callback(null, text));
      });
    expect(res.status).toBe(201); // POST default status; SSE body streamed
    return parseSse(res.body as string);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(DatabaseService).client;

    const tenant = await prisma.tenant.create({
      data: { name: 'AI Live School', slug: `ai-live-${ts}`, status: 'active' },
    });
    tenantId = tenant.id;
    await JWTSecretService.initializeTenantJWTSecret(prisma, tenantId);

    await makePersona('owner', 'Olivia', 8, 'Level8_SchoolOwner');
    await makePersona('parent', 'Patrick', 2, 'Level2_Parent');
    await makePersona('student', 'Sam', 1, 'Level1_Student');

    // Parent's child + an unrelated child (must never leak to the parent)
    const child = await makeChild(emails.child, 'Chidera', `STU-AI-${ts}-1`);
    await makeChild(emails.otherChild, 'Zanther', `STU-AI-${ts}-2`);
    await prisma.studentGuardian.create({
      data: {
        tenantId,
        studentId: child.id,
        userTenantId: profileIds.parent,
        relationship: 'parent',
        isPrimary: true,
      },
    });
    await prisma.feeInvoice.create({
      data: {
        tenantId,
        studentId: child.id,
        invoiceNumber: `INV-AI-${ts}`,
        amountDue: 500_000,
        amountPaid: 200_000,
        status: 'issued',
      },
    });
  });

  afterAll(async () => {
    // FK order: chat/audit + domain rows → profiles → users/roles → tenant
    if (tenantId) {
      await prisma.chatMessage.deleteMany({ where: { tenantId } });
      await prisma.chatSession.deleteMany({ where: { tenantId } });
      await prisma.auditLog.deleteMany({ where: { tenantId } });
      await prisma.feeInvoice.deleteMany({ where: { tenantId } });
      await prisma.studentGuardian.deleteMany({ where: { tenantId } });
      await prisma.student.deleteMany({ where: { tenantId } });
      await prisma.userTenantRole.deleteMany({ where: { tenantId } });
      await prisma.userTenant.deleteMany({ where: { tenantId } });
      await prisma.rolePermissionPool.deleteMany({
        where: { roleId: { in: roleIds } },
      });
      await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
      await prisma.tenantJWTConfig.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app?.close();
  });

  it('proves the live Anthropic round-trip via GET /ai/health (owner)', async () => {
    const token = await login('owner');
    const res = await request(server)
      .get('/ai/health')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.enabled).toBe(true);
    expect(res.body.available).toBe(true);
    expect(res.body.roundTrip).toMatchObject({ ok: true });
  });

  it('owner gets school-wide enrollment numbers', async () => {
    const token = await login('owner');
    const events = await chat(
      token,
      'How many students are currently enrolled at our school?',
    );

    const envelope = completeEnvelope(events);
    const enrollment = envelope.data.find(
      (t) => t.tool === 'get_enrollment_stats' && t.allowed,
    );
    expect(enrollment).toBeDefined();
    const result = enrollment!.result as {
      totals: { students: number };
    };
    expect(result.totals.students).toBe(2);
    expect(envelope.insights.length).toBeGreaterThan(0);
    expect(envelope.usage.iterations).toBeGreaterThanOrEqual(2);

    // Both sides persisted + audited
    const session = await prisma.chatSession.findFirst({
      where: { tenantId, userTenantId: profileIds.owner, type: 'analytics' },
      include: { messages: true },
    });
    expect(session).toBeDefined();
    expect(session!.messages.length).toBeGreaterThanOrEqual(2);
    const assistantMessage = session!.messages.find(
      (m) => m.sender === 'assistant',
    );
    expect(assistantMessage?.metadata).toMatchObject({
      provider: 'anthropic',
    });
    const auditRows = await prisma.auditLog.count({
      where: { tenantId, resource: 'ai_mediator' },
    });
    expect(auditRows).toBeGreaterThan(0);
  });

  it("parent gets only their own child's data", async () => {
    const token = await login('parent');
    const events = await chat(
      token,
      'How are my children doing in school? Give me an overview.',
    );

    const envelope = completeEnvelope(events);
    const overview = envelope.data.find(
      (t) => t.tool === 'get_student_overview' && t.allowed,
    );
    expect(overview).toBeDefined();
    const children = overview!.result as Array<{ firstName: string }>;
    expect(children).toHaveLength(1);
    expect(children[0].firstName).toBe('Chidera');

    // The other family's child never appears anywhere in the reply
    expect(envelope.insights).not.toContain('Zanther');
    expect(JSON.stringify(envelope.data)).not.toContain('Zanther');
  });

  it('student asking for financial reports is refused with the clearance error', async () => {
    const token = await login('student');
    const events = await chat(
      token,
      'Show me the school financial summary: total fees billed and outstanding.',
    );

    const envelope = completeEnvelope(events);

    // Never a successful finance read at clearance 1…
    const financeSuccess = envelope.data.find(
      (t) => t.tool === 'get_finance_summary' && t.allowed,
    );
    expect(financeSuccess).toBeUndefined();

    // …and when the model tried the tool, it was denied with the
    // requirements' insufficient-clearance shape.
    const financeDenied = envelope.data.find(
      (t) => t.tool === 'get_finance_summary' && !t.allowed,
    );
    if (financeDenied) {
      expect(financeDenied.error).toContain('Insufficient clearance');
    }
    // Either way the user gets a refusal, not numbers.
    expect(envelope.insights.length).toBeGreaterThan(0);
    expect(envelope.insights).not.toContain('₦3,000'); // real billed total never leaks

    // The denial (or the exchange) is audit-logged for this tenant
    const auditRows = await prisma.auditLog.count({
      where: { tenantId, resource: 'ai_mediator' },
    });
    expect(auditRows).toBeGreaterThan(0);
  });
});
