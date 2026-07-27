/**
 * Password Service
 *
 * Handles password hashing, validation, and policy enforcement.
 * Implements items 3.4 and 3.5.
 */

import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@workspace/database';
import { withTenantScope, withUserScope } from '@workspace/database/rls';

/**
 * Password Policy Configuration
 */
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge?: number; // days
  preventReuse?: number; // last N passwords
}

/**
 * Default password policy (Tier 1: Basic - Mandatory)
 */
const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  maxAge: 90,
  preventReuse: 5,
};

/**
 * Password Validation Result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * The subset of the effective policy surfaced to clients so the sign-up /
 * reset UI can render a live strength meter + requirements checklist. Kept in
 * lock-step with the rules `validatePasswordPolicy` actually enforces.
 */
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

/**
 * Password Service
 *
 * Provides password hashing, validation, and policy enforcement.
 */
export class PasswordService {
  /**
   * Hash password using bcrypt (3.4)
   *
   * @param password - Plain text password
   * @returns Bcrypt hash
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   *
   * @param password - Plain text password
   * @param hash - Bcrypt hash
   * @returns True if password matches
   */
  static async comparePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password against policy (3.5)
   *
   * @param password - Password to validate
   * @param policy - Password policy (optional, uses default if not provided)
   * @returns Validation result with errors
   */
  static validatePasswordPolicy(
    password: string,
    policy?: PasswordPolicy,
  ): PasswordValidationResult {
    const effectivePolicy = policy || DEFAULT_PASSWORD_POLICY;
    const errors: string[] = [];

    // Check minimum length
    if (password.length < effectivePolicy.minLength) {
      errors.push(
        `Password must be at least ${effectivePolicy.minLength} characters long`,
      );
    }

    // Check uppercase requirement
    if (effectivePolicy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check lowercase requirement
    if (effectivePolicy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check numbers requirement
    if (effectivePolicy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check special characters requirement
    if (
      effectivePolicy.requireSpecialChars &&
      !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
    ) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /** Project the effective policy to the client-facing requirement flags. */
  static toRequirements(policy: PasswordPolicy): PasswordRequirements {
    return {
      minLength: policy.minLength,
      requireUppercase: policy.requireUppercase,
      requireLowercase: policy.requireLowercase,
      requireNumbers: policy.requireNumbers,
      requireSpecialChars: policy.requireSpecialChars,
    };
  }

  /**
   * Resolve the effective password policy for a single school (4a).
   *
   * Reads that school's SchoolSecurityPolicy, RLS-scoped to the tenant the same
   * way SecurityPolicyService.getSchoolPolicy does (so it works on the pre-auth
   * reset/rotation paths). Falls back to the platform default (Basic tier) when
   * a school has no policy row yet.
   */
  static async resolveEffectivePolicyForSchool(
    prisma: PrismaClient,
    schoolId: string,
  ): Promise<PasswordPolicy> {
    const row = await withTenantScope(prisma, schoolId, undefined, (tx) =>
      tx.schoolSecurityPolicy.findUnique({
        where: { schoolId },
        select: {
          passwordMinLength: true,
          passwordRequireUppercase: true,
          passwordRequireLowercase: true,
          passwordRequireNumbers: true,
          passwordRequireSpecialChars: true,
          passwordMaxAge: true,
          passwordPreventReuse: true,
        },
      }),
    );
    if (!row) return { ...DEFAULT_PASSWORD_POLICY };
    return {
      minLength: row.passwordMinLength,
      requireUppercase: row.passwordRequireUppercase,
      requireLowercase: row.passwordRequireLowercase,
      requireNumbers: row.passwordRequireNumbers,
      requireSpecialChars: row.passwordRequireSpecialChars,
      maxAge: row.passwordMaxAge,
      preventReuse: row.passwordPreventReuse,
    };
  }

  /**
   * Resolve the effective password policy for a user across ALL their schools.
   *
   * A password must satisfy every school the user belongs to, so their policies
   * are combined into the STRICTEST single policy. A user with no school gets
   * the platform default.
   */
  static async resolveEffectivePolicyForUser(
    prisma: PrismaClient,
    userId: string,
  ): Promise<PasswordPolicy> {
    // Cross-tenant and about one user → read under the user scope, the grant
    // the sign-in profile lookup uses (migration 20260723090000). Runs on the
    // reset/rotation paths, before any tenant is selected.
    const userTenants = await withUserScope(prisma, userId, (tx) =>
      tx.userTenant.findMany({ where: { userId }, select: { tenantId: true } }),
    );
    const schoolIds = [...new Set(userTenants.map((ut) => ut.tenantId))];
    if (schoolIds.length === 0) return { ...DEFAULT_PASSWORD_POLICY };

    const policies = await Promise.all(
      schoolIds.map((id) => this.resolveEffectivePolicyForSchool(prisma, id)),
    );
    return policies.reduce((strictest, policy) =>
      this.strictestPolicy(strictest, policy),
    );
  }

  /** Combine two policies into the stricter of the two, field by field. */
  private static strictestPolicy(
    a: PasswordPolicy,
    b: PasswordPolicy,
  ): PasswordPolicy {
    const maxAge = Math.min(a.maxAge ?? Infinity, b.maxAge ?? Infinity);
    const preventReuse = Math.max(a.preventReuse ?? 0, b.preventReuse ?? 0);
    return {
      minLength: Math.max(a.minLength, b.minLength),
      requireUppercase: a.requireUppercase || b.requireUppercase,
      requireLowercase: a.requireLowercase || b.requireLowercase,
      requireNumbers: a.requireNumbers || b.requireNumbers,
      requireSpecialChars: a.requireSpecialChars || b.requireSpecialChars,
      maxAge: Number.isFinite(maxAge) ? maxAge : undefined,
      preventReuse: preventReuse > 0 ? preventReuse : undefined,
    };
  }

  /**
   * Validate a password against every school the user belongs to (3.5).
   *
   * The password must satisfy the strictest combination of all the user's
   * school policies, so a forced rotation or reset can never set a password
   * weaker than any of those schools require.
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param password - Password to validate
   * @returns Validation result with errors
   */
  static async validatePasswordAgainstAllSchools(
    prisma: PrismaClient,
    userId: string,
    password: string,
  ): Promise<PasswordValidationResult> {
    const policy = await this.resolveEffectivePolicyForUser(prisma, userId);
    return this.validatePasswordPolicy(password, policy);
  }

  /**
   * Check if password was recently used (prevent reuse) (3.5)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param newPasswordHash - New password hash
   * @param preventReuse - Number of previous passwords to check
   * @returns True if password was recently used
   */
  static async checkPasswordReuse(
    prisma: PrismaClient,
    userId: string,
    newPassword: string,
    preventReuse: number = 5,
  ): Promise<boolean> {
    // Get recent password history
    const passwordHistory = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: preventReuse,
    });

    // Check if new password matches any previous password
    for (const history of passwordHistory) {
      const matches = await this.comparePassword(
        newPassword,
        history.passwordHash,
      );
      if (matches) {
        return true; // Password was recently used
      }
    }

    return false; // Password is new
  }

  /**
   * Save password to history
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param passwordHash - Password hash
   */
  static async savePasswordHistory(
    prisma: PrismaClient,
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await prisma.passwordHistory.create({
      data: {
        userId,
        passwordHash,
      },
    });

    // Keep only last N passwords (preventReuse count)
    // This is handled by cleanup job or can be done here
  }

  /**
   * Check if password is expired (3.5)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param maxAgeDays - Maximum password age in days
   * @returns True if password is expired
   */
  static async isPasswordExpired(
    prisma: PrismaClient,
    userId: string,
    maxAgeDays: number = 90,
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordChangedAt: true },
    });

    if (!user?.passwordChangedAt) {
      // No password set or never changed, not expired
      return false;
    }

    const expirationDate = new Date(user.passwordChangedAt);
    expirationDate.setDate(expirationDate.getDate() + maxAgeDays);

    return new Date() > expirationDate;
  }
}
