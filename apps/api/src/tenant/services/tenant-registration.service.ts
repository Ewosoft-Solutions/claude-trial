import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { RegisterTenantDto, UpdateTenantDto } from '../dto';
import {
  JWTSecretService,
  SystemRole,
  PlatformRole,
  TenantStatus,
  canRegisterTenant,
  isPlatformAdminRole,
} from '@workspace/api';
import { TenantAuditService } from './tenant-audit.service';
import { DatabaseService } from '../../common/database/database.service';
import { AUDIT_ACTION, AUDIT_EVENT } from '../../common/audit/audit.constants';
import * as bcrypt from 'bcrypt';

/**
 * Tenant Registration Service
 *
 * Handles school registration by platform admins or school owners.
 * Automatically generates JWT secrets and sets up initial configuration.
 */
@Injectable()
export class TenantRegistrationService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly auditService: TenantAuditService,
  ) {}

  /**
   * Register a new school (tenant)
   *
   * 6.1: Implement school registration (platform admin or school owner)
   * 6.2: Implement school-specific JWT secret auto-generation (platform admin only)
   *
   * @param data - Registration data
   * @param createdBy - User ID of the creator (must be platform admin or school owner)
   * @param requesterRole - Role of the requester
   * @returns Created tenant
   */
  async registerTenant(
    data: RegisterTenantDto,
    createdBy: string,
    requesterRole: string,
  ) {
    // `requesterRole` arrives from the request context as the role's UUID
    // (userContext.roleId), but canRegisterTenant/isPlatformAdminRole compare
    // against role *names* (e.g. 'Architect'). Resolve the id to a name so the
    // authorization check works. Falls back to the raw value when a name is
    // passed directly (or the id is unknown), preserving prior behaviour.
    const resolvedRole = await this.dbService.client.role.findUnique({
      where: { id: requesterRole },
      select: { name: true },
    });
    const requesterRoleName = resolvedRole?.name ?? requesterRole;

    // Validate requester has permission (platform admin or school owner)
    if (!canRegisterTenant(requesterRoleName)) {
      throw new BadRequestException(
        'Only platform admins or school owners can register schools',
      );
    }

    // Check if slug is already taken
    if (data.slug) {
      const existingSlug = await this.dbService.client.tenant.findUnique({
        where: { slug: data.slug },
        select: { id: true },
      });

      if (existingSlug) {
        throw new ConflictException('Slug is already taken');
      }
    }

    // Generate slug from name if not provided
    const slug = data.slug || this.generateSlug(data.name);

    // Check if generated slug is available
    const existingGeneratedSlug = await this.dbService.client.tenant.findUnique(
      {
        where: { slug },
        select: { id: true },
      },
    );

    if (existingGeneratedSlug) {
      throw new ConflictException(
        'Generated slug is already taken. Please provide a custom slug.',
      );
    }

    // Create tenant
    const tenant = await this.dbService.client.tenant.create({
      data: {
        name: data.name,
        slug,
        emailDomain: data.emailDomain?.toLowerCase(),
        schoolType: data.schoolType,
        status: TenantStatus.PENDING, // Start as pending, activate after onboarding
        settings: data.settings || {},
        createdBy,
      },
    });

    // 6.2: Auto-generate JWT secret (platform admin only)
    // Only platform admins can trigger secret generation
    if (isPlatformAdminRole(requesterRoleName)) {
      await JWTSecretService.initializeTenantJWTSecret(
        this.dbService.client,
        tenant.id,
      );
    }

    // Audit log
    await this.auditService.logTenantAction({
      action: AUDIT_ACTION.TENANT_LIFECYCLE.TENANT_REGISTERED,
      tenantId: tenant.id,
      userId: createdBy,
      eventType: AUDIT_EVENT.AUTHORIZATION,
      metadata: {
        name: tenant.name,
        slug: tenant.slug,
        emailDomain: tenant.emailDomain,
      },
    });

    return tenant;
  }

  /**
   * Update tenant information
   *
   * @param tenantId - Tenant ID
   * @param data - Update data
   * @param updatedBy - User ID of the updater
   * @returns Updated tenant
   */
  async updateTenant(
    tenantId: string,
    data: UpdateTenantDto,
    updatedBy: string,
  ) {
    // Check if tenant exists
    const existing = await this.dbService.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true },
    });

    if (!existing) {
      throw new BadRequestException('Tenant not found');
    }

    // Check if slug is being changed and is available
    if (data.slug && data.slug !== existing.slug) {
      const slugTaken = await this.dbService.client.tenant.findUnique({
        where: { slug: data.slug },
        select: { id: true },
      });

      if (slugTaken) {
        throw new ConflictException('Slug is already taken');
      }
    }

    // Update tenant
    const tenant = await this.dbService.client.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.name,
        slug: data.slug,
        emailDomain: data.emailDomain?.toLowerCase(),
        settings: data.settings,
      },
    });

    // Audit log
    await this.auditService.logTenantAction({
      action: AUDIT_ACTION.TENANT_LIFECYCLE.TENANT_UPDATED,
      tenantId: tenant.id,
      userId: updatedBy,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      metadata: {
        changes: data,
      },
    });

    return tenant;
  }

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replaceAll(/[^\w\s-]/g, '') // Remove special characters
      .replaceAll(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replaceAll(/(^-+|-+$)/g, ''); // Remove leading/trailing hyphens
  }
}
