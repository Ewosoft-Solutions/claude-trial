import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { RegisterTenantDto, UpdateTenantDto } from '../dto';
import { JWTSecretService } from '@workspace/api';
import { TenantAuditService } from './tenant-audit.service';
import * as bcrypt from 'bcrypt';

/**
 * Tenant Registration Service
 *
 * Handles school registration by platform admins or school owners.
 * Automatically generates JWT secrets and sets up initial configuration.
 */
@Injectable()
export class TenantRegistrationService {
  constructor(private readonly auditService: TenantAuditService) {}

  /**
   * Register a new school (tenant)
   *
   * 6.1: Implement school registration (platform admin or school owner)
   * 6.2: Implement school-specific JWT secret auto-generation (platform admin only)
   *
   * @param prisma - Prisma client instance
   * @param data - Registration data
   * @param createdBy - User ID of the creator (must be platform admin or school owner)
   * @param requesterRole - Role of the requester
   * @returns Created tenant
   */
  async registerTenant(
    prisma: PrismaClient,
    data: RegisterTenantDto,
    createdBy: string,
    requesterRole: string,
  ) {
    // Validate requester has permission (platform admin or school owner)
    if (
      requesterRole !== 'Architect' &&
      requesterRole !== 'SuperAdmin' &&
      requesterRole !== 'Owner'
    ) {
      throw new BadRequestException(
        'Only platform admins or school owners can register schools',
      );
    }

    // Check if slug is already taken
    if (data.slug) {
      const existingSlug = await prisma.tenant.findUnique({
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
    const existingGeneratedSlug = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingGeneratedSlug) {
      throw new ConflictException(
        'Generated slug is already taken. Please provide a custom slug.',
      );
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        slug,
        emailDomain: data.emailDomain?.toLowerCase(),
        status: 'pending', // Start as pending, activate after onboarding
        settings: data.settings || {},
        createdBy,
      },
    });

    // 6.2: Auto-generate JWT secret (platform admin only)
    // Only platform admins can trigger secret generation
    if (
      requesterRole === 'Architect' ||
      requesterRole === 'SuperAdmin' ||
      requesterRole === 'platform_admin'
    ) {
      await JWTSecretService.initializeTenantJWTSecret(prisma, tenant.id);
    }

    // Audit log
    await this.auditService.logTenantAction(prisma, {
      action: 'tenant_registered',
      tenantId: tenant.id,
      userId: createdBy,
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
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param data - Update data
   * @param updatedBy - User ID of the updater
   * @returns Updated tenant
   */
  async updateTenant(
    prisma: PrismaClient,
    tenantId: string,
    data: UpdateTenantDto,
    updatedBy: string,
  ) {
    // Check if tenant exists
    const existing = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true },
    });

    if (!existing) {
      throw new BadRequestException('Tenant not found');
    }

    // Check if slug is being changed and is available
    if (data.slug && data.slug !== existing.slug) {
      const slugTaken = await prisma.tenant.findUnique({
        where: { slug: data.slug },
        select: { id: true },
      });

      if (slugTaken) {
        throw new ConflictException('Slug is already taken');
      }
    }

    // Update tenant
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.name,
        slug: data.slug,
        emailDomain: data.emailDomain?.toLowerCase(),
        settings: data.settings,
      },
    });

    // Audit log
    await this.auditService.logTenantAction(prisma, {
      action: 'tenant_updated',
      tenantId: tenant.id,
      userId: updatedBy,
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
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }
}
