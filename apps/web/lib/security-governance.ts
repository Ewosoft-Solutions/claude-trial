export type BiometricEnrollmentPolicy = 'require' | 'allow' | 'forbid';

export interface SensitiveOperationPolicy {
  id: string | null;
  operation: string;
  label: string;
  description: string;
  category:
    | 'governance'
    | 'financial'
    | 'account_security'
    | 'data_protection'
    | 'platform';
  enabled: boolean;
  requiresStepUp: boolean;
  requiresMakerChecker: boolean;
  freshnessMinutes: number;
  requiredClearanceLevel: number;
  requiredPermission: string | null;
  updatedAt: string | null;
}

export interface SensitiveOperationChangeRequest {
  id: string;
  tenantId: string;
  operation: string;
  requestedEnabled: boolean | null;
  requestedRequiresStepUp: boolean | null;
  requestedRequiresMakerChecker: boolean | null;
  requestedFreshnessMinutes: number | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  reviewedBy: string | null;
  feedback: string | null;
  reviewedAt: string | null;
  createdAt: string;
  tenant?: { id: string; name: string; slug: string | null };
}

export const SECURITY_CATEGORY_LABELS: Record<
  SensitiveOperationPolicy['category'],
  string
> = {
  governance: 'Governance & access',
  financial: 'Financial controls',
  account_security: 'Account security',
  data_protection: 'Protected data',
  platform: 'Platform operations',
};
