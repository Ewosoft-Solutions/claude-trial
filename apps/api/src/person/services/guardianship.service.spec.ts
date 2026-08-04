import { GuardianshipService } from './guardianship.service';

/** Build a GuardianshipService over jest-mock Prisma delegates. */
function makeService() {
  const personFindFirst = jest.fn();
  const relCreate = jest.fn();
  const relUpdate = jest.fn();
  const relUpdateMany = jest.fn();
  const relFindFirst = jest.fn();
  const relFindMany = jest.fn();
  const historyCreate = jest.fn();
  const write = jest.fn();
  const client = {
    person: { findFirst: personFindFirst },
    guardianRelationship: {
      create: relCreate,
      update: relUpdate,
      updateMany: relUpdateMany,
      findFirst: relFindFirst,
      findMany: relFindMany,
    },
    relationshipHistory: { create: historyCreate },
  };
  const service = new GuardianshipService(
    { client } as never,
    { write } as never,
  );
  return {
    service,
    personFindFirst,
    relCreate,
    relUpdate,
    relUpdateMany,
    relFindFirst,
    relFindMany,
    historyCreate,
    write,
  };
}

const persons = { g1: 'active', w1: 'active' } as Record<string, string>;

function relRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rel1',
    guardianPersonId: 'g1',
    wardPersonId: 'w1',
    relationship: 'parent',
    isPrimary: false,
    legalGuardian: false,
    contactPriority: null,
    custodyType: null,
    canPickup: false,
    canAuthorizeMedical: false,
    isEmergencyContact: false,
    isBillingContact: false,
    consentResults: true,
    consentFinance: true,
    consentAttendance: true,
    consentGeneral: true,
    verifiedAt: null,
    verifiedBy: null,
    verificationMethod: null,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    endedReason: null,
    guardian: {
      id: 'g1',
      firstName: 'Grace',
      lastName: 'Guardian',
      preferredName: null,
    },
    ward: {
      id: 'w1',
      firstName: 'Wale',
      lastName: 'Ward',
      preferredName: null,
    },
    ...overrides,
  };
}

