import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { UpdateTenantStatusDto } from '../dto';
import { TenantAuditService } from './tenant-audit.service';

/**
 * Tenant Status Service
 *
 * Handles tenant status management (active, pending, suspended).
 * 6.8: Implement tenant status management
 */
@Injectable()
export class TenantStatusService {
  constructor(private readonly auditService: TenantAuditService) {}

  /**
   * Update tenant status
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param data - Status update data
   * @param updatedBy - User ID of the updater
   * @returns Updated tenant
   */
  async updateTenantStatus(
    prisma: PrismaClient,
    tenantId: string,
    data: UpdateTenantStatusDto,
    updatedBy: string,
  ) {
    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true, name: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Validate status transition
    this.validateStatusTransition(tenant.status, data.status);

    // Update status
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: data.status,
      },
    });

    // Audit log
    await this.auditService.logTenantAction(prisma, {
      action: 'tenant_status_updated',
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
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @returns Tenant status
   */
  async getTenantStatus(prisma: PrismaClient, tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
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
