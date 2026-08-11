/**
 * Public (unauthenticated) admissions — the applicant-facing slice of the WB3
 * pipeline: a parent applies from `/apply/[school]` and tracks + acts on their
 * application from a SecureLink status portal, with no login.
 *
 * There is no session, so:
 *   • the school is resolved by SLUG in the audited platform scope (mirrors
 *     TenantService.getPublicBySlug — the tenant registry is not tenant-scoped);
 *   • every write then runs inside `runScoped(tenantId, PUBLIC_ACTOR, …)` so RLS
 *     + audit hold exactly as for a staff write, reusing the WB3 services
 *     unchanged (createApplication / requirements / forms / recordAcceptance);
 *   • the status token is an F5 SecureLink (hashed, expiring, revocable) resolved
 *     WITHOUT consuming a use, so the parent can reload it. Possession of the
 *     link is the capability; the status read is a NARROW projection (never
 *     reviews / internal notes / other applicants).
 */
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { SecureLinkService } from '../../communication/delivery/services/secure-link.service';
import { AdmissionsService } from './admissions.service';
import { AdmissionRequirementsService } from './admission-requirements.service';
import { AdmissionFormsService } from './admission-forms.service';
import {
  STATUS_PURPOSE,
  STATUS_TARGET,
  STATUS_TTL_SECONDS,
} from '../status-link.constants';
import type {
  PublicApplyDto,
  PublicUploadDocumentDto,
} from '../dto/public-admissions.dto';

/** Actor id attributed to self-submitted (portal) writes in audit + createdBy. */
const PUBLIC_ACTOR = 'public-portal';

// Lightweight per-IP throttle for the public submit. In-memory (single instance
// — a durable/distributed limiter is a follow-up); complements the guardian-
// contact requirement enforced by the DTO.
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 6;

