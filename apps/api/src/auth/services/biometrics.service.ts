/**
 * Biometrics Service
 *
 * Orchestrates platform-authenticator (passkey / Face ID / Touch ID / Windows
 * Hello) enrolment and device management (Biometrics Phase 1). Reuses the
 * WebAuthn crypto in MfaWebAuthnService, but always with the `platform`
 * attachment so credentials are discoverable and user-verified — distinct from
 * the cross-platform hardware-key MFA path.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { MfaWebAuthnService } from './mfa-webauthn.service';
import { providerFromAaguid } from './webauthn-aaguids';

/** Max length for a user-supplied device nickname. */
const MAX_LABEL_LENGTH = 60;

/**
 * A user-facing enrolled biometric device.
 */
export interface BiometricDevice {
  id: string;
  label: string;
  /** Passkey provider from the AAGUID (e.g. "iCloud Keychain"), when known. */
  provider?: string;
  backedUp: boolean;
  transports: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
}

@Injectable()
export class BiometricsService {
  constructor(private readonly webauthn: MfaWebAuthnService) {}

  /**
   * Generate registration options for enrolling a platform authenticator.
   *
   * The WebAuthn user name/display name come from the database, not the access
   * token — the JWT only carries ids (userId/tenant/profile/role), so email and
   * name must be resolved here.
   */
  async generateRegistrationOptions(prisma: PrismaClient, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const displayName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email;

    return this.webauthn.generateRegistrationOptions(
      prisma,
      userId,
      user.email,
      displayName,
      'platform',
    );
  }

  /**
   * Verify an enrolment response and persist the credential.
   */
  async verifyRegistration(
    prisma: PrismaClient,
    challengeId: string,
    registrationResponse: unknown,
    label?: string,
  ): Promise<string> {
    return this.webauthn.verifyRegistration(
      prisma,
      challengeId,
      registrationResponse,
      label,
      'platform',
    );
  }

  /**
   * List the user's enrolled platform authenticators for the management UI.
   */
  async listDevices(
    prisma: PrismaClient,
    userId: string,
  ): Promise<BiometricDevice[]> {
    const methods = await prisma.mfaMethod.findMany({
      where: {
        userId,
        type: 'webauthn',
        webauthnAttachment: 'platform',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        webauthnAaguid: true,
        webauthnBackedUp: true,
        webauthnTransports: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return methods.map((m) => ({
      id: m.id,
      label: m.name ?? 'Passkey',
      provider: providerFromAaguid(m.webauthnAaguid),
      backedUp: m.webauthnBackedUp ?? false,
      transports: m.webauthnTransports ?? [],
      createdAt: m.createdAt,
      lastUsedAt: m.lastUsedAt,
    }));
  }

  /**
   * Rename an enrolled platform authenticator. Scoped to the calling user and
   * to platform credentials, so a caller can't rename another user's device or
   * a cross-platform hardware key through this endpoint.
   */
  async renameDevice(
    prisma: PrismaClient,
    userId: string,
    methodId: string,
    label: string,
  ): Promise<void> {
    const trimmed = label.trim();
    if (!trimmed) {
      throw new BadRequestException('A device name is required.');
    }
    if (trimmed.length > MAX_LABEL_LENGTH) {
      throw new BadRequestException(
        `Device name must be ${MAX_LABEL_LENGTH} characters or fewer.`,
      );
    }

    const result = await prisma.mfaMethod.updateMany({
      where: {
        id: methodId,
        userId,
        type: 'webauthn',
        webauthnAttachment: 'platform',
      },
      data: { name: trimmed },
    });

    if (result.count === 0) {
      throw new NotFoundException('Biometric device not found');
    }
  }

  /**
   * Remove an enrolled platform authenticator.
   *
   * Scoped to the calling user and to platform credentials so a caller can
   * neither remove another user's device nor a cross-platform hardware key
   * through this endpoint.
   *
   * NOTE: per the biometrics plan (§4C) this is a reflexive-security action and
   * must gain `@RequireStepUp()` once the step-up flow is wired to endpoints in
   * Phase 3 — a hijacked live session should not be able to strip biometrics.
   */
  async removeDevice(
    prisma: PrismaClient,
    userId: string,
    methodId: string,
  ): Promise<void> {
    const method = await prisma.mfaMethod.findFirst({
      where: {
        id: methodId,
        userId,
        type: 'webauthn',
        webauthnAttachment: 'platform',
      },
      select: { id: true },
    });

    if (!method) {
      throw new NotFoundException('Biometric device not found');
    }

    await prisma.mfaMethod.delete({ where: { id: method.id } });
  }
}
