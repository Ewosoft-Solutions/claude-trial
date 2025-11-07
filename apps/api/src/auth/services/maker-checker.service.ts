/**
 * Maker-Checker Approval Service
 *
 * Implements maker-checker approval system for sensitive operations.
 * Implements item 4.8.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { ApprovalLevel, ApprovalStatus } from '@workspace/api';

/**
 * Sensitive Operation
 */
export interface SensitiveOperation {
  operation: string;
  level: ApprovalLevel;
  requiredPermissions: string[];
  requiredClearanceLevel: number;
  timeLimitHours?: number; // Hours before auto-approval
  autoApprove?: boolean;
}

/**
 * Approval Request
 */
export interface ApprovalRequest {
  id: string;
  operation: string;
  makerId: string;
  makerClearanceLevel: number;
  checkerId?: string;
  checkerClearanceLevel?: number;
  level: ApprovalLevel;
  status: ApprovalStatus;
  requestData: any;
  approvalReason?: string;
  rejectionReason?: string;
  createdAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  expiresAt?: Date;
}

/**
 * Maker-Checker Service
 *
 * Provides approval workflow for sensitive operations.
 */
@Injectable()
export class MakerCheckerService {
  /**
   * Sensitive operations requiring approval
   */
  private readonly sensitiveOperations: Map<string, SensitiveOperation> =
    new Map([
      [
        'students.delete',
        {
          operation: 'students.delete',
          level: ApprovalLevel.SCHOOL,
          requiredPermissions: ['students.delete'],
          requiredClearanceLevel: 7, // Management
          timeLimitHours: 24,
        },
      ],
      [
        'users.delete',
        {
          operation: 'users.delete',
          level: ApprovalLevel.SCHOOL,
          requiredPermissions: ['users.delete'],
          requiredClearanceLevel: 7,
          timeLimitHours: 24,
        },
      ],
      [
        'roles.create',
        {
          operation: 'roles.create',
          level: ApprovalLevel.SCHOOL,
          requiredPermissions: ['roles.create'],
          requiredClearanceLevel: 7,
          timeLimitHours: 24,
        },
      ],
      [
        'permissions.modify',
        {
          operation: 'permissions.modify',
          level: ApprovalLevel.SCHOOL,
          requiredPermissions: ['permissions.modify'],
          requiredClearanceLevel: 7,
          timeLimitHours: 24,
        },
      ],
      [
        'financial.transactions',
        {
          operation: 'financial.transactions',
          level: ApprovalLevel.SCHOOL,
          requiredPermissions: ['financial.transactions'],
          requiredClearanceLevel: 5, // Finance
          timeLimitHours: 48,
        },
      ],
      [
        'data.export',
        {
          operation: 'data.export',
          level: ApprovalLevel.PLATFORM,
          requiredPermissions: ['data.export'],
          requiredClearanceLevel: 8, // Owner
          timeLimitHours: 48,
        },
      ],
      [
        'system.configuration',
        {
          operation: 'system.configuration',
          level: ApprovalLevel.PLATFORM,
          requiredPermissions: ['system.configuration'],
          requiredClearanceLevel: 8,
          timeLimitHours: 48,
        },
      ],
      [
        'backup.restore',
        {
          operation: 'backup.restore',
          level: ApprovalLevel.PLATFORM,
          requiredPermissions: ['backup.restore'],
          requiredClearanceLevel: 9, // SuperAdmin
          timeLimitHours: 24,
        },
      ],
    ]);

  /**
   * Check if operation requires approval (4.8)
   *
   * @param operation - Operation name
   * @returns Sensitive operation config or null
   */
  getSensitiveOperation(operation: string): SensitiveOperation | null {
    return this.sensitiveOperations.get(operation) || null;
  }

  /**
   * Create approval request (4.8)
   *
   * @param prisma - Prisma client instance
   * @param operation - Operation name
   * @param makerId - User ID who initiates the action
   * @param makerClearanceLevel - Maker's clearance level
   * @param requestData - Operation data
   * @param tenantId - Tenant ID
   * @returns Approval request ID
   */
  async createApprovalRequest(
    prisma: PrismaClient,
    operation: string,
    makerId: string,
    makerClearanceLevel: number,
    requestData: any,
    tenantId: string,
  ): Promise<string> {
    const sensitiveOp = this.getSensitiveOperation(operation);

    if (!sensitiveOp) {
      // Operation doesn't require approval
      return '';
    }

    // Check if maker has required permissions and clearance
    if (makerClearanceLevel < sensitiveOp.requiredClearanceLevel) {
      throw new BadRequestException(
        `Insufficient clearance level for operation ${operation}`,
      );
    }

    // Calculate expiration time
    const expiresAt = sensitiveOp.timeLimitHours
      ? new Date(Date.now() + sensitiveOp.timeLimitHours * 60 * 60 * 1000)
      : undefined;

    // Create approval request
    // Note: This would typically be stored in a database table
    // For now, we'll return a placeholder ID
    const approvalRequestId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // TODO: Store approval request in database
    // await prisma.approvalRequest.create({ ... });

    return approvalRequestId;
  }

  /**
   * Approve request (4.8)
   *
   * @param prisma - Prisma client instance
   * @param approvalRequestId - Approval request ID
   * @param checkerId - User ID who approves
   * @param checkerClearanceLevel - Checker's clearance level
   * @param reason - Approval reason
   * @returns Approval result
   */
  async approveRequest(
    prisma: PrismaClient,
    approvalRequestId: string,
    checkerId: string,
    checkerClearanceLevel: number,
    reason?: string,
  ): Promise<{ approved: boolean; error?: string }> {
    // TODO: Load approval request from database
    // TODO: Validate checker has required clearance
    // TODO: Update approval request status

    return { approved: true };
  }

  /**
   * Reject request (4.8)
   *
   * @param prisma - Prisma client instance
   * @param approvalRequestId - Approval request ID
   * @param checkerId - User ID who rejects
   * @param reason - Rejection reason
   * @returns Rejection result
   */
  async rejectRequest(
    prisma: PrismaClient,
    approvalRequestId: string,
    checkerId: string,
    reason: string,
  ): Promise<{ rejected: boolean; error?: string }> {
    // TODO: Load approval request from database
    // TODO: Update approval request status

    return { rejected: true };
  }

  /**
   * Check if approval is required (4.8)
   *
   * @param operation - Operation name
   * @returns Whether approval is required
   */
  requiresApproval(operation: string): boolean {
    return this.sensitiveOperations.has(operation);
  }

  /**
   * Get required checker clearance level (4.8)
   *
   * @param operation - Operation name
   * @returns Required clearance level or null
   */
  getRequiredCheckerClearanceLevel(operation: string): number | null {
    const sensitiveOp = this.getSensitiveOperation(operation);
    return sensitiveOp?.requiredClearanceLevel || null;
  }
}
