import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { BrandingSettingsClient } from './branding-client';

interface TenantConfiguration {
  settings?: Record<string, unknown> | null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export default async function BrandingSettingsPage() {
  const session = await getSession();
  const tenantId = session?.defaultSchoolId;
  const configuration = tenantId
    ? await serverApiGet<TenantConfiguration>(`/tenant/${tenantId}/configuration`)
    : null;
  const branding = record(record(configuration?.settings).branding);

  return (
    <BrandingSettingsClient
      initialColor={text(branding.primaryColor)}
      initialTheme={text(branding.theme)}
    />
  );
}
