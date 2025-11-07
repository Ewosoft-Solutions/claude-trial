import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { JWTSecretService, isPlatformAdminRole } from '@workspace/api';
import { TenantAuditService } from './tenant-audit.service';

/**
 * JWT Secret Rotation Service
 *
 * Handles JWT secret rotation (scheduled and emergency).
 * 6.12: Implement secret rotation (scheduled 90-180 days + emergency)
 * 6.13: Implement secret access controls (platform admin only, schools cannot access)
 */
@Injectable()
export class JWTSecretRotationService {
  constructor(private readonly auditService: TenantAuditService) {}

  /**
   * Rotate JWT secret (manual or emergency)
   *
   * 6.12: Implement secret rotation (scheduled 90-180 days + emergency)
   * 6.13: Implement secret access controls (platform admin only, schools cannot access)
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param requesterRole - Role of the requester (must be platform admin)
   * @param options - Rotation options
   * @returns Rotation result
   */
  async rotateSecret(
    prisma: PrismaClient,
    tenantId: string,
    requesterRole: string,
    options: {
      reason: 'scheduled' | 'emergency' | 'breach_response' | 'manual';
      emergency?: boolean;
    },
  ) {
    // 6.13: Only platform admins can rotate secrets
    if (!isPlatformAdminRole(requesterRole)) {
      throw new ForbiddenException(
        'Only platform admins can rotate JWT secrets',
      );
    }

    // Rotate secret
    const success = await JWTSecretService.rotateTenantJWTSecret(
      prisma,
      tenantId,
      requesterRole,
      options,
    );

    if (!success) {
      throw new BadRequestException('Failed to rotate JWT secret');
    }

    // Audit log
    await this.auditService.logTenantAction(prisma, {
      action: 'jwt_secret_rotated',
      tenantId,
      userId: 'system', // Can be updated to actual user ID from context
      metadata: {
        reason: options.reason,
        emergency: options.emergency || false,
      },
    });

    return {
      success: true,
      message: 'JWT secret rotated successfully',
    };
  }

  /**
   * Emergency secret rotation
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param requesterRole - Role of the requester (must be platform admin)
   * @returns Rotation result
   */
  async emergencyRotateSecret(
    prisma: PrismaClient,
    tenantId: string,
    requesterRole: string,
  ) {
    return this.rotateSecret(prisma, tenantId, requesterRole, {
      reason: 'emergency',
      emergency: true,
    });
  }

  /**
   * Schedule secret rotation (to be called by cron job)
   *
   * Rotates secrets that are due for rotation (90-180 days old).
   *
   * @param prisma - Prisma client instance
   * @param maxAgeDays - Maximum age in days before rotation (default: 180)
   * @returns Number of secrets rotated
   */
  async scheduleSecretRotation(prisma: PrismaClient, maxAgeDays: number = 180) {
    const rotatedCount = await JWTSecretService.scheduleSecretRotation(
      prisma,
      maxAgeDays,
    );

    // Audit log
    await this.auditService.logTenantAction(prisma, {
      action: 'jwt_secret_scheduled_rotation',
      tenantId: 'system', // System-wide operation
      userId: 'system',
      metadata: {
        rotatedCount,
        maxAgeDays,
      },
    });

    return {
      rotatedCount,
      message: `Rotated ${rotatedCount} JWT secrets`,
    };
  }

  /**
   * Get secret rotation status
   *
   * 6.13: Only platform admins can access secret information
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param requesterRole - Role of the requester (must be platform admin)
   * @returns Secret rotation status
   */
  async getSecretRotationStatus(
    prisma: PrismaClient,
    tenantId: string,
    requesterRole: string,
  ) {
    // 6.13: Only platform admins can access secret information
    if (!isPlatformAdminRole(requesterRole)) {
      throw new ForbiddenException(
        'Only platform admins can access JWT secret information',
      );
    }

    const rotationDate = await JWTSecretService.getSecretRotationDate(
      prisma,
      tenantId,
    );

    if (!rotationDate) {
      throw new BadRequestException(
        'JWT secret not configured for this tenant',
      );
    }

    const daysSinceRotation = Math.floor(
      (Date.now() - rotationDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      lastRotationDate: rotationDate,
      daysSinceRotation,
      recommendedRotation: daysSinceRotation >= 90,
      urgentRotation: daysSinceRotation >= 180,
    };
  }
}
