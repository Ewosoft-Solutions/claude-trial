/**
 * MFA WebAuthn Service
 *
 * Handles WebAuthn/FIDO2 MFA for hardware keys (3a.4).
 */

import { Injectable } from '@nestjs/common';
import {
  generateRegistrationOptions as generateRegOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions as generateAuthOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type VerifyRegistrationResponseOpts,
  type GenerateAuthenticationOptionsOpts,
  type VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import { PrismaClient } from '@workspace/database';
import { MfaBaseService } from './mfa-base.service';

// Define transport types locally since they're not directly exported
type AuthenticatorTransportFuture =
  | 'ble'
  | 'cable'
  | 'hybrid'
  | 'internal'
  | 'nfc'
  | 'smart-card'
  | 'usb';

/**
 * WebAuthn Configuration
 */
interface WebAuthnConfig {
  rpName: string;
  rpID: string;
  origin: string;
}

/**
 * WebAuthn MFA Service
 *
 * Provides WebAuthn/FIDO2 MFA functionality.
 */
@Injectable()
export class MfaWebAuthnService {
  private config: WebAuthnConfig;

  constructor() {
    // TODO: Load from environment variables
    this.config = {
      rpName: process.env.WEBAUTHN_RP_NAME || 'School Management System',
      rpID: process.env.WEBAUTHN_RP_ID || 'localhost',
      origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
    };
  }

  /**
   * Generate registration options for new WebAuthn credential
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param userName - User name (email)
   * @param userDisplayName - User display name
   * @returns Registration options
   */
  async generateRegistrationOptions(
    prisma: PrismaClient,
    userId: string,
    userName: string,
    userDisplayName: string,
  ): Promise<
    Awaited<ReturnType<typeof generateRegOptions>> & { challengeId: string }
  > {
    // Get user's existing WebAuthn credentials
    const existingCredentials = await prisma.mfaMethod.findMany({
      where: {
        userId,
        type: 'webauthn',
        isActive: true,
      },
      select: {
        webauthnId: true,
        webauthnPublicKey: true,
        webauthnCounter: true,
      },
    });

    // Convert to PublicKeyCredentialDescriptor format
    const excludeCredentials = existingCredentials
      .filter((c) => c.webauthnId)
      .map((cred) => ({
        id: cred.webauthnId!,
        transports: [
          'usb',
          'nfc',
          'ble',
          'internal',
        ] as AuthenticatorTransportFuture[],
      }));

    // Generate registration options
    const opts: GenerateRegistrationOptionsOpts = {
      rpName: this.config.rpName,
      rpID: this.config.rpID,
      userID: Buffer.from(userId),
      userName,
      userDisplayName,
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: 'cross-platform',
        userVerification: 'preferred',
        requireResidentKey: false,
      },
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    };

    const options = await generateRegOptions(opts);

    // Store challenge in database
    const challenge = await prisma.mfaChallenge.create({
      data: {
        userId,
        type: 'webauthn',
        webauthnChallenge: options.challenge,
        operation: 'webauthn_registration',
        expiresAt: new Date(Date.now() + 60000), // 1 minute
      },
    });

    return {
      ...options,
      challengeId: challenge.id,
    };
  }

  /**
   * Verify registration response and create WebAuthn credential
   *
   * @param prisma - Prisma client instance
   * @param challengeId - Challenge ID
   * @param registrationResponse - Registration response from client
   * @param name - Credential name (optional)
   * @returns MFA method ID
   */
  async verifyRegistration(
    prisma: PrismaClient,
    challengeId: string,
    registrationResponse: any,
    name?: string,
  ): Promise<string> {
    // Find challenge
    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge || !challenge.webauthnChallenge) {
      throw new Error('Invalid challenge');
    }

    if (new Date() > challenge.expiresAt) {
      throw new Error('Challenge expired');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify registration response
    const opts: VerifyRegistrationResponseOpts = {
      response: registrationResponse,
      expectedChallenge: challenge.webauthnChallenge,
      expectedOrigin: this.config.origin,
      expectedRPID: this.config.rpID,
      requireUserVerification: true,
    };

    const verification = await verifyRegistrationResponse(opts);

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('Registration verification failed');
    }

    const {
      id: credentialID,
      publicKey: credentialPublicKey,
      counter,
    } = verification.registrationInfo.credential;

    // TODO: Encrypt credentialPublicKey before storing
    // For now, storing as base64 (NOT RECOMMENDED FOR PRODUCTION)
    const encryptedPublicKey =
      Buffer.from(credentialPublicKey).toString('base64');

    // Create MFA method
    const method = await prisma.mfaMethod.create({
      data: {
        userId: challenge.userId,
        type: 'webauthn',
        name: name || 'Hardware Key',
        webauthnId: Buffer.from(credentialID).toString('base64'),
        webauthnPublicKey: encryptedPublicKey,
        webauthnCounter: counter,
        isActive: true,
        verifiedAt: new Date(),
      },
    });

    // Mark challenge as verified
    await prisma.mfaChallenge.update({
      where: { id: challengeId },
      data: {
        verified: true,
        verifiedAt: new Date(),
        mfaMethodId: method.id,
      },
    });

    return method.id;
  }

  /**
   * Generate authentication options for WebAuthn login
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param operation - Operation type
   * @returns Authentication options
   */
  async generateAuthenticationOptions(
    prisma: PrismaClient,
    userId: string,
    operation: string,
  ): Promise<
    Awaited<ReturnType<typeof generateAuthOptions>> & { challengeId: string }
  > {
    // Get user's WebAuthn credentials
    const credentials = await prisma.mfaMethod.findMany({
      where: {
        userId,
        type: 'webauthn',
        isActive: true,
      },
      select: {
        id: true,
        webauthnId: true,
        webauthnCounter: true,
      },
    });

    if (credentials.length === 0) {
      throw new Error('No WebAuthn credentials found');
    }

    // Convert to PublicKeyCredentialDescriptor format
    const allowCredentials = credentials
      .filter((c) => c.webauthnId)
      .map((cred) => ({
        id: cred.webauthnId!,
        transports: [
          'usb',
          'nfc',
          'ble',
          'internal',
        ] as AuthenticatorTransportFuture[],
      }));

    // Generate authentication options
    const opts: GenerateAuthenticationOptionsOpts = {
      rpID: this.config.rpID,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 60000,
    };

    const options = await generateAuthOptions(opts);

    // Store challenge in database
    const challenge = await prisma.mfaChallenge.create({
      data: {
        userId,
        type: 'webauthn',
        webauthnChallenge: options.challenge,
        operation,
        expiresAt: new Date(Date.now() + 60000), // 1 minute
      },
    });

    return {
      ...options,
      challengeId: challenge.id,
    };
  }

  /**
   * Verify authentication response
   *
   * @param prisma - Prisma client instance
   * @param challengeId - Challenge ID
   * @param authenticationResponse - Authentication response from client
   * @returns True if verification successful
   */
  async verifyAuthentication(
    prisma: PrismaClient,
    challengeId: string,
    authenticationResponse: any,
  ): Promise<boolean> {
    // Find challenge
    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge || !challenge.webauthnChallenge) {
      return false;
    }

    if (new Date() > challenge.expiresAt) {
      return false;
    }

    // Find credential by ID
    const credentialId = Buffer.from(
      authenticationResponse.id,
      'base64',
    ).toString('base64');

    const method = await prisma.mfaMethod.findFirst({
      where: {
        userId: challenge.userId,
        type: 'webauthn',
        webauthnId: credentialId,
        isActive: true,
      },
    });

    if (!method || !method.webauthnPublicKey) {
      return false;
    }

    // TODO: Decrypt webauthnPublicKey before verification
    // For now, assuming it's stored as base64
    const publicKey = Buffer.from(method.webauthnPublicKey, 'base64');

    // Verify authentication response
    const opts: VerifyAuthenticationResponseOpts = {
      response: authenticationResponse,
      expectedChallenge: challenge.webauthnChallenge,
      expectedOrigin: this.config.origin,
      expectedRPID: this.config.rpID,
      credential: {
        id: method.webauthnId!,
        publicKey,
        counter: method.webauthnCounter || 0,
      },
      requireUserVerification: true,
    };

    const verification = await verifyAuthenticationResponse(opts);

    if (verification.verified && verification.authenticationInfo) {
      // Update counter
      await prisma.mfaMethod.update({
        where: { id: method.id },
        data: {
          webauthnCounter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date(),
        },
      });

      // Mark challenge as verified
      await prisma.mfaChallenge.update({
        where: { id: challengeId },
        data: {
          verified: true,
          verifiedAt: new Date(),
          mfaMethodId: method.id,
        },
      });

      return true;
    }

    return false;
  }
}
