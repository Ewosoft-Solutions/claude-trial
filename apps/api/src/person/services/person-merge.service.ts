import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { writeAuditLog } from '../../common/audit/audit-writer';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';

/**
 * Duplicate resolution (F1 / ADR-01) — merge one Person into another.
 *
 * The duplicate's profiles, contacts, addresses, relationships and student
 * anchor are re-pointed to the survivor; the duplicate is marked `merged` with
 * `mergedIntoId` set. **Evidence is preserved, never destroyed:** both records
 * get a RelationshipHistory row, and a security audit entry is written. High-
 * risk, so clearance-gated at the controller (maker-checker step-up is WB1-6).
 *
 * The whole re-point runs inside the request's RLS transaction (@TenantScoped →
 * runScoped), so it is atomic: a failure rolls the entire merge back.
 */
@Injectable()
export class PersonMergeService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return (
      this.tenantDb.isScoped ? this.tenantDb.client : this.db.client
    ) as Prisma.TransactionClient;
  }

  async merge(
    tenantId: string,
    actorId: string | undefined,
    survivorId: string,
    duplicateId: string,
    reason?: string,
  ) {
    if (survivorId === duplicateId) {
      throw new BadRequestException('survivorId and duplicateId are the same');
    }
    const client = this.client;

    const [survivor, duplicate] = await Promise.all([
      client.person.findFirst({ where: { id: survivorId, tenantId } }),
      client.person.findFirst({ where: { id: duplicateId, tenantId } }),
    ]);
    if (!survivor) throw new NotFoundException('Survivor person not found');
    if (!duplicate) throw new NotFoundException('Duplicate person not found');
    if (survivor.status !== 'active') {
      throw new BadRequestException('Survivor must be active');
    }
    if (duplicate.status === 'merged') {
      throw new BadRequestException('Duplicate is already merged');
    }

    // Re-point owned child records. contactPoints/addresses have no cross-person
    // unique, so a blanket updateMany is safe.
    const movedContacts = await client.contactPoint.updateMany({
      where: { personId: duplicateId, tenantId },
      data: { personId: survivorId },
    });
    const movedAddresses = await client.address.updateMany({
      where: { personId: duplicateId, tenantId },
      data: { personId: survivorId },
    });
    const movedStaff = await client.staffProfile.updateMany({
      where: { personId: duplicateId, tenantId },
      data: { personId: survivorId },
    });
    const movedHistory = await client.relationshipHistory.updateMany({
      where: { personId: duplicateId, tenantId },
      data: { personId: survivorId },
    });

    // Guardian relationships: re-point, but drop any that would collide with an
    // existing (guardian, ward) pair on the survivor, and any that would become
    // a self-relationship.
    await this.repointGuardianEdges(client, tenantId, duplicateId, survivorId);

    // Student anchor: move only if the survivor has none (students.person_id is
    // unique). If both have a student profile, leave the duplicate's in place —
    // that is a data problem for a human to resolve, not something to silently drop.
    let movedStudent = false;
    const dupStudent = await client.student.findFirst({
      where: { personId: duplicateId },
      select: { id: true },
    });
    if (dupStudent) {
      const survivorHasStudent = await client.student.findFirst({
        where: { personId: survivorId },
        select: { id: true },
      });
      if (!survivorHasStudent) {
        await client.student.update({
          where: { id: dupStudent.id },
          data: { personId: survivorId },
        });
        movedStudent = true;
      }
    }

    // Move the account link if the survivor has none (user_tenant_id is unique).
    let movedAccount = false;
    if (!survivor.userTenantId && duplicate.userTenantId) {
      await client.person.update({
        where: { id: duplicateId },
        data: { userTenantId: null },
      });
      await client.person.update({
        where: { id: survivorId },
        data: { userTenantId: duplicate.userTenantId },
      });
      movedAccount = true;
    }

    // Mark the duplicate merged.
    await client.person.update({
      where: { id: duplicateId },
      data: {
        status: 'merged',
        mergedIntoId: survivorId,
        updatedBy: actorId ?? null,
      },
    });

    const detail = {
      survivorId,
      duplicateId,
      reason: reason ?? null,
      moved: {
        contacts: movedContacts.count,
        addresses: movedAddresses.count,
        staffProfiles: movedStaff.count,
        historyRows: movedHistory.count,
        student: movedStudent,
        account: movedAccount,
      },
    };

    // History on BOTH records — the preserved evidence trail.
    await client.relationshipHistory.create({
      data: {
        id: randomUUID(),
        tenantId,
        personId: survivorId,
        changeType: 'merged_from',
        summary: `Absorbed duplicate ${duplicate.firstName} ${duplicate.lastName}`,
        detail: detail as Prisma.InputJsonValue,
        recordedBy: actorId ?? null,
      },
    });
    await client.relationshipHistory.create({
      data: {
        id: randomUUID(),
        tenantId,
        personId: duplicateId,
        changeType: 'merged_into',
        summary: `Merged into ${survivor.firstName} ${survivor.lastName}`,
        detail: detail as Prisma.InputJsonValue,
        recordedBy: actorId ?? null,
      },
    });

    await writeAuditLog(this.db.client, {
      tenantId,
      eventType: AUDIT_EVENT.SECURITY_EVENT,
      action: 'person.merge',
      resource: 'person',
      resourceId: survivorId,
      actorId: actorId ?? null,
      description: `Merged person ${duplicateId} into ${survivorId}`,
      metadata: detail,
    });

    return { survivorId, duplicateId, moved: detail.moved };
  }

  /**
   * Re-point guardian edges from the duplicate to the survivor on both sides,
   * skipping any that would duplicate an existing (guardian, ward) pair or form
   * a self-relationship.
   */
  private async repointGuardianEdges(
    client: Prisma.TransactionClient,
    tenantId: string,
    duplicateId: string,
    survivorId: string,
  ) {
    const edges = await client.guardianRelationship.findMany({
      where: {
        tenantId,
        OR: [{ guardianPersonId: duplicateId }, { wardPersonId: duplicateId }],
      },
    });
    for (const edge of edges) {
      const guardianPersonId =
        edge.guardianPersonId === duplicateId
          ? survivorId
          : edge.guardianPersonId;
      const wardPersonId =
        edge.wardPersonId === duplicateId ? survivorId : edge.wardPersonId;

      if (guardianPersonId === wardPersonId) {
        // Would become a self-guardianship — drop it.
        await client.guardianRelationship.delete({ where: { id: edge.id } });
        continue;
      }
      const clash = await client.guardianRelationship.findFirst({
        where: { guardianPersonId, wardPersonId },
        select: { id: true },
      });
      if (clash && clash.id !== edge.id) {
        await client.guardianRelationship.delete({ where: { id: edge.id } });
      } else {
        await client.guardianRelationship.update({
          where: { id: edge.id },
          data: { guardianPersonId, wardPersonId },
        });
      }
    }
  }
}
