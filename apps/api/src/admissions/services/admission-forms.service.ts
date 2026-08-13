/**
 * WB3-3 · the admissions application form — now a thin adapter over the generic
 * Form engine (see docs/form-engine-plan.md). The application form is a `Form`
 * owned by the tenant with purpose `admissions.application`; an application's
 * answers are a `FormResponse` whose subject is the application. All the
 * versioning, validation, branching and `file` materialisation live in the
 * reusable FormsService.
 */
import { BadRequestException, Injectable } from '@nestjs/common';

import { FormsService, type FormOwnerRef } from '../../forms/forms.service';
import { type FormDefinition } from '@workspace/forms';

const PURPOSE = 'admissions.application';
const SUBJECT = 'AdmissionApplication';

@Injectable()
export class AdmissionFormsService {
  constructor(private readonly forms: FormsService) {}

  private ref(tenantId: string): FormOwnerRef {
    return { ownerType: 'Tenant', ownerId: tenantId, purpose: PURPOSE };
  }

  // ---- versions ----

  async listVersions(tenantId: string) {
    const form = await this.forms.findForm(tenantId, this.ref(tenantId));
    return form ? this.forms.listVersions(tenantId, form.id) : [];
  }

  async getCurrentForm(tenantId: string) {
    const form = await this.forms.findForm(tenantId, this.ref(tenantId));
    return form ? this.forms.getCurrentPublished(tenantId, form.id) : null;
  }

  getVersion(tenantId: string, id: string) {
    return this.forms.getVersion(tenantId, id);
  }

  async createDraft(
    tenantId: string,
    actorId: string,
    definition: FormDefinition,
  ) {
    const title =
      typeof definition?.title === 'string' && definition.title.trim()
        ? definition.title
        : 'Application form';
    const form = await this.forms.getOrCreateForm(
      tenantId,
      actorId,
      this.ref(tenantId),
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

  async getResponse(tenantId: string, applicationId: string) {
    const current = await this.getCurrentForm(tenantId);
    if (!current) return null;
    return this.forms.getResponse(tenantId, current.id, SUBJECT, applicationId);
  }

  async submitResponse(
    tenantId: string,
    applicationId: string,
    actorId: string,
    answers: Record<string, unknown>,
  ) {
    const current = await this.getCurrentForm(tenantId);
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
