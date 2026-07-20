'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Building2, ShieldCheck } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { NoticeBanner } from '@workspace/ui/custom/states/notice-banner';

import type { SessionLifecyclePolicy } from '@/lib/session';
import { SessionSecurityForm } from '../../../settings/security/session-security-form';
import { PlatformSecurityGovernance } from './platform-security-governance';

interface School {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export default function PlatformSecuritySettingsPage() {
  const { data: schoolData, error: schoolsError } = useSWR<{ data: School[] }>(
    '/api/platform/schools?limit=100',
  );
  const schools = schoolData?.data ?? [];
  const [tenantId, setTenantId] = React.useState('');
  const selectedId = tenantId || schools[0]?.id || '';
  const selected = schools.find((school) => school.id === selectedId);
  const {
    data: policy,
    error: policyError,
    isLoading,
  } = useSWR<SessionLifecyclePolicy>(
    selectedId ? `/api/platform/session-policy/${selectedId}` : null,
  );

  const error = schoolsError ?? policyError;

  return (
    <div className="flex flex-col gap-5 py-6">
      <PageHeader
        title="Session security"
        description="Set inactivity protection for each school within the platform safety limits."
      />

      {error ? (
        <NoticeBanner
          tone="destructive"
          role="alert"
          title={
            error instanceof Error
              ? error.message
              : 'Could not load session policy.'
          }
        />
      ) : null}

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Building2 className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base">School</CardTitle>
              <CardDescription>
                Choose the tenant whose effective inactivity policy you want to
                manage.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <label htmlFor="security-tenant" className="sr-only">
            School
          </label>
          <select
            id="security-tenant"
            value={selectedId}
            onChange={(event) => setTenantId(event.target.value)}
            className="h-10 w-full max-w-xl rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name} · {school.slug}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card className="grid min-h-52 place-items-center shadow-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4" /> Loading policy…
          </div>
        </Card>
      ) : policy && selected ? (
        <SessionSecurityForm
          key={selected.id}
          initialPolicy={policy}
          endpoint={`/api/platform/session-policy/${selected.id}`}
          canEdit
          tenantName={selected.name}
        />
      ) : null}

      <PlatformSecurityGovernance />
    </div>
  );
}
