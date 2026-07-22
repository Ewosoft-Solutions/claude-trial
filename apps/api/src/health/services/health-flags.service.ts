import { BadRequestException, Injectable } from '@nestjs/common';
import {
  HEALTH_FLAG_INDEX_DOMAIN,
  isHealthFlagCode,
  normalizeHealthFlag,
  type HealthFlagCode,
} from '@workspace/api';
import { EncryptionService } from '../../common/encryption/encryption.service';

/**
 * Health Flags Service
 *
 * Owns the two representations of a student's health flags:
 *
 * - `healthFlagsEnc`  — encrypted JSON array of vocabulary codes. The display
 *   copy; decrypt to show a pupil's flags.
 * - `healthFlagIndex` — keyed HMAC per code. The searchable copy; a database
 *   dump reveals which pupils share a flag but not which flag it is.
 *
 * Keeping both in one place matters: they must be written together or a pupil
 * becomes findable but undisplayable (or worse, displayable but unfindable —
 * the failure mode where an allergy is on file and the trip search misses it).
 * Callers should never construct either column directly.
 */
@Injectable()
export class HealthFlagsService {
  constructor(private readonly encryption: EncryptionService) {}

  /**
   * Encode vocabulary codes into the pair of stored columns.
   *
   * @param codes - Vocabulary codes; validated against the controlled list
   * @returns The columns to persist
   * @throws BadRequestException if any code is outside the vocabulary
   */
  encode(codes: readonly HealthFlagCode[]): {
    healthFlagsEnc: string | null;
    healthFlagIndex: string[];
  } {
    const normalized = this.validateAndNormalize(codes);

    if (normalized.length === 0) {
      return { healthFlagsEnc: null, healthFlagIndex: [] };
    }

    return {
      healthFlagsEnc: this.encryption.encryptForStorage(
        JSON.stringify(normalized),
      ),
      healthFlagIndex: normalized.map((code) => this.indexFor(code)),
    };
  }

  /**
   * Decode the stored display copy back to vocabulary codes.
   *
   * Returns `[]` rather than throwing when the value is absent or unreadable:
   * a health record that cannot render its flags should still render the rest
   * of the pupil's profile, and an unreadable value is an operational problem
   * (wrong key, partial restore) rather than a caller error.
   */
  decode(healthFlagsEnc: string | null | undefined): HealthFlagCode[] {
    if (!healthFlagsEnc) return [];
    try {
      const parsed: unknown = JSON.parse(
        this.encryption.decryptFromStorage(healthFlagsEnc),
      );
      return Array.isArray(parsed) ? (parsed as HealthFlagCode[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Blind-index digest for one code — the value to match in SQL.
   *
   * Normalization happens here as well as on write, so a query for `Allergy:Peanut`
   * still finds a pupil stored under `allergy:peanut`.
   */
  indexFor(code: HealthFlagCode): string {
    return this.encryption.blindIndex(
      normalizeHealthFlag(code),
      HEALTH_FLAG_INDEX_DOMAIN,
    );
  }

  /**
   * Build a Prisma filter for "has any of these flags".
   *
   * Uses array overlap (`hasSome` → `&&`), which the GIN index on
   * `health_flag_index` serves.
   */
  hasAnyFilter(codes: readonly HealthFlagCode[]): { hasSome: string[] } {
    return {
      hasSome: this.validateAndNormalize(codes).map((c) => this.indexFor(c)),
    };
  }

  /** Build a Prisma filter for "has all of these flags" (`hasEvery` → `@>`). */
  hasAllFilter(codes: readonly HealthFlagCode[]): { hasEvery: string[] } {
    return {
      hasEvery: this.validateAndNormalize(codes).map((c) => this.indexFor(c)),
    };
  }

  /**
   * Normalize, de-duplicate and validate against the controlled vocabulary.
   *
   * Rejecting unknown codes is deliberate. A free-text code would be indexed
   * under a digest nothing else ever produces, so it would be silently
   * unfindable — the exact failure the vocabulary exists to prevent.
   */
  private validateAndNormalize(
    codes: readonly HealthFlagCode[],
  ): HealthFlagCode[] {
    const normalized = Array.from(
      new Set((codes ?? []).map((c) => normalizeHealthFlag(String(c)))),
    ).filter((c) => c.length > 0);

    const unknown = normalized.filter((c) => !isHealthFlagCode(c));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown health flag code(s): ${unknown.join(', ')}`,
      );
    }
    return normalized;
  }
}
