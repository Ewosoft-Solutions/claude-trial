import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { ListHealthRecordsDto, UpsertHealthRecordDto } from '../dto/health.dto';
import { HealthFlagsService } from './health-flags.service';

/**
 * Free-text medical fields encrypted at rest. Read/written whole and never
 * searched (search is the coded-flag layer), so encryption costs nothing in
 * queryability. See docs/platform-scope-plan.md decision 2 / 0.5.7c.
 */
const NARRATIVE_FIELDS = [
  'bloodType',
  'allergies',
  'conditions',
  'medications',
  'notes',
] as const;
type NarrativeField = (typeof NARRATIVE_FIELDS)[number];

const STUDENT_SELECT = {
  id: true,
  studentNumber: true,
  userTenant: {
    select: { user: { select: { firstName: true, lastName: true } } },
  },
} as const;

@Injectable()
export class HealthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
    private readonly flags: HealthFlagsService,
    private readonly encryption: EncryptionService,
  ) {}

  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  async listRecords(tenantId: string, query: ListHealthRecordsDto) {
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where['status'] = query.status;
    if (query.query) {
      where['student'] = {
        OR: [
          { studentNumber: { contains: query.query, mode: 'insensitive' } },
          { userTenant: { user: { firstName: { contains: query.query, mode: 'insensitive' } } } },
          { userTenant: { user: { lastName: { contains: query.query, mode: 'insensitive' } } } },
        ],
      };
    }

    // Flag search runs against the blind index, never the narrative text:
    // matching prose would silently miss "peanuts" when asked for "peanut".
    if (query.flags?.length) {
      where['healthFlagIndex'] =
        query.flagsMatch === 'all'
          ? this.flags.hasAllFilter(query.flags)
          : this.flags.hasAnyFilter(query.flags);
    }

    const records = await this.client.healthRecord.findMany({
      where,
      include: { student: { select: STUDENT_SELECT } },
      orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }],
    });

    return records.map((record) => this.present(record));
  }

  /**
   * Present a stored record to callers: decode the flag columns into
   * `healthFlags`, and decrypt the at-rest narrative fields. The encrypted flag
   * blob and the digest index are storage detail and are stripped — exposing
   * the index would hand out a lookup table.
   */
  private present<
    T extends {
      healthFlagsEnc?: string | null;
      healthFlagIndex?: string[];
    } & Partial<Record<NarrativeField, string | null>>,
  >(record: T) {
    // Strip the storage-only columns; the digest index especially must never
    // leave the service (it would be a lookup table).
    const { healthFlagsEnc, healthFlagIndex, ...rest } = record;
    void healthFlagIndex;
    const out = { ...rest, healthFlags: this.flags.decode(healthFlagsEnc) };
    for (const field of NARRATIVE_FIELDS) {
      if (field in out) {
        (out as Record<string, unknown>)[field] = this.encryption.decryptEnveloped(
          out[field] ?? null,
        );
      }
    }
    return out;
  }

  /** Envelope-encrypt the narrative fields present in a write payload. */
  private encryptNarrative(
    data: Partial<Record<NarrativeField, string | null | undefined>>,
  ): Partial<Record<NarrativeField, string | null>> {
    const out: Partial<Record<NarrativeField, string | null>> = {};
    for (const field of NARRATIVE_FIELDS) {
      if (data[field] !== undefined) {
        out[field] = this.encryption.encryptEnveloped(data[field]);
      }
    }
    return out;
  }

  async summary(tenantId: string) {
    const records = await this.client.healthRecord.findMany({
      where: { tenantId },
      select: { status: true },
    });

    const statusCounts: Record<string, number> = {};
    for (const r of records) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    return { totalRecords: records.length, statusCounts };
  }

  async upsertRecord(
    tenantId: string,
    studentId: string,
    dto: UpsertHealthRecordDto,
    userId: string,
  ) {
    const student = await this.client.student.findFirst({ where: { id: studentId, tenantId } });
    if (!student) throw new NotFoundException('Student not found');

    // Encoded once and written to both columns together — see HealthFlagsService.
    const encodedFlags =
      dto.healthFlags !== undefined ? this.flags.encode(dto.healthFlags) : undefined;

    // Envelope-encrypt the narrative fields present on the payload.
    const enc = this.encryptNarrative(dto);

    const record = await this.client.healthRecord.upsert({
      where: { studentId },
      update: {
        ...(encodedFlags !== undefined && encodedFlags),
        ...(enc.bloodType !== undefined && { bloodType: enc.bloodType }),
        ...(enc.allergies !== undefined && { allergies: enc.allergies }),
        ...(enc.conditions !== undefined && { conditions: enc.conditions }),
        ...(enc.medications !== undefined && { medications: enc.medications }),
        ...(dto.emergencyContactName !== undefined && { emergencyContactName: dto.emergencyContactName }),
        ...(dto.emergencyContactPhone !== undefined && { emergencyContactPhone: dto.emergencyContactPhone }),
        ...(dto.lastCheckup !== undefined && { lastCheckup: new Date(dto.lastCheckup) }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(enc.notes !== undefined && { notes: enc.notes }),
        updatedBy: userId,
      },
      create: {
        tenantId,
        studentId,
        bloodType: enc.bloodType ?? null,
        allergies: enc.allergies ?? null,
        conditions: enc.conditions ?? null,
        medications: enc.medications ?? null,
        emergencyContactName: dto.emergencyContactName ?? null,
        emergencyContactPhone: dto.emergencyContactPhone ?? null,
        lastCheckup: dto.lastCheckup ? new Date(dto.lastCheckup) : null,
        status: dto.status ?? 'normal',
        notes: enc.notes ?? null,
        healthFlagsEnc: encodedFlags?.healthFlagsEnc ?? null,
        healthFlagIndex: encodedFlags?.healthFlagIndex ?? [],
        createdBy: userId,
        updatedBy: userId,
      },
    });

    return this.present(record);
  }
}
