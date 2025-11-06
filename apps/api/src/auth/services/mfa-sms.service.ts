/**
 * MFA SMS Service
 *
 * Handles SMS-based MFA (3a.1).
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { MfaBaseService } from './mfa-base.service';

/**
 * SMS MFA Service
 *
 * Provides SMS-based MFA functionality.
 */
@Injectable()
export class MfaSmsService {
  /**
   * Generate and send SMS verification code
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param phoneNumber - Phone number to send code to
   * @param operation - Operation type
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   * @returns Challenge ID and expiration time
   */
  async sendVerificationCode(
    prisma: PrismaClient,
    userId: string,
    phoneNumber: string,
    operation: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ challengeId: string; expiresAt: Date }> {
    // Generate verification code
    const code = MfaBaseService.generateVerificationCode(6);
    const codeHash = await MfaBaseService.hashCode(code);

    // Set expiration (5 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Create challenge
    const challenge = await prisma.mfaChallenge.create({
      data: {
        userId,
        type: 'sms',
        code: codeHash,
        codeExpiresAt: expiresAt,
        operation,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    // TODO: Integrate with SMS service provider (Twilio, AWS SNS, etc.)
    // For now, this is a placeholder
    // await this.sendSms(phoneNumber, code);

    // In production, log the code for testing purposes (remove in production)
    console.log(`[MFA SMS] Code for ${phoneNumber}: ${code}`);

    return {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
    };
  }

  /**
   * Verify SMS code
   *
   * @param prisma - Prisma client instance
   * @param challengeId - Challenge ID
   * @param code - Verification code
   * @returns True if code is valid
   */
  async verifyCode(
    prisma: PrismaClient,
    challengeId: string,
    code: string,
  ): Promise<boolean> {
    // Find challenge
    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      return false;
    }

    // Check if challenge is expired
    if (new Date() > challenge.expiresAt) {
      return false;
    }

    // Check if challenge is already verified
    if (challenge.verified) {
      return false;
    }

    // Check if code is expired (for SMS/Email codes)
    if (challenge.codeExpiresAt && new Date() > challenge.codeExpiresAt) {
      return false;
    }

    // Verify code
    if (!challenge.code) {
      return false;
    }

    const isValid = await MfaBaseService.compareCode(code, challenge.code);

    if (isValid) {
      // Mark challenge as verified
      await prisma.mfaChallenge.update({
        where: { id: challengeId },
        data: {
          verified: true,
          verifiedAt: new Date(),
        },
      });
    }

    return isValid;
  }

  /**
   * Setup SMS MFA method
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param phoneNumber - Phone number
   * @param name - Method name (optional)
   * @returns MFA method ID
   */
  async setupMethod(
    prisma: PrismaClient,
    userId: string,
    phoneNumber: string,
    name?: string,
  ): Promise<string> {
    // Create MFA method
    const method = await prisma.mfaMethod.create({
      data: {
        userId,
        type: 'sms',
        name: name || `SMS (${phoneNumber.slice(-4)})`,
        phoneNumber,
        isActive: false, // Not active until verified
      },
    });

    return method.id;
  }

  /**
   * Verify and activate SMS MFA method
   *
   * @param prisma - Prisma client instance
   * @param methodId - MFA method ID
   * @param code - Verification code
   * @returns True if verification successful
   */
  async verifyAndActivateMethod(
    prisma: PrismaClient,
    methodId: string,
    code: string,
  ): Promise<boolean> {
    // Find method
    const method = await prisma.mfaMethod.findUnique({
      where: { id: methodId },
    });

    if (!method || method.type !== 'sms') {
      return false;
    }

    // Find active challenge for this method
    const challenge = await prisma.mfaChallenge.findFirst({
      where: {
        userId: method.userId,
        mfaMethodId: methodId,
        type: 'sms',
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!challenge || !challenge.code) {
      return false;
    }

    // Verify code
    const isValid = await MfaBaseService.compareCode(code, challenge.code);

    if (isValid) {
      // Activate method
      await prisma.mfaMethod.update({
        where: { id: methodId },
        data: {
          isActive: true,
          verifiedAt: new Date(),
        },
      });

      // Mark challenge as verified
      await prisma.mfaChallenge.update({
        where: { id: challenge.id },
        data: {
          verified: true,
          verifiedAt: new Date(),
        },
      });
    }

    return isValid;
  }

  /**
   * Send SMS (placeholder - integrate with SMS provider)
   *
   * @param phoneNumber - Phone number
   * @param code - Verification code
   */
  private async sendSms(phoneNumber: string, code: string): Promise<void> {
    // TODO: Integrate with SMS service provider
    // Example: Twilio, AWS SNS, etc.
    // await smsProvider.send(phoneNumber, `Your verification code is: ${code}`);
  }
}
