import { FinanceHouseholdService } from './finance-household.service';

/**
 * The two behaviours that carry risk: auto-derive must cluster a guardian's
 * wards into ONE household and skip guardians who already have a home (so it is
 * idempotent + merge-safe), and merge must move members/payers + re-point
 * invoices before deleting the absorbed household.
 */
describe('FinanceHouseholdService', () => {
  const billingHousehold = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const householdMember = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const householdPayer = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const guardianRelationship = { findMany: jest.fn() };
  const student = { findMany: jest.fn() };
  const person = { findMany: jest.fn() };
  const feeInvoice = { updateMany: jest.fn() };
  // WB5 hung two more money tables off the household; a merge that forgets
  // them orphans the family's credit and payment history.
  const accountCredit = { updateMany: jest.fn() };
  const payment = { updateMany: jest.fn() };
  const client = {
    billingHousehold,
    householdMember,
    householdPayer,
    guardianRelationship,
    student,
    person,
    feeInvoice,
    accountCredit,
    payment,
  };
  const service = new FinanceHouseholdService({ client } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    billingHousehold.create.mockResolvedValue({ id: 'h1' });
  });

  describe('autoDerive', () => {
    beforeEach(() => {
      guardianRelationship.findMany.mockResolvedValue([
        { guardianPersonId: 'g1', wardPersonId: 'w1' },
        { guardianPersonId: 'g1', wardPersonId: 'w2' },
        { guardianPersonId: 'g2', wardPersonId: 'w3' },
      ]);
      student.findMany.mockResolvedValue([
        {
          id: 's1',
          personId: 'w1',
          userTenant: { user: { firstName: 'Ada', lastName: 'Okafor' } },
        },
        {
          id: 's2',
          personId: 'w2',
          userTenant: { user: { firstName: 'Chidi', lastName: 'Okafor' } },
        },
        {
          id: 's3',
          personId: 'w3',
          userTenant: { user: { firstName: 'Bola', lastName: 'Ade' } },
        },
      ]);
      person.findMany.mockResolvedValue([
        { id: 'g1', firstName: 'Amaka', lastName: 'Okafor' },
        { id: 'g2', firstName: 'Tunde', lastName: 'Ade' },
      ]);
    });

    it('clusters a guardian’s wards into one household and skips guardians who already pay', async () => {
      // g1 is not yet a payer anywhere; g2 already is → g2 is skipped.
      householdPayer.findFirst.mockImplementation(async ({ where }: any) =>
        where.guardianId === 'g2' ? { id: 'existing' } : null,
      );

      const result = await service.autoDerive('t1', 'user-1');

      expect(result).toEqual({ created: 1, skipped: 1 });
      // One household, for g1, tagged with its derivation source.
      expect(billingHousehold.create).toHaveBeenCalledTimes(1);
      expect(billingHousehold.create.mock.calls[0][0].data).toMatchObject({
        derivedFromGuardianId: 'g1',
        primaryPayerName: 'Amaka Okafor',
      });
      // Both of g1's students become members; g2's student does not.
      const memberStudentIds = householdMember.create.mock.calls.map(
        (c) => c[0].data.studentId,
      );
      expect(memberStudentIds.sort()).toEqual(['s1', 's2']);
      expect(householdPayer.create).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when every guardian already has a household', async () => {
      householdPayer.findFirst.mockResolvedValue({ id: 'existing' });
      const result = await service.autoDerive('t1');
      expect(result).toEqual({ created: 0, skipped: 2 });
      expect(billingHousehold.create).not.toHaveBeenCalled();
    });
  });

  describe('merge', () => {
    it('moves members + payers, re-points invoices, deletes the source', async () => {
      billingHousehold.findFirst.mockResolvedValue({
        id: 'x',
        members: [],
        payers: [],
      });
      householdMember.findMany
        .mockResolvedValueOnce([{ studentId: 's1', studentName: 'Ada' }]) // source
        .mockResolvedValueOnce([]); // target
      householdPayer.findMany
        .mockResolvedValueOnce([{ guardianId: 'g1', payerName: 'Amaka' }]) // source
        .mockResolvedValueOnce([]); // target

      await service.merge('t1', 'target', 'source');

      expect(householdMember.create.mock.calls[0][0].data).toMatchObject({
        householdId: 'target',
        studentId: 's1',
      });
      expect(householdPayer.create.mock.calls[0][0].data).toMatchObject({
        householdId: 'target',
        guardianId: 'g1',
        role: 'secondary',
      });
      expect(accountCredit.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 't1', householdId: 'source' },
        data: { householdId: 'target' },
      });
      expect(payment.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 't1', householdId: 'source' },
        data: { householdId: 'target' },
      });
      expect(feeInvoice.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 't1', householdId: 'source' },
        data: { householdId: 'target' },
      });
      expect(billingHousehold.delete).toHaveBeenCalledWith({
        where: { id: 'source' },
      });
    });

    it('refuses to merge a household into itself', async () => {
      await expect(service.merge('t1', 'same', 'same')).rejects.toThrow(
        /into itself/,
      );
    });
  });
});
