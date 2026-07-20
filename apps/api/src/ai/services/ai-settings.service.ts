/**
 * AI settings mutation with maker-checker approval (governance follow-up to
 * Step 6, which shipped the read-only `ai_settings` row + `/settings/ai-usage`).
 *
 * A tenant admin (`ai.configure`, clearance 7+) proposes a change; it lands as
 * a PENDING `MakerCheckerRequest` and applies only when a DIFFERENT approver
 * accepts it (dual control). BYOK keys never touch the request row in
 * plaintext: they are encrypted at submit time, and only the last 4 chars are
 * ever surfaced.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaClient } from '@workspace/database';
import { ApprovalStatus } from '@workspace/api';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { PermissionService } from '../../auth/services/permission.service';
import { MakerCheckerService } from '../../auth/services/maker-checker.service';
import type { AiSettingsChangeRequestDto } from '../dto/ai-settings.dto';

const AI_SETTINGS_OPERATION = 'ai.settings.update';

/** The public (sanitized) settings shape — never carries the encrypted key. */
const SETTINGS_SELECT = {
  modelTier: true,
  analyticsEnabled: true,
  tutorEnabled: true,
  monthlyTokenBudget: true,
  concurrencyLimit: true,
  alertThresholdPercent: true,
  byokProvider: true,
  keyLast4: true,
} as const;

/** Fields that a change request may patch onto the AiSettings row. */
type SettingsPatch = {
  modelTier?: string;
  analyticsEnabled?: boolean;
  tutorEnabled?: boolean;
  monthlyTokenBudget?: number;
  concurrencyLimit?: number;
  alertThresholdPercent?: number;
  byokProvider?: string | null;
  encryptedApiKey?: string | null;
  keyLast4?: string | null;
};

