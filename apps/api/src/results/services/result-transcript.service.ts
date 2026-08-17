/**
 * WB4-4 · ResultTranscriptService — a student's cumulative academic record,
 * assembled ONLY from published (non-superseded) result snapshots.
 *
 * This is the reproducibility promise of ADR-04 turned into a document: every
 * number on a transcript is copied from a `PublishedStudentResult` that carries
 * its own checksum and its publication version, so the record can be re-derived
 * and defended years later even after cycles, sections and grade scales have
 * moved on. Nothing here reads the live gradebook, and an amended term shows the
 * CURRENT version only (the superseded snapshot stays in history, never on the
 * transcript).
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { AccessScopeService } from '../../auth/services/access-scope.service';
import { ResultArtifactService } from './result-artifact.service';
import {
  sortTranscriptTerms,
  summariseTranscript,
  type TranscriptSubject,
  type TranscriptSummary,
  type TranscriptTerm,
} from './result-transcript';
import type { ResultActor } from './results.types';

export interface Transcript {
  student: {
    id: string;
    studentNumber: string | null;
    studentName: string | null;
  };
  schoolName: string;
  terms: TranscriptTerm[];
  summary: TranscriptSummary;
  /** False while an audited FinancialHold gates the family's view. */
  visibleToGuardian: boolean;
  transcriptDocumentId: string | null;
  generatedAt: string;
}

/** The per-subject shape stored inside a published snapshot row. */
interface SnapshotSubjectRow {
  subjectLabel?: string | null;
  percentage?: number | string | null;
  letterGrade?: string | null;
  total?: number | string | null;
  maxTotal?: number | string | null;
}

