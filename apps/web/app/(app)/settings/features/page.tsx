import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { FeaturesSettingsClient } from './features-client';

interface FeaturesResponse {
  features: Record<string, boolean>;
}

export default async function FeaturesSettingsPage() {
  const session = await getSession();
  const data = await serverApiGet<FeaturesResponse>('/tenant/features');

  return (
    <FeaturesSettingsClient
      initialEnabled={data?.features ?? {}}
      schoolName={session?.schools[0]?.name}
    />
  );
}
