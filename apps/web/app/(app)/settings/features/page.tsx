import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { FeaturesSettingsClient } from './features-client';

interface TenantConfiguration {
  settings?: Record<string, unknown> | null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function boolMap(value: unknown): Record<string, boolean> {
  const source = record(value);
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  );
}

export default async function FeaturesSettingsPage() {
  const session = await getSession();
  const tenantId = session?.defaultSchoolId;
  const configuration = tenantId
    ? await serverApiGet<TenantConfiguration>(`/tenant/${tenantId}/configuration`)
    : null;
  const settings = record(configuration?.settings);

  return (
    <FeaturesSettingsClient
      initialEnabled={boolMap(settings.features ?? settings.modules)}
      schoolName={session?.schools[0]?.name}
    />
  );
}
