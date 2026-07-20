/**
 * PermissionPoolService Gate 4 — update-time consistency for a pool's
 * clearance level (requirements/role-permissions-management.md). Prisma is
 * stubbed; these prove system pools are immutable and that raising a pool's
 * clearance reject-and-lists roles that would fall below it.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PermissionPoolService } from './permission-pool.service';

function build(pool: unknown) {
  const update = jest.fn(async ({ data }: any) => ({ id: 'p1', ...data }));
  const prisma = {
    permissionPool: {
      findUnique: jest.fn().mockResolvedValue(pool),
      update,
    },
  };
  return { service: new PermissionPoolService(), prisma, update };
}

const tenantPool = (
  clearanceLevel: number,
  roleLevels: number[],
  overrides: Record<string, unknown> = {},
) => ({
  id: 'p1',
  name: 'Custom Pool',
  clearanceLevel,
  isSystemPool: false,
  tenantId: 't1',
  rolePools: roleLevels.map((lvl, i) => ({
    role: { id: `r${i}`, name: `Role ${i}`, clearanceLevel: lvl },
  })),
  ...overrides,
});

describe('PermissionPoolService.updatePoolClearance (Gate 4)', () => {
  it('rejects a clearance level outside 0-10', async () => {
    const { service, prisma } = build(tenantPool(3, []));
    await expect(
      service.updatePoolClearance(prisma as never, {
        poolId: 'p1',
        tenantId: 't1',
        newClearanceLevel: 11,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s when the pool is not found', async () => {
    const { service, prisma } = build(null);
    await expect(
      service.updatePoolClearance(prisma as never, {
        poolId: 'missing',
        tenantId: 't1',
        newClearanceLevel: 3,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids modifying a system pool', async () => {
    const { service, prisma } = build(
      tenantPool(3, [], { isSystemPool: true, tenantId: null }),
    );
    await expect(
      service.updatePoolClearance(prisma as never, {
        poolId: 'p1',
        tenantId: 't1',
        newClearanceLevel: 3,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids modifying a pool owned by another tenant', async () => {
    const { service, prisma } = build(tenantPool(3, [], { tenantId: 't2' }));
    await expect(
      service.updatePoolClearance(prisma as never, {
        poolId: 'p1',
        tenantId: 't1',
        newClearanceLevel: 3,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reject-and-lists roles that would fall below the raised level', async () => {
    const { service, prisma, update } = build(tenantPool(3, [7, 2]));
    await expect(
      service.updatePoolClearance(prisma as never, {
        poolId: 'p1',
        tenantId: 't1',
        newClearanceLevel: 5,
      }),
    ).rejects.toMatchObject({
      response: {
        conflictingRoles: [{ id: 'r1', name: 'Role 1', clearanceLevel: 2 }],
      },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('applies the change when every referencing role stays above the new level', async () => {
    const { service, prisma, update } = build(tenantPool(3, [7, 5]));
    const result = await service.updatePoolClearance(prisma as never, {
      poolId: 'p1',
      tenantId: 't1',
      newClearanceLevel: 5,
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { clearanceLevel: 5 },
    });
    expect(result).toMatchObject({ clearanceLevel: 5 });
  });
});
