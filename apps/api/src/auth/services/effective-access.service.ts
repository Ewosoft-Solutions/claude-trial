/**
 * Effective-access evaluator (WB1-5)
 *
 * The "explain effective access" surface behind the role editor. Given a role
 * (or a DRAFT the editor is building) it resolves the permission set the same
 * way the runtime does — pools, floored at the role's clearance — and returns:
 *
 *   • a matrix of granted permissions, each with its SOURCE pool, clearance,
 *     and a plain-language reason;
 *   • the SENSITIVE (money / security / PII) capabilities the role carries;
 *   • separation-of-duties CONFLICTS from a canonical incompatible-pairs table;
 *   • a one-line summary;
 *
 * plus `explain()` for a single "is X allowed (in scope Y)?" question and
 * `whoIsAffected()` for the profiles currently holding a role.
 *
 * Scope is EXPLAINED here (a role scoped to "Campus A" denies a Campus-B
 * action); row-level scope ENFORCEMENT + expiry are WB1-6 (this item's
 * dependant). Methods take a prisma client and scope their own reads — no
 * DatabaseService injection.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { withTenantScope } from '@workspace/database/rls';
import { RoleType } from '@workspace/api';

export interface ScopeDescriptor {
  type: string; // 'campus' | 'department' | 'global' | …
  value?: string;
  label?: string;
}

export interface AccessEntry {
  permission: string;
  label: string;
  resource: string;
  action: string;
  context: string | null;
  requiredClearance: number;
  sourcePool: string | null;
  sensitive: boolean;
  reason: string;
}

export interface SoDConflict {
  a: string;
  b: string;
  rule: string;
}

export interface EffectiveAccess {
  roleName: string | null;
  clearanceLevel: number;
  scope: ScopeDescriptor | null;
  templateKey: string | null;
  entries: AccessEntry[];
  sensitive: string[];
  conflicts: SoDConflict[];
  summary: string;
}

export interface ExplainResult {
  permission: string;
  allowed: boolean;
  reason: string;
  sourcePool: string | null;
  scope: ScopeDescriptor | null;
}

/** Actions that carry money / security / PII weight regardless of resource. */
const SENSITIVE_ACTIONS = new Set([
  'delete',
  'export',
  'refund',
  'process',
  'approve',
  'override',
  'provision',
  'import',
]);

/**
 * Separation-of-duties: capability pairs that concentrate risk in one role.
 * Flagged (not blocked) so the admin sees the conflict they are about to build.
 */
const SOD_PAIRS: SoDConflict[] = [
  {
    a: 'fees.create',
    b: 'payments.refund',
    rule: 'Raising charges and refunding payments in one role is a fraud risk — separate them.',
  },
  {
    a: 'roles.edit',
    b: 'users.provision',
    rule: 'Editing roles together with provisioning accounts lets a holder self-elevate.',
  },
  {
    a: 'payments.edit',
    b: 'payments.export',
    rule: 'Editing payments and bulk-exporting them concentrate handling and exfiltration.',
  },
  {
    a: 'grades.edit',
    b: 'grades.delete',
    rule: 'Editing and deleting grades in one role removes the second pair of eyes on results.',
  },
];

type PoolWithPerms = {
  name: string;
  clearanceLevel: number;
  poolPermissions: Array<{
    permission: {
      id: string;
      name: string;
      label: string;
      resource: string;
      action: string;
      context: string | null;
      requiredClearanceLevel: number;
    };
  }>;
};

function parseScope(raw: unknown): ScopeDescriptor | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.type !== 'string') return null;
  return {
    type: s.type,
    value: typeof s.value === 'string' ? s.value : undefined,
    label: typeof s.label === 'string' ? s.label : undefined,
  };
}

function isSensitive(p: {
  resource: string;
  action: string;
  requiredClearanceLevel: number;
}): boolean {
  return (
    SENSITIVE_ACTIONS.has(p.action) ||
    p.resource === 'platform' ||
    p.requiredClearanceLevel >= 7
  );
}

