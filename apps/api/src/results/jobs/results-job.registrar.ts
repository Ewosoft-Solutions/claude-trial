import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { JobHandlerRegistry } from '../../common/jobs/job-handler.registry';
import type { JobContext } from '../../common/jobs/job.types';
import { DeliveryService } from '../../communication/delivery/services/delivery.service';
import { GuardianshipService } from '../../person/services/guardianship.service';
import {
  ResultArtifactService,
  type ArtifactStudent,
} from '../services/result-artifact.service';
import {
  RESULT_ARTIFACTS_JOB,
  type ResultArtifactsPayload,
} from './results-jobs';

interface SnapshotStudent extends ArtifactStudent {
  studentId: string;
  classSectionId: string | null;
}

/**
 * WB4 · results artifact + notification handler (ADR-04 / ADR-06). Runs OFF the
 * publish request: for one section of a publication it renders + stores the
 * report-card DocumentArtifacts (updating each PublishedStudentResult) and one
 * section broadsheet, then notifies each student's guardians via F5 — skipping a
 * student whose result is under an active FinancialHold (visibility gate). The
 * job runs inside its own tenant scope (ctx.client), so all writes are
 * RLS-correct and commit with the job's completion (idempotent re-run on crash).
 */
@Injectable()
export class ResultsJobRegistrar implements OnModuleInit {
  private readonly logger = new Logger(ResultsJobRegistrar.name);

  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly artifacts: ResultArtifactService,
    private readonly delivery: DeliveryService,
    private readonly guardianships: GuardianshipService,
  ) {}

  onModuleInit(): void {
    this.registry.register<ResultArtifactsPayload>(
      RESULT_ARTIFACTS_JOB,
      (payload, ctx) => this.renderSection(payload, ctx),
    );
  }

  private async renderSection(
    payload: ResultArtifactsPayload,
    ctx: JobContext,
  ): Promise<void> {
    const tenantId = ctx.tenantId;
    if (!tenantId) return;
    const publication = await ctx.client.resultPublication.findFirst({
      where: { id: payload.publicationId, tenantId },
    });
    if (!publication) {
      this.logger.warn(`artifacts: publication ${payload.publicationId} gone`);
      return;
    }

    const snapshot = publication.snapshot as unknown as {
      cycle: {
        name: string;
        academicYearName: string;
        termName: string | null;
        schoolName?: string;
      };
      students: SnapshotStudent[];
    };
    const meta = {
      schoolName: snapshot.cycle.schoolName ?? 'School',
      cycleName: snapshot.cycle.name,
      academicYearName: snapshot.cycle.academicYearName,
      termName: snapshot.cycle.termName,
      version: publication.version,
      publishedAt: publication.publishedAt.toISOString().slice(0, 10),
    };
    const students = snapshot.students.filter(
      (s) => s.classSectionId === payload.classSectionId,
    );
    if (students.length === 0) return;
    const sectionLabel = students[0]!.sectionLabel ?? 'Class';

    // Report card per student → link it on the PublishedStudentResult row.
    for (const s of students) {
      const card = await this.artifacts.storeReportCard(
        tenantId,
        ctx.job.actor_id ?? undefined,
        publication.id,
        meta,
        s,
      );
      await ctx.client.publishedStudentResult.updateMany({
        where: {
          tenantId,
          publicationId: publication.id,
          studentId: s.studentId,
        },
        data: { reportCardDocumentId: card.documentId },
      });
    }

    // One broadsheet per section; pin it on the publication when it is the only
    // section (the common single-class cycle).
    const broadsheet = await this.artifacts.storeBroadsheet(
      tenantId,
      ctx.job.actor_id ?? undefined,
      publication.id,
      meta,
      sectionLabel,
      students,
    );
    const distinctSections = new Set(
      snapshot.students.map((s) => s.classSectionId),
    );
    if (distinctSections.size === 1) {
      await ctx.client.resultPublication.update({
        where: { id: publication.id },
        data: { broadsheetDocumentId: broadsheet.documentId },
      });
    }

    await this.notify(
      tenantId,
      ctx,
      meta.cycleName,
      publication.version,
      students,
    );
  }

  /**
   * Notify each student's guardians (WB1-4 consent-aware audience for the
   * 'results' category) — never a held student (an active FinancialHold gates
   * guardian visibility). Falls back to the student's own account when no
   * guardian is on file. Best-effort: F5 ledgers failures; they never fail the job.
   */
  private async notify(
    tenantId: string,
    ctx: JobContext,
    cycleName: string,
    version: number,
    students: SnapshotStudent[],
  ): Promise<void> {
    const studentIds = students.map((s) => s.studentId);
    const holds = await ctx.client.financialHold.findMany({
      where: { tenantId, studentId: { in: studentIds }, status: 'active' },
      select: { studentId: true },
    });
    const held = new Set(holds.map((h) => h.studentId));

    const profiles = await ctx.client.student.findMany({
      where: { id: { in: studentIds }, tenantId },
      select: { id: true, userTenantId: true, personId: true },
    });
    const profileByStudent = new Map(profiles.map((p) => [p.id, p]));

    for (const s of students) {
      if (held.has(s.studentId)) continue;
      const profile = profileByStudent.get(s.studentId);
      if (!profile) continue;
      const recipients: { personId?: string; profileId?: string }[] = [];
      if (profile.personId) {
        const audience = await this.guardianships.resolveAudience(
          tenantId,
          profile.personId,
          'results',
        );
        for (const g of audience)
          recipients.push({ personId: g.guardianPersonId });
      }
      if (recipients.length === 0) {
        recipients.push({ profileId: profile.userTenantId });
      }
      for (const r of recipients) {
        try {
          await this.delivery.send({
            tenantId,
            channel: 'in_app',
            category: 'transactional',
            personId: r.personId,
            profileId: r.profileId,
            subject: 'Results are ready',
            body: `Results for "${cycleName}" have been published.`,
            dedupeKey: `result-published:${s.studentId}:${version}:${
              r.personId ?? r.profileId
            }`,
            actorId: ctx.job.actor_id ?? undefined,
            metadata: { kind: 'result_published' },
          });
        } catch {
          // F5 ledgers the failure; a delivery hiccup never fails the job.
        }
      }
    }
  }
}
