import { seedStandardFeeCatalogue, STANDARD_FEE_ITEMS } from './fee-catalogue';

describe('seedStandardFeeCatalogue', () => {
  it('inserts the whole standard catalogue for the tenant, skipping duplicates', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 10 });
    const client = { feeItem: { createMany } };

    const inserted = await seedStandardFeeCatalogue(client, 'tenant-1');

    expect(inserted).toBe(10);
    const args = createMany.mock.calls[0][0];
    expect(args.skipDuplicates).toBe(true);
    expect(args.data).toHaveLength(STANDARD_FEE_ITEMS.length);
    // Every row is scoped to the tenant and active, and carries a known code.
    expect(
      args.data.every((r: { tenantId: string }) => r.tenantId === 'tenant-1'),
    ).toBe(true);
    expect(args.data.every((r: { active: boolean }) => r.active === true)).toBe(
      true,
    );
    expect(args.data.map((r: { code: string }) => r.code)).toContain('tuition');
  });

  it('returns the count actually inserted (0 when everything already exists)', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 0 });
    const inserted = await seedStandardFeeCatalogue(
      { feeItem: { createMany } },
      'tenant-1',
    );
    expect(inserted).toBe(0);
  });
});
