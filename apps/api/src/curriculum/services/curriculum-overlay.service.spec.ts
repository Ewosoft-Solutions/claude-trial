/**
 * Separation of duties on curriculum overlays.
 *
 * An overlay edits the curriculum spine every class is taught against, so the
 * author must not also be the approver. `create` and `approve` are both handed
 * the PROFILE id by the controller, so that is the identity compared here — see
 * docs/self-approval-audit.md for why comparing the wrong id silently disables
 * a guard like this.
 */
import { ForbiddenException } from '@nestjs/common';

import { CurriculumOverlayService } from './curriculum-overlay.service';

const TENANT = 'tenant-1';
const AUTHOR = 'profile-author';
const REVIEWER = 'profile-reviewer';

function makeService(overlay: Record<string, unknown> | null) {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    tenantCurriculumOverlay: {
      findFirst: jest.fn().mockResolvedValue(overlay),
      update: jest.fn().mockImplementation((args: { data: unknown }) => {
        updates.push(args.data as Record<string, unknown>);
        return Promise.resolve({ id: 'overlay-1', ...(args.data as object) });
      }),
    },
  };
  const tenantDb = { client } as never;
  const audit = { write: jest.fn().mockResolvedValue(undefined) } as never;
  return {
    service: new CurriculumOverlayService(tenantDb, audit),
    updates,
  };
}

describe('CurriculumOverlayService.approve', () => {
  it('refuses to let the author approve their own overlay', async () => {
    const { service } = makeService({ id: 'overlay-1', createdBy: AUTHOR });
    await expect(service.approve(TENANT, AUTHOR, 'overlay-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lets a different reviewer approve it', async () => {
    const { service, updates } = makeService({
      id: 'overlay-1',
      createdBy: AUTHOR,
    });
    await service.approve(TENANT, REVIEWER, 'overlay-1');
    expect(updates[0]).toMatchObject({
      status: 'active',
      approvedBy: REVIEWER,
    });
  });

  it('still approves when the overlay has no recorded author', async () => {
    // Pre-guard rows can carry a null `createdBy`; that is unknown authorship,
    // not self-approval, so it must not become unapprovable.
    const { service, updates } = makeService({
      id: 'overlay-1',
      createdBy: null,
    });
    await service.approve(TENANT, REVIEWER, 'overlay-1');
    expect(updates[0]).toMatchObject({ status: 'active' });
  });
});
