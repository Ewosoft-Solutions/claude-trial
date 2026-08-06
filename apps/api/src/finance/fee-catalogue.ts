/**
 * The starter fee-item catalogue every tenant gets.
 *
 * Codes are stable slugs referenced by invoice lines and discount policies —
 * keep this list in lock-step with the slice-1 backfill migration
 * (20260806030000_fee_items_and_invoice_lines), which seeded the same set for
 * tenants that already existed when the table was introduced. Amounts are left
 * unset; each school sets its own on the /finance/fee-items page.
 */
export const STANDARD_FEE_ITEMS: ReadonlyArray<{ code: string; name: string }> =
  [
    { code: 'tuition', name: 'Tuition' },
    { code: 'bus', name: 'Bus' },
    { code: 'books', name: 'Books' },
    { code: 'lab', name: 'Lab' },
    { code: 'uniform', name: 'Uniform' },
    { code: 'exam', name: 'Exam' },
    { code: 'boarding', name: 'Boarding' },
    { code: 'pta_levy', name: 'PTA levy' },
    { code: 'excursion', name: 'Excursion' },
    { code: 'id_card', name: 'ID card' },
  ];

/** Minimal structural client — satisfied by both PrismaClient and a tx client. */
type FeeItemWriter = {
  feeItem: {
    createMany(args: {
      data: Array<{
        tenantId: string;
        code: string;
        name: string;
        active: boolean;
      }>;
      skipDuplicates?: boolean;
    }): Promise<{ count: number }>;
  };
};

/**
 * Idempotently seed the standard fee-item catalogue for a tenant.
 *
 * MUST run inside an RLS scope for `tenantId` (e.g. `withTenantScope` /
 * `runScoped`): fee_items FORCEs row-level security, so the INSERT's WITH CHECK
 * needs `app.current_tenant_id` to match. Existing codes are left untouched
 * (`skipDuplicates` on the (tenant_id, code) unique index), so it is safe to
 * re-run — a school that already has a catalogue gains only the codes it lacks.
 *
 * @returns the number of rows actually inserted.
 */
export async function seedStandardFeeCatalogue(
  client: FeeItemWriter,
  tenantId: string,
): Promise<number> {
  const result = await client.feeItem.createMany({
    data: STANDARD_FEE_ITEMS.map((item) => ({
      tenantId,
      code: item.code,
      name: item.name,
      active: true,
    })),
    skipDuplicates: true,
  });
  return result.count;
}
