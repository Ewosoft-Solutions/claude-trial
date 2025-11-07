import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { UpdateTenantConfigurationDto } from '../dto';
import { TenantAuditService } from './tenant-audit.service';

/**
 * Tenant Configuration Service
 *
 * Handles tenant settings and configuration management.
 * 6.6: Implement tenant configuration system
 * 6.9: Create tenant settings/configuration API
 */
@Injectable()
export class TenantConfigurationService {
  constructor(private readonly auditService: TenantAuditService) {}

  /**
   * Get tenant configuration
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @returns Tenant configuration
   */
  async getTenantConfiguration(prisma: PrismaClient, tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        emailDomain: true,
        status: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  /**
   * Update tenant configuration
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param data - Configuration update data
   * @param updatedBy - User ID of the updater
   * @returns Updated tenant
   */
  async updateTenantConfiguration(
    prisma: PrismaClient,
    tenantId: string,
    data: UpdateTenantConfigurationDto,
    updatedBy: string,
  ) {
    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, settings: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Merge settings
    const currentSettings = (tenant.settings as Record<string, any>) || {};
    const newSettings = {
      ...currentSettings,
      ...(data.settings || {}),
    };

    // Update tenant
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: newSettings,
      },
    });

    // Audit log
    await this.auditService.logTenantAction(prisma, {
      action: 'tenant_configuration_updated',
      tenantId: tenant.id,
      userId: updatedBy,
      metadata: {
        oldSettings: currentSettings,
        newSettings: data.settings,
      },
    });

    return updated;
  }

  /**
   * Get tenant settings
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @returns Tenant settings
   */
  async getTenantSettings(prisma: PrismaClient, tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant.settings || {};
  }
}
