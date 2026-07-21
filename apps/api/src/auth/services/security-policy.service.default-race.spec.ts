import { Prisma } from '@workspace/database';
import { SecurityPolicyService } from './security-policy.service';

/**
 * Pins the concurrency contract of getOrCreateDefaultPolicy.
 *
 * `schoolId` is unique and the existence check cannot be atomic with the
 * create, so two callers that both find no policy will both try to create one.
 * GET /auth/me does exactly that on a tenant's first request — it resolves the
 * session policy and the biometric enrolment policy in the same Promise.all —
 * which used to surface as a 409 on first page load.
 */
describe('SecurityPolicyService.getOrCreateDefaultPolicy — create race', () => {
  let service: SecurityPolicyService;

  const uniqueViolation = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  const policy = { id: 'p1', schoolId: 's1', policyTier: 'basic' };

  beforeEach(() => {
    jest.restoreAllMocks();
    service = new SecurityPolicyService();
  });

  it('returns the existing policy without attempting a create', async () => {
    const getSchoolPolicy = jest
      .spyOn(service, 'getSchoolPolicy')
      .mockResolvedValue(policy as never);
    const assignPolicy = jest.spyOn(service, 'assignPolicy');

    await expect(
      service.getOrCreateDefaultPolicy({} as never, 's1'),
    ).resolves.toEqual(policy);

    expect(assignPolicy).not.toHaveBeenCalled();
    expect(getSchoolPolicy).toHaveBeenCalledTimes(1);
  });

  it('creates the default policy when none exists', async () => {
    jest.spyOn(service, 'getSchoolPolicy').mockResolvedValue(null);
    const assignPolicy = jest
      .spyOn(service, 'assignPolicy')
      .mockResolvedValue(policy as never);

    await expect(
      service.getOrCreateDefaultPolicy({} as never, 's1'),
    ).resolves.toEqual(policy);

    expect(assignPolicy).toHaveBeenCalledTimes(1);
  });

  it('reads back the winner’s row when it loses the create race', async () => {
    // First read: absent. Second read (after the conflict): the winner's row.
    jest
      .spyOn(service, 'getSchoolPolicy')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(policy as never);
    jest.spyOn(service, 'assignPolicy').mockRejectedValue(uniqueViolation());

    await expect(
      service.getOrCreateDefaultPolicy({} as never, 's1'),
    ).resolves.toEqual(policy);
  });

  it('rethrows a unique violation that leaves nothing to read back', async () => {
    // Not a lost race — a conflict from somewhere else. Inventing a policy here
    // would hide it.
    jest.spyOn(service, 'getSchoolPolicy').mockResolvedValue(null);
    jest.spyOn(service, 'assignPolicy').mockRejectedValue(uniqueViolation());

    await expect(
      service.getOrCreateDefaultPolicy({} as never, 's1'),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('does not swallow unrelated failures', async () => {
    jest.spyOn(service, 'getSchoolPolicy').mockResolvedValue(null);
    jest
      .spyOn(service, 'assignPolicy')
      .mockRejectedValue(new Error('database is down'));

    await expect(
      service.getOrCreateDefaultPolicy({} as never, 's1'),
    ).rejects.toThrow('database is down');
  });
});
