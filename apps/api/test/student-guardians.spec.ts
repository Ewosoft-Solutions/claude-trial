import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StudentService } from '../src/student/services/student.service';
import { DatabaseService } from '../src/common/database/database.service';
import { PrismaTransactionService } from '../src/common/database/prisma-transaction.service';
import { UserInvitationService } from '../src/tenant/services/user-invitation.service';
import { QueueService } from '../src/common/queue/queue.service';
import {
  createMockContext,
  MockContext,
} from '../src/common/__tests__/test-utils';
import { PrismaClient } from '@workspace/database';

describe('StudentService.bulkUpsertGuardians', () => {
  let service: StudentService;
  let mockPrisma: MockContext['prisma'];

  const mockDb = {
    client: null as any,
  } as DatabaseService;

  const mockTx = {
    runInTransaction: jest.fn(),
  } as unknown as PrismaTransactionService;

  const mockInvitationService = {
    createInvitation: jest.fn(),
  } as unknown as UserInvitationService;

  const mockQueue = {
    enqueue: jest.fn(() => ({ id: 'job-1' })),
    markCompleted: jest.fn(),
    markFailed: jest.fn(),
  } as unknown as QueueService;

  beforeEach(async () => {
    const mockCtx = createMockContext();
    mockPrisma = mockCtx.prisma;
    mockDb.client = mockPrisma as unknown as PrismaClient;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: PrismaTransactionService, useValue: mockTx },
        { provide: UserInvitationService, useValue: mockInvitationService },
        { provide: QueueService, useValue: mockQueue },
      ],
    }).compile();

    service = module.get<StudentService>(StudentService);

    mockPrisma.role.findFirst.mockResolvedValue({ id: 'parent-role' });
  });

  it('rejects rows without any identifier', async () => {
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'stu-1' });

    const result = await service.bulkUpsertGuardians('tenant-1', 'user-1', {
      items: [
        {
          studentId: 'stu-1',
          guardianFirstName: 'NoId',
          guardianLastName: 'Guardian',
        },
      ],
    });

    expect(result.failed).toBe(1);
    expect(result.errors[0].message).toContain('identifier');
    expect(result.jobId).toBe('job-1');
    expect(mockQueue.markCompleted).toHaveBeenCalledWith('job-1');
  });

  it('reuses guardian by guardianId without creating invitation', async () => {
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'stu-1' });
    mockPrisma.studentGuardian.findFirst.mockResolvedValue({
      userTenantId: 'profile-1',
    });
    mockPrisma.userTenantRole.upsert.mockResolvedValue({});
    mockPrisma.studentGuardian.upsert.mockResolvedValue({});

    const result = await service.bulkUpsertGuardians('tenant-1', 'user-1', {
      items: [
        {
          studentId: 'stu-1',
          guardianId: 'EXT-123',
          relationship: 'parent',
        },
      ],
    });

    expect(result.succeeded).toBe(1);
    expect(result.jobId).toBe('job-1');
    expect(result.status).toBe('completed');
    expect(mockPrisma.userTenantRole.upsert).toHaveBeenCalled();
    expect(mockPrisma.studentGuardian.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          guardianIdentifier: 'EXT-123',
        }),
        update: expect.objectContaining({
          guardianIdentifier: 'EXT-123',
        }),
      }),
    );
    expect(mockInvitationService.createInvitation).not.toHaveBeenCalled();
  });
});
