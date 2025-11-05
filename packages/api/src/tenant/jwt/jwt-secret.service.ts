/**
 * JWT Secret Service
 *
 * Service for managing school-specific JWT secrets.
 * Handles secret generation, rotation, and access control.
 * Only platform admins can access secrets - schools cannot access their own secrets.
 */

import { PrismaClient } from '@workspace/database';
import * as crypto from 'crypto';

/**
 * JWT Secret Service
 *
 * Manages school-specific JWT secrets with automatic generation,
 * rotation, and strict access control.
 */
export class JWTSecretService {
  /**
   * Generate a secure random secret
   *
   * @returns 256-bit random secret (base64 encoded)
   */
  private static generateSecureSecret(): string {
    // Generate 256-bit (32 bytes) random secret
    const secret = crypto.randomBytes(32);
    return secret.toString('base64');
  }

  /**
   * Encrypt secret for storage
   *
   * In production, use proper encryption (AES-256-GCM).
   * This is a placeholder - implement proper encryption.
   *
   * @param secret - Plain text secret
   * @returns Encrypted secret
   */
  private static async encryptSecret(secret: string): Promise<string> {
    // TODO: Implement proper encryption (AES-256-GCM)
    // For now, return base64 encoded (NOT secure for production)
    // In production, use environment variable or key management service
    return Buffer.from(secret).toString('base64');
  }

  /**
   * Decrypt secret from storage
   *
   * @param encryptedSecret - Encrypted secret
   * @returns Decrypted secret
   */
  private static async decryptSecret(encryptedSecret: string): Promise<string> {
    // TODO: Implement proper decryption
    // For now, decode base64 (NOT secure for production)
    return Buffer.from(encryptedSecret, 'base64').toString('utf-8');
  }

  /**
   * Initialize JWT secret for a tenant
   *
   * Automatically generates a secret when a school is created.
   * This is called during tenant creation.
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @returns True if initialization was successful
   */
  static async initializeTenantJWTSecret(
    prisma: PrismaClient,
    tenantId: string,
  ): Promise<boolean> {
    try {
      // Check if secret already exists
      const existing = await prisma.tenantJWTConfig.findUnique({
        where: { tenantId },
      });

      if (existing) {
        return true; // Already initialized
      }

      // Generate secure secret
      const secret = this.generateSecureSecret();
      const encryptedSecret = await this.encryptSecret(secret);

      // Create JWT config
      await prisma.tenantJWTConfig.create({
        data: {
          tenantId,
          jwtSecret: encryptedSecret,
          secretSource: 'auto_generated',
          secretRotationDate: new Date(),
          previousSecrets: [],
          managedBy: 'platform_admin',
          accessibleBySchools: false,
        },
      });

      return true;
    } catch {
      console.error('Failed to initialize JWT secret');
      return false;
    }
  }

  /**
   * Get JWT secret for a tenant (Platform Admin Only)
   *
   * Only platform admins (Architect, SuperAdmin) can access secrets.
   * Schools cannot access their own secrets.
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param requesterRole - Role of the requester (must be platform admin)
   * @returns Decrypted JWT secret
   * @throws Error if requester is not authorized
   */
  static async getTenantJWTSecret(
    prisma: PrismaClient,
    tenantId: string,
    requesterRole: string,
  ): Promise<string> {
    // Only platform admins can access secrets
    if (
      requesterRole !== 'Architect' &&
      requesterRole !== 'SuperAdmin' &&
      requesterRole !== 'platform_admin'
    ) {
      throw new Error(
        'Unauthorized: Only platform admins can access JWT secrets',
      );
    }

    const config = await prisma.tenantJWTConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      throw new Error('JWT secret not configured for this tenant');
    }

