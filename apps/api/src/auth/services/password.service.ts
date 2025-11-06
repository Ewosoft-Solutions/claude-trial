/**
 * Password Service
 *
 * Handles password hashing, validation, and policy enforcement.
 * Implements items 3.4 and 3.5.
 */

import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@workspace/database';

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
    if (effectivePolicy.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check special characters requirement
    if (
      effectivePolicy.requireSpecialChars &&
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    ) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate password against all school policies (3.5)
   *
   * User must satisfy password policy for ALL schools they belong to.
   * This ensures password works across all schools.
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
    // Get all schools user belongs to
    const userTenants = await prisma.userTenant.findMany({
      where: { userId },
      include: {
        tenant: {
          // TODO: Include securityPolicy when security policy table is implemented
          // include: {
          //   securityPolicy: true,
          // },
        },
      },
    });

    if (userTenants.length === 0) {
      // No schools, use default policy
      return this.validatePasswordPolicy(password);
    }

    // TODO: Validate against school-specific policies when security policy table is implemented
    // For now, use default policy
    // This will be enhanced when security policy system is implemented (Section 4a)

    // Validate against strictest policy from all schools
    let strictestPolicy: PasswordPolicy | null = null;

    // TODO: When security policy is implemented, uncomment and use actual policy
    // for (const userTenant of userTenants) {
    //   const policy = userTenant.tenant.securityPolicy;
    //   if (policy) {
    //     const schoolPolicy: PasswordPolicy = {
    //       minLength: policy.passwordMinLength || DEFAULT_PASSWORD_POLICY.minLength,
    //       requireUppercase:
    //         policy.passwordRequireUppercase ??
    //         DEFAULT_PASSWORD_POLICY.requireUppercase,
    //       requireLowercase:
    //         policy.passwordRequireLowercase ??
    //         DEFAULT_PASSWORD_POLICY.requireLowercase,
    //       requireNumbers:
    //         policy.passwordRequireNumbers ?? DEFAULT_PASSWORD_POLICY.requireNumbers,
    //       requireSpecialChars:
    //         policy.passwordRequireSpecialChars ??
    //         DEFAULT_PASSWORD_POLICY.requireSpecialChars,
    //       maxAge: policy.passwordMaxAge || DEFAULT_PASSWORD_POLICY.maxAge,
    //       preventReuse:
    //         policy.passwordPreventReuse || DEFAULT_PASSWORD_POLICY.preventReuse,
    //     };
    //
    //     // Use strictest policy (highest requirements)
    //     if (!strictestPolicy) {
    //       strictestPolicy = schoolPolicy;
    //     } else {
    //       strictestPolicy = {
    //         minLength: Math.max(strictestPolicy.minLength, schoolPolicy.minLength),
    //         requireUppercase:
    //           strictestPolicy.requireUppercase || schoolPolicy.requireUppercase,
    //         requireLowercase:
    //           strictestPolicy.requireLowercase || schoolPolicy.requireLowercase,
    //         requireNumbers:
    //           strictestPolicy.requireNumbers || schoolPolicy.requireNumbers,
    //         requireSpecialChars:
    //           strictestPolicy.requireSpecialChars ||
    //           schoolPolicy.requireSpecialChars,
    //         maxAge: Math.min(
    //           strictestPolicy.maxAge || 999,
    //           schoolPolicy.maxAge || 999,
    //         ),
    //         preventReuse: Math.max(
    //           strictestPolicy.preventReuse || 0,
    //           schoolPolicy.preventReuse || 0,
    //         ),
    //       };
    //     }
    //   }
    // }

    // Validate against strictest policy (default for now)
    const effectivePolicy = strictestPolicy || DEFAULT_PASSWORD_POLICY;
    return this.validatePasswordPolicy(password, effectivePolicy);
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
    newPasswordHash: string,
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
        newPasswordHash,
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

    if (!user || !user.passwordChangedAt) {
      // No password set or never changed, not expired
      return false;
    }

    const expirationDate = new Date(user.passwordChangedAt);
    expirationDate.setDate(expirationDate.getDate() + maxAgeDays);

    return new Date() > expirationDate;
  }
}
