/**
 * Unit coverage for the WB2-4 promotion target resolver: which section a
 * promotion item is placed into, including the 'repeat' fallback to the
 * student's source section.
 */
import { describe, it, expect } from '@jest/globals';
import { PromotionService, resolveTargetSection } from './promotion.service';

describe('resolveTargetSection (WB2-4)', () => {
  it('promote/manual place into the proposed section', () => {
    expect(
      resolveTargetSection({
        decision: 'promote',
        proposedClassSectionId: 'sec-next',
        fromClassSectionId: 'sec-prev',
      }),
    ).toBe('sec-next');
    expect(
      resolveTargetSection({
        decision: 'manual',
        proposedClassSectionId: 'sec-manual',
        fromClassSectionId: 'sec-prev',
      }),
    ).toBe('sec-manual');
  });

  it("a repeat falls back to the student's source section", () => {
    expect(
      resolveTargetSection({
        decision: 'repeat',
        proposedClassSectionId: null,
        fromClassSectionId: 'sec-prev',
      }),
    ).toBe('sec-prev');
  });

  it('a repeat still honours an explicit proposed section', () => {
    expect(
      resolveTargetSection({
        decision: 'repeat',
        proposedClassSectionId: 'sec-chosen',
        fromClassSectionId: 'sec-prev',
      }),
    ).toBe('sec-chosen');
  });

  it('returns null for a promote with no proposal (needs manual placement)', () => {
    expect(
      resolveTargetSection({
        decision: 'promote',
        proposedClassSectionId: null,
        fromClassSectionId: 'sec-prev',
      }),
    ).toBeNull();
  });
});

describe('PromotionService.listRuns — separation of duties', () => {
  /**
   * The workbench cannot withhold the approve action without knowing whose
   * run it is. The approve route already refuses a self-approval
   * (maker-checker); this read is what stops the button being offered. The
   * maker lives on the MakerCheckerRequest, not the run — see
   * docs/self-approval-audit.md.
   */
  function makeService(
    runs: Record<string, unknown>[],
    myRequestIds: string[],
  ) {
    const client = {
      promotionRun: { findMany: jest.fn().mockResolvedValue(runs) },
      makerCheckerRequest: {
        findMany: jest
          .fn()
          .mockResolvedValue(myRequestIds.map((id) => ({ id }))),
      },
    };
    return new PromotionService(
      { client } as never,
      { write: jest.fn() } as never,
      { resolveScope: jest.fn() } as never,
      {} as never,
      {} as never,
    );
  }

  const actor = { userId: 'user-me', clearanceLevel: 7 } as never;

  it('flags only the runs whose approval request this reader raised', async () => {
    const service = makeService(
      [
        { id: 'mine', approvalRequestId: 'req-mine' },
        { id: 'theirs', approvalRequestId: 'req-theirs' },
      ],
      ['req-mine'],
    );
    const runs = await service.listRuns('t1', actor);
    expect(runs.map((r) => [r.id, r.isOwnRequest])).toEqual([
      ['mine', true],
      ['theirs', false],
    ]);
  });

  it('never flags a run with no approval request', async () => {
    // A draft has nobody waiting on it; it must not read as "yours to approve".
    const service = makeService([{ id: 'draft', approvalRequestId: null }], []);
    const runs = await service.listRuns('t1', actor);
    expect(runs[0].isOwnRequest).toBe(false);
  });

  it('does not query the maker table when nothing is pending', async () => {
    // One query per page, and none at all when there is nothing to check.
    const service = makeService([{ id: 'draft', approvalRequestId: null }], []);
    await service.listRuns('t1', actor);
    const client = (service as unknown as { tenantDb: { client: any } })
      .tenantDb.client;
    expect(client.makerCheckerRequest.findMany).not.toHaveBeenCalled();
  });
});