@Injectable()
export class PublicAdmissionsService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly admissions: AdmissionsService,
    private readonly requirements: AdmissionRequirementsService,
    private readonly forms: AdmissionFormsService,
    private readonly secureLinks: SecureLinkService,
  ) {}

  private readonly attempts = new Map<string, number[]>();

  // ======================= school (slug) =======================

  /** Resolve an active school by slug (narrow, unauthenticated — mirrors
   *  TenantService.getPublicBySlug). */
  private async resolveSchool(slug: string) {
    const tenant = await this.tenantDb.runPlatform(undefined, () =>
      this.tenantDb.client.tenant.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          slug: true,
          schoolType: true,
          status: true,
        },
      }),
    );
    if (
      !tenant ||
      tenant.status === 'suspended' ||
      tenant.status === 'deleted'
    ) {
      throw new NotFoundException('School not found');
    }
    return tenant;
  }

  /** The apply form: school identity + the WB2-1 cascade + published form. */
  async getIntake(slug: string) {
    const school = await this.resolveSchool(slug);
    return this.tenantDb.runScoped(school.id, undefined, async () => ({
      school: {
        name: school.name,
        slug: school.slug,
        schoolType: school.schoolType,
      },
      structure: await this.admissions.getIntakeStructure(school.id),
      form: await this.forms.getCurrentForm(school.id),
    }));
  }

  // ======================= apply =======================

  async apply(slug: string, dto: PublicApplyDto, ip: string) {
    const school = await this.resolveSchool(slug);
    this.throttle(ip);

    return this.tenantDb.runScoped(school.id, PUBLIC_ACTOR, async () => {
      const application = await this.admissions.createApplication(
        school.id,
        dto,
        PUBLIC_ACTOR,
      );

      // Capture the school-authored form answers, if a form is published.
      if (dto.formAnswers && Object.keys(dto.formAnswers).length > 0) {
        const form = await this.forms.getCurrentForm(school.id);
        if (form) {
          await this.forms.submitResponse(
            school.id,
            application.id,
            PUBLIC_ACTOR,
            {
              answers: dto.formAnswers,
            },
          );
        }
      }

      const { token } = await this.secureLinks.create(school.id, PUBLIC_ACTOR, {
        purpose: STATUS_PURPOSE,
        targetType: STATUS_TARGET,
        targetId: application.id,
        ttlSeconds: STATUS_TTL_SECONDS,
        // No maxUses — the status link is re-checkable.
        metadata: { origin: 'public-portal' },
      });

      return {
        reference: application.id,
        applicantName: application.applicantName,
        statusToken: token,
      };
    });
  }

  // ======================= status (token) =======================

  private async resolve(token: string): Promise<{
    tenantId: string;
    applicationId: string;
  }> {
    const link = await this.secureLinks.resolveActive(token, STATUS_PURPOSE);
    if (link.targetType !== STATUS_TARGET) {
      throw new NotFoundException('Invalid link');
    }
    return { tenantId: link.tenantId, applicationId: link.targetId };
  }

  async getStatus(token: string) {
    const { tenantId, applicationId } = await this.resolve(token);
    return this.tenantDb.runScoped(tenantId, undefined, async () => {
      const app = await this.admissions.getApplication(tenantId, applicationId);
      return this.project(app);
    });
  }

  async uploadDocument(
    token: string,
    requirementId: string,
    dto: PublicUploadDocumentDto,
  ) {
    const { tenantId, applicationId } = await this.resolve(token);
    return this.tenantDb.runScoped(tenantId, PUBLIC_ACTOR, () =>
      this.requirements.uploadRequirementDocument(
        tenantId,
        applicationId,
        requirementId,
        dto,
        PUBLIC_ACTOR,
      ),
    );
  }

  async accept(token: string) {
    const { tenantId, applicationId } = await this.resolve(token);
    await this.tenantDb.runScoped(tenantId, PUBLIC_ACTOR, () =>
      this.admissions.recordAcceptance(tenantId, applicationId, PUBLIC_ACTOR),
    );
    return this.getStatus(token);
  }

  // ======================= projection + throttle =======================

  /**
   * The applicant-safe view — deliberately narrow: NO reviews, NO internal
   * notes, NO other applicants, NO guardian contact details. Just enough to
   * track the journey and complete the online steps (requirement uploads,
   * accept an offer).
   */
  private project(app: {
    id: string;
    applicantName: string;
    applyingFor: string;
    stage: string;
    decision: string;
    submittedDate: Date | null;
    offeredAt: Date | null;
    requirements?: Array<{
      id: string;
      label: string;
      type: string;
      collectStage: string;
      required: boolean;
      status: string;
      documentId: string | null;
    }>;
    stageEvents?: Array<{ toStage: string; createdAt: Date }>;
  }) {
    return {
      reference: app.id,
      applicantName: app.applicantName,
      applyingFor: app.applyingFor,
      stage: app.stage,
      decision: app.decision,
      submittedDate: app.submittedDate,
      offeredAt: app.offeredAt,
      requirements: (app.requirements ?? []).map((r) => ({
        id: r.id,
        label: r.label,
        type: r.type,
        collectStage: r.collectStage,
        required: r.required,
        status: r.status,
        hasDocument: r.documentId != null,
      })),
      // Stage transitions only (stage + date) — no internal transition notes.
      stageHistory: (app.stageEvents ?? []).map((e) => ({
        toStage: e.toStage,
        createdAt: e.createdAt,
      })),
    };
  }

  private throttle(ip: string) {
    const key = ip || 'unknown';
    const now = Date.now();
    const recent = (this.attempts.get(key) ?? []).filter(
      (t) => now - t < RATE_WINDOW_MS,
    );
    if (recent.length >= RATE_MAX) {
      throw new HttpException(
        'Too many applications from this network. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.attempts.set(key, recent);
    // Bound the map so it can't grow unbounded under a flood.
    if (this.attempts.size > 10000) this.attempts.clear();
  }
}