@Injectable()
export class ResultTranscriptService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly accessScope: AccessScopeService,
    private readonly artifacts: ResultArtifactService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  async getTranscript(
    tenantId: string,
    actor: ResultActor,
    studentId: string,
  ): Promise<Transcript> {
    const student = await this.client.student.findFirst({
      where: { id: studentId, tenantId },
      select: {
        id: true,
        studentNumber: true,
        userTenant: {
          select: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const rows = await this.client.publishedStudentResult.findMany({
      where: {
        tenantId,
        studentId,
        // Superseded publications never appear — an amended term shows its
        // current version only.
        publication: { status: 'published' },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        publicationId: true,
        cycleId: true,
        sectionLabel: true,
        subjects: true,
        average: true,
        overallGrade: true,
        position: true,
        promotionRecommendation: true,
        reportCardDocumentId: true,
        checksum: true,
        publication: { select: { version: true, publishedAt: true } },
      },
    });

    const cycleIds = [...new Set(rows.map((r) => r.cycleId))];
    const cycles = cycleIds.length
      ? await this.client.resultCycle.findMany({
          where: { id: { in: cycleIds }, tenantId },
          select: {
            id: true,
            name: true,
            campusId: true,
            academicYearId: true,
            termId: true,
          },
        })
      : [];
    const cycleById = new Map(cycles.map((c) => [c.id, c]));

    const [years, terms, tenant] = await Promise.all([
      this.client.academicYear.findMany({
        where: { tenantId, id: { in: cycles.map((c) => c.academicYearId) } },
        select: { id: true, name: true },
      }),
      this.client.term.findMany({
        where: {
          tenantId,
          id: {
            in: cycles.flatMap((c) => (c.termId ? [c.termId] : [])),
          },
        },
        select: { id: true, name: true },
      }),
      this.client.tenant.findFirst({
        where: { id: tenantId },
        select: { name: true },
      }),
    ]);
    const yearName = new Map(years.map((y) => [y.id, y.name]));
    const termName = new Map(terms.map((t) => [t.id, t.name]));

    const transcriptTerms: TranscriptTerm[] = [];
    for (const row of rows) {
      const cycle = cycleById.get(row.cycleId);
      if (!cycle) continue;
      // A campus-scoped reader only sees results from cycles in their scope
      // (a whole-school cycle has no campus and stays visible).
      if (!this.withinScope(actor, cycle.campusId)) continue;

      transcriptTerms.push({
        cycleId: cycle.id,
        cycleName: cycle.name,
        academicYearId: cycle.academicYearId,
        academicYearName: yearName.get(cycle.academicYearId) ?? 'Academic year',
        termId: cycle.termId,
        termName: cycle.termId ? (termName.get(cycle.termId) ?? null) : null,
        publicationId: row.publicationId,
        version: row.publication?.version ?? 1,
        checksum: row.checksum,
        publishedAt: (row.publication?.publishedAt ?? new Date())
          .toISOString()
          .slice(0, 10),
        average: row.average === null ? null : Number(row.average),
        overallGrade: row.overallGrade,
        position: row.position,
        promotionRecommendation: row.promotionRecommendation,
        sectionLabel: row.sectionLabel,
        reportCardDocumentId: row.reportCardDocumentId,
        subjects: toTranscriptSubjects(row.subjects),
      });
    }
    const ordered = sortTranscriptTerms(transcriptTerms);

    const hold = await this.client.financialHold.findFirst({
      where: { tenantId, studentId, status: 'active' },
      select: { id: true },
    });
    const existing = await this.client.document.findFirst({
      where: {
        tenantId,
        ownerType: 'Student',
        ownerId: studentId,
        title: { startsWith: 'Transcript' },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    return {
      student: {
        id: student.id,
        studentNumber: student.studentNumber,
        studentName:
          `${student.userTenant?.user?.firstName ?? ''} ${student.userTenant?.user?.lastName ?? ''}`.trim() ||
          student.studentNumber,
      },
      schoolName: tenant?.name ?? 'School',
      terms: ordered,
      summary: summariseTranscript(ordered),
      visibleToGuardian: !hold,
      transcriptDocumentId: existing?.id ?? null,
      generatedAt: new Date().toISOString().slice(0, 10),
    };
  }

  /**
   * Render + store the transcript as an immutable, checksum-addressed
   * DocumentArtifact (F4). Issuing one is an audited act — a transcript leaves
   * the building.
   */
  async issueTranscript(
    tenantId: string,
    actor: ResultActor,
    studentId: string,
  ): Promise<{ documentId: string; checksum: string; termCount: number }> {
    const transcript = await this.getTranscript(tenantId, actor, studentId);
    if (transcript.terms.length === 0) {
      throw new BadRequestException(
        'This student has no published results to put on a transcript.',
      );
    }
    const stored = await this.artifacts.storeTranscript(
      tenantId,
      actor.userId,
      studentId,
      transcript,
    );
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'academics.results.transcript.issue',
      resource: 'student',
      resourceId: studentId,
      actorId: actor.userId,
      description: `issued a transcript for ${transcript.student.studentName} (${transcript.terms.length} published term(s))`,
      metadata: {
        documentId: stored.documentId,
        checksum: stored.checksum,
        terms: transcript.terms.length,
      },
    });
    return {
      documentId: stored.documentId,
      checksum: stored.checksum,
      termCount: transcript.terms.length,
    };
  }

  private withinScope(actor: ResultActor, campusId: string | null): boolean {
    try {
      this.accessScope.assertWithinScope(actor.grantScope, {
        campusId: campusId ?? undefined,
      });
      return true;
    } catch {
      return false;
    }
  }
}

/** Read the snapshot's subject array defensively — it is stored JSON. */
export function toTranscriptSubjects(value: unknown): TranscriptSubject[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const row = (raw ?? {}) as SnapshotSubjectRow;
    return {
      subjectLabel: row.subjectLabel ?? '—',
      percentage: numberOrNull(row.percentage),
      letterGrade: row.letterGrade ?? null,
      total: numberOrNull(row.total),
      maxTotal: numberOrNull(row.maxTotal),
    };
  });
}

function numberOrNull(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
