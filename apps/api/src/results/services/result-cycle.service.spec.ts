/**
 * Separation of duties on result publication.
 *
 * The workbench cannot withhold the approve action without knowing whose cycle
 * it is. `approve-publish` already refuses a self-approval (maker-checker);
 * this read is what stops the button being offered at all. The maker lives on
 * the MakerCheckerRequest rather than the cycle, so it is read from there —
 * once per page, not once per row. See docs/self-approval-audit.md.
 */
import { describe, it, expect, jest } from '@jest/globals';

import { ResultCycleService } from './result-cycle.service';

function makeService(
  cycles: Record<string, unknown>[],
  myRequestIds: string[],
) {
  const makerCheckerRequest = {
    findMany: jest
      .fn<() => Promise<{ id: string }[]>>()
      .mockResolvedValue(myRequestIds.map((id) => ({ id }))),
  };
  const client = {
    resultCycle: {
      findMany: jest
        .fn<() => Promise<Record<string, unknown>[]>>()
        .mockResolvedValue(cycles),
    },
    makerCheckerRequest,
  };
  const service = new ResultCycleService(
    { client } as never,
    { write: jest.fn() } as never,
    { resolveScope: jest.fn() } as never,
  );
  return { service, makerCheckerRequest };
}

const actor = { userId: 'user-me', clearanceLevel: 7 } as never;

describe('ResultCycleService.listCycles — separation of duties', () => {
  it('flags only the cycles whose publish request this reader raised', async () => {
    const { service } = makeService(
      [
        { id: 'mine', approvalRequestId: 'req-mine' },
        { id: 'theirs', approvalRequestId: 'req-theirs' },
      ],
      ['req-mine'],
    );
    const cycles = await service.listCycles('t1', actor);
    expect(cycles.map((c) => [c.id, c.isOwnRequest])).toEqual([
      ['mine', true],
      ['theirs', false],
    ]);
  });

  it('never flags a cycle with no publish request pending', async () => {
    // A draft has nobody waiting on it; it must not read as "yours to approve".
    const { service } = makeService(
      [{ id: 'draft', approvalRequestId: null }],
      [],
    );
    const cycles = await service.listCycles('t1', actor);
    expect(cycles[0].isOwnRequest).toBe(false);
  });

  it('does not query the maker table when nothing is pending', async () => {
    const { service, makerCheckerRequest } = makeService(
      [{ id: 'draft', approvalRequestId: null }],
      [],
    );
    await service.listCycles('t1', actor);
    expect(makerCheckerRequest.findMany).not.toHaveBeenCalled();
  });
});