@Injectable()
export class EffectiveAccessService {
  /**
   * Assemble the effective-access view from a clearance level + the pools a role
   * (or draft) inherits. Clearance is a floor: a permission above the role's
   * clearance is never issued (mirrors resolveRolePoolPermissions).
   */
  private assemble(
    clearanceLevel: number,
    pools: PoolWithPerms[],
    meta: {
      roleName: string | null;
      scope: ScopeDescriptor | null;
      templateKey: string | null;
    },
  ): EffectiveAccess {
    // permission name -> { entry, sourcePool }. The first pool that grants a
    // permission is credited as its source; sort by clearance ascending first so
    // that attribution is DETERMINISTIC (the lowest-level pool wins) regardless
    // of the order the caller passed the pools in.
    const orderedPools = [...pools].sort(
      (a, b) => a.clearanceLevel - b.clearanceLevel,
    );
    const byName = new Map<string, AccessEntry>();
    for (const pool of orderedPools) {
      for (const pp of pool.poolPermissions) {
        const perm = pp.permission;
        if (perm.requiredClearanceLevel > clearanceLevel) continue; // floor
        if (byName.has(perm.name)) continue; // keep first source
        const sensitive = isSensitive(perm);
        const scopeNote =
          meta.scope && meta.scope.label
            ? ` within ${meta.scope.label}`
            : meta.scope && meta.scope.type !== 'global'
              ? ` within its ${meta.scope.type} scope`
              : '';
        byName.set(perm.name, {
          permission: perm.name,
          label: perm.label,
          resource: perm.resource,
          action: perm.action,
          context: perm.context ?? null,
          requiredClearance: perm.requiredClearanceLevel,
          sourcePool: pool.name,
          sensitive,
          reason: `Allowed: ${perm.name} · Source: ${
            meta.templateKey ? `${meta.templateKey} template → ` : ''
          }${pool.name}${scopeNote}`,
        });
      }
    }

    const entries = Array.from(byName.values()).sort((a, b) =>
      a.permission.localeCompare(b.permission),
    );
    const granted = new Set(entries.map((e) => e.permission));
    const conflicts = SOD_PAIRS.filter(
      (p) => granted.has(p.a) && granted.has(p.b),
    );
    const sensitive = entries
      .filter((e) => e.sensitive)
      .map((e) => e.permission);

    const scopeSummary = meta.scope
      ? `, scoped to ${meta.scope.label ?? meta.scope.type}`
      : '';
    const summary =
      `${entries.length} permission${entries.length === 1 ? '' : 's'}` +
      ` at clearance ${clearanceLevel}${scopeSummary}` +
      (sensitive.length ? `; ${sensitive.length} sensitive` : '') +
      (conflicts.length
        ? `; ${conflicts.length} separation-of-duties conflict${conflicts.length === 1 ? '' : 's'}`
        : '');

    return {
      roleName: meta.roleName,
      clearanceLevel,
      scope: meta.scope,
      templateKey: meta.templateKey,
      entries,
      sensitive,
      conflicts,
      summary,
    };
  }

