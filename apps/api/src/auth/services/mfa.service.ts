/**
 * MFA Service
 *
 * Main service that orchestrates all MFA methods and operations.
 * Implements items 3a.5, 3a.6, 3a.7, 3a.8.
 */

import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import {
  MfaBaseService,
  MfaMethodType,
  MfaOperationType,
} from './mfa-base.service';
import { MfaSmsService } from './mfa-sms.service';
import { MfaEmailService } from './mfa-email.service';
import { MfaTotpService } from './mfa-totp.service';
import { MfaWebAuthnService } from './mfa-webauthn.service';

/**
 * MFA Service
 *
 * Provides unified MFA functionality across all methods.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly smsService: MfaSmsService,
    private readonly emailService: MfaEmailService,
    private readonly totpService: MfaTotpService,
    private readonly webauthnService: MfaWebAuthnService,
  ) {}

  /**
   * Check if user has active MFA methods
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @returns True if user has active MFA methods
   */
  async hasActiveMfaMethods(
    prisma: PrismaClient,
    userId: string,
  ): Promise<boolean> {
    return MfaBaseService.hasActiveMfaMethods(prisma, userId);
  }

  /**
   * Get user's active MFA methods
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @returns List of active MFA methods
   */
  async getActiveMfaMethods(prisma: PrismaClient, userId: string) {
    return MfaBaseService.getActiveMfaMethods(prisma, userId);
  }

  /**
   * Get user's primary MFA method
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @returns Primary MFA method or null
   */
  async getPrimaryMfaMethod(prisma: PrismaClient, userId: string) {
    return MfaBaseService.getPrimaryMfaMethod(prisma, userId);
  }

  /**
   * Setup SMS MFA method (3a.5)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param phoneNumber - Phone number
   * @param name - Method name (optional)
   * @returns MFA method ID
   */
  async setupSmsMethod(
    prisma: PrismaClient,
    userId: string,
    phoneNumber: string,
    name?: string,
  ): Promise<string> {
    return this.smsService.setupMethod(prisma, userId, phoneNumber, name);
  }

  /**
   * Setup Email MFA method (3a.5)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param emailAddress - Email address
   * @param name - Method name (optional)
   * @returns MFA method ID
   */
  async setupEmailMethod(
    prisma: PrismaClient,
    userId: string,
    emailAddress: string,
    name?: string,
  ): Promise<string> {
    return this.emailService.setupMethod(prisma, userId, emailAddress, name);
  }

  /**
   * Setup TOTP MFA method (3a.5)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param userEmail - User email
   * @param name - Method name (optional)
   * @param issuer - Issuer name (optional)
   * @returns MFA method ID, QR code URL, and manual entry key
   */
  async setupTotpMethod(
    prisma: PrismaClient,
    userId: string,
    userEmail: string,
    name?: string,
    issuer?: string,
  ): Promise<{ methodId: string; qrCodeUrl: string; manualEntryKey: string }> {
    // Generate secret
    const { secret, qrCodeUrl, manualEntryKey } =
      await this.totpService.generateSecret(userId, userEmail, issuer);

    // TODO: Encrypt secret before storing
    // For now, storing as plain text (NOT RECOMMENDED FOR PRODUCTION)
    const encryptedSecret = secret;

    // Setup method
    const result = await this.totpService.setupMethod(
      prisma,
      userId,
      userEmail,
      encryptedSecret,
      name,
      issuer,
    );

    return {
      methodId: result.methodId,
      qrCodeUrl: result.qrCodeUrl,
      manualEntryKey: result.manualEntryKey,
    };
  }

  /**
   * Setup WebAuthn MFA method (3a.5)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param userName - User name (email)
   * @param userDisplayName - User display name
   * @returns Registration options
   */
  async setupWebAuthnMethod(
    prisma: PrismaClient,
    userId: string,
    userName: string,
    userDisplayName: string,
  ) {
    return this.webauthnService.generateRegistrationOptions(
      prisma,
      userId,
      userName,
      userDisplayName,
    );
  }

  /**
   * Verify and activate SMS MFA method (3a.5)
   *
   * @param prisma - Prisma client instance
   * @param methodId - MFA method ID
   * @param code - Verification code
   * @returns True if verification successful
   */
  async verifyAndActivateSmsMethod(
    prisma: PrismaClient,
    methodId: string,
    code: string,
  ): Promise<boolean> {
    return this.smsService.verifyAndActivateMethod(prisma, methodId, code);
  }

  /**
   * Verify and activate Email MFA method (3a.5)
   *
   * @param prisma - Prisma client instance
   * @param methodId - MFA method ID
   * @param code - Verification code
   * @returns True if verification successful
   */
  async verifyAndActivateEmailMethod(
    prisma: PrismaClient,
    methodId: string,
    code: string,
  ): Promise<boolean> {
    return this.emailService.verifyAndActivateMethod(prisma, methodId, code);
  }

  /**
   * Verify and activate TOTP MFA method (3a.5)
   *
   * @param prisma - Prisma client instance
   * @param methodId - MFA method ID
   * @param token - TOTP token
   * @returns True if verification successful
   */
  async verifyAndActivateTotpMethod(
    prisma: PrismaClient,
    methodId: string,
    token: string,
  ): Promise<boolean> {
    // Get method to retrieve secret
    const method = await prisma.mfaMethod.findUnique({
      where: { id: methodId },
    });

    if (!method || !method.secret) {
      return false;
    }

    // TODO: Decrypt secret before verification
    // For now, assuming secret is stored as plain text (NOT RECOMMENDED FOR PRODUCTION)
    const secret = method.secret;

    return this.totpService.verifyAndActivateMethod(
      prisma,
      methodId,
      token,
      secret,
    );
  }

  /**
   * Verify and activate WebAuthn MFA method (3a.5)
   *
   * @param prisma - Prisma client instance
   * @param challengeId - Challenge ID
   * @param registrationResponse - Registration response
   * @param name - Credential name (optional)
   * @returns MFA method ID
   */
  async verifyAndActivateWebAuthnMethod(
    prisma: PrismaClient,
    challengeId: string,
    registrationResponse: any,
    name?: string,
  ): Promise<string> {
    return this.webauthnService.verifyRegistration(
      prisma,
      challengeId,
      registrationResponse,
      name,
    );
  }

  /**
   * Initiate MFA verification (3a.6)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param methodId - MFA method ID (optional, uses primary if not provided)
   * @param operation - Operation type
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   * @returns Challenge ID and method details
   */
  async initiateVerification(
    prisma: PrismaClient,
    userId: string,
    methodId: string | null,
    operation: MfaOperationType,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    challengeId: string;
    methodType: MfaMethodType;
    expiresAt: Date;
    qrCodeUrl?: string; // For TOTP
    webauthnOptions?: any; // For WebAuthn
  }> {
    // Get method (use primary if methodId not provided)
    let method;
    if (methodId) {
      method = await prisma.mfaMethod.findUnique({
        where: {
          id: methodId,
          userId,
          isActive: true,
        },
      });
    } else {
      method = await MfaBaseService.getPrimaryMfaMethod(prisma, userId);
    }

    if (!method) {
      throw new BadRequestException('No active MFA method found');
    }

    // Initiate verification based on method type
    switch (method.type) {
      case 'sms': {
        if (!method.phoneNumber) {
          throw new BadRequestException('Phone number not configured');
        }
        const result = await this.smsService.sendVerificationCode(
          prisma,
          userId,
          method.phoneNumber,
          operation,
          ipAddress,
          userAgent,
        );
        return {
          challengeId: result.challengeId,
          methodType: 'sms',
          expiresAt: result.expiresAt,
        };
      }

      case 'email': {
        const emailAddress =
          method.emailAddress ||
          (
            await prisma.user.findUnique({
              where: { id: userId },
              select: { email: true },
            })
          )?.email;

        if (!emailAddress) {
          throw new BadRequestException('Email address not configured');
        }

        const result = await this.emailService.sendVerificationCode(
          prisma,
          userId,
          emailAddress,
          operation,
          ipAddress,
          userAgent,
        );
        return {
          challengeId: result.challengeId,
          methodType: 'email',
          expiresAt: result.expiresAt,
        };
      }

      case 'totp': {
        // For TOTP, user enters code from authenticator app
        // No challenge needed, but we create one for tracking
        const challenge = await prisma.mfaChallenge.create({
          data: {
            userId,
            mfaMethodId: method.id,
            type: 'totp',
            operation,
            ipAddress,
            userAgent,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          },
        });

        return {
          challengeId: challenge.id,
          methodType: 'totp',
          expiresAt: challenge.expiresAt,
        };
      }

      case 'webauthn': {
        const options =
          await this.webauthnService.generateAuthenticationOptions(
            prisma,
            userId,
            operation,
          );
        return {
          challengeId: options.challengeId,
          methodType: 'webauthn',
          expiresAt: options.expiresAt || new Date(Date.now() + 60000),
          webauthnOptions: options,
        };
      }

      default:
        throw new BadRequestException('Unsupported MFA method type');
    }
  }

  /**
   * Verify MFA challenge (3a.6)
   *
   * @param prisma - Prisma client instance
   * @param challengeId - Challenge ID
   * @param code - Verification code (for SMS/Email/TOTP)
   * @param token - TOTP token (alternative to code for TOTP)
   * @param webauthnResponse - WebAuthn response (for WebAuthn)
   * @returns True if verification successful
   */
  async verifyChallenge(
    prisma: PrismaClient,
    challengeId: string,
    code?: string,
    token?: string,
    webauthnResponse?: any,
  ): Promise<boolean> {
    // Find challenge
    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: challengeId },
      include: {
        mfaMethod: true,
      },
    });

    if (!challenge) {
      return false;
    }

    if (new Date() > challenge.expiresAt) {
      return false;
    }

    if (challenge.verified) {
      return false;
    }

    // Verify based on challenge type
    switch (challenge.type) {
      case 'sms':
        if (!code) {
          return false;
        }
        return this.smsService.verifyCode(prisma, challengeId, code);

      case 'email':
        if (!code) {
          return false;
        }
        return this.emailService.verifyCode(prisma, challengeId, code);

      case 'totp': {
        const totpToken = token || code;
        if (!totpToken || !challenge.mfaMethodId) {
          return false;
        }

        const method = await prisma.mfaMethod.findUnique({
          where: { id: challenge.mfaMethodId },
        });

        if (!method || !method.secret) {
          return false;
        }

        // TODO: Decrypt secret before verification
        const secret = method.secret;

        const isValid = this.totpService.verifyToken(secret, totpToken);

        if (isValid) {
          await prisma.mfaChallenge.update({
            where: { id: challengeId },
            data: {
              verified: true,
              verifiedAt: new Date(),
            },
          });

          if (method) {
            await prisma.mfaMethod.update({
              where: { id: method.id },
              data: {
                lastUsedAt: new Date(),
              },
            });
          }
        }

        return isValid;
      }

      case 'webauthn':
        if (!webauthnResponse) {
          return false;
        }
        return this.webauthnService.verifyAuthentication(
          prisma,
          challengeId,
          webauthnResponse,
        );

      default:
        return false;
    }
  }

  /**
   * Generate recovery codes (3a.7, 3a.8)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param count - Number of codes to generate (default: 10)
   * @returns List of recovery codes (plain text - show to user once)
   */
  async generateRecoveryCodes(
    prisma: PrismaClient,
    userId: string,
    count: number = 10,
  ): Promise<string[]> {
    const codes: string[] = [];

    // Generate codes
    for (let i = 0; i < count; i++) {
      const code = MfaBaseService.generateRecoveryCode();
      const codeHash = await MfaBaseService.hashCode(code);

      await prisma.mfaRecoveryCode.create({
        data: {
          userId,
          code: codeHash,
        },
      });

      codes.push(code);
    }

    // Clean up old unused codes
    await MfaBaseService.cleanupOldRecoveryCodes(prisma, userId, 10);

    return codes;
  }

  /**
   * Verify recovery code (3a.8)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param code - Recovery code
   * @returns True if code is valid
   */
  async verifyRecoveryCode(
    prisma: PrismaClient,
    userId: string,
    code: string,
  ): Promise<boolean> {
    // Get all unused recovery codes for user
    const recoveryCodes = await prisma.mfaRecoveryCode.findMany({
      where: {
        userId,
        used: false,
      },
    });

    // Try to match code
    for (const recoveryCode of recoveryCodes) {
      const isValid = await MfaBaseService.compareCode(code, recoveryCode.code);

      if (isValid) {
        // Mark code as used
        await prisma.mfaRecoveryCode.update({
          where: { id: recoveryCode.id },
          data: {
            used: true,
            usedAt: new Date(),
          },
        });

        return true;
      }
    }

    return false;
  }

  /**
   * Set primary MFA method (3a.5)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param methodId - MFA method ID
   */
  async setPrimaryMethod(
    prisma: PrismaClient,
    userId: string,
    methodId: string,
  ): Promise<void> {
    await MfaBaseService.setPrimaryMfaMethod(prisma, userId, methodId);
  }

  /**
   * Disable MFA method
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param methodId - MFA method ID
   */
  async disableMethod(
    prisma: PrismaClient,
    userId: string,
    methodId: string,
  ): Promise<void> {
    await prisma.mfaMethod.update({
      where: {
        id: methodId,
        userId, // Ensure user owns this method
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Delete MFA method
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param methodId - MFA method ID
   */
  async deleteMethod(
    prisma: PrismaClient,
    userId: string,
    methodId: string,
  ): Promise<void> {
    // Check if this is the last active method
    const activeMethods = await MfaBaseService.getActiveMfaMethods(
      prisma,
      userId,
    );

    if (activeMethods.length === 1 && activeMethods[0].id === methodId) {
      throw new BadRequestException(
        'Cannot delete last active MFA method. Please add another method first.',
      );
    }

    await prisma.mfaMethod.delete({
      where: {
        id: methodId,
        userId, // Ensure user owns this method
      },
    });
  }
}
