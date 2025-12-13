import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UpdateTenantStatusDto } from '../dto';
import { TenantAuditService } from './tenant-audit.service';
import { DatabaseService } from '../../common/database/database.service';
import { AUDIT_ACTION } from '../../common/audit/audit.constants';

/**
 * Tenant Status Service
 *
 * Handles tenant status management (active, pending, suspended).
 * 6.8: Implement tenant status management
 */
@Injectable()
export class TenantStatusService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly auditService: TenantAuditService,
  ) {}

  /**
   * Update tenant status
   *
   * @param tenantId - Tenant ID
   * @param data - Status update data
   * @param updatedBy - User ID of the updater
   * @returns Updated tenant
   */
  async updateTenantStatus(
    tenantId: string,
    data: UpdateTenantStatusDto,
    updatedBy: string,
  ) {
    // Check if tenant exists
    const tenant = await this.dbService.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true, name: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Validate status transition
    this.validateStatusTransition(tenant.status, data.status);

    // Update status
    const updated = await this.dbService.client.tenant.update({
      where: { id: tenantId },
      data: {
        status: data.status,
      },
    });

    // Audit log
    await this.auditService.logTenantAction({
      action: AUDIT_ACTION.TENANT_LIFECYCLE.TENANT_STATUS_UPDATED,
      tenantId: tenant.id,
      userId: updatedBy,
      metadata: {
        oldStatus: tenant.status,
        newStatus: data.status,
        reason: data.reason,
      },
    });

    return updated;
  }

  /**
   * Get tenant status
   *
   * @param tenantId - Tenant ID
   * @returns Tenant status
   */
  async getTenantStatus(tenantId: string) {
    const tenant = await this.dbService.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true, name: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
    };
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(
    currentStatus: string,
    newStatus: string,
  ): void {
    // Allow any transition for now
    // Can add business logic here if needed
    // e.g., can't go from suspended directly to active without approval
    if (currentStatus === newStatus) {
      throw new BadRequestException(`Tenant is already in ${newStatus} status`);
    }
  }
}
