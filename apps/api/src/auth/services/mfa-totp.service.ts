/**
 * MFA TOTP Service
 *
 * Handles TOTP-based MFA (Google Authenticator, Microsoft Authenticator) (3a.3).
 */

import { Injectable } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { PrismaClient } from '@workspace/database';
import { MfaBaseService } from './mfa-base.service';

/**
 * TOTP MFA Service
 *
 * Provides TOTP-based MFA functionality.
 */
@Injectable()
export class MfaTotpService {
  /**
   * Generate TOTP secret and QR code
   *
   * @param userId - User ID
   * @param userEmail - User email
   * @param issuer - Issuer name (e.g., "School Management System")
   * @returns Secret, QR code URL, and manual entry key
   */
  async generateSecret(
    userId: string,
    userEmail: string,
    issuer: string = 'School Management System',
  ): Promise<{
    secret: string;
    qrCodeUrl: string;
    manualEntryKey: string;
  }> {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${issuer} (${userEmail})`,
      issuer,
      length: 32,
    });

    // Generate QR code URL
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '');

    return {
      secret: secret.base32 || '',
      qrCodeUrl,
      manualEntryKey: secret.base32 || '',
    };
  }

  /**
   * Verify TOTP token
   *
   * @param secret - TOTP secret (base32)
   * @param token - TOTP token from authenticator app
   * @param window - Time window for verification (default: 1)
   * @returns True if token is valid
   */
  verifyToken(secret: string, token: string, window: number = 1): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window,
    });
  }

  /**
   * Setup TOTP MFA method
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param userEmail - User email
   * @param secret - TOTP secret (encrypted)
   * @param name - Method name (optional)
   * @param issuer - Issuer name (optional)
   * @returns MFA method ID and QR code URL
   */
  async setupMethod(
    prisma: PrismaClient,
    userId: string,
    userEmail: string,
    secret: string,
    name?: string,
    issuer: string = 'School Management System',
  ): Promise<{ methodId: string; qrCodeUrl: string; manualEntryKey: string }> {
    // Generate QR code URL for display
    const otpauthUrl = speakeasy.otpauthURL({
      secret,
      label: `${issuer} (${userEmail})`,
      issuer,
      encoding: 'base32',
    });

    const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);

    // Create MFA method (secret is already encrypted by caller)
    const method = await prisma.mfaMethod.create({
      data: {
        userId,
        type: 'totp',
        name: name || 'Authenticator App',
        secret, // Encrypted secret
        isActive: false, // Not active until verified
      },
    });

    return {
      methodId: method.id,
      qrCodeUrl,
      manualEntryKey: secret,
    };
  }

  /**
   * Verify and activate TOTP MFA method
   *
   * @param prisma - Prisma client instance
   * @param methodId - MFA method ID
   * @param token - TOTP token from authenticator app
   * @param secret - Decrypted secret (for verification)
   * @returns True if verification successful
   */
  async verifyAndActivateMethod(
    prisma: PrismaClient,
    methodId: string,
    token: string,
    secret: string,
  ): Promise<boolean> {
    // Find method
    const method = await prisma.mfaMethod.findUnique({
      where: { id: methodId },
    });

    if (!method || method.type !== 'totp' || !method.secret) {
      return false;
    }

    // Verify token
    // Note: In production, decrypt method.secret before verification
    // For now, assuming secret is passed in (decrypted)
    const isValid = this.verifyToken(secret, token);

    if (isValid) {
      // Activate method
      await prisma.mfaMethod.update({
        where: { id: methodId },
        data: {
          isActive: true,
          verifiedAt: new Date(),
        },
      });
    }

    return isValid;
  }

  /**
   * Verify TOTP token for authentication
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param methodId - MFA method ID
   * @param token - TOTP token from authenticator app
   * @returns True if token is valid
   */
  async verifyTokenForAuth(
    prisma: PrismaClient,
    userId: string,
    methodId: string,
    token: string,
  ): Promise<boolean> {
    // Find method
    const method = await prisma.mfaMethod.findUnique({
      where: {
        id: methodId,
        userId,
        type: 'totp',
        isActive: true,
      },
    });

    if (!method || !method.secret) {
      return false;
    }

    // TODO: Decrypt secret before verification
    // For now, assuming secret is stored in plain text (NOT RECOMMENDED FOR PRODUCTION)
    // In production, use encryption service to decrypt method.secret
    const secret = method.secret;

    // Verify token
    const isValid = this.verifyToken(secret, token);

    if (isValid) {
      // Update last used timestamp
      await prisma.mfaMethod.update({
        where: { id: methodId },
        data: {
          lastUsedAt: new Date(),
        },
      });
    }

    return isValid;
  }
}
