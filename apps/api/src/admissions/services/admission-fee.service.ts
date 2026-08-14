/**
 * WB3-5 · admission fee → Finance coupling.
 *
 * A `fee`-type admission requirement (application fee, acceptance fee) is no
 * longer a bare "mark paid" toggle — it is a REAL Finance AR record:
 *
 *   • bill    — create a studentless `FeeInvoice` (keyed to the application) with
 *               one line against an `admission:<key>` fee item; the fulfilment
 *               stores the invoice id and stays `pending` until settled.
 *   • settle  — record a real `Payment` against that invoice; when the derived
 *               balance hits zero the fulfilment flips to `provided`.
 *
 * On convert-to-student the application's invoices/payments are re-keyed to the
 * new student (see AdmissionsService.convertToStudent), so admission fees reconcile
 * in the finance subsystem and follow the applicant into the student ledger with
 * zero re-billing. All finance DB writes stay inside the finance module; this
 * service only orchestrates + audits, on the request's tenant RLS transaction.
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
import { FinanceService } from '../../finance/services/finance.service';
import { FinanceCatalogueService } from '../../finance/services/finance-catalogue.service';
import type { BillFeeDto, SettleFeeDto } from '../dto/admissions.dto';

@Injectable()
export class AdmissionFeeService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly finance: FinanceService,
    private readonly catalogue: FinanceCatalogueService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  /**
   * Bill a fee requirement: provision the `admission:<key>` fee item, create the
   * Finance invoice, and link it on the fulfilment. Idempotent — if the fee has
   * already been billed the existing invoice is returned untouched.
   */
  async billFee(
    tenantId: string,
    applicationId: string,
    appRequirementId: string,
    dto: BillFeeDto,
    actorId: string,
  ) {
    const fulfilment = await this.assertFeeRequirement(
      tenantId,
      applicationId,
      appRequirementId,
    );

    const existing = this.linkedInvoiceId(fulfilment.value);
    if (existing) {
      const invoice = await this.finance.getInvoice(tenantId, existing);
      return { requirement: fulfilment, invoice };
    }

    // Amount: explicit override, else the template's configured amount.
    const template = await this.client.admissionRequirement.findFirst({
      where: { id: fulfilment.requirementId, tenantId },
      select: { key: true, config: true },
    });
    const configuredAmount = this.configuredAmount(template?.config);
    const amount = dto.amount ?? configuredAmount;
    if (amount == null || amount <= 0) {
      throw new BadRequestException(
        'No fee amount set for this requirement — pass an amount to bill it.',
      );
    }

    const application = await this.client.admissionApplication.findFirst({
      where: { id: applicationId, tenantId },
      select: { applicantName: true },
    });

    const feeItem = await this.catalogue.ensureFeeItem(tenantId, {
      code: `admission:${template?.key ?? 'fee'}`,
      name: fulfilment.label,
    });

    const invoice = await this.finance.createAdmissionInvoice(
      tenantId,
      {
        applicationId,
        applicantName: application?.applicantName ?? null,
        feeItemId: feeItem.id,
        amount,
        label: fulfilment.label,
        dueDate: dto.dueDate ?? null,
      },
      actorId,
    );

    const requirement =
      await this.client.admissionApplicationRequirement.update({
        where: { id: appRequirementId },
        data: {
          value: {
            ...this.valueObject(fulfilment.value),
            invoiceId: invoice.id,
            amount,
          },
        },
      });

    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.fee.bill',
      appRequirementId,
      `billed "${fulfilment.label}" (${amount}) on application ${applicationId}`,
      { invoiceId: invoice.id, amount },
    );
    return { requirement, invoice };
  }

  /**
   * Settle (fully or partially) a billed fee requirement by recording a Finance
   * payment. The fulfilment flips to `provided` only when the invoice balance
   * reaches zero; a partial payment leaves it `pending` with the invoice at
   * `partial`.
   */
  async settleFee(
    tenantId: string,
    applicationId: string,
    appRequirementId: string,
    dto: SettleFeeDto,
    actorId: string,
  ) {
    const fulfilment = await this.assertFeeRequirement(
      tenantId,
      applicationId,
      appRequirementId,
    );
    const invoiceId = this.linkedInvoiceId(fulfilment.value);
    if (!invoiceId) {
      throw new BadRequestException(
        'Bill this fee before recording a payment against it.',
      );
    }

    const { payment, invoice, financials } =
      await this.finance.settleAdmissionInvoice(
        tenantId,
        invoiceId,
        {
          amount: dto.amount,
          method: dto.method,
          paidAt: dto.paidAt,
          reference: dto.reference ?? null,
        },
        actorId,
      );

    const settled = financials.balance === 0;
    const requirement =
      await this.client.admissionApplicationRequirement.update({
        where: { id: appRequirementId },
        data: settled
          ? {
              status: 'provided',
              providedAt: new Date(),
              providedBy: actorId,
              waivedReason: null,
              value: {
                ...this.valueObject(fulfilment.value),
                invoiceId,
                paid: true,
              },
            }
          : {
              value: {
                ...this.valueObject(fulfilment.value),
                invoiceId,
                paid: false,
              },
            },
      });

    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.fee.settle',
      appRequirementId,
      `recorded a ${dto.amount} payment for "${fulfilment.label}" on application ${applicationId}${
        settled ? ' (settled)' : ' (partial)'
      }`,
      { invoiceId, amount: dto.amount, settled },
    );
    return { requirement, invoice, payment };
  }

  // ======================= helpers =======================

  private async assertFeeRequirement(
    tenantId: string,
    applicationId: string,
    appRequirementId: string,
  ) {
    const req = await this.client.admissionApplicationRequirement.findFirst({
      where: { id: appRequirementId, tenantId, applicationId },
    });
    if (!req) {
      throw new NotFoundException('Application requirement not found');
    }
    if (req.type !== 'fee') {
      throw new BadRequestException(
        'This requirement is not a fee — use provide / upload instead.',
      );
    }
    return req;
  }

  /** The linked Finance invoice id stored on the fulfilment's `value`, if any. */
  private linkedInvoiceId(value: Prisma.JsonValue | null): string | null {
    const obj = this.valueObject(value);
    const id = obj['invoiceId'];
    return typeof id === 'string' ? id : null;
  }

  private valueObject(value: Prisma.JsonValue | null): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  /** The `amount` (kobo) from a fee requirement template's `config`, if a number. */
  private configuredAmount(
    config: Prisma.JsonValue | null | undefined,
  ): number | null {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return null;
    }
    const amount = (config as Record<string, unknown>)['amount'];
    return typeof amount === 'number' && amount > 0 ? amount : null;
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
      resource: 'admission_requirement',
      resourceId,
      actorId,
      description,
      metadata,
    });
  }
}
