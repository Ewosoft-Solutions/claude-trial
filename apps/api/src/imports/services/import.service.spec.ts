/**
 * Separation of duties on bulk imports.
 *
 * An import writes rows in bulk, and the clearance floor on the approve route
 * governs WHO may approve, never WHOSE work — so without this guard one person
 * could stage and commit a bulk write end to end. `createdBy` and the actor are
 * both USER ids here (the controller passes `userId` on create and on approve).
 * See docs/self-approval-audit.md.
 */
import { ForbiddenException } from '@nestjs/common';

import { IMPORT_STATUS } from '../imports.constants';
import { ImportService } from './import.service';

const TENANT = 'tenant-1';
const UPLOADER = 'user-uploader';
const APPROVER = 'user-approver';

function makeService(job: Record<string, unknown>) {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    importJob: {
      findFirst: jest.fn().mockResolvedValue(job),
      update: jest.fn().mockImplementation((args: { data: unknown }) => {
        updates.push(args.data as Record<string, unknown>);
        return Promise.resolve({ id: 'job-1', ...(args.data as object) });
      }),
    },
  };
  const tenantDb = { client } as never;
  const audit = { write: jest.fn().mockResolvedValue(undefined) } as never;
  const documents = {} as never;
  return { service: new ImportService(tenantDb, audit, documents), updates };
}

const VALIDATED_JOB = {
  id: 'job-1',
  requiresApproval: true,
  status: IMPORT_STATUS.VALIDATED,
};

describe('ImportService.approve', () => {
  it('refuses to let the uploader approve their own import', async () => {
    const { service } = makeService({
      ...VALIDATED_JOB,
      createdBy: UPLOADER,
    });
    await expect(service.approve(TENANT, UPLOADER, 'job-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lets a second person approve it', async () => {
    const { service, updates } = makeService({
      ...VALIDATED_JOB,
      createdBy: UPLOADER,
    });
    await service.approve(TENANT, APPROVER, 'job-1');
    expect(updates[0]).toMatchObject({
      status: IMPORT_STATUS.APPROVED,
      approvedBy: APPROVER,
    });
  });

  it('checks authorship BEFORE the status gate', async () => {
    // Order matters for what the uploader learns: a self-approval attempt must
    // be refused as self-approval, not leak that the job is merely the wrong
    // status — and must stay refused once the status is right.
    const { service } = makeService({
      ...VALIDATED_JOB,
      status: IMPORT_STATUS.DRY_RUN,
      createdBy: UPLOADER,
    });
    await expect(service.approve(TENANT, UPLOADER, 'job-1')).rejects.toThrow(
      /your own import/,
    );
  });

  it('still approves a job with no recorded uploader', async () => {
    // Pre-guard rows can carry a null `createdBy` — unknown authorship, not
    // self-approval, so they must not become unapprovable.
    const { service, updates } = makeService({
      ...VALIDATED_JOB,
      createdBy: null,
    });
    await service.approve(TENANT, APPROVER, 'job-1');
    expect(updates[0]).toMatchObject({ status: IMPORT_STATUS.APPROVED });
  });
});
