/* ============================================================
   SchoolWithEase — Access-control primitives (Phase 1 / M4)

   UI-side vocabulary mirroring requirements/access-control.md and
   requirements/permissions.md. These types let the navigation model
   be filtered by the SAME role / clearance / permission keys the
   backend will authorize against. NOTHING here enforces access —
   it only decides what navigation a viewer is offered. Real
   authorization remains server-side.
   ============================================================ */

/**
 * Clearance level, 0 (Guest, lowest) … 10 (Architect, highest).
 * See the hierarchy table in requirements/access-control.md.
 */
export type ClearanceLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** The default system roles defined in requirements/permissions.md. */
export type StandardRole =
  // Platform-level
  | 'Architect'
  | 'SuperAdmin'
  // School-level (default)
  | 'Owner'
  | 'Management'
  | 'ITSupport'
  | 'Finance'
  | 'Operations'
  | 'Teacher'
  | 'Parent'
  | 'Student'
  | 'Guest';

/**
 * A role key. Schools may define custom roles (Registrar, Counselor, …),
 * so any string is accepted while the standard roles still autocomplete.
 */
export type RoleKey = StandardRole | (string & Record<never, never>);

/** Polymorphic institution types the platform serves (see AI_CONTEXT.md). */
export type SchoolType =
  | 'nursery'
  | 'primary'
  | 'secondary'
  | 'university'
  | 'college'
  | 'training_institute'
  | 'organization';

/**
 * A toggleable product module. A tenant can turn these on/off (Settings ›
 * Modules); the toggle gates navigation and UI on top of role/clearance/
 * schoolType. The list is the operational modules that are optional per
 * institution — core academic surfaces are never toggled off.
 */
export type FeatureKey =
  | 'messaging'
  | 'transport'
  | 'cafeteria'
  | 'library'
  | 'health';

/** The canonical feature catalog, in display order. */
export const FEATURE_KEYS: readonly FeatureKey[] = [
  'messaging',
  'transport',
  'cafeteria',
  'library',
  'health',
];

/** Which navigation surface a config or node targets. */
export type NavScope = 'platform' | 'school';

/**
 * A dot-namespaced permission key, e.g. `students.view`,
 * `grades.edit.own_classes`, `platform.tenants.read`. The 274 keys are
 * enumerated in requirements/permissions.md; kept as a string so the
 * model stays decoupled from that evolving list.
 */
export type PermissionKey = string;

/**
 * The signed-in viewer whose access decides what navigation renders.
 * Supplied by the host app (from the session); the navigation model is
 * pure and never derives this itself.
 */
export interface ViewerContext {
  /** Effective clearance level (see access-control.md). */
  clearanceLevel: ClearanceLevel;
  /** Role keys assigned to the viewer (standard and/or custom). */
  roles: readonly RoleKey[];
  /** The viewer's effective permission keys. */
  permissions: ReadonlySet<PermissionKey>;
  /** Active surface: a tenant (`school`) or the platform. */
  scope: NavScope;
  /** Active tenant id, when `scope === 'school'`. */
  tenantId?: string;
  /** Active tenant's institution type, for polymorphic navigation. */
  schoolType?: SchoolType;
  /**
   * Modules the active tenant has enabled. When omitted, feature gating is
   * skipped entirely (every feature-gated node is visible) — so existing
   * callers that don't supply it are unaffected. When present, a node's
   * `features` guard must be satisfied by this set.
   */
  enabledFeatures?: ReadonlySet<FeatureKey>;
}

/**
 * Access guard attached to a navigation node. All present conditions must
 * pass (AND between fields); omit any field that does not apply. A node with
 * no guard is always visible.
 */
export interface NavAccess {
  /** Minimum clearance level required (inclusive). */
  minClearance?: ClearanceLevel;
  /** Visible only on this surface. */
  scope?: NavScope;
  /** Visible only to viewers holding at least one of these roles. */
  roles?: readonly RoleKey[];
  /** Visible only for these institution types (any match). */
  schoolTypes?: readonly SchoolType[];
  /**
   * Requires ALL of these modules to be enabled for the active tenant. Only
   * enforced when the viewer carries an `enabledFeatures` set.
   */
  features?: readonly FeatureKey[];
  /** Requires AT LEAST ONE of these permission keys. */
  anyPermission?: readonly PermissionKey[];
  /** Requires ALL of these permission keys. */
  allPermissions?: readonly PermissionKey[];
}
