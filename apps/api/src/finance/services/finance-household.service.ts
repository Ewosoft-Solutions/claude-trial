import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import {
  AddHouseholdMemberDto,
  AddHouseholdPayerDto,
  CreateHouseholdDto,
  UpdateHouseholdDto,
} from '../dto/household.dto';

/**
 * Billing households (P2) — the durable family account invoices/payments attach
 * to. Membership + payers are temporal (an "effectiveTo" ends a stint without
 * losing history). Households are auto-derived from shared primary/billing
 * guardian clusters and hand-managed via add/end + merge for blended families.
 */
@Injectable()
export class FinanceHouseholdService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  /** Current (not-yet-ended) members + payers, for list/detail rendering. */
  private readonly currentInclude = {
    members: {
      where: { effectiveTo: null },
      orderBy: { effectiveFrom: 'asc' },
    },
    payers: {
      where: { effectiveTo: null },
      orderBy: { role: 'asc' },
    },
  } as const;

  // ---- Reads ----------------------------------------------------------

  listHouseholds(tenantId: string) {
    return this.client.billingHousehold.findMany({
      where: { tenantId },
      include: this.currentInclude,
      orderBy: { name: 'asc' },
    });
  }

  async getHousehold(tenantId: string, id: string) {
    const household = await this.client.billingHousehold.findFirst({
      where: { id, tenantId },
      include: {
        members: { orderBy: { effectiveFrom: 'desc' } },
        payers: { orderBy: { effectiveFrom: 'desc' } },
      },
    });
    if (!household) throw new NotFoundException('Household not found');
    return household;
  }

  // ---- Manual CRUD ----------------------------------------------------

  createHousehold(tenantId: string, dto: CreateHouseholdDto, userId?: string) {
    return this.client.billingHousehold.create({
      data: {
        tenantId,
        name: dto.name,
        primaryPayerName: dto.primaryPayerName ?? null,
        createdBy: userId ?? null,
      },
    });
  }

  async updateHousehold(tenantId: string, id: string, dto: UpdateHouseholdDto) {
    await this.assertHousehold(tenantId, id);
    return this.client.billingHousehold.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.primaryPayerName !== undefined && {
          primaryPayerName: dto.primaryPayerName,
        }),
      },
    });
  }

  async addMember(
    tenantId: string,
    householdId: string,
    dto: AddHouseholdMemberDto,
  ) {
    await this.assertHousehold(tenantId, householdId);
    const existing = await this.client.householdMember.findFirst({
      where: {
        tenantId,
        householdId,
        studentId: dto.studentId,
        effectiveTo: null,
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Student is already in this household');
    }
    return this.client.householdMember.create({
      data: {
        tenantId,
        householdId,
        studentId: dto.studentId,
        studentName: dto.studentName ?? null,
      },
    });
  }

  /** End a membership (keeps history — sets effectiveTo, never deletes). */
  async endMember(tenantId: string, memberId: string) {
    const member = await this.client.householdMember.findFirst({
      where: { id: memberId, tenantId },
    });
    if (!member) throw new NotFoundException('Household member not found');
    return this.client.householdMember.update({
      where: { id: memberId },
      data: { effectiveTo: new Date() },
    });
  }

  async addPayer(
    tenantId: string,
    householdId: string,
    dto: AddHouseholdPayerDto,
  ) {
    await this.assertHousehold(tenantId, householdId);
    const existing = await this.client.householdPayer.findFirst({
      where: {
        tenantId,
        householdId,
        guardianId: dto.guardianId,
        effectiveTo: null,
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Guardian is already a payer here');
    }
    return this.client.householdPayer.create({
      data: {
        tenantId,
        householdId,
        guardianId: dto.guardianId,
        payerName: dto.payerName ?? null,
        role: dto.role ?? 'primary',
      },
    });
  }

  async endPayer(tenantId: string, payerId: string) {
    const payer = await this.client.householdPayer.findFirst({
      where: { id: payerId, tenantId },
    });
    if (!payer) throw new NotFoundException('Household payer not found');
    return this.client.householdPayer.update({
      where: { id: payerId },
      data: { effectiveTo: new Date() },
    });
  }

  // ---- Merge (blended families / duplicates) --------------------------

  /**
   * Absorb `sourceId` into `targetId`: move its active members/payers (skipping
   * ones the target already has), re-point its invoices, then delete the empty
   * source. Payers move in as `secondary` so the target keeps a single primary.
   */
  async merge(tenantId: string, targetId: string, sourceId: string) {
    if (targetId === sourceId) {
      throw new BadRequestException('Cannot merge a household into itself');
    }
    await this.assertHousehold(tenantId, targetId);
    await this.assertHousehold(tenantId, sourceId);

    const [srcMembers, tgtMembers] = await Promise.all([
      this.client.householdMember.findMany({
        where: { tenantId, householdId: sourceId, effectiveTo: null },
      }),
      this.client.householdMember.findMany({
        where: { tenantId, householdId: targetId, effectiveTo: null },
        select: { studentId: true },
      }),
    ]);
    const tgtStudentIds = new Set(tgtMembers.map((m) => m.studentId));
    for (const m of srcMembers) {
      if (!tgtStudentIds.has(m.studentId)) {
        await this.client.householdMember.create({
          data: {
            tenantId,
            householdId: targetId,
            studentId: m.studentId,
            studentName: m.studentName,
          },
        });
      }
    }

    const [srcPayers, tgtPayers] = await Promise.all([
      this.client.householdPayer.findMany({
        where: { tenantId, householdId: sourceId, effectiveTo: null },
      }),
      this.client.householdPayer.findMany({
        where: { tenantId, householdId: targetId, effectiveTo: null },
        select: { guardianId: true },
      }),
    ]);
    const tgtGuardianIds = new Set(tgtPayers.map((p) => p.guardianId));
    for (const p of srcPayers) {
      if (!tgtGuardianIds.has(p.guardianId)) {
        await this.client.householdPayer.create({
          data: {
            tenantId,
            householdId: targetId,
            guardianId: p.guardianId,
            payerName: p.payerName,
            role: 'secondary',
          },
        });
      }
    }

    await this.client.feeInvoice.updateMany({
      where: { tenantId, householdId: sourceId },
      data: { householdId: targetId },
    });
    await this.client.billingHousehold.delete({ where: { id: sourceId } });

    return this.getHousehold(tenantId, targetId);
  }

  // ---- Auto-derive from guardian clusters -----------------------------

  /**
   * Create a household per guardian who is a primary/billing contact for ≥1
   * student and does NOT already appear as an active payer anywhere. Skipping
   * guardians that already have a home makes this idempotent (re-runs are
   * no-ops) and merge-safe (a merged-away cluster is not recreated). It is a
   * bootstrap: new siblings under an existing guardian are added by hand.
   */
  async autoDerive(tenantId: string, userId?: string) {
    const rels = await this.client.guardianRelationship.findMany({
      where: {
        tenantId,
        effectiveTo: null,
        OR: [{ isPrimary: true }, { isBillingContact: true }],
      },
      select: { guardianPersonId: true, wardPersonId: true },
    });
    if (rels.length === 0) return { created: 0, skipped: 0 };

    const wardPersonIds = [...new Set(rels.map((r) => r.wardPersonId))];
    const guardianPersonIds = [...new Set(rels.map((r) => r.guardianPersonId))];

    const students = await this.client.student.findMany({
      where: { tenantId, personId: { in: wardPersonIds } },
      select: {
        id: true,
        personId: true,
        userTenant: {
          select: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    const studentByPerson = new Map(
      students
        .filter((s) => s.personId)
        .map((s) => [
          s.personId as string,
          {
            id: s.id,
            name: [s.userTenant?.user?.firstName, s.userTenant?.user?.lastName]
              .filter(Boolean)
              .join(' ')
              .trim(),
          },
        ]),
    );

    const guardians = await this.client.person.findMany({
      where: { tenantId, id: { in: guardianPersonIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const guardianById = new Map(guardians.map((g) => [g.id, g]));

    // guardian → distinct students.
    const clusters = new Map<string, { studentId: string; name: string }[]>();
    for (const r of rels) {
      const student = studentByPerson.get(r.wardPersonId);
      if (!student) continue;
      const arr = clusters.get(r.guardianPersonId) ?? [];
      if (!arr.some((a) => a.studentId === student.id)) {
        arr.push({ studentId: student.id, name: student.name });
      }
      clusters.set(r.guardianPersonId, arr);
    }

    let created = 0;
    let skipped = 0;
    for (const [guardianId, members] of clusters) {
      if (members.length === 0) continue;

      const alreadyPayer = await this.client.householdPayer.findFirst({
        where: { tenantId, guardianId, effectiveTo: null },
        select: { id: true },
      });
      if (alreadyPayer) {
        skipped++;
        continue;
      }

      const g = guardianById.get(guardianId);
      const payerName = g
        ? [g.firstName, g.lastName].filter(Boolean).join(' ').trim() || null
        : null;

      const household = await this.client.billingHousehold.create({
        data: {
          tenantId,
          name: payerName ? `${payerName}'s household` : 'Household',
          primaryPayerName: payerName,
          derivedFromGuardianId: guardianId,
          createdBy: userId ?? null,
        },
      });
      await this.client.householdPayer.create({
        data: {
          tenantId,
          householdId: household.id,
          guardianId,
          payerName,
          role: 'primary',
        },
      });
      for (const m of members) {
        await this.client.householdMember.create({
          data: {
            tenantId,
            householdId: household.id,
            studentId: m.studentId,
            studentName: m.name || null,
          },
        });
      }
      created++;
    }

    return { created, skipped };
  }

  // ---- Helpers --------------------------------------------------------

  private async assertHousehold(tenantId: string, id: string) {
    const household = await this.client.billingHousehold.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!household) throw new NotFoundException('Household not found');
  }
}