    // Decrypt and return secret
    return await this.decryptSecret(config.jwtSecret as string);
  }

  /**
   * Get JWT secret (internal use - no role check)
   *
   * Used internally by the system for token generation/validation.
   * No authorization check - system operation only.
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @returns Decrypted JWT secret
   */
  static async getTenantJWTSecretInternal(
    prisma: PrismaClient,
    tenantId: string,
  ): Promise<string> {
    const config = await prisma.tenantJWTConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      throw new Error('JWT secret not configured for this tenant');
    }

    return await this.decryptSecret(config.jwtSecret as string);
  }

  /**
   * Rotate JWT secret (Scheduled or Emergency)
   *
   * Rotates the JWT secret for a tenant, keeping previous secrets
   * for graceful rotation (last 2 secrets).
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param requesterRole - Role of the requester (must be platform admin)
   * @param options - Rotation options
   * @returns True if rotation was successful
   */
  static async rotateTenantJWTSecret(
    prisma: PrismaClient,
    tenantId: string,
    requesterRole: string,
    options: {
      reason: 'scheduled' | 'emergency' | 'breach_response' | 'manual';
      emergency?: boolean;
    },
  ): Promise<boolean> {
    // Only platform admins can rotate secrets
    if (
      requesterRole !== 'Architect' &&
      requesterRole !== 'SuperAdmin' &&
      requesterRole !== 'platform_admin'
    ) {
      throw new Error(
        'Unauthorized: Only platform admins can rotate JWT secrets',
      );
    }

    try {
      const config = await prisma.tenantJWTConfig.findUnique({
        where: { tenantId },
      });

      if (!config) {
        throw new Error('JWT secret not configured for this tenant');
      }

      // Generate new secret
      const newSecret = this.generateSecureSecret();
      const encryptedNewSecret = await this.encryptSecret(newSecret);

      // Get previous secrets (keep last 2 for graceful rotation)
      const previousSecrets = (config.previousSecrets as string[]) || [];
      const updatedPreviousSecrets = [
        config.jwtSecret, // Current secret becomes previous
        ...previousSecrets.slice(0, 1), // Keep only last one from previous
      ];

      // Update config with new secret
      await prisma.tenantJWTConfig.update({
        where: { tenantId },
        data: {
          jwtSecret: encryptedNewSecret,
          previousSecrets: updatedPreviousSecrets,
          secretRotationDate: new Date(),
          rotationReason: options.reason,
          emergencyRotation: options.emergency || false,
        },
      });

      return true;
    } catch {
      console.error('Failed to rotate JWT secret');
      return false;
    }
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
  static async scheduleSecretRotation(
    prisma: PrismaClient,
    maxAgeDays: number = 180,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const configsToRotate = await prisma.tenantJWTConfig.findMany({
      where: {
        secretRotationDate: {
          lt: cutoffDate,
        },
        emergencyRotation: false, // Don't rotate emergency-rotated secrets again
      },
    });

    let rotatedCount = 0;

    for (const config of configsToRotate) {
      // Use system role for scheduled rotation
      const success = await this.rotateTenantJWTSecret(
        prisma,
        config.tenantId as string,
        'platform_admin', // System operation
        {
          reason: 'scheduled',
          emergency: false,
        },
      );

      if (success) {
        rotatedCount++;
      }
    }

    return rotatedCount;
  }

  /**
   * Emergency secret rotation
   *
   * Immediately rotates secret for security breach response.
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param requesterRole - Role of the requester (must be platform admin)
   * @returns True if rotation was successful
   */
  static async emergencyRotateSecret(
    prisma: PrismaClient,
    tenantId: string,
    requesterRole: string,
  ): Promise<boolean> {
    return this.rotateTenantJWTSecret(prisma, tenantId, requesterRole, {
      reason: 'emergency',
      emergency: true,
    });
  }

  /**
   * Check if secret exists for tenant
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @returns True if secret exists
   */
  static async hasSecret(
    prisma: PrismaClient,
    tenantId: string,
  ): Promise<boolean> {
    const config = await prisma.tenantJWTConfig.findUnique({
      where: { tenantId },
      select: { id: true },
    });

    return !!config;
  }

  /**
   * Get secret rotation date
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @returns Secret rotation date or null
   */
  static async getSecretRotationDate(
    prisma: PrismaClient,
    tenantId: string,
  ): Promise<Date | null> {
    const config = await prisma.tenantJWTConfig.findUnique({
      where: { tenantId },
      select: { secretRotationDate: true },
    });

    return config?.secretRotationDate || null;
  }
}
