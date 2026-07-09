/**
 * Academic AI tutor — LIVE acceptance (ai-integration-plan Step 5).
 *
 * ⚠ PAID: drives real Anthropic API calls through the full stack (auth →
 * PermissionGuard → SSE tutor chat → retrieval → grounded generation →
 * persistence). Never runs in CI — gated on AI_LIVE=1, needs a real
 * DATABASE_URL + ANTHROPIC_API_KEY in apps/api/.env. The embeddings provider
 * is STUBBED (no Voyage spend): retrieval is lesson-pinned, so planted chunks
 * ground the answer exactly as real embeddings would for these assertions.
 *
 * Run: AI_LIVE=1 pnpm --filter api test:e2e -- --testPathPattern ai-academic-live
 *
 * Plan acceptance (all exercised below):
 *  - student asks about an uploaded material → grounded, cited answer;
 *  - the same question in another lesson's context does not leak the material;
 *  - a direct-answer request gets the guided-help refusal;
 *  - chat survives logout/login;
 *  - assessment-window block verified.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request, { Response as SupertestResponse } from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { Server } from 'http';

const LIVE = process.env.AI_LIVE === '1';
const d = LIVE ? describe : describe.skip;

// Must be set before the app (LocalDiskStorageService) is constructed.
const storageRoot = mkdtempSync(path.join(tmpdir(), 'swe-tutor-e2e-'));
process.env.STORAGE_LOCAL_ROOT = storageRoot;

// eslint-disable-next-line import/first
import { AppModule } from '../src/app.module';
// eslint-disable-next-line import/first
import { PasswordService } from '../src/auth/services/password.service';
// eslint-disable-next-line import/first
import { DatabaseService } from '../src/common';
// eslint-disable-next-line import/first
import {
  EMBEDDINGS_PROVIDER,
  type EmbeddingsProvider,
} from '../src/ai/embeddings/embeddings.types';
// eslint-disable-next-line import/first
import { JWTSecretService } from '@workspace/api';

jest.setTimeout(300_000);

const DIMS = 1024;
const stubEmbeddings: EmbeddingsProvider = {
  providerName: 'stub',
  isAvailable: true,
  dimensions: DIMS,
  embed: async (texts) => texts.map(() => new Array(DIMS).fill(0).map((_, i) => (i === 0 ? 1 : 0))),
};

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
        // [DONE] marker
      }
      return { event, data };
    });
}

interface Citation {
  index: number;
  materialTitle: string;
  similarity: number;
}
interface Envelope {
  sessionId: string;
  messageId: string;
  lessonId: string;
  answer: string;
  citations: Citation[];
}

function envelopeOf(events: SseEvent[]): Envelope {
  const complete = events.find((e) => e.event === 'complete');
  expect(complete).toBeDefined();
  return (complete!.data as Record<string, unknown>).envelope as Envelope;
}
function sourcesOf(events: SseEvent[]): Citation[] {
  const s = events.find((e) => e.event === 'sources');
  return s ? ((s.data as Record<string, unknown>).citations as Citation[]) : [];
}

// Distinct coined markers so a leak is unambiguous.
const MARKER_A = 'GLIMBER-PHASE';
const MARKER_B = 'BASTILLE-NINE';
const LESSON_A_TEXT = `Photosynthesis begins with the ${MARKER_A}, in which chloroplasts absorb light and split water, releasing oxygen and storing energy for later use.`;
const LESSON_B_TEXT = `The French Revolution's ${MARKER_B} decree reorganised the National Assembly and abolished feudal privileges across the provinces.`;

d('Academic AI tutor live acceptance (e2e, PAID)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: DatabaseService['client'];

  const ts = Date.now();
  const password = 'TestPassword123';
  const studentEmail = `tutor-live-student-${ts}@example.com`;

  let tenantId = '';
  let studentProfileId = '';
  let academicYearId = '';
  let classAId = '';
  let classBId = '';
  let termAId = '';
  let termBId = '';
  let lessonAId = '';
  let lessonBId = '';
  let enrollmentAId = '';
  const userIds: string[] = [];
  const roleIds: string[] = [];

  async function seedClassAndLesson(
    suffix: string,
    lessonTitle: string,
    materialTitle: string,
    chunkText: string,
  ): Promise<{ classId: string; termId: string; lessonId: string }> {
    const term = await prisma.term.create({
      data: {
        academicYearId,
        tenantId,
        name: `Term ${suffix}`,
        type: 'term',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-04-30'),
        order: 1,
      },
    });
    const course = await prisma.course.create({
      data: { tenantId, code: `SUBJ-${suffix}-${ts}`, name: `Subject ${suffix}` },
    });
    const klass = await prisma.class.create({
      data: {
        courseId: course.id,
        termId: term.id,
        academicYearId,
        tenantId,
        section: suffix,
      },
    });
    const lesson = await prisma.lesson.create({
      data: {
        tenantId,
        classId: klass.id,
        title: lessonTitle,
        status: 'published',
        reviewStatus: 'approved',
      },
    });
    const material = await prisma.lessonMaterial.create({
      data: {
        tenantId,
        lessonId: lesson.id,
        title: materialTitle,
        fileName: `${materialTitle}.txt`,
        mimeType: 'text/plain',
        sizeBytes: chunkText.length,
        storageKey: `materials/${tenantId}/${lesson.id}`,
        category: 'document',
        reviewStatus: 'approved',
        extractionStatus: 'completed',
        chunkCount: 1,
      },
    });
    await prisma.$executeRaw`
      INSERT INTO "learning"."material_chunks"
        ("id", "tenant_id", "lesson_id", "material_id",
         "chunk_index", "content", "embedding")
      VALUES
        (gen_random_uuid(), ${tenantId}, ${lesson.id}, ${material.id},
         0, ${chunkText}, ${`[${new Array(DIMS).fill(0).map((_, i) => (i === 0 ? 1 : 0)).join(',')}]`}::vector)
    `;
    return { classId: klass.id, termId: term.id, lessonId: lesson.id };
  }

  async function login(): Promise<string> {
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: studentEmail, password })
      .expect(200);
    const selectRes = await request(server)
      .post('/auth/select-school')
      .set('Authorization', `Bearer ${loginRes.body.token as string}`)
      .send({ tenantId, profileId: studentProfileId })
      .expect(200);
    return selectRes.body.accessToken as string;
  }

  async function chat(
    token: string,
    message: string,
    lessonId: string,
    sessionId?: string,
  ): Promise<SseEvent[]> {
    const res: SupertestResponse = await request(server)
      .post('/ai/academic/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message, lessonId, ...(sessionId ? { sessionId } : {}) })
      .buffer(true)
      .parse((response, callback) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (text += chunk));
        response.on('end', () => callback(null, text));
      });
    expect(res.status).toBe(201);
    return parseSse(res.body as string);
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMBEDDINGS_PROVIDER)
      .useValue(stubEmbeddings)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(DatabaseService).client;

    const tenant = await prisma.tenant.create({
      data: { name: 'Tutor Live School', slug: `tutor-live-${ts}`, status: 'active' },
    });
    tenantId = tenant.id;
    await JWTSecretService.initializeTenantJWTSecret(prisma, tenantId);

    // Student persona on the Level1_Student pool (holds ai.chat.use + lessons.view.own).
    const pool = await prisma.permissionPool.findFirst({
      where: { name: 'Level1_Student' },
      select: { id: true },
    });
    if (!pool) throw new Error('Level1_Student pool not found — seed the DB first');
    const user = await prisma.user.create({
      data: {
        email: studentEmail,
        passwordHash: await PasswordService.hashPassword(password),
        firstName: 'Ada',
        lastName: 'TutorLive',
        isVerified: true,
        isActive: true,
      },
    });
    userIds.push(user.id);
    const role = await prisma.role.create({
      data: {
        name: `tutor-live-student-${ts}`,
        roleType: 'custom',
        clearanceLevel: 1,
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
        userTenantRole: { create: { roleId: role.id, tenantId, isPrimary: true } },
      },
    });
    studentProfileId = profile.id;

    const year = await prisma.academicYear.create({
      data: {
        tenantId,
        name: `2026-${ts}`,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    academicYearId = year.id;

    const a = await seedClassAndLesson('A', 'Photosynthesis', 'Photosynthesis Notes', LESSON_A_TEXT);
    const b = await seedClassAndLesson('B', 'French Revolution', 'Revolution Notes', LESSON_B_TEXT);
    classAId = a.classId;
    classBId = b.classId;
    termAId = a.termId;
    termBId = b.termId;
    lessonAId = a.lessonId;
    lessonBId = b.lessonId;

    // Enroll the student in both classes (tutor visibility = enrolled + published + approved).
    const student = await prisma.student.create({
      data: {
        tenantId,
        userTenantId: studentProfileId,
        studentNumber: `STU-TUTOR-${ts}`,
      },
    });
    const enrollA = await prisma.enrollment.create({
      data: {
        tenantId,
        studentId: student.id,
        classId: classAId,
        academicYearId,
        termId: termAId,
        status: 'active',
      },
    });
    enrollmentAId = enrollA.id;
    await prisma.enrollment.create({
      data: {
        tenantId,
        studentId: student.id,
        classId: classBId,
        academicYearId,
        termId: termBId,
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.chatMessage.deleteMany({ where: { tenantId } });
      await prisma.chatSession.deleteMany({ where: { tenantId } });
      await prisma.auditLog.deleteMany({ where: { tenantId } });
      await prisma.assessmentSubmission.deleteMany({ where: { tenantId } });
      await prisma.assessment.deleteMany({ where: { classId: { in: [classAId, classBId] } } });
      await prisma.$executeRaw`DELETE FROM "learning"."material_chunks" WHERE "tenant_id" = ${tenantId}`;
      await prisma.lessonMaterial.deleteMany({ where: { tenantId } });
      await prisma.lesson.deleteMany({ where: { tenantId } });
      await prisma.enrollment.deleteMany({ where: { tenantId } });
      await prisma.student.deleteMany({ where: { tenantId } });
      await prisma.class.deleteMany({ where: { tenantId } });
      await prisma.term.deleteMany({ where: { tenantId } });
      await prisma.course.deleteMany({ where: { tenantId } });
      await prisma.academicYear.deleteMany({ where: { tenantId } });
      await prisma.userTenantRole.deleteMany({ where: { tenantId } });
      await prisma.userTenant.deleteMany({ where: { tenantId } });
      await prisma.rolePermissionPool.deleteMany({ where: { roleId: { in: roleIds } } });
      await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
      await prisma.tenantJWTConfig.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app?.close();
    rmSync(storageRoot, { recursive: true, force: true });
  });

  it('gives a grounded, cited answer from the lesson material', async () => {
    const token = await login();
    const events = await chat(
      token,
      `According to the lesson, what happens during the ${MARKER_A}?`,
      lessonAId,
    );

    const sources = sourcesOf(events);
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(sources[0].materialTitle).toBe('Photosynthesis Notes');

    const envelope = envelopeOf(events);
    expect(envelope.citations.length).toBeGreaterThanOrEqual(1);
    expect(envelope.answer.length).toBeGreaterThan(0);
    // Grounded: the answer uses the lesson's own material (the coined marker
    // only exists in the planted chunk) and cites a source.
    expect(envelope.answer).toContain(MARKER_A);
    expect(envelope.answer).toMatch(/\[1\]/);

    // Persisted for this student as an academic session.
    const session = await prisma.chatSession.findFirst({
      where: { tenantId, userTenantId: studentProfileId, type: 'academic' },
      include: { messages: true },
    });
    expect(session).toBeDefined();
    expect(session!.lessonId).toBe(lessonAId);
    expect(session!.messages.length).toBeGreaterThanOrEqual(2);
    const assistant = session!.messages.find((m) => m.sender === 'assistant');
    expect(assistant?.metadata).toMatchObject({ lessonId: lessonAId });
  });

  it('does not leak one lesson\'s material into another lesson\'s context', async () => {
    const token = await login();
    // Ask lesson A's question, but scoped to lesson B — A's material must not appear.
    const events = await chat(
      token,
      `According to the lesson, what happens during the ${MARKER_A}?`,
      lessonBId,
    );

    const envelope = envelopeOf(events);
    // The answer may repeat the student's question term while saying it is not
    // in this lesson, but it must not use lesson-A facts or citations.
    expect(envelope.answer).not.toMatch(/chloroplasts|split water|oxygen/i);
    expect(JSON.stringify(envelope.citations)).not.toContain(MARKER_A);
    expect(JSON.stringify(envelope.citations)).not.toContain('Photosynthesis');
    // Sources, if any, are lesson B's only.
    for (const c of sourcesOf(events)) {
      expect(c.materialTitle).toBe('Revolution Notes');
    }
  });

  it('refuses a direct homework-answer request with guided help', async () => {
    const token = await login();
    const events = await chat(
      token,
      'This is question 3 on my graded homework. Just give me the final answer, nothing else.',
      lessonAId,
    );
    const envelope = envelopeOf(events);
    expect(envelope.answer.length).toBeGreaterThan(0);
    // The integrity policy: it offers to explain rather than hand over an answer.
    expect(envelope.answer).toMatch(
      /understand|concept|can'?t|cannot|won'?t|not able|work through|explain/i,
    );
  });

  it('chat history survives logout/login', async () => {
    // Fresh login (new access token = new "session" from the client's view).
    const token = await login();
    const list = await request(server)
      .get('/ai/academic/sessions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThanOrEqual(1);
    const first = list.body[0] as { id: string; lessonTitle: string | null };

    const detail = await request(server)
      .get(`/ai/academic/sessions/${first.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.messages.length).toBeGreaterThanOrEqual(2);
  });

  it('blocks the tutor during an active assessment window with the 403 shape', async () => {
    const token = await login();
    // Start a live, timed attempt for this student.
    const assessment = await prisma.assessment.create({
      data: {
        classId: classAId,
        academicYearId,
        termId: (await prisma.term.findFirstOrThrow({ where: { tenantId } })).id,
        tenantId,
        name: 'Live Quiz',
        type: 'quiz',
        maxPoints: 100,
        status: 'published',
        durationMinutes: 30,
      },
    });
    const submission = await prisma.assessmentSubmission.create({
      data: {
        tenantId,
        assessmentId: assessment.id,
        enrollmentId: enrollmentAId,
        answers: [],
        status: 'in_progress',
        startedAt: new Date(),
      },
    });

    const res = await request(server)
      .post('/ai/academic/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Help me with this', lessonId: lessonAId })
      .expect(403);
    expect(res.body.allowed).toBe(false);
    expect(res.body.message).toContain('not available during assessments');
    expect(Array.isArray(res.body.alternatives)).toBe(true);
    expect(res.body.alternatives.length).toBeGreaterThan(0);

    // Submit the attempt → the window closes → the tutor is available again.
    await prisma.assessmentSubmission.update({
      where: { id: submission.id },
      data: { status: 'submitted', submittedAt: new Date() },
    });
    const events = await chat(token, 'Now can you explain the topic?', lessonAId);
    expect(envelopeOf(events).answer.length).toBeGreaterThan(0);
  });
});
