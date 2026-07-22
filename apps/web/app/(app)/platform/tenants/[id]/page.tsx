'use client';

/* ============================================================
   /platform/tenants/[id] — tenant detail (facet-gated)

   Identity fields render for any platform.tenants.read holder. The
   internals card (JWT rotation state, security policy) only appears
   when the API includes them — i.e. the viewer holds
   platform.tenants.inspect (Architect). A SuperAdmin sees identity
   only; the internals are omitted server-side, not hidden client-side.
   See docs/platform-scope-plan.md §7.2.
   ============================================================ */

import Link from 'next/link';
import { use } from 'react';
import useSWR from 'swr';
import { ArrowLeft, Building2, KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';

interface JwtConfig {
  id: string;
  secretRotationDate: string | null;
  rotationReason: string | null;
  emergencyRotation: boolean;
}
interface SecurityPolicy {
  id: string;
  policyTier: string;
  requireMFA: boolean;
  auditLevel: string;
}
interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  schoolType: string | null;
  emailDomain: string | null;
  createdAt: string;
  // Present only for platform.tenants.inspect holders.
  jwtConfig?: JwtConfig | null;
  securityPolicy?: SecurityPolicy | null;
}

const STATUS_TONE: Record<string, StateTone> = {
  active: 'success',
  pending: 'info',
  suspended: 'warning',
};

export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const {
    data: tenant,
    error: loadError,
    isLoading: loading,
  } = useSWR<TenantDetail>(`/api/platform/schools/${id}`);

  // `securityPolicy` is the marker: the API includes it only for an inspect
  // holder, so its presence (either key) tells us the internals were returned.
  const canInspect =
    tenant != null &&
    ('securityPolicy' in tenant || 'jwtConfig' in tenant);

  const error =
    loadError instanceof Error
      ? loadError.message
      : loadError
        ? 'Failed to load school'
        : null;

  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/platform/tenants/all">
            <ArrowLeft className="size-4" /> All schools
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : loading || !tenant ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <Building2 className="size-5" /> {tenant.name}
              </h1>
              <p className="text-sm text-muted-foreground">{tenant.slug}</p>
            </div>
            <StatusBadge tone={STATUS_TONE[tenant.status] ?? 'neutral'} dot>
              {tenant.status}
            </StatusBadge>
          </div>

          {/* Identity — always available (platform.tenants.read) */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Identity</CardTitle>
              <CardDescription>School registration details</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Field label="Type" value={tenant.schoolType?.replace('_', ' ') ?? '—'} />
              <Field label="Email domain" value={tenant.emailDomain ?? '—'} />
              <Field
                label="Registered"
                value={new Date(tenant.createdAt).toLocaleDateString()}
              />
              <Field label="Slug" value={tenant.slug} mono />
            </CardContent>
          </Card>

          {/* Internals — only when the API returned them (inspect facet) */}
          {canInspect ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="size-4" /> Security policy
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  {tenant.securityPolicy ? (
                    <>
                      <Field label="Tier" value={tenant.securityPolicy.policyTier} />
                      <Field
                        label="Require MFA"
                        value={tenant.securityPolicy.requireMFA ? 'Yes' : 'No'}
                      />
                      <Field label="Audit level" value={tenant.securityPolicy.auditLevel} />
                    </>
                  ) : (
                    <p className="text-muted-foreground">No policy configured.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <KeyRound className="size-4" /> JWT state
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  {tenant.jwtConfig ? (
                    <>
                      <Field
                        label="Last rotation"
                        value={
                          tenant.jwtConfig.secretRotationDate
                            ? new Date(
                                tenant.jwtConfig.secretRotationDate,
                              ).toLocaleDateString()
                            : '—'
                        }
                      />
                      <Field
                        label="Reason"
                        value={tenant.jwtConfig.rotationReason ?? '—'}
                      />
                      <Field
                        label="Emergency"
                        value={tenant.jwtConfig.emergencyRotation ? 'Yes' : 'No'}
                      />
                    </>
                  ) : (
                    <p className="text-muted-foreground">No JWT config.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="shadow-card border-dashed">
              <CardContent className="py-4 text-sm text-muted-foreground">
                Security policy and JWT state require the{' '}
                <code className="text-xs">platform.tenants.inspect</code>{' '}
                permission (Architect).
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono text-xs' : 'font-medium text-foreground'}>
        {value}
      </span>
    </div>
  );
}
