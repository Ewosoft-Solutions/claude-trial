import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantDbService } from '../../common/database/tenant-db.service';

/**
 * Tenant Service
 *
 * Main service for tenant operations.
 *
 * Every read here crosses tenant boundaries by nature (the tenant registry is
 * what the platform console browses), so this service runs on the RLS-enforcing
 * `app_runtime` client inside the audited `app.is_platform` scope — never on the
 * privileged client. `getTenant`/`listTenants` expect their caller to be
 * `@PlatformScoped()`; `getPublicBySlug` opens its own scope because it serves
 * unauthenticated requests.
 */
@Injectable()
export class TenantService {
  constructor(private readonly tenantDb: TenantDbService) {}

  /**
   * Public branding lookup by subdomain slug — safe to call unauthenticated
   * (e.g. from the login page on `{slug}.domain`). Returns only non-sensitive
   * identity/branding fields, and only for an active tenant.
   *
   * Opens its own platform scope: there is no authenticated actor to gate or
   * attribute, so this deliberately bypasses `@PlatformScoped`. The narrow
   * `select` below is what keeps that safe — keep it narrow.
   */
  async getPublicBySlug(slug: string) {
    return this.tenantDb.runPlatform(undefined, () =>
      this.selectPublicBySlug(slug),
    );
  }

  private async selectPublicBySlug(slug: string) {
    const tenant = await this.tenantDb.client.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        schoolType: true,
        status: true,
      },
    });
    if (
      !tenant ||
      tenant.status === 'suspended' ||
      tenant.status === 'deleted'
    ) {
      throw new NotFoundException('School not found');
    }
    return tenant;
  }

  /**
   * Get tenant by ID
   *
   * @param tenantId - Tenant ID
   * @returns Tenant
   */
  async getTenant(
    tenantId: string,
    options: { includeInternals?: boolean } = {},
  ) {
    // `jwtConfig` and `securityPolicy` are tenant internals, gated on
    // `platform.tenants.inspect` (clearance 10). Omitted entirely rather than
    // nulled, so a caller without the facet cannot infer their shape.
    const tenant = await this.tenantDb.client.tenant.findUnique({
      where: { id: tenantId },
      ...(options.includeInternals
        ? {
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
          }
        : {}),
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
      this.tenantDb.client.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.tenantDb.client.tenant.count({ where }),
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
