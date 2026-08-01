import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SavedViewService } from './saved-view.service';

describe('SavedViewService', () => {
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const del = jest.fn();
  const updateMany = jest.fn();
  const write = jest.fn();
  const client = {
    savedView: { findMany, findFirst, create, update, delete: del, updateMany },
  };
  const service = new SavedViewService({ client } as never, { write } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    write.mockResolvedValue(true);
    updateMany.mockResolvedValue({ count: 0 });
  });

  it("lists the owner's own views plus tenant-shared ones", async () => {
    findMany.mockResolvedValue([]);
    await service.list('tenant-1', 'profile-1', 'students');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          resource: 'students',
          OR: [{ ownerUserTenantId: 'profile-1' }, { isShared: true }],
        },
      }),
    );
  });

  it('stamps the owner + creator and audits on create', async () => {
    create.mockResolvedValue({
      id: 'v1',
      resource: 'students',
      isShared: false,
    });
    await service.create('tenant-1', 'profile-1', 'user-1', {
      resource: 'students',
      name: 'Owing',
      state: { filters: { status: 'owing' } },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          ownerUserTenantId: 'profile-1',
          createdBy: 'user-1',
          resource: 'students',
        }),
      }),
    );
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'directory.saved_view.create' }),
    );
  });

  it('clears any prior default when creating a default view', async () => {
    create.mockResolvedValue({
      id: 'v1',
      resource: 'students',
      isShared: false,
    });
    await service.create('tenant-1', 'profile-1', 'user-1', {
      resource: 'students',
      name: 'Default',
      state: {},
      isDefault: true,
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerUserTenantId: 'profile-1',
          resource: 'students',
          isDefault: true,
        }),
        data: { isDefault: false },
      }),
    );
  });

  it('refuses to update a view owned by another profile', async () => {
    findFirst.mockResolvedValue({
      id: 'v1',
      ownerUserTenantId: 'someone-else',
      resource: 'students',
    });
    await expect(
      service.update('tenant-1', 'profile-1', 'user-1', 'v1', { name: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('404s when updating a missing view', async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      service.update('tenant-1', 'profile-1', 'user-1', 'missing', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes an owned view and audits it', async () => {
    findFirst.mockResolvedValue({
      id: 'v1',
      ownerUserTenantId: 'profile-1',
      resource: 'students',
    });
    del.mockResolvedValue({ id: 'v1' });
    const res = await service.remove('tenant-1', 'profile-1', 'user-1', 'v1');
    expect(del).toHaveBeenCalledWith({ where: { id: 'v1' } });
    expect(res).toEqual({ deleted: true });
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'directory.saved_view.delete' }),
    );
  });
});
