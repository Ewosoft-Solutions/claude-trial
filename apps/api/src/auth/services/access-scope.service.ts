/**
 * Access-scope enforcement (WB1-6)
 *
 * The reusable primitive that turns a GRANT's scope descriptor into an
 * allow/deny decision. WB1-5's `EffectiveAccessService` only EXPLAINED scope
 * ("a Campus-A role denies a Campus-B probe"); this ENFORCES it at the access
 * layer, and honours grant EXPIRY.
 *
 * A grant carries a scope on `UserTenantRole.scope` (shape
 * `{ type: 'campus'|'global', value?: campusId, label? }`). The rule:
 *
 *   • an unscoped / `global` grant is not restricted — always within scope;
 *   • a `campus` grant is within scope only for its own campus. A campus-scoped
 *     actor acting with no campus target (a bulk/global action) is DENIED — the
 *     safe default behind scenario 2 ("a bursar for Campus A cannot export
 *     Campus B debtors"): they may act on Campus A, never school-wide.
 *
 * WB5 (finance) and WB2 (academics) call `assertWithinScope` once their rows
 * carry a `campusId` to complete scenario 2 end-to-end; WB1-6 wires it on the
 * access-grant surface itself (a campus-scoped admin can only grant within its
 * campus) so enforcement is proven now, not just designed.
 */
import { ForbiddenException, Injectable } from '@nestjs/common';

/** Matches WB1-5's ScopeDescriptor (effective-access.service) structurally. */
export interface ScopeDescriptor {
  type: string; // 'campus' | 'global' | …
  value?: string; // e.g. a campusId
  label?: string; // human label for messages
}

/** Defensively parse a stored `scope` JSON value into a ScopeDescriptor. */
export function parseScope(raw: unknown): ScopeDescriptor | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.type !== 'string') return null;
  return {
    type: s.type,
    value: typeof s.value === 'string' ? s.value : undefined,
    label: typeof s.label === 'string' ? s.label : undefined,
  };
}

/** True once a grant's expiry (if any) is in the past. */
export function isGrantExpired(
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return expiresAt != null && expiresAt.getTime() <= now.getTime();
}

export interface ScopeTarget {
  /** The campus an action touches, when it is campus-specific. */
  campusId?: string | null;
}

@Injectable()
export class AccessScopeService {
  /**
   * Is `target` within `grantScope`? See the class doc for the rule. A null or
   * `global` scope is unrestricted; a `campus` scope permits only its own
   * campus (and never an unspecified/global target).
   */
  isWithinScope(
    grantScope: ScopeDescriptor | null | undefined,
    target: ScopeTarget,
  ): boolean {
    if (!grantScope || grantScope.type === 'global') return true;
    if (grantScope.type === 'campus') {
      return Boolean(grantScope.value) && target.campusId === grantScope.value;
    }
    // Unknown scope types are forward-compatible: they do not restrict until a
    // future evaluator understands them (fail-open only for types we haven't
    // shipped an enforcement rule for — campus, the one that exists, fails safe).
    return true;
  }

  /** Throw a 403 when `target` is outside `grantScope`. */
  assertWithinScope(
    grantScope: ScopeDescriptor | null | undefined,
    target: ScopeTarget,
  ): void {
    if (!this.isWithinScope(grantScope, target)) {
      const where = grantScope?.label ?? grantScope?.value ?? grantScope?.type;
      throw new ForbiddenException(
        `This action is outside your access scope${where ? ` (${where})` : ''}.`,
      );
    }
  }
}
