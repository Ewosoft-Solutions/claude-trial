/**
 * WB3-4 · interview / exam / screening scheduling + structured outcome, and the
 * inline admission quiz.
 *
 * An AdmissionInterview is a scheduled touchpoint on an application with a
 * structured outcome (pass / fail / hold + score + notes). An 'exam' kind may
 * carry an inline question paper (the admission quiz) — the applicant's answers
 * are auto-marked server-side with the SAME objective marker as classroom
 * assessments (`markObjective`), so an all-objective paper scores itself and an
 * essay paper parks for a human to finalise via recordOutcome.
 *
 * Runs on the request's tenant-scoped client (RLS) inside the @TenantScoped tx;
 * audited; no privileged DatabaseService.
 */
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { markObjective } from '../../common/academics/objective-marking';
import {
  QUIZ_AUTO_GRADABLE_STYLES,
  type CancelInterviewDto,
  type QuizQuestionDto,
  type RecordOutcomeDto,
  type ScheduleInterviewDto,
  type SubmitQuizDto,
  type UpdateInterviewDto,
} from '../dto/admission-interviews.dto';

/** A normalised inline quiz question (server-owned shape). */
interface PaperQuestion {
  id: string;
  style: string;
  text: string;
  options?: string[];
  correctAnswer: string | null;
  points: number;
}

