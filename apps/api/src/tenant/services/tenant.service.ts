import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';

/**
 * Tenant Service
 *
 * Main service for tenant operations.
 */
@Injectable()
export class TenantService {
  /**
   * Get tenant by ID
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @returns Tenant
   */
  async getTenant(prisma: PrismaClient, tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
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
            tier: true,
            isActive: true,
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
   * @param prisma - Prisma client instance
   * @param filters - Optional filters
   * @returns List of tenants
   */
  async listTenants(
    prisma: PrismaClient,
    filters?: {
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
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
      prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.tenant.count({ where }),
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
