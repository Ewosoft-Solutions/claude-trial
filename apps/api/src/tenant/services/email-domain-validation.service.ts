import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import * as dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);

/**
 * Email Domain Validation Service
 *
 * Validates email domains using DNS TXT records.
 * 6.3: Implement optional email domain validation (DNS TXT record)
 */
@Injectable()
export class EmailDomainValidationService {
  /**
   * Validate email domain using DNS TXT record
   *
   * Checks for a TXT record with format: "school-verification=<tenant-id>"
   *
   * @param emailDomain - Email domain to validate
   * @param tenantId - Tenant ID to verify
   * @returns Validation result
   */
  async validateEmailDomain(
    emailDomain: string,
    tenantId: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Resolve TXT records for the domain
      const txtRecords = await resolveTxt(emailDomain);

      // Flatten TXT records (they can be arrays)
      const allRecords = txtRecords.flat();

      // Look for verification record
      const verificationRecord = allRecords.find((record) =>
        record.startsWith('school-verification='),
      );

      if (!verificationRecord) {
        return {
          valid: false,
          error: 'No verification TXT record found for this domain',
        };
      }

      // Extract tenant ID from record
      const recordTenantId = verificationRecord.split('=')[1];

      if (recordTenantId !== tenantId) {
        return {
          valid: false,
          error: 'Verification TXT record does not match tenant ID',
        };
      }

      return { valid: true };
    } catch (error: any) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        return {
          valid: false,
          error: 'Domain not found or has no TXT records',
        };
      }

      return {
        valid: false,
        error: `DNS validation error: ${error.message}`,
      };
    }
  }

  /**
   * Get verification TXT record value
   *
   * Returns the TXT record value that should be added to DNS for verification.
   *
   * @param tenantId - Tenant ID
   * @returns TXT record value
   */
  getVerificationTxtRecord(tenantId: string): string {
    return `school-verification=${tenantId}`;
  }

  /**
   * Validate email matches tenant domain (if configured)
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param email - Email address to validate
   * @returns Validation result
   */
  async validateEmailForTenant(
    prisma: PrismaClient,
    tenantId: string,
    email: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { emailDomain: true },
    });

    if (!tenant) {
      return { valid: false, error: 'Tenant not found' };
    }

    // If no email domain is configured, validation passes
    if (!tenant.emailDomain) {
      return { valid: true };
    }

    // Extract domain from email
    const emailDomain = email.split('@')[1]?.toLowerCase();

    if (!emailDomain) {
      return { valid: false, error: 'Invalid email format' };
    }

    if (emailDomain !== tenant.emailDomain.toLowerCase()) {
      return {
        valid: false,
        error: `Email domain does not match tenant domain (expected: ${tenant.emailDomain})`,
      };
    }

    return { valid: true };
  }
}