@Injectable()
export class AdmissionInterviewsService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  private async writeAudit(
    tenantId: string,
    actorId: string,
    action: string,
    resourceId: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action,
      resource: 'admission_interview',
      resourceId,
      actorId,
      description,
      metadata,
    });
  }

  // ======================= reads =======================

  async listForApplication(tenantId: string, applicationId: string) {
    await this.assertApplication(tenantId, applicationId);
    return this.client.admissionInterview.findMany({
      where: { tenantId, applicationId },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // ======================= schedule / update =======================

  async schedule(
    tenantId: string,
    applicationId: string,
    actorId: string,
    dto: ScheduleInterviewDto,
  ) {
    await this.assertApplication(tenantId, applicationId);
    const questions =
      dto.kind === 'exam' && dto.questions?.length
        ? this.normalizePaper(dto.questions)
        : null;
    if (dto.kind !== 'exam' && dto.questions?.length) {
      throw new BadRequestException(
        'Only an exam-kind interview can carry a question paper.',
      );
    }

    const interview = await this.client.admissionInterview.create({
      data: {
        tenantId,
        applicationId,
        kind: dto.kind,
        title: dto.title?.trim() || null,
        mode: dto.mode ?? 'in_person',
        location: dto.location?.trim() || null,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
        durationMinutes: dto.durationMinutes ?? null,
        interviewerId: dto.interviewerId ?? null,
        status: 'scheduled',
        questions: questions
          ? (questions as unknown as Prisma.InputJsonValue)
          : undefined,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.interview.schedule',
      interview.id,
      `scheduled ${dto.kind} on application ${applicationId}`,
      { kind: dto.kind, questions: questions?.length ?? 0 },
    );
    return interview;
  }

  async update(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateInterviewDto,
  ) {
    const interview = await this.assertInterview(tenantId, id);
    if (interview.status !== 'scheduled') {
      throw new BadRequestException(
        `A '${interview.status}' interview can no longer be edited.`,
      );
    }
    let questions: PaperQuestion[] | undefined;
    if (dto.questions !== undefined) {
      if (interview.kind !== 'exam') {
        throw new BadRequestException(
          'Only an exam-kind interview can carry a question paper.',
        );
      }
      questions = this.normalizePaper(dto.questions);
    }

    const updated = await this.client.admissionInterview.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        mode: dto.mode,
        location:
          dto.location === undefined ? undefined : dto.location.trim() || null,
        scheduledFor:
          dto.scheduledFor === undefined
            ? undefined
            : new Date(dto.scheduledFor),
        durationMinutes: dto.durationMinutes,
        interviewerId: dto.interviewerId,
        questions:
          questions === undefined
            ? undefined
            : (questions as unknown as Prisma.InputJsonValue),
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.interview.update',
      id,
      `updated ${interview.kind} ${id}`,
    );
    return updated;
  }

  async cancel(
    tenantId: string,
    id: string,
    actorId: string,
    dto: CancelInterviewDto,
  ) {
    const interview = await this.assertInterview(tenantId, id);
    if (interview.status === 'completed') {
      throw new BadRequestException(
        'A completed interview cannot be cancelled.',
      );
    }
    const status = dto.status ?? 'cancelled';
    const updated = await this.client.admissionInterview.update({
      where: { id },
      data: {
        status,
        notes: dto.reason?.trim() || interview.notes,
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.interview.cancel',
      id,
      `${status === 'no_show' ? 'marked no-show' : 'cancelled'} ${interview.kind} ${id}`,
      { reason: dto.reason?.trim() },
    );
    return updated;
  }

  // ======================= outcome / quiz =======================

  /** Manually record a structured outcome (also the exam manual-grade path). */
  async recordOutcome(
    tenantId: string,
    id: string,
    actorId: string,
    dto: RecordOutcomeDto,
  ) {
    const interview = await this.assertInterview(tenantId, id);
    if (interview.status === 'cancelled' || interview.status === 'no_show') {
      throw new BadRequestException(
        `Cannot record an outcome on a '${interview.status}' interview.`,
      );
    }
    if (dto.score != null && dto.maxScore != null && dto.score > dto.maxScore) {
      throw new BadRequestException('score cannot exceed maxScore.');
    }

    const updated = await this.client.admissionInterview.update({
      where: { id },
      data: {
        status: 'completed',
        outcome: dto.outcome ?? interview.outcome,
        score: dto.score ?? interview.score,
        maxScore: dto.maxScore ?? interview.maxScore,
        notes: dto.notes?.trim() ?? interview.notes,
        // A human finalising the mark clears the manual-grading flag.
        needsManualGrading: false,
        completedAt: interview.completedAt ?? new Date(),
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.interview.outcome',
      id,
      `recorded outcome on ${interview.kind} ${id}` +
        (dto.outcome ? `: ${dto.outcome}` : ''),
      { outcome: dto.outcome, score: dto.score },
    );
    return updated;
  }

  /**
   * Submit an applicant's answers to an exam's inline quiz. Objective questions
   * are auto-marked; an essay in the paper flags needsManualGrading for a human
   * to finalise the score/outcome via recordOutcome.
   */
  async submitQuiz(
    tenantId: string,
    id: string,
    actorId: string,
    dto: SubmitQuizDto,
  ) {
    const interview = await this.assertInterview(tenantId, id);
    if (interview.kind !== 'exam') {
      throw new BadRequestException('Only an exam-kind interview has a quiz.');
    }
    if (interview.status === 'cancelled' || interview.status === 'no_show') {
      throw new BadRequestException(
        `Cannot submit a quiz on a '${interview.status}' interview.`,
      );
    }
    const paper = (interview.questions as unknown as PaperQuestion[]) ?? [];
    if (!Array.isArray(paper) || paper.length === 0) {
      throw new BadRequestException('This exam has no question paper.');
    }

    const known = new Set(paper.map((q) => q.id));
    const seen = new Set<string>();
    for (const a of dto.answers) {
      if (!known.has(a.questionId)) {
        throw new BadRequestException(
          `Question ${a.questionId} is not on this paper.`,
        );
      }
      if (seen.has(a.questionId)) {
        throw new BadRequestException(
          `Duplicate answer for question ${a.questionId}.`,
        );
      }
      seen.add(a.questionId);
    }

    const marking = markObjective(
      paper.map((q) => ({
        questionId: q.id,
        points: q.points,
        style: q.style,
        correctAnswer: q.correctAnswer,
      })),
      dto.answers,
      QUIZ_AUTO_GRADABLE_STYLES,
    );

    const updated = await this.client.admissionInterview.update({
      where: { id },
      data: {
        answers: dto.answers as unknown as Prisma.InputJsonValue,
        score: marking.autoPoints,
        maxScore: marking.maxPoints,
        autoMarked: true,
        needsManualGrading: marking.needsManualGrading,
        status: 'completed',
        completedAt: new Date(),
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.interview.quiz_submit',
      id,
      `quiz auto-marked ${marking.autoPoints}/${marking.maxPoints} on exam ${id}` +
        (marking.needsManualGrading ? ' (needs manual grading)' : ''),
      {
        autoPoints: marking.autoPoints,
        maxPoints: marking.maxPoints,
        needsManualGrading: marking.needsManualGrading,
      },
    );
    return updated;
  }

  // ======================= helpers =======================

  /** Normalise + validate an inline paper: ids, options, answer keys, points. */
  private normalizePaper(questions: QuizQuestionDto[]): PaperQuestion[] {
    if (questions.length === 0) {
      throw new BadRequestException('An exam needs at least one question.');
    }
    const ids = new Set<string>();
    return questions.map((q) => {
      const id = q.id?.trim() || randomUUID();
      if (ids.has(id)) {
        throw new BadRequestException(`Duplicate question id "${id}".`);
      }
      ids.add(id);

      const options = q.options?.map((o) => o.trim()).filter(Boolean);
      const objective = QUIZ_AUTO_GRADABLE_STYLES.includes(q.style);
      const correctAnswer = q.correctAnswer?.trim() || null;

      if (q.style === 'mcq' && (!options || options.length < 2)) {
        throw new BadRequestException(
          'A multiple-choice question needs at least two options.',
        );
      }
      if (objective && !correctAnswer) {
        throw new BadRequestException(
          `Question "${q.text.slice(0, 40)}" needs an answer key.`,
        );
      }
      if (objective && options && !options.includes(correctAnswer!)) {
        throw new BadRequestException(
          `The answer key for "${q.text.slice(0, 40)}" must be one of its options.`,
        );
      }

      return {
        id,
        style: q.style,
        text: q.text.trim(),
        options: options && options.length ? options : undefined,
        correctAnswer: q.style === 'essay' ? null : correctAnswer,
        points: q.points ?? 1,
      };
    });
  }

  private async assertInterview(tenantId: string, id: string) {
    const interview = await this.client.admissionInterview.findFirst({
      where: { id, tenantId },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    return interview;
  }

  private async assertApplication(tenantId: string, id: string) {
    const app = await this.client.admissionApplication.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }
}
