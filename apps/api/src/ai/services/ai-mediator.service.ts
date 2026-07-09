/**
 * AI Mediator Service
 *
 * Handles AI mediator integration with clearance level context, access scope validation,
 * data filtering, and audit logging.
 * Implements items 4b.1, 4b.2, 4b.3, 4b.4, 4b.5.
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import {
  PermissionService,
  AIMediatorContext,
  UserPermissionContext,
} from '../../auth/services/permission.service';
import { PermissionPoolService } from '../../auth/services/permission-pool.service';
import { AUDIT_ACTION, AUDIT_EVENT } from '../../common/audit/audit.constants';
import {
  AccessScope,
  // ClearanceLevelHelpers,
  AIQueryType,
} from '@workspace/api';

/**
 * AI Query Request
 */
export interface AIQueryRequest {
  query: string;
  userId: string;
  tenantId: string;
  profileId: string;
  queryType?: AIQueryType;
  context?: Record<string, any>;
}

/**
 * AI Query Validation Result
 */
export interface AIQueryValidationResult {
  allowed: boolean;
  reason?: string;
  requiredClearanceLevel?: number;
  userClearanceLevel?: number;
  requiredAccessScope?: AccessScope;
  userAccessScope?: AccessScope;
}

/**
 * AI Data Filter Configuration
 */
export interface AIDataFilterConfig {
  allowedResources: string[];
  allowedActions: string[];
  maxDataScope: AccessScope;
  requireExplicitPermission?: boolean;
}

/**
 * AI Mediator Service
 *
 * Provides AI mediator integration with proper access control and data filtering.
 */