@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
    private readonly encryption: EncryptionService,
    private readonly permissionService: PermissionService,
    private readonly makerChecker: MakerCheckerService,
  ) {}

  /** Current settings for a tenant (sanitized), creating defaults on first read. */
  async getSettings(tenantId: string, userId: string) {
    return this.tenantDb.runScoped(tenantId, userId, async () => {
      const existing = await this.tenantDb.client.aiSettings.findUnique({
        where: { tenantId },
        select: SETTINGS_SELECT,
      });
      if (existing) return existing;
      return this.tenantDb.client.aiSettings.create({
        data: { tenantId },
        select: SETTINGS_SELECT,
      });
    });
  }

  /**
   * Submit a proposed change. Validates + normalizes the patch (encrypting any
   * BYOK key), then records a PENDING maker-checker request. Nothing on the
   * settings row changes yet.
   */
  async createChangeRequest(params: {
    tenantId: string;
    userId: string;
    profileId: string;
    dto: AiSettingsChangeRequestDto;
  }): Promise<{ requestId: string; status: 'pending' }> {
    const patch = this.buildPatch(params.dto);
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No settings changes were provided.');
    }

    const clearanceLevel = await this.clearanceOf(params);

    const requestId = await this.tenantDb.runScoped(
      params.tenantId,
      params.userId,
      () =>
        this.makerChecker.createApprovalRequest(
          this.tenantDb.client as unknown as PrismaClient,
          AI_SETTINGS_OPERATION,
          params.userId,
          clearanceLevel,
          { patch, reason: params.dto.reason ?? null },
          params.tenantId,
        ),
    );

    if (!requestId) {
      // Should never happen — the operation is registered as sensitive.
      throw new BadRequestException('AI settings changes require approval.');
    }
    return { requestId, status: 'pending' };
  }

  /** Pending AI-settings change requests for the tenant (sanitized summaries). */
  async listPendingChanges(tenantId: string, userId: string) {
    return this.tenantDb.runScoped(tenantId, userId, async () => {
      const rows = await this.tenantDb.client.makerCheckerRequest.findMany({
        where: {
          tenantId,
          operation: AI_SETTINGS_OPERATION,
          status: ApprovalStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          makerId: true,
          makerClearanceLevel: true,
          requestData: true,
          createdAt: true,
          expiresAt: true,
        },
      });
      return rows.map((r) => ({
        id: r.id,
        makerId: r.makerId,
        makerClearanceLevel: r.makerClearanceLevel,
        changes: this.summarizePatch(r.requestData),
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      }));
    });
  }

  /**
   * Approve + apply a pending change. Enforces dual control (the approver must
   * differ from the maker) before delegating status/clearance validation to the
   * shared maker-checker service, then patches the settings row.
   */
  async approveChange(params: {
    tenantId: string;
    userId: string;
    profileId: string;
    requestId: string;
    reason?: string;
  }) {
    const clearanceLevel = await this.clearanceOf(params);

    return this.tenantDb.runScoped(params.tenantId, params.userId, async () => {
      const request = await this.loadPendingRequest(
        params.tenantId,
        params.requestId,
      );
      if (request.makerId === params.userId) {
        throw new BadRequestException(
          'Maker-checker: you cannot approve a change you requested.',
        );
      }

      const result = await this.makerChecker.approveRequest(
        this.tenantDb.client as unknown as PrismaClient,
        params.requestId,
        params.userId,
        clearanceLevel,
        params.reason,
      );
      if (!result.approved) {
        throw new BadRequestException(result.error ?? 'Approval failed.');
      }

      const patch = this.extractPatch(request.requestData);
      const applied = await this.tenantDb.client.aiSettings.upsert({
        where: { tenantId: params.tenantId },
        update: patch,
        create: { tenantId: params.tenantId, ...patch },
        select: SETTINGS_SELECT,
      });
      this.logger.log(
        `AI settings change ${params.requestId} approved by ${params.userId} for tenant ${params.tenantId}`,
      );
      return applied;
    });
  }

  /** Reject a pending change without applying it. */
  async rejectChange(params: {
    tenantId: string;
    userId: string;
    requestId: string;
    reason: string;
  }): Promise<{ rejected: true }> {
    return this.tenantDb.runScoped(params.tenantId, params.userId, async () => {
      await this.loadPendingRequest(params.tenantId, params.requestId);
      const result = await this.makerChecker.rejectRequest(
        this.tenantDb.client as unknown as PrismaClient,
        params.requestId,
        params.userId,
        params.reason,
      );
      if (!result.rejected) {
        throw new BadRequestException(result.error ?? 'Rejection failed.');
      }
      return { rejected: true };
    });
  }

  // ---- internals --------------------------------------------------------

  private async loadPendingRequest(tenantId: string, requestId: string) {
    const request = await this.tenantDb.client.makerCheckerRequest.findFirst({
      where: {
        id: requestId,
        tenantId,
        operation: AI_SETTINGS_OPERATION,
        status: ApprovalStatus.PENDING,
      },
    });
    if (!request) {
      throw new NotFoundException('Pending AI settings change not found.');
    }
    return request;
  }

  private async clearanceOf(params: {
    tenantId: string;
    userId: string;
    profileId: string;
  }): Promise<number> {
    const context = await this.permissionService.getUserPermissionContext(
      this.db.client,
      params.userId,
      params.tenantId,
      params.profileId,
    );
    return context.clearanceLevel;
  }

  /** Turn a validated DTO into a normalized, plaintext-free patch. */
  private buildPatch(dto: AiSettingsChangeRequestDto): SettingsPatch {
    const patch: SettingsPatch = {};
    if (dto.modelTier !== undefined) patch.modelTier = dto.modelTier;
    if (dto.analyticsEnabled !== undefined)
      patch.analyticsEnabled = dto.analyticsEnabled;
    if (dto.tutorEnabled !== undefined) patch.tutorEnabled = dto.tutorEnabled;
    if (dto.monthlyTokenBudget !== undefined)
      patch.monthlyTokenBudget = dto.monthlyTokenBudget;
    if (dto.concurrencyLimit !== undefined)
      patch.concurrencyLimit = dto.concurrencyLimit;
    if (dto.alertThresholdPercent !== undefined)
      patch.alertThresholdPercent = dto.alertThresholdPercent;

    // BYOK handling. `null` clears; a provider requires a key; a key requires a
    // provider. The plaintext key is encrypted here and never leaves this method.
    if (dto.byokProvider === null) {
      patch.byokProvider = null;
      patch.encryptedApiKey = null;
      patch.keyLast4 = null;
    } else if (dto.byokProvider !== undefined) {
      if (!dto.byokApiKey) {
        throw new BadRequestException(
          'A BYOK API key is required when setting a BYOK provider.',
        );
      }
      patch.byokProvider = dto.byokProvider;
      patch.encryptedApiKey = this.encryption.encryptForStorage(dto.byokApiKey);
      patch.keyLast4 = dto.byokApiKey.slice(-4);
    } else if (dto.byokApiKey !== undefined) {
      throw new BadRequestException(
        'Set `byokProvider` alongside a BYOK API key.',
      );
    }
    return patch;
  }

  private extractPatch(requestData: unknown): SettingsPatch {
    const data = (requestData ?? {}) as { patch?: SettingsPatch };
    return data.patch ?? {};
  }

  /** A checker-facing summary: which fields change, key shown only as last-4. */
  private summarizePatch(requestData: unknown): Record<string, unknown> {
    const patch = this.extractPatch(requestData);
    const { encryptedApiKey: _drop, keyLast4, ...rest } = patch;
    const summary: Record<string, unknown> = { ...rest };
    if (keyLast4 !== undefined) summary.byokKeyLast4 = keyLast4;
    return summary;
  }
}