  /** Load a role (system or this tenant's custom) with its pools + permissions. */
  private async loadRole(
    prisma: PrismaClient,
    tenantId: string,
    roleId: string,
  ) {
    const role = await withTenantScope(prisma, tenantId, undefined, (tx) =>
      tx.role.findFirst({
        where: {
          id: roleId,
          OR: [
            {
              tenantId: null,
              roleType: { in: [RoleType.PLATFORM, RoleType.SYSTEM] },
            },
            { tenantId, roleType: RoleType.CUSTOM },
          ],
        },
        include: {
          rolePools: {
            include: {
              pool: {
                include: { poolPermissions: { include: { permission: true } } },
              },
            },
          },
        },
      }),
    );
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  /** Load pools by id (scoped), for a draft the editor is assembling. */
  private async loadPools(
    prisma: PrismaClient,
    tenantId: string,
    poolIds: string[],
  ): Promise<PoolWithPerms[]> {
    if (poolIds.length === 0) return [];
    const pools = await withTenantScope(prisma, tenantId, undefined, (tx) =>
      tx.permissionPool.findMany({
        where: { id: { in: poolIds } },
        include: { poolPermissions: { include: { permission: true } } },
      }),
    );
    return pools as unknown as PoolWithPerms[];
  }

  /** Effective access for an existing role. */
  async evaluateRole(
    prisma: PrismaClient,
    tenantId: string,
    roleId: string,
  ): Promise<EffectiveAccess> {
    const role = await this.loadRole(prisma, tenantId, roleId);
    const pools = role.rolePools.map(
      (rp) => rp.pool,
    ) as unknown as PoolWithPerms[];
    return this.assemble(role.clearanceLevel, pools, {
      roleName: role.name,
      scope: parseScope(role.scope),
      templateKey: role.templateKey ?? null,
    });
  }

  /** Effective access for a DRAFT — live preview while the editor is open. */
  async evaluateDraft(
    prisma: PrismaClient,
    tenantId: string,
    draft: {
      clearanceLevel: number;
      poolIds: string[];
      scope?: ScopeDescriptor | null;
      templateKey?: string | null;
      name?: string | null;
    },
  ): Promise<EffectiveAccess> {
    const pools = await this.loadPools(prisma, tenantId, draft.poolIds);
    return this.assemble(draft.clearanceLevel, pools, {
      roleName: draft.name ?? null,
      scope: draft.scope ?? null,
      templateKey: draft.templateKey ?? null,
    });
  }

  /**
   * Answer a single "is `permission` allowed (in `targetScope`)?" question for a
   * role — the effective-access preview's per-permission explanation.
   */
  async explainRole(
    prisma: PrismaClient,
    tenantId: string,
    roleId: string,
    probe: { permission: string; targetScope?: ScopeDescriptor | null },
  ): Promise<ExplainResult> {
    const access = await this.evaluateRole(prisma, tenantId, roleId);
    return this.explainFrom(access, probe);
  }

  private explainFrom(
    access: EffectiveAccess,
    probe: { permission: string; targetScope?: ScopeDescriptor | null },
  ): ExplainResult {
    const entry = access.entries.find((e) => e.permission === probe.permission);
    if (!entry) {
      return {
        permission: probe.permission,
        allowed: false,
        reason: `Denied: ${probe.permission} is not granted by this role.`,
        sourcePool: null,
        scope: access.scope,
      };
    }
    // Scope check: a scoped role denies an action targeted outside its scope.
    const roleScope = access.scope;
    const target = probe.targetScope;
    if (
      roleScope &&
      roleScope.type !== 'global' &&
      target &&
      target.value &&
      roleScope.value &&
      target.value !== roleScope.value
    ) {
      return {
        permission: probe.permission,
        allowed: false,
        reason:
          `Denied: ${probe.permission} is scoped to ${roleScope.label ?? roleScope.value}` +
          `, not ${target.label ?? target.value}.`,
        sourcePool: entry.sourcePool,
        scope: roleScope,
      };
    }
    return {
      permission: probe.permission,
      allowed: true,
      reason: entry.reason,
      sourcePool: entry.sourcePool,
      scope: roleScope,
    };
  }

  /** Profiles that currently hold this role — the "who's affected" view. */
  async whoIsAffected(prisma: PrismaClient, tenantId: string, roleId: string) {
    const holders = await withTenantScope(prisma, tenantId, undefined, (tx) =>
      tx.userTenantRole.findMany({
        where: { roleId, userTenant: { tenantId } },
        select: {
          assignedAt: true,
          userTenant: {
            select: {
              id: true,
              status: true,
              user: {
                select: { email: true, firstName: true, lastName: true },
              },
            },
          },
        },
        take: 500,
      }),
    );
    return {
      count: holders.length,
      profiles: holders.map((h) => ({
        userTenantId: h.userTenant.id,
        name:
          [h.userTenant.user?.firstName, h.userTenant.user?.lastName]
            .filter(Boolean)
            .join(' ') ||
          (h.userTenant.user?.email ?? 'Unknown'),
        email: h.userTenant.user?.email ?? null,
        status: h.userTenant.status,
        assignedAt: h.assignedAt,
      })),
    };
  }
}
