import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PeopleDirectoryController } from './people-directory.controller';

/**
 * The per-tab authorization boundary. The service-level e2e proves masking +
 * tenant isolation + projection; this proves the controller refuses a tab the
 * caller lacks the type permission for (server-side, not hidden UI) and wires
 * the contact-reveal scope.
 */
describe('PeopleDirectoryController', () => {
  const list = jest.fn();
  const exportRows = jest.fn();
  const summaryFn = jest.fn();
  const detailFn = jest.fn();
  const facetsFn = jest.fn();
  const checkPermissions = jest.fn();

  function makeController(grantedPermissions: string[]) {
    checkPermissions.mockImplementation(
      (_ctx: unknown, [permission]: string[]) => ({
        granted: grantedPermissions.includes(permission),
      }),
    );
    return new PeopleDirectoryController(
      {
        list,
        export: exportRows,
        summary: summaryFn,
        detail: detailFn,
        facets: facetsFn,
      } as never,
      { checkPermissions } as never,
    );
  }

  const req = {
    user: { tenantId: 't1', userId: 'u1' },
    userContext: { userId: 'u1', tenantId: 't1' },
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    list.mockResolvedValue({ data: [], pagination: {}, meta: {} });
    detailFn.mockResolvedValue({ id: 'p1', type: 'all', name: 'Ada' });
    facetsFn.mockResolvedValue({ grades: [], departments: [] });
  });

  it('refuses a tab the caller lacks the type permission for', async () => {
    const controller = makeController(['people.view']); // no staff.view
    await expect(
      controller.list({ type: 'staff' }, req),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(list).not.toHaveBeenCalled();
  });

  it('defaults to the All roster (gated on people.view alone)', async () => {
    const controller = makeController(['people.view']); // no per-type perms
    await controller.list({}, req);
    expect(list).toHaveBeenCalledWith('t1', 'all', false, {});
  });

  it('maps prospect → admissions.view and staff → staff.view', async () => {
    const staff = makeController(['people.view', 'staff.view']);
    await staff.list({ type: 'staff' }, req);
    expect(list).toHaveBeenLastCalledWith('t1', 'staff', false, {
      type: 'staff',
    });

    const prospect = makeController(['people.view', 'admissions.view']);
    await prospect.list({ type: 'prospect' }, req);
    expect(list).toHaveBeenLastCalledWith('t1', 'prospect', false, {
      type: 'prospect',
    });
  });

  it('passes canViewContact=true only when people.view_contact is held', async () => {
    const controller = makeController([
      'people.view',
      'students.view',
      'people.view_contact',
    ]);
    await controller.list({ type: 'student' }, req);
    expect(list).toHaveBeenCalledWith('t1', 'student', true, {
      type: 'student',
    });
  });

  it('enforces the type permission on export too', async () => {
    const controller = makeController(['people.view']); // no staff.view
    await expect(
      controller.export({ type: 'staff', ids: ['p1'] }, req),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(exportRows).not.toHaveBeenCalled();
  });

  it('summary counts only the tabs the caller may view', async () => {
    // people.view (→ all) + students.view, but NOT staff/users/guardians/admissions.
    const controller = makeController(['people.view', 'students.view']);
    await controller.summary(req);
    expect(summaryFn).toHaveBeenCalledWith('t1', ['all', 'student']);
  });

  it('detail refuses a tab the caller lacks the type permission for', async () => {
    const controller = makeController(['people.view']); // no staff.view
    await expect(controller.detail('p1', 'staff', req)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(detailFn).not.toHaveBeenCalled();
  });

  it('detail passes per-section permissions + contact scope through', async () => {
    const controller = makeController([
      'people.view',
      'students.view',
      'people.view_contact',
    ]);
    await controller.detail('p1', 'all', req);
    expect(detailFn).toHaveBeenCalledWith(
      't1',
      'p1',
      'all',
      { students: true, staff: false, guardians: false, users: false },
      true,
    );
  });

  it('detail 404s when the person is not found', async () => {
    const controller = makeController(['people.view']);
    detailFn.mockResolvedValue(null);
    await expect(
      controller.detail('missing', 'all', req),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('facets reads the tenant facets', async () => {
    const controller = makeController(['people.view']);
    await controller.facets(req);
    expect(facetsFn).toHaveBeenCalledWith('t1');
  });
});
