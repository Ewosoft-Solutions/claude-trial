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
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { PrismaClient } from '@workspace/database';
import { EncryptionService } from '../../common/encryption';

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
 * Authenticator kind: `platform` = built-in device biometrics (Face ID /
 * Touch ID / Windows Hello / Android), `cross-platform` = roaming security key.
 */
type AuthenticatorAttachment = 'platform' | 'cross-platform';

/**
 * WebAuthn Configuration
 */
interface WebAuthnConfig {
  rpName: string;
  rpID: string;
  /**
   * Allowed assertion origins. A passkey is scoped to a single RP ID (the apex
   * registrable domain) but may be presented from several tenant subdomain
   * origins, so origin verification is against this allow-list.
   */
  origins: string[];
}

/**
 * WebAuthn MFA Service
 *
 * Provides WebAuthn/FIDO2 MFA functionality.
 */
@Injectable()
export class MfaWebAuthnService {
  private config: WebAuthnConfig;

  constructor(private readonly encryption: EncryptionService) {
    const primaryOrigin =
      process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';
    // WEBAUTHN_ALLOWED_ORIGINS is a comma-separated allow-list of origins the
    // app is served from (e.g. tenant subdomains). Falls back to the single
    // WEBAUTHN_ORIGIN when unset, so existing single-origin setups are unchanged.
    const origins = (process.env.WEBAUTHN_ALLOWED_ORIGINS || primaryOrigin)
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    this.config = {
      rpName: process.env.WEBAUTHN_RP_NAME || 'School With Ease',
      // RP ID must be the apex registrable domain so one passkey works across
      // every tenant subdomain of it.
      rpID: process.env.WEBAUTHN_RP_ID || 'localhost',
      origins,
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
    attachment: AuthenticatorAttachment = 'cross-platform',
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
      // Platform (biometric) credentials must be discoverable and
      // user-verified so they can drive one-tap passwordless login and count
      // as MFA. Cross-platform hardware keys keep their existing, looser policy.
      authenticatorSelection:
        attachment === 'platform'
          ? {
              authenticatorAttachment: 'platform',
              residentKey: 'required',
              requireResidentKey: true,
              userVerification: 'required',
            }
          : {
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
    attachment: AuthenticatorAttachment = 'cross-platform',
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
      expectedOrigin: this.config.origins,
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
      transports,
    } = verification.registrationInfo.credential;

    // Device metadata for the management UI: whether the passkey is synced
    // across devices (iCloud/Google) and the authenticator model id.
    const { credentialBackedUp, aaguid } = verification.registrationInfo;

    // Encrypt the public key at rest (AES-256-GCM), matching the convention for
    // other sensitive columns (TOTP/JWT secrets). Stored as base64(iv+tag+ct).
    // The raw key bytes are base64-encoded first, then encrypted.
    const encryptedPublicKey = this.encryption.encrypt(
      Buffer.from(credentialPublicKey).toString('base64'),
    );

    // Create MFA method
    const method = await prisma.mfaMethod.create({
      data: {
        userId: challenge.userId,
        type: 'webauthn',
        name: name || (attachment === 'platform' ? 'Passkey' : 'Hardware Key'),
        // `credentialID` is already a base64url string from SimpleWebAuthn v13.
        // Store it verbatim — the previous Buffer→base64 round-trip mangled it
        // (base64 ≠ base64url), so authentication lookups never matched.
        webauthnId: credentialID,
        webauthnPublicKey: encryptedPublicKey,
        webauthnCounter: counter,
        webauthnAttachment: attachment,
        webauthnBackedUp: credentialBackedUp ?? null,
        webauthnTransports: transports ?? [],
        webauthnAaguid: aaguid ?? null,
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
    userVerification: 'required' | 'preferred' | 'discouraged' = 'preferred',
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
      userVerification,
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
    authenticationResponse: AuthenticationResponseJSON,
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

    // The client sends the credential id as a base64url string; it was stored
    // verbatim at registration, so match on it directly (no re-encoding).
    const method = await prisma.mfaMethod.findFirst({
      where: {
        userId: challenge.userId,
        type: 'webauthn',
        webauthnId: authenticationResponse.id,
        isActive: true,
      },
    });

    if (!method || !method.webauthnPublicKey) {
      return false;
    }

    // Decrypt the stored public key (reverse of registration): decrypt to the
    // base64 string, then back to raw bytes for verification.
    const publicKey = Buffer.from(
      this.encryption.decrypt(method.webauthnPublicKey),
      'base64',
    );

    // Verify authentication response
    const opts: VerifyAuthenticationResponseOpts = {
      response: authenticationResponse,
      expectedChallenge: challenge.webauthnChallenge,
      expectedOrigin: this.config.origins,
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

  /**
   * Generate authentication options for a usernameless / discoverable login.
   *
   * `allowCredentials` is empty, so the authenticator offers any resident
   * passkey for this RP — the user is unknown until they pick one. The stored
   * challenge therefore has no `userId`; it's resolved from the assertion in
   * `verifyUsernamelessAuthentication`.
   */
  async generateUsernamelessLoginOptions(
    prisma: PrismaClient,
  ): Promise<
    Awaited<ReturnType<typeof generateAuthOptions>> & { challengeId: string }
  > {
    const opts: GenerateAuthenticationOptionsOpts = {
      rpID: this.config.rpID,
      allowCredentials: [],
      userVerification: 'required',
      timeout: 60000,
    };

    const options = await generateAuthOptions(opts);

    const challenge = await prisma.mfaChallenge.create({
      data: {
        userId: null,
        type: 'webauthn',
        webauthnChallenge: options.challenge,
        operation: 'login',
        expiresAt: new Date(Date.now() + 60000),
      },
    });

    return { ...options, challengeId: challenge.id };
  }

  /**
   * Verify a usernameless assertion: resolve the credential globally (we don't
   * know the user yet), verify the signature against its public key, and return
   * the owning user id. Returns null on any failure (unknown credential,
   * expired/used challenge, bad signature).
   */
  async verifyUsernamelessAuthentication(
    prisma: PrismaClient,
    challengeId: string,
    authenticationResponse: AuthenticationResponseJSON,
  ): Promise<string | null> {
    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge || !challenge.webauthnChallenge) return null;
    if (challenge.verified) return null;
    if (new Date() > challenge.expiresAt) return null;

    // The credential id from the client is a base64url string, stored verbatim.
    const method = await prisma.mfaMethod.findFirst({
      where: {
        type: 'webauthn',
        webauthnId: authenticationResponse.id,
        isActive: true,
      },
    });

    if (!method || !method.webauthnPublicKey || !method.userId) return null;

    // Defence-in-depth: the assertion's userHandle (set to the user id at
    // registration) must match the credential's owner.
    const userHandle = authenticationResponse.response.userHandle;
    if (userHandle) {
      const decoded = Buffer.from(userHandle, 'base64url').toString('utf8');
      if (decoded !== method.userId) return null;
    }

    const publicKey = Buffer.from(
      this.encryption.decrypt(method.webauthnPublicKey),
      'base64',
    );

    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge: challenge.webauthnChallenge,
      expectedOrigin: this.config.origins,
      expectedRPID: this.config.rpID,
      credential: {
        id: method.webauthnId!,
        publicKey,
        counter: method.webauthnCounter || 0,
      },
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.authenticationInfo) return null;

    await prisma.mfaMethod.update({
      where: { id: method.id },
      data: {
        webauthnCounter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    });
    await prisma.mfaChallenge.update({
      where: { id: challengeId },
      data: {
        verified: true,
        verifiedAt: new Date(),
        mfaMethodId: method.id,
      },
    });

    return method.userId;
  }
}
