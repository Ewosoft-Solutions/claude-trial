/**
 * RoleService Gate 4 — update-time consistency for a role's clearance level
 * (requirements/role-permissions-management.md). Prisma + maker-checker are
 * stubbed; these prove the reject-and-list behaviour and the actor authority
 * bound.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleService } from './role.service';

function build(role: unknown) {
  const update = jest.fn(async ({ data }: any) => ({ id: 'r1', ...data }));
  const prisma = {
    role: {
      findFirst: jest.fn().mockResolvedValue(role),
      update,
    },
  };
  const service = new RoleService({} as never);
  return { service, prisma, update };
}

const customRole = (clearanceLevel: number, poolLevels: number[]) => ({
  id: 'r1',
  clearanceLevel,
  roleType: 'custom',
  rolePools: poolLevels.map((lvl, i) => ({
    pool: { id: `p${i}`, name: `Pool ${i}`, clearanceLevel: lvl },
  })),
});

describe('RoleService.updateRoleClearance (Gate 4)', () => {
  it('rejects a clearance level outside the custom-role range', async () => {
    const { service, prisma } = build(customRole(5, []));
    await expect(
      service.updateRoleClearance(prisma as never, {
        roleId: 'r1',
        tenantId: 't1',
        newClearanceLevel: 8,
        actorClearanceLevel: 8,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s when the custom role is not found for the tenant', async () => {
    const { service, prisma } = build(null);
    await expect(
      service.updateRoleClearance(prisma as never, {
        roleId: 'missing',
        tenantId: 't1',
        newClearanceLevel: 5,
        actorClearanceLevel: 8,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids an actor without authority over the level', async () => {
    const { service, prisma } = build(customRole(5, []));
    await expect(
      service.updateRoleClearance(prisma as never, {
        roleId: 'r1',
        tenantId: 't1',
        newClearanceLevel: 5,
        actorClearanceLevel: 6, // below the 7 floor for custom-role authority
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reject-and-lists pools that would exceed the lowered level', async () => {
    const { service, prisma, update } = build(customRole(5, [5, 2]));
    await expect(
      service.updateRoleClearance(prisma as never, {
        roleId: 'r1',
        tenantId: 't1',
        newClearanceLevel: 3,
        actorClearanceLevel: 8,
      }),
    ).rejects.toMatchObject({
      response: {
        conflictingPools: [{ id: 'p0', name: 'Pool 0', clearanceLevel: 5 }],
      },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('applies the change when no assigned pool exceeds the new level', async () => {
    const { service, prisma, update } = build(customRole(5, [4, 2]));
    const result = await service.updateRoleClearance(prisma as never, {
      roleId: 'r1',
      tenantId: 't1',
      newClearanceLevel: 6,
      actorClearanceLevel: 8,
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { clearanceLevel: 6 },
    });
    expect(result).toMatchObject({ clearanceLevel: 6 });
  });
});
