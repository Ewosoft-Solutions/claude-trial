import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';

/**
 * Tenant Service
 *
 * Main service for tenant operations.
 */
@Injectable()
export class TenantService {
  constructor(private readonly dbService: DatabaseService) {}

  /**
   * Get tenant by ID
   *
   * @param tenantId - Tenant ID
   * @returns Tenant
   */
  async getTenant(tenantId: string) {
    const tenant = await this.dbService.client.tenant.findUnique({
      where: { id: tenantId },
      include: {
        jwtConfig: {
          select: {
            id: true,
            secretRotationDate: true,
            rotationReason: true,
            emergencyRotation: true,
            // Don't expose secret
          },
        },
        securityPolicy: {
          select: {
            id: true,
            policyTier: true,
            requireMFA: true,
            auditLevel: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  /**
   * List tenants
   *
   * @param filters - Optional filters
   * @returns List of tenants
   */
  async listTenants(filters?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
        { emailDomain: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      this.dbService.client.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.dbService.client.tenant.count({ where }),
    ]);

    return {
      data: tenants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
}