describe('GuardianshipService', () => {
  describe('create', () => {
    it('rejects a person being their own guardian', async () => {
      const { service } = makeService();
      await expect(
        service.create('t1', 'actor', {
          guardianPersonId: 'x',
          wardPersonId: 'x',
        }),
      ).rejects.toThrow(/own guardian/i);
    });

    it('defaults operational consent ON, records history on both sides + audit', async () => {
      const t = makeService();
      t.personFindFirst.mockImplementation(({ where }: any) =>
        Promise.resolve(
          persons[where.id]
            ? { id: where.id, status: persons[where.id] }
            : null,
        ),
      );
      t.relCreate.mockResolvedValue(relRow());

      await t.service.create('t1', 'actor', {
        guardianPersonId: 'g1',
        wardPersonId: 'w1',
        isEmergencyContact: true,
      });

      const data = t.relCreate.mock.calls[0][0].data;
      expect(data.consentResults).toBe(true);
      expect(data.consentFinance).toBe(true);
      expect(data.isEmergencyContact).toBe(true);
      // one history entry for the guardian, one for the ward
      expect(t.historyCreate).toHaveBeenCalledTimes(2);
      expect(t.write).toHaveBeenCalledTimes(1);
      expect(t.write.mock.calls[0][0].action).toBe('guardianship.create');
    });
  });

  describe('resolveAudience', () => {
    it('a non-emergency category filters by that consent flag', async () => {
      const t = makeService();
      t.relFindMany.mockResolvedValue([relRow()]);
      await t.service.resolveAudience('t1', 'w1', 'finance');
      const where = t.relFindMany.mock.calls[0][0].where;
      expect(where).toMatchObject({
        tenantId: 't1',
        wardPersonId: 'w1',
        effectiveTo: null,
        consentFinance: true,
      });
      // never gates on a gender label
      expect(where).not.toHaveProperty('gender');
    });

    it('emergency returns emergency contacts regardless of consent', async () => {
      const t = makeService();
      t.relFindMany.mockResolvedValue([relRow({ isEmergencyContact: true })]);
      await t.service.resolveAudience('t1', 'w1', 'emergency');
      const where = t.relFindMany.mock.calls[0][0].where;
      expect(where.isEmergencyContact).toBe(true);
      expect(where).not.toHaveProperty('consentResults');
      expect(where).not.toHaveProperty('consentGeneral');
    });

    it('orders primary first, then by contact priority', async () => {
      const t = makeService();
      t.relFindMany.mockResolvedValue([]);
      await t.service.resolveAudience('t1', 'w1', 'results');
      expect(t.relFindMany.mock.calls[0][0].orderBy).toEqual([
        { isPrimary: 'desc' },
        { contactPriority: 'asc' },
        { createdAt: 'asc' },
      ]);
    });

    it('projects recipients by relationship, not a gender label', async () => {
      const t = makeService();
      t.relFindMany.mockResolvedValue([
        relRow({ isPrimary: true, contactPriority: 1 }),
      ]);
      const audience = await t.service.resolveAudience('t1', 'w1', 'general');
      expect(audience).toEqual([
        expect.objectContaining({
          guardianPersonId: 'g1',
          guardianName: 'Grace Guardian',
          relationship: 'parent',
          isPrimary: true,
          contactPriority: 1,
        }),
      ]);
    });
  });

  describe('update', () => {
    it('only writes the fields provided', async () => {
      const t = makeService();
      t.relFindFirst.mockResolvedValue(relRow());
      t.relUpdate.mockResolvedValue(relRow({ custodyType: 'joint' }));
      await t.service.update('t1', 'actor', 'rel1', {
        custodyType: 'joint',
        consentFinance: false,
      });
      const data = t.relUpdate.mock.calls[0][0].data;
      expect(data).toEqual({ custodyType: 'joint', consentFinance: false });
      expect(t.write.mock.calls[0][0].action).toBe('guardianship.update');
    });

    it('refuses to edit an ended relationship', async () => {
      const t = makeService();
      t.relFindFirst.mockResolvedValue(
        relRow({ effectiveTo: new Date('2026-02-01') }),
      );
      await expect(
        t.service.update('t1', 'actor', 'rel1', { isPrimary: true }),
      ).rejects.toThrow(/ended/i);
    });
  });

  describe('exactly one primary contact per ward', () => {
    it('creating a primary demotes any other current primary for the ward', async () => {
      const t = makeService();
      t.personFindFirst.mockImplementation(({ where }: any) =>
        Promise.resolve(
          persons[where.id]
            ? { id: where.id, status: persons[where.id] }
            : null,
        ),
      );
      t.relCreate.mockResolvedValue(relRow({ isPrimary: true }));
      await t.service.create('t1', 'actor', {
        guardianPersonId: 'g1',
        wardPersonId: 'w1',
        isPrimary: true,
      });
      // On create the new row does not exist yet, so all the ward's current
      // primaries are demoted (no id exclusion) before it is inserted.
      expect(t.relUpdateMany).toHaveBeenCalledWith({
        where: {
          tenantId: 't1',
          wardPersonId: 'w1',
          effectiveTo: null,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    });

    it('does NOT demote others when the new relationship is not primary', async () => {
      const t = makeService();
      t.personFindFirst.mockImplementation(({ where }: any) =>
        Promise.resolve({ id: where.id, status: 'active' }),
      );
      t.relCreate.mockResolvedValue(relRow({ isPrimary: false }));
      await t.service.create('t1', 'actor', {
        guardianPersonId: 'g1',
        wardPersonId: 'w1',
      });
      expect(t.relUpdateMany).not.toHaveBeenCalled();
    });

    it('promoting via update demotes the previous primary', async () => {
      const t = makeService();
      t.relFindFirst.mockResolvedValue(relRow({ isPrimary: false }));
      t.relUpdate.mockResolvedValue(relRow({ isPrimary: true }));
      await t.service.update('t1', 'actor', 'rel1', { isPrimary: true });
      expect(t.relUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            wardPersonId: 'w1',
            id: { not: 'rel1' },
            isPrimary: true,
          }),
          data: { isPrimary: false },
        }),
      );
    });
  });

  describe('verify + end', () => {
    it('verify stamps verifiedAt/By/method', async () => {
      const t = makeService();
      t.relFindFirst.mockResolvedValue(relRow());
      t.relUpdate.mockResolvedValue(relRow({ verifiedAt: new Date() }));
      await t.service.verify('t1', 'actor', 'rel1', 'document');
      const data = t.relUpdate.mock.calls[0][0].data;
      expect(data.verifiedBy).toBe('actor');
      expect(data.verificationMethod).toBe('document');
      expect(data.verifiedAt).toBeInstanceOf(Date);
    });

    it('end sets effectiveTo + reason and records history on both sides', async () => {
      const t = makeService();
      t.relFindFirst.mockResolvedValue(relRow());
      t.relUpdate.mockResolvedValue(
        relRow({ effectiveTo: new Date(), endedReason: 'moved' }),
      );
      await t.service.end('t1', 'actor', 'rel1', 'moved');
      const data = t.relUpdate.mock.calls[0][0].data;
      expect(data.effectiveTo).toBeInstanceOf(Date);
      expect(data.endedReason).toBe('moved');
      expect(t.historyCreate).toHaveBeenCalledTimes(2);
      expect(t.write.mock.calls[0][0].action).toBe('guardianship.end');
    });
  });
});
