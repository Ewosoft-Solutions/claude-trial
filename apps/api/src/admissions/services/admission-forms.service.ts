/**
 * WB3-3 · the admissions application form — now a thin adapter over the generic
 * Form engine (see docs/form-engine-plan.md). The application form is a `Form`
 * owned by the tenant with purpose `admissions.application`; an application's
 * answers are a `FormResponse` whose subject is the application. All the
 * versioning, validation, branching and `file` materialisation live in the
 * reusable FormsService.
 *
 * WB3 consolidation: a school can author a PER-CAMPUS variant — a `Form` owned by
 * `{Campus, campusId}` that overrides the school default `{Tenant, tenantId}`.
 * Resolution (for the intake/apply forms) prefers the applicant's campus form and
 * falls back to the default; the editor targets one exact form (default or a
 * chosen campus), with no fallback.
 */
import { BadRequestException, Injectable } from '@nestjs/common';

import { FormsService, type FormOwnerRef } from '../../forms/forms.service';
import { type FormDefinition } from '@workspace/forms';

const PURPOSE = 'admissions.application';
const SUBJECT = 'AdmissionApplication';

@Injectable()
export class AdmissionFormsService {
  constructor(private readonly forms: FormsService) {}

  /** The owner of the exact form: a specific campus, else the school default. */
  private ref(tenantId: string, campusId?: string | null): FormOwnerRef {
    return campusId
      ? { ownerType: 'Campus', ownerId: campusId, purpose: PURPOSE }
      : { ownerType: 'Tenant', ownerId: tenantId, purpose: PURPOSE };
  }

  // ---- versions (editor targets ONE exact form: default or a campus) ----

  async listVersions(tenantId: string, campusId?: string | null) {
    const form = await this.forms.findForm(
      tenantId,
      this.ref(tenantId, campusId),
    );
    return form ? this.forms.listVersions(tenantId, form.id) : [];
  }

  /**
   * The current PUBLISHED form to render for an applicant of `campusId`: the
   * campus variant if it has a published version, else the school default.
   */
  async getCurrentForm(tenantId: string, campusId?: string | null) {
    if (campusId) {
      const own = await this.forms.findForm(
        tenantId,
        this.ref(tenantId, campusId),
      );
      if (own) {
        const published = await this.forms.getCurrentPublished(
          tenantId,
          own.id,
        );
        if (published) return published;
      }
    }
    const base = await this.forms.findForm(tenantId, this.ref(tenantId));
    return base ? this.forms.getCurrentPublished(tenantId, base.id) : null;
  }

  /** Which of the given campuses author their OWN form (vs. using the default). */
  async campusesWithOwnForm(
    tenantId: string,
    campusIds: string[],
  ): Promise<string[]> {
    const out: string[] = [];
    for (const campusId of campusIds) {
      const form = await this.forms.findForm(
        tenantId,
        this.ref(tenantId, campusId),
      );
      if (form) out.push(campusId);
    }
    return out;
  }

  getVersion(tenantId: string, id: string) {
    return this.forms.getVersion(tenantId, id);
  }

  async createDraft(
    tenantId: string,
    actorId: string,
    definition: FormDefinition,
    campusId?: string | null,
  ) {
    const title =
      typeof definition?.title === 'string' && definition.title.trim()
        ? definition.title
        : 'Application form';
    const form = await this.forms.getOrCreateForm(
      tenantId,
      actorId,
      this.ref(tenantId, campusId),
      title,
    );
    return this.forms.createDraft(tenantId, actorId, form.id, definition);
  }

  updateDraft(
    tenantId: string,
    actorId: string,
    id: string,
    definition: FormDefinition,
  ) {
    return this.forms.updateDraft(tenantId, actorId, id, definition);
  }

  publishVersion(tenantId: string, actorId: string, id: string) {
    return this.forms.publishVersion(tenantId, actorId, id);
  }

  archiveVersion(tenantId: string, actorId: string, id: string) {
    return this.forms.archiveVersion(tenantId, actorId, id);
  }

  // ---- an application's response ----

  async getResponse(
    tenantId: string,
    applicationId: string,
    campusId?: string | null,
  ) {
    const current = await this.getCurrentForm(tenantId, campusId);
    if (!current) return null;
    return this.forms.getResponse(tenantId, current.id, SUBJECT, applicationId);
  }

  async submitResponse(
    tenantId: string,
    applicationId: string,
    actorId: string,
    answers: Record<string, unknown>,
    campusId?: string | null,
  ) {
    const current = await this.getCurrentForm(tenantId, campusId);
    if (!current) {
      throw new BadRequestException(
        'No published application form to respond to.',
      );
    }
    return this.forms.submitResponse(tenantId, actorId, {
      formVersionId: current.id,
      subjectType: SUBJECT,
      subjectId: applicationId,
      answers,
    });
  }
}
