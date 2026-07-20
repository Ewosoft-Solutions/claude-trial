import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateTenantConfigurationDto } from '../dto';
import { TenantAuditService } from './tenant-audit.service';
import { DatabaseService } from '../../common/database/database.service';
import { AUDIT_ACTION } from '../../common/audit/audit.constants';
import {
  type FeatureKey,
  isFeatureKey,
  resolveFeatureMap,
} from '../tenant-features';

/**
 * Tenant Configuration Service
 *
 * Handles tenant settings and configuration management.
 * 6.6: Implement tenant configuration system
 * 6.9: Create tenant settings/configuration API
 */
@Injectable()
export class TenantConfigurationService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly auditService: TenantAuditService,
  ) {}

  /**
   * Get tenant configuration
   *
   * @param tenantId - Tenant ID
   * @returns Tenant configuration
   */
  async getTenantConfiguration(tenantId: string) {
    const tenant = await this.dbService.client.tenant.findUnique({
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
   * @param tenantId - Tenant ID
   * @param data - Configuration update data
   * @param updatedBy - User ID of the updater
   * @returns Updated tenant
   */
  async updateTenantConfiguration(
    tenantId: string,
    data: UpdateTenantConfigurationDto,
    updatedBy: string,
  ) {
    // Check if tenant exists
    const tenant = await this.dbService.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, emailDomain: true, settings: true },
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
    const updated = await this.dbService.client.tenant.update({
      where: { id: tenantId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.emailDomain !== undefined
          ? { emailDomain: data.emailDomain || null }
          : {}),
        settings: newSettings,
      },
    });

    // Audit log
    await this.auditService.logTenantAction({
      action: AUDIT_ACTION.TENANT_LIFECYCLE.TENANT_CONFIGURATION_UPDATED,
      tenantId: tenant.id,
      userId: updatedBy,
      metadata: {
        oldSettings: currentSettings,
        newSettings: data.settings,
        oldName: tenant.name,
        newName: data.name,
        oldEmailDomain: tenant.emailDomain,
        newEmailDomain: data.emailDomain,
      },
    });

    return updated;
  }

  /**
   * Get tenant settings
   *
   * @param tenantId - Tenant ID
   * @returns Tenant settings
   */
  async getTenantSettings(tenantId: string) {
    const tenant = await this.dbService.client.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant.settings || {};
  }

  /**
   * The tenant's feature on/off map (default-on for any unset feature).
   */
  async getFeatures(tenantId: string): Promise<Record<FeatureKey, boolean>> {
    const tenant = await this.dbService.client.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return resolveFeatureMap(tenant.settings);
  }

  /**
   * Merge a partial feature toggle patch into `settings.features` and return
   * the resolved map. Unknown feature keys are rejected.
   */
  async updateFeatures(
    tenantId: string,
    patch: Record<string, boolean>,
    updatedBy: string,
  ): Promise<Record<FeatureKey, boolean>> {
    for (const [key, value] of Object.entries(patch)) {
      if (!isFeatureKey(key)) {
        throw new BadRequestException(`Unknown feature: ${key}`);
      }
      if (typeof value !== 'boolean') {
        throw new BadRequestException(`Feature ${key} must be a boolean`);
      }
    }

    const tenant = await this.dbService.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, settings: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const currentSettings = (tenant.settings as Record<string, any>) || {};
    const currentFeatures =
      (currentSettings.features as Record<string, boolean>) || {};
    const newFeatures = { ...currentFeatures, ...patch };
    const newSettings = { ...currentSettings, features: newFeatures };

    await this.dbService.client.tenant.update({
      where: { id: tenantId },
      data: { settings: newSettings },
    });

    await this.auditService.logTenantAction({
      action: AUDIT_ACTION.TENANT_LIFECYCLE.TENANT_CONFIGURATION_UPDATED,
      tenantId: tenant.id,
      userId: updatedBy,
      metadata: { featuresPatch: patch },
    });

    return resolveFeatureMap(newSettings);
  }
}