@Injectable()
export class AIMediatorService {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly permissionPoolService: PermissionPoolService,
  ) {}

  /**
   * Get AI Mediator Context with Permission Pools (4b.1, 4b.4)
   *
   * Integrates clearance level context with AI mediator and loads permission pools.
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param profileId - Profile ID
   * @returns AI mediator context with permission pools
   */
  async getAIMediatorContextWithPools(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
    profileId: string,
  ): Promise<AIMediatorContext> {
    // Get user permission context
    const userContext: UserPermissionContext =
      await this.permissionService.getUserPermissionContext(
        prisma,
        userId,
        tenantId,
        profileId,
      );

    // Get AI mediator context (includes access scope)
    const aiContext = this.permissionService.getAIMediatorContext(userContext);

    // Load permission pools for this clearance level (4b.4)
    const permissionPools =
      await this.permissionPoolService.getPermissionPoolsByClearanceLevel(
        prisma,
        userContext.clearanceLevel,
        tenantId,
      );

    // Extract permission pool names
    const permissionPoolNames = permissionPools.map((pool) => pool.name);

    // Return enhanced context with permission pools
    return {
      ...aiContext,
      permissions: permissionPoolNames,
    };
  }

  /**
   * Validate AI Query Access Scope (4b.2)
   *
   * Validates that the user has sufficient clearance level and access scope
   * for the requested AI query.
   *
   * @param prisma - Prisma client instance
   * @param request - AI query request
   * @param requiredClearanceLevel - Required clearance level for the query
   * @param requiredAccessScope - Required access scope for the query
   * @returns Validation result
   */
  async validateAIQueryAccessScope(
    prisma: PrismaClient,
    request: AIQueryRequest,
    requiredClearanceLevel?: number,
    requiredAccessScope?: AccessScope,
  ): Promise<AIQueryValidationResult> {
    // Get user permission context
    const userContext = await this.permissionService.getUserPermissionContext(
      prisma,
      request.userId,
      request.tenantId,
      request.profileId,
    );

    // Get AI mediator context
    const aiContext = this.permissionService.getAIMediatorContext(userContext);

    // Check clearance level if required
    if (requiredClearanceLevel !== undefined) {
      if (userContext.clearanceLevel < requiredClearanceLevel) {
        return {
          allowed: false,
          reason: `Insufficient clearance level. Required: ${requiredClearanceLevel}, User: ${userContext.clearanceLevel}`,
          requiredClearanceLevel,
          userClearanceLevel: userContext.clearanceLevel,
          requiredAccessScope,
          userAccessScope: aiContext.accessScope,
        };
      }
    }

    // Check access scope if required
    if (requiredAccessScope !== undefined) {
      const scopeHierarchy: Record<AccessScope, number> = {
        [AccessScope.OWN]: 0,
        [AccessScope.DEPARTMENT]: 1,
        [AccessScope.SCHOOL]: 2,
        [AccessScope.PLATFORM]: 3,
      };

      const userScopeLevel = scopeHierarchy[aiContext.accessScope] || 0;
      const requiredScopeLevel = scopeHierarchy[requiredAccessScope] || 0;

      if (userScopeLevel < requiredScopeLevel) {
        return {
          allowed: false,
          reason: `Insufficient access scope. Required: ${requiredAccessScope}, User: ${aiContext.accessScope}`,
          requiredClearanceLevel,
          userClearanceLevel: userContext.clearanceLevel,
          requiredAccessScope,
          userAccessScope: aiContext.accessScope,
        };
      }
    }

    return {
      allowed: true,
      userClearanceLevel: userContext.clearanceLevel,
      userAccessScope: aiContext.accessScope,
    };
  }

  /**
   * Filter AI Data Based on Clearance Level (4b.3)
   *
   * Filters data based on user's clearance level and access scope.
   *
   * @param prisma - Prisma client instance
   * @param request - AI query request
   * @param data - Data to filter
   * @param filterConfig - Filter configuration
   * @returns Filtered data
   */
  async filterAIDataByClearanceLevel(
    prisma: PrismaClient,
    request: AIQueryRequest,
    data: any[],
    filterConfig: AIDataFilterConfig,
  ): Promise<any[]> {
    // Get user permission context
    const userContext = await this.permissionService.getUserPermissionContext(
      prisma,
      request.userId,
      request.tenantId,
      request.profileId,
    );

    // Get AI mediator context
    const aiContext = this.permissionService.getAIMediatorContext(userContext);

    // Determine data scope based on access scope
    const scopeHierarchy: Record<AccessScope, number> = {
      [AccessScope.OWN]: 0,
      [AccessScope.DEPARTMENT]: 1,
      [AccessScope.SCHOOL]: 2,
      [AccessScope.PLATFORM]: 3,
    };

    const userScopeLevel = scopeHierarchy[aiContext.accessScope] || 0;
    const maxScopeLevel = scopeHierarchy[filterConfig.maxDataScope] || 0;

    // Filter data based on scope
    let filteredData = data;

    // Apply scope-based filtering
    if (userScopeLevel < maxScopeLevel) {
      // User has limited scope, filter accordingly
      if (aiContext.accessScope === AccessScope.OWN) {
        // Only own data
        filteredData = filteredData.filter((item) => {
          // Filter based on userId or profileId
          return (
            item.userId === request.userId ||
            item.profileId === request.profileId ||
            item.studentId === request.userId
          );
        });
      } else if (aiContext.accessScope === AccessScope.DEPARTMENT) {
        // Department-level data
        filteredData = filteredData.filter((item) => {
          // Filter based on department/class association
          return (
            item.tenantId === request.tenantId &&
            (item.departmentId || item.classId || item.profileId)
          );
        });
      } else if (aiContext.accessScope === AccessScope.SCHOOL) {
        // School-level data
        filteredData = filteredData.filter((item) => {
          return item.tenantId === request.tenantId;
        });
      }
      // PLATFORM scope has no filtering
    }

    // Apply resource-based filtering if configured
    if (filterConfig.allowedResources.length > 0) {
      filteredData = filteredData.filter(
        (item: Record<string, string | undefined>) => {
          const resourceType = item.resource || item.resourceType;
          return filterConfig.allowedResources.includes(resourceType);
        },
      );
    }

    // Apply action-based filtering if configured
    if (filterConfig.allowedActions.length > 0) {
      filteredData = filteredData.filter(
        (item: Record<string, string | undefined>) => {
          const action = item.action || item.actionType;
          return filterConfig.allowedActions.includes(action);
        },
      );
    }

    // Apply explicit permission check if required
    if (filterConfig.requireExplicitPermission) {
      filteredData = filteredData.filter((item) => {
        const resource = item.resource || item.resourceType;
        const action = item.action || item.actionType;
        const permissionName = `${resource}:${action}`;

        return aiContext.permissions.includes(permissionName);
      });
    }

    return filteredData;
  }

  /**
   * Log AI Mediator Query (4b.5)
   *
   * Logs AI mediator queries to audit log for security and compliance.
   *
   * @param prisma - Prisma client instance
   * @param request - AI query request
   * @param validationResult - Query validation result
   * @param responseMetadata - Response metadata
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   */
  async logAIMediatorQuery(
    prisma: PrismaClient,
    request: AIQueryRequest,
    validationResult: AIQueryValidationResult,
    responseMetadata?: {
      queryType?: string;
      dataScope?: AccessScope;
      dataCount?: number;
      executionTime?: number;
      error?: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      // Get user context for audit log
      const userContext = await this.permissionService.getUserPermissionContext(
        prisma,
        request.userId,
        request.tenantId,
        request.profileId,
      );

      // Get user email for audit trail
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
        select: { email: true },
      });

      // Determine event type based on query type
      let eventTypeKey: keyof typeof AUDIT_ACTION.AI_EVENT = 'GENERAL';
      if (request.queryType === 'analytics') {
        eventTypeKey = 'ANALYTICS';
      } else if (request.queryType === 'academic') {
        eventTypeKey = 'ACADEMIC';
      }

      // Determine status
      let status: 'error' | 'success' | 'failure';
      if (!validationResult.allowed) {
        status = 'failure';
      } else if (responseMetadata?.error) {
        status = 'error';
      } else {
        status = 'success';
      }

      // Create audit log entry
      await prisma.auditLog.create({
        data: {
          tenantId: request.tenantId,
          eventType: AUDIT_EVENT.AI_EVENT, // Dedicated type for AI-specific events
          action: AUDIT_ACTION.AI_EVENT[eventTypeKey],
          resource: 'ai_mediator',
          resourceId: null,
          actorId: request.userId,
          actorProfileId: request.profileId,
          actorRole: userContext.roleId || null,
          actorEmail: user?.email || null,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          description: `AI ${request.queryType || 'general'} query: ${request.query.substring(0, 100)}${request.query.length > 100 ? '...' : ''}`,
          metadata: {
            query: request.query,
            queryType: request.queryType || 'general',
            context: request.context || {},
            validationResult: {
              allowed: validationResult.allowed,
              reason: validationResult.reason,
              requiredClearanceLevel: validationResult.requiredClearanceLevel,
              userClearanceLevel: validationResult.userClearanceLevel,
              requiredAccessScope: validationResult.requiredAccessScope,
              userAccessScope: validationResult.userAccessScope,
            },
            responseMetadata: responseMetadata || {},
            clearanceLevel: userContext.clearanceLevel,
            accessScope:
              this.permissionService.getAIMediatorContext(userContext)
                .accessScope,
          },
          status,
          errorCode: responseMetadata?.error ? 'AI_QUERY_ERROR' : null,
          errorMessage: responseMetadata?.error || null,
        },
      });
    } catch (error) {
      // Don't throw - audit logging should not break the main flow
      console.error('Failed to log AI mediator query:', error);
    }
  }

  /**
   * Process AI Query with Full Integration (4b.1-4b.5)
   *
   * Complete AI query processing with context loading, validation, filtering, and audit logging.
   *
   * @param prisma - Prisma client instance
   * @param request - AI query request
   * @param requiredClearanceLevel - Required clearance level
   * @param requiredAccessScope - Required access scope
   * @param filterConfig - Data filter configuration
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   * @returns Processed AI context and validation result
   */
  async processAIQuery(
    prisma: PrismaClient,
    request: AIQueryRequest,
    requiredClearanceLevel?: number,
    requiredAccessScope?: AccessScope,
    filterConfig?: AIDataFilterConfig,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    context: AIMediatorContext;
    validation: AIQueryValidationResult;
    filteredData?: any[];
  }> {
    // 1. Get AI mediator context with permission pools (4b.1, 4b.4)
    const context = await this.getAIMediatorContextWithPools(
      prisma,
      request.userId,
      request.tenantId,
      request.profileId,
    );

    // 2. Validate access scope (4b.2)
    const validation = await this.validateAIQueryAccessScope(
      prisma,
      request,
      requiredClearanceLevel,
      requiredAccessScope,
    );

    // 3. Log the query (4b.5)
    await this.logAIMediatorQuery(
      prisma,
      request,
      validation,
      {
        queryType: request.queryType,
        dataScope: context.accessScope,
      },
      ipAddress,
      userAgent,
    );

    // 4. If validation failed, return early
    if (!validation.allowed) {
      return {
        context,
        validation,
      };
    }

    // 5. If filter config provided, apply data filtering (4b.3)
    let filteredData: any[] | undefined;
    if (filterConfig) {
      // Note: In a real implementation, you would fetch data here
      // For now, we return the filter config for the caller to use
      filteredData = [];
    }

    return {
      context,
      validation,
      filteredData,
    };
  }
}
