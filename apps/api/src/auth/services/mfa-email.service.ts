/**
 * MFA Email Service
 *
 * Handles Email-based MFA (3a.2).
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { MfaBaseService } from './mfa-base.service';

/**
 * Email MFA Service
 *
 * Provides Email-based MFA functionality.
 */
@Injectable()
export class MfaEmailService {
  /**
   * Generate and send Email verification code
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param emailAddress - Email address to send code to
   * @param operation - Operation type
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   * @returns Challenge ID and expiration time
   */
  async sendVerificationCode(
    prisma: PrismaClient,
    userId: string,
    emailAddress: string,
    operation: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ challengeId: string; expiresAt: Date }> {
    // Generate verification code
    const code = MfaBaseService.generateVerificationCode(6);
    const codeHash = await MfaBaseService.hashCode(code);

    // Set expiration (10 minutes for email)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Create challenge
    const challenge = await prisma.mfaChallenge.create({
      data: {
        userId,
        type: 'email',
        code: codeHash,
        codeExpiresAt: expiresAt,
        operation,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    // TODO: Integrate with email service provider
    // For now, this is a placeholder
    // await this.sendEmail(emailAddress, code, operation);

    // In production, log the code for testing purposes (remove in production)
    console.log(`[MFA Email] Code for ${emailAddress}: ${code}`);

    return {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
    };
  }

  /**
   * Verify Email code
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

    // Check if code is expired
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
   * Setup Email MFA method
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param emailAddress - Email address
   * @param name - Method name (optional)
   * @returns MFA method ID
   */
  async setupMethod(
    prisma: PrismaClient,
    userId: string,
    emailAddress: string,
    name?: string,
  ): Promise<string> {
    // Create MFA method
    const method = await prisma.mfaMethod.create({
      data: {
        userId,
        type: 'email',
        name: name || `Email (${emailAddress})`,
        emailAddress,
        isActive: false, // Not active until verified
      },
    });

    return method.id;
  }

  /**
   * Verify and activate Email MFA method
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

    if (!method || method.type !== 'email') {
      return false;
    }

    // Find active challenge for this method
    const challenge = await prisma.mfaChallenge.findFirst({
      where: {
        userId: method.userId,
        mfaMethodId: methodId,
        type: 'email',
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
   * Send Email (placeholder - integrate with email provider)
   *
   * @param emailAddress - Email address
   * @param code - Verification code
   * @param operation - Operation type
   */
  private async sendEmail(
    emailAddress: string,
    code: string,
    operation: string,
  ): Promise<void> {
    // TODO: Integrate with email service provider
    // Example: SendGrid, AWS SES, etc.
    // await emailProvider.send({
    //   to: emailAddress,
    //   subject: 'Your Verification Code',
    //   body: `Your verification code is: ${code}`,
    // });
  }
}
