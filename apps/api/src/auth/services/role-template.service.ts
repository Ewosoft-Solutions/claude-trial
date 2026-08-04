/**
 * Role templates (WB1-5)
 *
 * Named presets an admin builds a scoped custom role from. A template lists the
 * SYSTEM permission-pool NAMES it grants; this service resolves those to the
 * tenant-visible pool ids (system pools are shared, tenant_id NULL) so the role
 * editor can hand them straight to createCustomRole. Reads are tenant-scoped:
 * a caller sees shared system templates + their own tenant's templates.
 *
 * Takes a prisma client per method (no DatabaseService injection).
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { withTenantScope } from '@workspace/database/rls';

export interface ResolvedRoleTemplate {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  clearanceLevel: number;
  permissionPoolNames: string[];
  /** Pool ids resolved for this tenant (system pools + any tenant pool by name). */
  poolIds: string[];
  /** True when a referenced pool name could not be resolved (misconfig). */
  unresolvedPools: string[];
  sensitive: boolean;
  isSystemTemplate: boolean;
}

@Injectable()
export class RoleTemplateService {
  /** List templates visible to the tenant (shared system + own), with pool ids. */
  async list(
    prisma: PrismaClient,
    tenantId: string,
  ): Promise<ResolvedRoleTemplate[]> {
    return withTenantScope(prisma, tenantId, undefined, async (tx) => {
      const templates = await tx.roleTemplate.findMany({
        orderBy: [{ clearanceLevel: 'desc' }, { name: 'asc' }],
      });

      // Resolve every referenced pool name once for the whole set.
      const names = [
        ...new Set(templates.flatMap((t) => t.permissionPoolNames)),
      ];
      const pools =
        names.length > 0
          ? await tx.permissionPool.findMany({
              where: { name: { in: names } },
              select: { id: true, name: true },
            })
          : [];
      const idByName = new Map(pools.map((p) => [p.name, p.id]));

      return templates.map((t) => {
        const poolIds: string[] = [];
        const unresolvedPools: string[] = [];
        for (const name of t.permissionPoolNames) {
          const id = idByName.get(name);
          if (id) poolIds.push(id);
          else unresolvedPools.push(name);
        }
        return {
          id: t.id,
          key: t.key,
          name: t.name,
          description: t.description,
          category: t.category,
          clearanceLevel: t.clearanceLevel,
          permissionPoolNames: t.permissionPoolNames,
          poolIds,
          unresolvedPools,
          sensitive: t.sensitive,
          isSystemTemplate: t.isSystemTemplate,
        };
      });
    });
  }

  /** One template by key (for server-side apply / validation). */
  async getByKey(
    prisma: PrismaClient,
    tenantId: string,
    key: string,
  ): Promise<ResolvedRoleTemplate> {
    const all = await this.list(prisma, tenantId);
    const found = all.find((t) => t.key === key);
    if (!found) throw new NotFoundException(`Role template '${key}' not found`);
    return found;
  }
}
